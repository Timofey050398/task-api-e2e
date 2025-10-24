import TronWebModule from 'tronweb';
const TronWeb = TronWebModule.TronWeb || TronWebModule.default || TronWebModule;
import { BlockchainTransactionService } from './BlockchainTransactionService.js';
import { Currencies } from '../../model/Currency.js';
import { Network } from '../../model/Network.js';
import { createTronStatusProvider } from './tron/providers.js';
import { resolveTronNetworkName, resolveTronNodes } from './tron/config.js';
import { extractTransactionInfo, normalizeTransactionId, scaleDecimals } from './tron/utils.js';

const ONE_MINUTE = 60 * 1000;

export class TronTransactionService extends BlockchainTransactionService {
    constructor(options = {}) {
        const networkName = resolveTronNetworkName();
        super({
            ...options,
            network: 'TRON',
            recommendedConfirmationTimeMs: options.recommendedConfirmationTimeMs ?? 2 * ONE_MINUTE,
            pollIntervalMs: options.pollIntervalMs ?? 10 * 1000,
        });

        const { fullNode, solidityNode, eventServer } = resolveTronNodes(networkName);
        const privateKey = process.env.TRON_PRIVATE_KEY;

        if (!privateKey) {
            throw new Error('TRON_PRIVATE_KEY not found in environment');
        }

        this.tronWeb =
            options.tronWeb ??
            new TronWeb(fullNode, solidityNode, eventServer, privateKey);

        const statusProvider = options.statusProvider ?? createTronStatusProvider(() => this.tronWeb, { logger: this.logger });
        this.setStatusProvider(statusProvider);
    }

    async send(to, amount, currency) {
        if (!currency) {
            throw new Error('Currency required');
        }

        if (currency.network !== Network.TRON) {
            throw new Error('Only TRON network supported');
        }

        if ('tokenContract' in currency && currency.tokenContract) {
            return this.sendTokenTransaction(to, amount, currency);
        }

        return this.sendNativeTransaction(to, amount);
    }

    async sendNativeTransaction(to, amount) {
        if (!to) throw new Error('Recipient address required');
        if (!this.tronWeb) throw new Error('TronWeb client not initialized');

        this.logger?.info?.('[TRON] Sending native transaction', { to, amount });

        try {
            const from = this.tronWeb.defaultAddress.base58;
            const amountInSun = this.tronWeb.toSun(amount);

            const tx = await this.tronWeb.transactionBuilder.sendTrx(to, amountInSun, from);
            const signed = await this.tronWeb.trx.sign(tx);
            const receipt = await this.tronWeb.trx.sendRawTransaction(signed);

            const confirmation = await this.waitForConfirmation(receipt.txid);
            const info = extractTransactionInfo(confirmation.status);
            const energyFee = info?.receipt?.energy_fee ?? 0;
            const feeTrx = this.tronWeb.fromSun(energyFee);

            const result = {
                currency: Currencies.TRX,
                txHash: receipt.txid,
                sentAmount: amount,
                fee: feeTrx,
            };

            this.logger?.info?.('[TRON] Native transaction sent', result);
            return result;
        } catch (error) {
            this.logger?.error?.('[TRON] Failed to send native transaction', error);
            throw error;
        }
    }

    async sendTokenTransaction(to, amount, currency) {
        if (!to) throw new Error('Recipient address required');
        if (!currency) throw new Error('Currency required');
        if (currency.network !== Network.TRON) throw new Error('Only TRON network supported');

        this.logger?.info?.('[TRON] Sending token transaction', {
            to,
            amount,
            tokenContract: currency.tokenContract,
        });

        try {
            const tokenAddress = currency.tokenContract;
            const decimals = currency.decimal ?? 6;
            if (!tokenAddress) throw new Error('Token contract missing in currency');

            const contract = await this.tronWeb.contract().at(tokenAddress);
            const scaledAmount = scaleDecimals(amount, decimals);

            const tx = await contract.transfer(to, scaledAmount).send({
                feeLimit: 30_000_000,
                shouldPollResponse: false,
            });

            const txId = normalizeTransactionId(tx);
            const confirmation = await this.waitForConfirmation(txId);
            const info = extractTransactionInfo(confirmation.status);
            const feeTrx = this.tronWeb.fromSun(info?.fee ?? info?.receipt?.energy_fee ?? 0);

            const result = {
                currency: currency,
                txHash: txId,
                sentAmount: amount,
                fee: feeTrx,
            };

            this.logger?.info?.('[TRON] Token transaction sent', result);
            return result;
        } catch (error) {
            this.logger?.error?.('[TRON] Failed to send token transaction', error);
            throw error;
        }
    }
}
