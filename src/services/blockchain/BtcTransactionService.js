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

        const networkName = resolveBitcoinNetworkName(options.bitcoinNetwork);
        this.bitcoinNetwork = resolveBitcoinNetwork(networkName);
        this.bitcoinNetworkName = networkName;

        const blockstreamBaseUrlCandidate =
            options.blockstreamApiBaseUrl ?? process.env.BTC_BLOCKSTREAM_API_BASE_URL;
        this.blockstreamApiBaseUrl = resolveBlockstreamApiBaseUrl(
            blockstreamBaseUrlCandidate,
            this.bitcoinNetworkName,
        );

        const mempoolBaseUrlCandidate = options.mempoolApiBaseUrl ?? process.env.BTC_MEMPOOL_API_BASE_URL;
        this.mempoolApiBaseUrl = resolveMempoolApiBaseUrl(mempoolBaseUrlCandidate, this.bitcoinNetworkName);

        this.utxoProvider = options.utxoProvider ?? createBlockstreamUtxoProvider({
            logger: this.logger,
            apiBaseUrl: this.blockstreamApiBaseUrl,
        });
        this.feeRateProvider =
            options.feeRateProvider ?? createMempoolFeeRateProvider({
                logger: this.logger,
                apiBaseUrl: this.mempoolApiBaseUrl,
            });
        this.broadcastProvider = options.broadcastProvider ?? createBlockstreamBroadcastProvider({
            apiBaseUrl: this.blockstreamApiBaseUrl,
            logger: this.logger,
        });
        this.currency = Currencies.BTC;

        if (!this.statusProvider) {
            this.setStatusProvider(
                createBlockstreamStatusProvider({
                    apiBaseUrl: this.blockstreamApiBaseUrl,
                    logger: this.logger,
                }),
            );
        }
    }

    async send(to, value, currency = this.currency) {
        if (currency?.network && currency.network !== this.network) {
            throw new Error("Only BTC network supported");
        }

        const { satoshis, humanAmount } = normalizeBtcAmount(value);

        return this.sendTransaction(to, satoshis, humanAmount);
    }

    async sendTransaction(recipientAddress, sendValueSatoshis, humanAmount = sendValueSatoshis) {
        this.logger?.info?.("[BTC] Preparing transaction", {
            recipientAddress,
            amount: humanAmount,
            satoshis: sendValueSatoshis,
        });

        try {
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
                sendValue: sendValueSatoshis,
                feeRate,
                senderAddress,
                bitcoinNetwork: this.bitcoinNetwork,
            });

            const outputs = [
                { address: recipientAddress, value: sendValueSatoshis },
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
            const result = {
                currency: Currencies.BTC,
                txHash: res.txid ?? txid,
                sentAmount: humanAmount,
                fee,
            };

            this.logger?.info?.("[BTC] Transaction broadcasted", result);

            try {
                await this.waitForConfirmation(result.txHash);
            } catch (error) {
                this.logger?.error?.("[BTC] Confirmation error", error);
                throw error;
            }

            return result;
        } catch (error) {
            this.logger?.error?.("[BTC] Failed to send transaction", error);
            throw error;
        }
    }
}

const DUST_THRESHOLD = 546;

/** Получение UTXO через Blockstream API */
function createBlockstreamUtxoProvider({ logger, timeoutMs = 10_000, retries = 3, apiBaseUrl = "https://blockstream.info/api" } = {}) {
    return async (address) => {
        const base = apiBaseUrl.replace(/\/$/, "");
        const url = `${base}/address/${address}/utxo`;
        return retry(async () => {
            const res = await fetchWithTimeout(url, { timeoutMs });
            if (!res.ok) throw new Error(`UTXO fetch failed: ${res.status}`);
            return res.json();
        }, { retries, logger });
    };
}

/** Получение средней комиссии */
function createMempoolFeeRateProvider({ logger, timeoutMs = 10_000, retries = 3, apiBaseUrl } = {}) {
    return async () => {
        return retry(async () => {
            const base = (apiBaseUrl ?? "https://mempool.space/api").replace(/\/$/, "");
            const res = await fetchWithTimeout(`${base}/v1/fees/recommended`, { timeoutMs });
            if (!res.ok) throw new Error(`Fee rate fetch failed: ${res.status}`);
            const data = await res.json();
            return data.fastestFee || 15; // сатоши за байт
        }, { retries, fallback: () => 10, logger });
    };
}

