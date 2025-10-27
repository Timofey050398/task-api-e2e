import * as bitcoin from "bitcoinjs-lib";
import {selectUtxosForAmount} from "./providers";
import {Buffer} from "buffer";
import {Currencies} from "../../../model/Currency";

/**
 * bitcoinjs-lib expects ECPair signers to expose Buffer-based keys/signatures,
 * while ecpair@3 returns Uint8Array values. Normalize the pair to Buffers so
 * PSBT signing works reliably across environments.
 */
function ensureBufferKeyPair(keyPair) {
    if (!keyPair) {
        return keyPair;
    }

    const normalized = Object.create(Object.getPrototypeOf(keyPair));
    Object.assign(normalized, keyPair);

    const toBuffer = (value) => (Buffer.isBuffer(value) ? value : Buffer.from(value));

    if (normalized.publicKey) {
        Object.defineProperty(normalized, 'publicKey', {
            value: toBuffer(normalized.publicKey),
            writable: false,
            enumerable: true,
        });
    }

    if (normalized.privateKey) {
        Object.defineProperty(normalized, 'privateKey', {
            value: toBuffer(normalized.privateKey),
            writable: false,
            enumerable: true,
        });
    }

    const originalSign = typeof keyPair.sign === 'function' ? keyPair.sign.bind(keyPair) : null;
    if (originalSign) {
        Object.defineProperty(normalized, 'sign', {
            value: (hash, lowR) => {
                const signature = originalSign(hash, lowR);
                return toBuffer(signature);
            },
        });
    }

    const originalSignSchnorr = typeof keyPair.signSchnorr === 'function'
        ? keyPair.signSchnorr.bind(keyPair)
        : null;
    if (originalSignSchnorr) {
        Object.defineProperty(normalized, 'signSchnorr', {
            value: (hash) => toBuffer(originalSignSchnorr(hash)),
        });
    }

    return normalized;
}

function deriveNativeSegwitAddress(keyPair, network) {
    const payment = bitcoin.payments.p2wpkh({
        pubkey: Buffer.isBuffer(keyPair.publicKey)
            ? keyPair.publicKey
            : Buffer.from(keyPair.publicKey),
        network,
    });

    return payment.address;
}

export class BtcTxSender {
    constructor(btcService) {
        this.btcService = btcService;
    }

    async sendTransaction(recipientAddress, sendValueSatoshis, humanAmount = sendValueSatoshis) {
        this.btcService.logger?.info?.('[BTC] Preparing transaction', {
            recipientAddress,
            amount: humanAmount,
            satoshis: sendValueSatoshis,
        });

        try {
            const senderAddress = process.env.BTC_ADDRESS;
            const privateKeyWIF = process.env.BTC_PRIVATE_KEY;

            if (!senderAddress || !privateKeyWIF) {
                throw new Error('BTC_ADDRESS or BTC_PRIVATE_KEY missing from .env');
            }

            const keyPair = ensureBufferKeyPair(this.btcService.ecpair.fromWIF(privateKeyWIF, this.btcService.bitcoinNetwork));

            const senderConfig = {
                senderAddress,
                network: this.btcService.bitcoinNetworkName,
            };
            this.btcService.logger?.info?.('[BTC] Sender configuration loaded', senderConfig);

            try {
                bitcoin.address.toOutputScript(senderAddress, this.btcService.bitcoinNetwork);
            } catch (addressError) {
                throw new Error(
                    `BTC_ADDRESS ${senderAddress} is invalid for ${this.btcService.bitcoinNetworkName}: ${addressError.message}`,
                );
            }

            const derivedSegwitAddress = deriveNativeSegwitAddress(keyPair, this.btcService.bitcoinNetwork);
            const isSegwitAddress = senderAddress?.toLowerCase?.().startsWith('bc1')
                || senderAddress?.toLowerCase?.().startsWith('tb1');
            if (isSegwitAddress && derivedSegwitAddress && derivedSegwitAddress !== senderAddress) {
                const mismatchError = new Error(
                    `Derived address ${derivedSegwitAddress} does not match BTC_ADDRESS ${senderAddress} for ${this.btcService.bitcoinNetworkName}`,
                );
                this.btcService.logger?.error?.('[BTC] Sender address mismatch', {
                    ...senderConfig,
                    derivedAddress: derivedSegwitAddress,
                });
                throw mismatchError;
            }

            const utxos = await this.btcService.utxoProvider(senderAddress);
            if (!utxos.length) throw new Error('No UTXO found for sender address');

            const totalUtxoValue = utxos.reduce((acc, utxo) => acc + (utxo.value ?? 0), 0);
            this.btcService.logger?.info?.('[BTC] Retrieved UTXO set', {
                count: utxos.length,
                totalValue: totalUtxoValue,
            });

            const feeRate = await this.btcService.feeRateProvider();

            this.btcService.logger?.info?.('[BTC] Fee rate resolved', { feeRate });

            const {
                selectedUtxos,
                fee,
                changeValue,
            } = selectUtxosForAmount({
                utxos,
                sendValue: sendValueSatoshis,
                feeRate,
            });

            const outputs = [
                { address: recipientAddress, value: sendValueSatoshis },
            ];
            if (changeValue > 0) {
                outputs.push({ address: senderAddress, value: changeValue });
            }

            const psbt = new bitcoin.Psbt({ network: this.btcService.bitcoinNetwork });
            const senderOutputScript = bitcoin.address.toOutputScript(senderAddress, this.btcService.bitcoinNetwork);

            const txHexCache = new Map();
            const psbtInputs = await Promise.all(
                selectedUtxos.map(async (input) => {
                    if (isSegwitAddress) {
                        return {
                            hash: input.hash,
                            index: input.index,
                            witnessUtxo: {
                                script: senderOutputScript,
                                value: input.value,
                            },
                        };
                    }

                    if (!this.btcService.txProvider) {
                        throw new Error('No BTC transaction provider configured for non-SegWit inputs');
                    }

                    let rawTxHex = txHexCache.get(input.hash);
                    if (!rawTxHex) {
                        rawTxHex = await this.btcService.txProvider(input.hash);
                        txHexCache.set(input.hash, rawTxHex);
                    }
                    if (!rawTxHex) {
                        throw new Error(`Unable to fetch raw transaction for input ${input.hash}:${input.index}`);
                    }

                    return {
                        hash: input.hash,
                        index: input.index,
                        nonWitnessUtxo: Buffer.from(rawTxHex, 'hex'),
                    };
                }),
            );

            psbtInputs.forEach((input) => psbt.addInput(input));
            outputs.forEach((o) => psbt.addOutput(o));
            psbt.signAllInputs(keyPair);
            psbt.finalizeAllInputs();

            const tx = psbt.extractTransaction();
            const rawHex = tx.toHex();
            const txid = tx.getId();

            const res = await this.btcService.broadcastProvider(rawHex);
            const result = {
                currency: Currencies.BTC,
                txHash: res.txid ?? txid,
                sentAmount: humanAmount,
                fee,
            };

            this.btcService.logger?.info?.('[BTC] Transaction broadcasted', result);

            try {
                await this.btcService.waitForConfirmation(result.txHash);
            } catch (error) {
                this.btcService.logger?.error?.('[BTC] Confirmation error', error);
                throw error;
            }

            return result;
        } catch (error) {
            this.btcService.logger?.error?.('[BTC] Failed to send transaction', error);
            throw error;
        }
    }


}