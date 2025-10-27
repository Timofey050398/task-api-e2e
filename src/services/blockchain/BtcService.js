import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { BlockchainService } from './BlockchainService.js';
import { Currencies } from '../../model/Currency.js';
import { normalizeBtcAmount } from './btc/amount.js';
import {
    createBlockstreamBroadcastProvider,
    createBlockstreamTxProvider,
    createBlockstreamStatusProvider,
    createBlockstreamUtxoProvider,
    createMempoolFeeRateProvider,
    selectUtxosForAmount,
} from './btc/providers.js';
import {
    resolveBitcoinNetwork,
    resolveBitcoinNetworkName,
    resolveBlockstreamApiBaseUrl,
    resolveMempoolApiBaseUrl,
} from './btc/config.js';
import { ONE_MINUTE_MS } from './btc/constants.js';
import {Buffer} from "buffer";

let defaultECPair = null;

function resolveECPair(pairFactory = ECPairFactory, eccLib = ecc) {
    if (defaultECPair) {
        return defaultECPair;
    }

    defaultECPair = pairFactory(eccLib);
    return defaultECPair;
}

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

export class BtcService extends BlockchainService {
    constructor(options = {}) {
        super({
            ...options,
            network: 'BTC',
            recommendedConfirmationTimeMs: options.recommendedConfirmationTimeMs ?? 30 * ONE_MINUTE_MS,
            pollIntervalMs: options.pollIntervalMs ?? 30 * 1000,
        });

        const networkName = resolveBitcoinNetworkName(options.bitcoinNetwork);
        this.bitcoinNetwork = resolveBitcoinNetwork(networkName);
        this.bitcoinNetworkName = networkName;

        this.blockstreamApiBaseUrl = resolveBlockstreamApiBaseUrl(
            options.blockstreamApiBaseUrl ?? process.env.BTC_BLOCKSTREAM_API_BASE_URL,
            this.bitcoinNetworkName,
        );

        this.mempoolApiBaseUrl = resolveMempoolApiBaseUrl(
            options.mempoolApiBaseUrl ?? process.env.BTC_MEMPOOL_API_BASE_URL,
            this.bitcoinNetworkName,
        );

        this.utxoProvider = options.utxoProvider ?? createBlockstreamUtxoProvider({
            logger: this.logger,
            apiBaseUrl: this.blockstreamApiBaseUrl,
        });

        this.feeRateProvider = options.feeRateProvider ?? createMempoolFeeRateProvider({
            logger: this.logger,
            apiBaseUrl: this.mempoolApiBaseUrl,
        });

        this.broadcastProvider = options.broadcastProvider ?? createBlockstreamBroadcastProvider({
            apiBaseUrl: this.blockstreamApiBaseUrl,
            logger: this.logger,
        });

        this.txProvider = options.txProvider ?? createBlockstreamTxProvider({
            apiBaseUrl: this.blockstreamApiBaseUrl,
            logger: this.logger,
        });

        this.currency = Currencies.BTC;
        this.ecpair = options.ecpair ?? resolveECPair();

        if (!this.statusProvider) {
            this.setStatusProvider(
                createBlockstreamStatusProvider({
                    apiBaseUrl: this.blockstreamApiBaseUrl,
                    logger: this.logger,
                }),
            );
        }
    }

    async generateRandomAddress() {
        const ECPair = ECPairFactory(ecc);
        const btcNetwork = process.env.BTC_NETWORK === 'testnet'
            ? bitcoin.networks.testnet
            : bitcoin.networks.bitcoin;

        const keyPair = ECPair.makeRandom({ network: btcNetwork });
        const { address } = bitcoin.payments.p2wpkh({
            pubkey: Buffer.from(keyPair.publicKey),
            network: btcNetwork,
        });
        // noinspection JSValidateTypes
        return address;
    }

