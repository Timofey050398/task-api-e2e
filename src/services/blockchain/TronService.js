import TronWebModule from 'tronweb';
const TronWeb = TronWebModule.TronWeb || TronWebModule.default || TronWebModule;
import { BlockchainService } from './BlockchainService.js';
import { Network } from '../../model/Network.js';
import { createTronStatusProvider } from './tron/providers.js';
import { resolveTronNetworkName, resolveTronNodes } from './tron/config.js';
import {TronTxResolver} from "./tron/TronTxResolver";
import {TronTxSender} from "./tron/TronTxSender";

const ONE_MINUTE = 60 * 1000;

export class TronService extends BlockchainService {
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
        this.txResolver = new TronTxResolver(this);
        this.txSender = new TronTxSender(this);
    }

    async generateRandomAddress() {
        const tronWeb = new TronWeb({
            fullHost: process.env.TRON_FULL_NODE || 'https://api.shasta.trongrid.io',
        });
        const account = tronWeb.utils.accounts.generateAccount();
        // noinspection JSValidateTypes
        return account.address.base58;
    }

    /**
     * Получает информацию о транзакции в сети Tron (TRX или TRC20)
     *
     * @param {string} txId - идентификатор транзакции (txid)
     * @param {Currency | undefined} currency - объект валюты, содержащий decimal и tokenContract
     * @returns {Promise<{ isTxSuccess: boolean, receiver: string | null, receiveAmount: number }>}
     */
    async getTx(txId, currency) {
        return await this.txResolver.getTx(txId, currency);
    }


    async send(to, amount, currency) {
        if (!currency) {
            throw new Error('Currency required');
        }

        if (currency.network !== Network.TRON) {
            throw new Error('Only TRON network supported');
        }

        if ('tokenContract' in currency && currency.tokenContract) {
            return this.txSender.sendTokenTransaction(to, amount, currency);
        }

        return this.txSender.sendNativeTransaction(to, amount);
    }
}
