import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import ecc from 'tiny-secp256k1';
import { BlockchainTransactionService } from './BlockchainTransactionService.js';
import { Currencies } from '../../model/Currency.js';
import { normalizeBtcAmount } from './btc/amount.js';
import {
    createBlockstreamBroadcastProvider,
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

const ECPair = ECPairFactory(ecc);

export class BtcTransactionService extends BlockchainTransactionService {
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

            const keyPair = ECPair.fromWIF(privateKeyWIF, this.bitcoinNetwork);

            const utxos = await this.utxoProvider(senderAddress);
            if (!utxos.length) throw new Error('No UTXO found for sender address');

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
            if (changeValue > 0) {
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
