import TonWeb from 'tonweb';
import { BlockchainService } from './BlockchainService.js';
import { Network } from '../../model/Network.js';
import { resolveTonNetworkName } from './ton/config.js';
import { ONE_MINUTE_MS } from './ton/constants.js';
import {randomBytes} from "node:crypto";
import {TonParamSetter} from "./ton/TonParamSetter";

export class TonService extends BlockchainService {
    constructor(options = {}) {
        const networkName = resolveTonNetworkName();
        super({
            ...options,
            network: 'TON',
            recommendedConfirmationTimeMs: options.recommendedConfirmationTimeMs ?? ONE_MINUTE_MS,
            pollIntervalMs: options.pollIntervalMs ?? 5 * 1000,
        });
        this.paramSetter = new TonParamSetter(this);
        this.paramSetter.setParams(options, networkName);
    }

    async generateRandomAddress() {
        const {Address} = TonWeb.utils;
        const randomHash = randomBytes(32).toString("hex");
        const address = new Address(`0:${randomHash}`);
        const isMainnet = Boolean(process.env.TON_API_KEY);
        // noinspection JSValidateTypes
        return address.toString(true, true, true, !isMainnet);
    }

    async send(toAddress, amount, currency) {
        if (!currency) {
            throw new Error('Currency required');
        }

        if (currency.network !== Network.TON) {
            throw new Error('Only TON network supported');
        }

        return this.txSender.sendNativeTransaction(toAddress, amount);
    }

    /**
     * Получает информацию о нативной транзакции TON по хэшу через tonapi.io.
     *
     * @param {string} txHash - идентификатор транзакции
     * @returns {Promise<{ isTxSuccess: boolean, receiver: string | null, receiveAmount: number }>}
     */
    async getTx(txHash) {
        return await this.txResolver.getTx(txHash);
    }
}
