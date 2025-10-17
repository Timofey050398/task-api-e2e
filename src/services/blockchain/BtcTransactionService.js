import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import ecc from "tiny-secp256k1";
import { BlockchainTransactionService } from "./BlockchainTransactionService.js";
import {Currencies} from "../../model/Currency";

const ECPair = ECPairFactory(ecc);
const ONE_MINUTE = 60 * 1000;

export class BtcTransactionService extends BlockchainTransactionService {
    constructor(options = {}) {
        super({
            ...options,
            network: "BTC",
            recommendedConfirmationTimeMs: options.recommendedConfirmationTimeMs ?? 30 * ONE_MINUTE,
            pollIntervalMs: options.pollIntervalMs ?? 30 * 1000,
        });

        this.bitcoinNetwork = resolveBitcoinNetwork(options.bitcoinNetwork ?? "mainnet");
        this.logger = options.logger ?? console;
        this.utxoProvider = options.utxoProvider ?? createBlockstreamUtxoProvider({ logger: this.logger });
        this.feeRateProvider = options.feeRateProvider ?? createMempoolFeeRateProvider({ logger: this.logger });
        this.broadcastProvider = options.broadcastProvider ?? broadcastViaBlockstream;
        this.currency = Currencies.BTC;
    }

    async send(to, value, currency = this.currency) {
        if (currency?.network && currency.network !== this.network) {
            throw new Error("Only BTC network supported");
        }

        return this.sendTransaction(to, value);
    }

    async sendTransaction(recipientAddress, sendValue) {
        const senderAddress = process.env.BTC_ADDRESS;
        const privateKeyWIF = process.env.BTC_PRIVATE_KEY;

        if (!senderAddress || !privateKeyWIF) {
            throw new Error("BTC_ADDRESS or BTC_PRIVATE_KEY missing from .env");
        }

        const keyPair = ECPair.fromWIF(privateKeyWIF, this.bitcoinNetwork);

        const utxos = await this.utxoProvider(senderAddress);
        if (!utxos.length) throw new Error("No UTXO found for sender address");

        const feeRate = await this.feeRateProvider();

        const {
            selectedUtxos,
            fee,
            changeValue,
        } = selectUtxosForAmount({
            utxos,
            sendValue,
            feeRate,
            senderAddress,
            bitcoinNetwork: this.bitcoinNetwork,
        });

        const outputs = [
            { address: recipientAddress, value: sendValue },
        ];
        if (changeValue >= DUST_THRESHOLD) {
            outputs.push({ address: senderAddress, value: changeValue });
        }

        const psbt = new bitcoin.Psbt({ network: this.bitcoinNetwork });
        selectedUtxos.forEach((input) => psbt.addInput(input));
        outputs.forEach((o) => psbt.addOutput(o));
        psbt.signAllInputs(keyPair);
        psbt.finalizeAllInputs();

        const tx = psbt.extractTransaction();
        const rawHex = tx.toHex();
        const txid = tx.getId();

        const res = await this.broadcastProvider(rawHex);

        return {
            txid: res.txid ?? txid,
            sentAmount: sendValue,
            fee,
        };
    }
}

const DUST_THRESHOLD = 546;

/** Получение UTXO через Blockstream API */
function createBlockstreamUtxoProvider({ logger, timeoutMs = 10_000, retries = 3 } = {}) {
    return async (address) => {
        const url = `https://blockstream.info/api/address/${address}/utxo`;
        return retry(async () => {
            const res = await fetchWithTimeout(url, { timeoutMs });
            if (!res.ok) throw new Error(`UTXO fetch failed: ${res.status}`);
            return res.json();
        }, { retries, logger });
    };
}

/** Получение средней комиссии */
function createMempoolFeeRateProvider({ logger, timeoutMs = 10_000, retries = 3 } = {}) {
    return async () => {
        return retry(async () => {
            const res = await fetchWithTimeout("https://mempool.space/api/v1/fees/recommended", { timeoutMs });
            if (!res.ok) throw new Error(`Fee rate fetch failed: ${res.status}`);
            const data = await res.json();
            return data.fastestFee || 15; // сатоши за байт
        }, { retries, fallback: () => 10, logger });
    };
}