    /**
     * Получает информацию о транзакции по её txid.
     * Возвращает { isTxSuccess, receiver, receiveAmount }.
     *
     * receiveAmount — в BTC, а не в сатоши.
     */
    async getTx(txid) {
        if (!txid) {
            throw new Error("[BTC] getTx: txid is required");
        }

        try {
            const txData = await this.txProvider(txid);
            if (!txData) {
                throw new Error(`[BTC] Transaction not found for txid: ${txid}`);
            }

            const status = await this.statusProvider(txid);
            const isTxSuccess =
                typeof status === "boolean"
                    ? status
                    : status?.confirmed === true ||
                    status?.status === "confirmed" ||
                    status?.status === "success";

            const outputs = txData.vout || txData.outputs || [];
            let receiver = null;
            let receiveAmount = 0;

            if (outputs.length > 0) {
                const firstOutput = outputs.find(
                    (out) => out.scriptpubkey_address && out.value
                );
                if (firstOutput) {
                    receiver = firstOutput.scriptpubkey_address;
                    receiveAmount = Number(firstOutput.value) / 1e8; // 💰 BTC, не сатоши
                }
            }

            return {
                isTxSuccess,
                receiver,
                receiveAmount,
            };
        } catch (error) {
            this.logger?.error?.("[BTC] getTx failed", { txid, error });
            throw error;
        }
    }


    async send(to, value, currency = this.currency) {
        if (currency?.network && currency.network !== this.network) {
            throw new Error('Only BTC network supported');
        }

        const { satoshis, humanAmount } = normalizeBtcAmount(value);

        return this.sendTransaction(to, satoshis, humanAmount);
    }

    async sendTransaction(recipientAddress, sendValueSatoshis, humanAmount = sendValueSatoshis) {
        this.logger?.info?.('[BTC] Preparing transaction', {
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

            const keyPair = ensureBufferKeyPair(this.ecpair.fromWIF(privateKeyWIF, this.bitcoinNetwork));

            const senderConfig = {
                senderAddress,
                network: this.bitcoinNetworkName,
            };
            this.logger?.info?.('[BTC] Sender configuration loaded', senderConfig);

            try {
                bitcoin.address.toOutputScript(senderAddress, this.bitcoinNetwork);
            } catch (addressError) {
                throw new Error(
                    `BTC_ADDRESS ${senderAddress} is invalid for ${this.bitcoinNetworkName}: ${addressError.message}`,
                );
            }

            const derivedSegwitAddress = deriveNativeSegwitAddress(keyPair, this.bitcoinNetwork);
            const isSegwitAddress = senderAddress?.toLowerCase?.().startsWith('bc1')
                || senderAddress?.toLowerCase?.().startsWith('tb1');
            if (isSegwitAddress && derivedSegwitAddress && derivedSegwitAddress !== senderAddress) {
                const mismatchError = new Error(
                    `Derived address ${derivedSegwitAddress} does not match BTC_ADDRESS ${senderAddress} for ${this.bitcoinNetworkName}`,
                );
                this.logger?.error?.('[BTC] Sender address mismatch', {
                    ...senderConfig,
                    derivedAddress: derivedSegwitAddress,
                });
                throw mismatchError;
            }

            const utxos = await this.utxoProvider(senderAddress);
            if (!utxos.length) throw new Error('No UTXO found for sender address');

            const totalUtxoValue = utxos.reduce((acc, utxo) => acc + (utxo.value ?? 0), 0);
            this.logger?.info?.('[BTC] Retrieved UTXO set', {
                count: utxos.length,
                totalValue: totalUtxoValue,
            });

            const feeRate = await this.feeRateProvider();

            this.logger?.info?.('[BTC] Fee rate resolved', { feeRate });

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

            const psbt = new bitcoin.Psbt({ network: this.bitcoinNetwork });
            const senderOutputScript = bitcoin.address.toOutputScript(senderAddress, this.bitcoinNetwork);

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

                    if (!this.txProvider) {
                        throw new Error('No BTC transaction provider configured for non-SegWit inputs');
                    }

                    let rawTxHex = txHexCache.get(input.hash);
                    if (!rawTxHex) {
                        rawTxHex = await this.txProvider(input.hash);
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

            const res = await this.broadcastProvider(rawHex);
            const result = {
                currency: Currencies.BTC,
                txHash: res.txid ?? txid,
                sentAmount: humanAmount,
                fee,
            };

            this.logger?.info?.('[BTC] Transaction broadcasted', result);

            try {
                await this.waitForConfirmation(result.txHash);
            } catch (error) {
                this.logger?.error?.('[BTC] Confirmation error', error);
                throw error;
            }

            return result;
        } catch (error) {
            this.logger?.error?.('[BTC] Failed to send transaction', error);
            throw error;
        }
    }
}
