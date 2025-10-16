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
        this.broadcastProvider = options.broadcastProvider ?? broadcastViaBlockstream;
        this.currency = Currencies.BTC;
    }

    async sendTransaction(recipientAddress, sendValue) {
        const senderAddress = process.env.BTC_ADDRESS;
        const privateKeyWIF = process.env.BTC_PRIVATE_KEY;

        if (!senderAddress || !privateKeyWIF) {
            throw new Error("BTC_ADDRESS or BTC_PRIVATE_KEY missing from .env");
        }

        const keyPair = ECPair.fromWIF(privateKeyWIF, this.bitcoinNetwork);

        const utxos = await fetchUtxos(senderAddress);
        if (!utxos.length) throw new Error("No UTXO found for sender address");

        const utxo = utxos[0];
        const utxoValue = utxo.value;

        const input = {
            hash: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
                script: bitcoin.address.toOutputScript(senderAddress, this.bitcoinNetwork),
                value: utxoValue,
            },
        };

        const estimatedVBytes = 180 + 34 * 2 + 10;
        const feeRate = await fetchFeeRate();
        const fee = Math.ceil(estimatedVBytes * feeRate);

        if (utxoValue < sendValue + fee) {
            throw new Error(`Insufficient balance. Available: ${utxoValue}, need: ${sendValue + fee}`);
        }

        const changeValue = utxoValue - sendValue - fee;

        const outputs = [
            { address: recipientAddress, value: sendValue },
        ];
        if (changeValue > 546) { // если сдача не пыль
            outputs.push({ address: senderAddress, value: changeValue });
        }

        const psbt = new bitcoin.Psbt({ network: this.bitcoinNetwork });
        psbt.addInput(input);
        outputs.forEach(o => psbt.addOutput(o));
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

/** Получение UTXO через Blockstream API */
async function fetchUtxos(address) {
    const url = `https://blockstream.info/api/address/${address}/utxo`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`UTXO fetch failed: ${res.status}`);
    return await res.json();
}

/** Получение средней комиссии */
async function fetchFeeRate() {
    try {
        const res = await fetch("https://mempool.space/api/v1/fees/recommended");
        const data = await res.json();
        return data.fastestFee || 15; // сатоши за байт
    } catch {
        return 10;
    }
}

/** Отправка транзакции в сеть */
async function broadcastViaBlockstream(rawTx) {
    const res = await fetch("https://blockstream.info/api/tx", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: rawTx,
    });
    if (!res.ok) throw new Error(`Broadcast failed: ${await res.text()}`);
    const txid = await res.text();
    console.log(`✅ Broadcasted: ${txid}`);
    return { txid };
}

function resolveBitcoinNetwork(name = "mainnet") {
    switch (name) {
        case "testnet": return bitcoin.networks.testnet;
        case "regtest": return bitcoin.networks.regtest ?? bitcoin.networks.testnet;
        default: return bitcoin.networks.bitcoin;
    }
}