/** Отправка транзакции в сеть */
async function broadcastViaBlockstream(rawTx) {
    const res = await fetchWithTimeout("https://blockstream.info/api/tx", {
        timeoutMs: 15_000,
        fetchOptions: {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: rawTx,
        },
    });
    if (!res.ok) throw new Error(`Broadcast failed: ${await res.text()}`);
    const txid = await res.text();
    console.log(`✅ Broadcasted: ${txid}`);
    return { txid };
}

function selectUtxosForAmount({ utxos, sendValue, feeRate, senderAddress, bitcoinNetwork }) {
    const sorted = [...utxos].sort((a, b) => b.value - a.value);
    const selectedUtxos = [];
    let total = 0;

    for (const utxo of sorted) {
        selectedUtxos.push({
            hash: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
                script: bitcoin.address.toOutputScript(senderAddress, bitcoinNetwork),
                value: utxo.value,
            },
        });
        total += utxo.value;

        const { fee, changeValue } = calculateFeeAndChange({
            totalInputValue: total,
            inputCount: selectedUtxos.length,
            sendValue,
            feeRate,
        });

        if (total >= sendValue + fee) {
            return { selectedUtxos, fee, changeValue };
        }
    }

    const { fee } = calculateFeeAndChange({
        totalInputValue: total,
        inputCount: selectedUtxos.length,
        sendValue,
        feeRate,
    });

    throw new Error(`Insufficient balance. Available: ${total}, need: ${sendValue + fee}`);
}

function calculateFeeAndChange({ totalInputValue, inputCount, sendValue, feeRate }) {
    const baseOutputs = 1;
    let fee = estimateFee({ inputCount, outputCount: baseOutputs, feeRate });
    let changeValue = totalInputValue - sendValue - fee;

    if (changeValue >= DUST_THRESHOLD) {
        fee = estimateFee({ inputCount, outputCount: baseOutputs + 1, feeRate });
        changeValue = totalInputValue - sendValue - fee;
        if (changeValue < DUST_THRESHOLD) {
            fee = estimateFee({ inputCount, outputCount: baseOutputs, feeRate });
            changeValue = 0;
        }
    } else if (changeValue < 0) {
        // fee is too high, treat change as dust and recompute without change output
        fee = estimateFee({ inputCount, outputCount: baseOutputs, feeRate });
        changeValue = totalInputValue - sendValue - fee;
    }

    return { fee, changeValue: Math.max(changeValue, 0) };
}

function estimateFee({ inputCount, outputCount, feeRate }) {
    const estimatedVBytes = inputCount * 148 + outputCount * 34 + 10;
    return Math.ceil(estimatedVBytes * feeRate);
}

async function fetchWithTimeout(url, { timeoutMs = 10_000, fetchOptions = {} } = {}) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...fetchOptions, signal: controller.signal });
    } catch (error) {
        if (error.name === "AbortError") {
            throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
        }
        throw error;
    } finally {
        clearTimeout(id);
    }
}

async function retry(fn, { retries = 3, fallback = null, logger = console }) {
    let attempt = 0;
    while (attempt < retries) {
        try {
            return await fn();
        } catch (error) {
            attempt += 1;
            logger?.warn?.(`BTC provider error (attempt ${attempt}/${retries}):`, error.message ?? error);
            if (attempt >= retries) {
                if (fallback !== null) {
                    return typeof fallback === "function" ? fallback() : fallback;
                }
                throw error;
            }
        }
    }

    return typeof fallback === "function" ? fallback() : fallback;
}

function resolveBitcoinNetwork(name = "mainnet") {
    switch (name) {
        case "testnet": return bitcoin.networks.testnet;
        case "regtest": return bitcoin.networks.regtest ?? bitcoin.networks.testnet;
        default: return bitcoin.networks.bitcoin;
    }
}