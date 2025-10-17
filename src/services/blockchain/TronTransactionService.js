import TronWeb from 'tronweb';
import { BlockchainTransactionService } from './BlockchainTransactionService.js';
import { Currencies } from '../../model/Currency.js';
import { Network } from '../../model/Network.js';

const ONE_MINUTE = 60 * 1000;

export class TronTransactionService extends BlockchainTransactionService {
    constructor(options = {}) {
        super({
            ...options,
            network: 'TRON',
            recommendedConfirmationTimeMs: options.recommendedConfirmationTimeMs ?? 2 * ONE_MINUTE,
            pollIntervalMs: options.pollIntervalMs ?? 10 * 1000,
        });

        const fullNode = process.env.TRON_FULL_NODE ?? 'https://api.trongrid.io';
        const solidityNode = process.env.TRON_SOLIDITY_NODE ?? fullNode;
        const eventServer = process.env.TRON_EVENT_SERVER ?? fullNode;
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

    /**
     * Отправка нативных TRX
     * @param {string} to - адрес получателя
     * @param {number|string} amount - сумма в TRX
     * @returns {Promise<{txHash: string, feeTrx: string}>}
     */
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
                txHash: receipt.txid,
                feeTrx,
                energyUsed: info?.receipt?.energy_usage_total ?? 0,
                bandwidthUsed: info?.receipt?.net_usage ?? 0,
            };

            this.logger?.info?.('[TRON] Native transaction sent', result);
            return result;
        } catch (error) {
            this.logger?.error?.('[TRON] Failed to send native transaction', error);
            throw error;
        }
    }

    /**
     * Отправка токенов TRC20
     * @param {string} to - адрес получателя
     * @param {number|string} amount - сумма в токенах (человеческое значение)
     * @param {typeof Currencies[keyof typeof Currencies]} currency - токен (например, Currencies.USDT_TRC20)
     * @returns {Promise<{txHash: string, feeTrx: string}>}
     */
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
                feeLimit: 5_000_000,
                shouldPollResponse: false,
            });

            const txId = normalizeTransactionId(tx);
            const confirmation = await this.waitForConfirmation(txId);
            const info = extractTransactionInfo(confirmation.status);
            const feeTrx = this.tronWeb.fromSun(info?.fee ?? info?.receipt?.energy_fee ?? 0);

            const result = {
                txHash: txId,
                feeTrx,
            };

            this.logger?.info?.('[TRON] Token transaction sent', result);
            return result;
        } catch (error) {
            this.logger?.error?.('[TRON] Failed to send token transaction', error);
            throw error;
        }
    }
}

/** --- helpers --- */
function scaleDecimals(value, decimals) {
    const [intPart, frac = ''] = value.toString().split('.');
    const padded = (frac + '0'.repeat(decimals)).slice(0, decimals);
    return `${intPart}${padded}`;
}

function createTronStatusProvider(getTronWeb, { logger } = {}) {
    return async (txId) => {
        const tronWeb = getTronWeb();
        if (!tronWeb) {
            throw new Error('TronWeb client is not initialized');
        }

        try {
            const info = await tronWeb.trx.getTransactionInfo(txId);
            if (!info || Object.keys(info).length === 0) {
                return { confirmed: false, info: null };
            }

            const result = info.receipt?.result ?? info.result;
            const confirmed = typeof result === 'string'
                ? result.toLowerCase() === 'success'
                : Boolean(info.receipt);

            return { confirmed, info };
        } catch (error) {
            const message = error?.message ?? '';
            if (/not found|doesn't exist|transaction has not existed/i.test(message)) {
                return { confirmed: false, info: null };
            }

            logger?.warn?.('TRON status check error:', message || error);
            return { confirmed: false, error };
        }
    };
}

function extractTransactionInfo(status) {
    if (!status) return null;
    if (status.info) return status.info;
    if (status.receipt || status.fee) return status;
    return null;
}

function normalizeTransactionId(tx) {
    if (typeof tx === 'string') return tx;
    if (tx?.txid) return tx.txid;
    if (tx?.transaction?.txID) return tx.transaction.txID;
    throw new Error('Unable to determine TRON transaction id');
}