/** Отправка транзакции в сеть */
function createBlockstreamBroadcastProvider({ apiBaseUrl = "https://blockstream.info/api", logger } = {}) {
    const baseUrl = apiBaseUrl.replace(/\/$/, "");
    return async (rawTx) => {
        const res = await fetchWithTimeout(`${baseUrl}/tx`, {
            timeoutMs: 15_000,
            fetchOptions: {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: rawTx,
            },
        });
        if (!res.ok) {
            const message = await res.text();
            logger?.error?.("[BTC] Broadcast error", message);
            throw new Error(`Broadcast failed: ${message}`);
        }
        const txid = await res.text();
        console.log(`✅ Broadcasted: ${txid}`);
        return { txid };
    };
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

function resolveBitcoinNetworkName(optionsNetwork) {
    const envNetwork = process.env.BTC_NETWORK?.trim();
    return (envNetwork || optionsNetwork || "mainnet").toLowerCase();
}

function resolveBitcoinNetwork(name = "mainnet") {
    switch (name) {
        case "testnet": return bitcoin.networks.testnet;
        case "regtest": return bitcoin.networks.regtest ?? bitcoin.networks.testnet;
        default: return bitcoin.networks.bitcoin;
    }
}

function resolveMempoolApiBaseUrl(customUrl, networkName = "mainnet") {
    if (customUrl) {
        return customUrl.replace(/\/$/, "");
    }

    switch (networkName) {
        case "testnet":
        case "regtest":
            return "https://mempool.space/testnet/api";
        default:
            return "https://mempool.space/api";
    }
}

function resolveBlockstreamApiBaseUrl(customUrl, networkName = "mainnet") {
    if (customUrl) {
        return customUrl.replace(/\/$/, "");
    }

    switch (networkName) {
        case "testnet":
        case "regtest":
            return "https://blockstream.info/testnet/api";
        default:
            return "https://blockstream.info/api";
    }
}

function createBlockstreamStatusProvider({ apiBaseUrl, logger, timeoutMs = 10_000, retries = 5 } = {}) {
    if (!apiBaseUrl) {
        throw new Error("apiBaseUrl is required for Blockstream status provider");
    }

    const baseUrl = apiBaseUrl.replace(/\/$/, "");

    return async (txId) => {
        const url = `${baseUrl}/tx/${txId}`;

        try {
            const response = await retry(
                async () => {
                    const res = await fetchWithTimeout(url, { timeoutMs });
                    if (res.status === 404) {
                        return { confirmed: false };
                    }

                    if (!res.ok) {
                        throw new Error(`Status fetch failed: ${res.status}`);
                    }

                    return res.json();
                },
                { retries, logger },
            );

            if (!response) {
                return { confirmed: false };
            }

            if (response.confirmed === false) {
                return { confirmed: false };
            }

            const status = response.status ?? response;
            if (status && typeof status === "object") {
                return { confirmed: Boolean(status.confirmed), status };
            }

            return { confirmed: false, status };
        } catch (error) {
            logger?.warn?.("[BTC] Status check error", error?.message ?? error);
            return { confirmed: false, error };
        }
    };
}

function normalizeBtcAmount(amount) {
    if (typeof amount === "bigint") {
        const satoshisBigInt = amount;
        if (satoshisBigInt < 0n) {
            throw new Error("BTC amount must be positive");
        }

        if (satoshisBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
            throw new Error("BTC amount exceeds safe integer range");
        }

        const satoshis = Number(satoshisBigInt);
        return {
            satoshis,
            humanAmount: formatBtcFromSatoshis(satoshisBigInt),
        };
    }

    if (typeof amount === "number") {
        if (!Number.isFinite(amount)) {
            throw new Error("BTC amount must be a finite number");
        }
        if (amount < 0) {
            throw new Error("BTC amount must be positive");
        }

        const satoshis = Math.round(amount * 100_000_000);

        if (!Number.isSafeInteger(satoshis)) {
            throw new Error("BTC amount exceeds safe integer range");
        }

        const normalized = satoshis / 100_000_000;
        if (Math.abs(normalized - amount) > Number.EPSILON) {
            throw new Error("BTC amount precision exceeds 8 decimal places");
        }

        return {
            satoshis,
            humanAmount: formatBtcFromSatoshis(BigInt(satoshis)),
        };
    }

    if (typeof amount === "string") {
        const trimmed = amount.trim();
        if (!/^\d+(\.\d+)?$/.test(trimmed)) {
            throw new Error("BTC amount must be a non-negative decimal string");
        }

        const [integerPartRaw, fractionalRaw = ""] = trimmed.split(".");
        if (fractionalRaw.length > 8 && /[1-9]/.test(fractionalRaw.slice(8))) {
            throw new Error("BTC amount precision exceeds 8 decimal places");
        }

        const integerPart = integerPartRaw === "" ? "0" : integerPartRaw;
        const fractionalPart = (fractionalRaw + "0".repeat(8)).slice(0, 8);

        const satoshiString = `${integerPart}${fractionalPart}`.replace(/^0+(?=\d)/, "");
        const satoshisBigInt = BigInt(satoshiString === "" ? "0" : satoshiString);

        if (satoshisBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
            throw new Error("BTC amount exceeds safe integer range");
        }

        return {
            satoshis: Number(satoshisBigInt),
            humanAmount: formatBtcFromSatoshis(satoshisBigInt),
        };
    }

    throw new Error("Unsupported BTC amount type");
}

function formatBtcFromSatoshis(value) {
    const bigIntValue = typeof value === "bigint" ? value : BigInt(value);
    const negative = bigIntValue < 0n;
    const absValue = negative ? -bigIntValue : bigIntValue;
    const integerPart = absValue / 100_000_000n;
    const fractionalPart = absValue % 100_000_000n;
    const fractional = fractionalPart.toString().padStart(8, "0");
    const normalizedFractional = fractional.replace(/0+$/, "");
    const result = normalizedFractional ? `${integerPart.toString()}.${normalizedFractional}` : integerPart.toString();
    return negative ? `-${result}` : result;
}
