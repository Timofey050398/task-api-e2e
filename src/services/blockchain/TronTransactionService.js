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

        const from = this.tronWeb.defaultAddress.base58;
        const amountInSun = this.tronWeb.toSun(amount);

        const tx = await this.tronWeb.transactionBuilder.sendTrx(to, amountInSun, from);
        const signed = await this.tronWeb.trx.sign(tx);
        const receipt = await this.tronWeb.trx.sendRawTransaction(signed);

        const info = await this.tronWeb.trx.getTransactionInfo(receipt.txid).catch(() => null);
        const energyFee = info?.receipt?.energy_fee ?? 0;
        const feeTrx = this.tronWeb.fromSun(energyFee);

        return {
            txHash: receipt.txid,
            feeTrx,
            energyUsed: info?.receipt?.energy_usage_total ?? 0,
            bandwidthUsed: info?.receipt?.net_usage ?? 0,
        };
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

        const tokenAddress = currency.tokenContract;
        const decimals = currency.decimal ?? 6;
        if (!tokenAddress) throw new Error('Token contract missing in currency');

        const contract = await this.tronWeb.contract().at(tokenAddress);
        const scaledAmount = scaleDecimals(amount, decimals);

        const tx = await contract.transfer(to, scaledAmount).send({
            feeLimit: 5_000_000,
            shouldPollResponse: false,
        });

        const info = await this.tronWeb.trx.getTransactionInfo(tx);
        const feeTrx = this.tronWeb.fromSun(info?.fee ?? 0);

        return {
            txHash: tx,
            feeTrx,
        };
    }
}

/** --- helpers --- */
function scaleDecimals(value, decimals) {
    const [intPart, frac = ''] = value.toString().split('.');
    const padded = (frac + '0'.repeat(decimals)).slice(0, decimals);
    return `${intPart}${padded}`;
}