import {WithdrawClient} from "../../api/clients/WithdrawClient";
import {AccountClient} from "../../api/clients/AccountClient";
import {TelegramService} from "../telegram/TelegramService";
import {WalletService} from "./WalletService";
import {MainClient} from "../../api/clients/MainClient";
import {getServiceInstance} from "../../model/Network";



export class WithdrawService {
    constructor(user) {
        this.withdrawClient = new WithdrawClient(user, false);
        this.mainClient = new MainClient(user, false);
        this.telegramClient = new TelegramService(user);
        this.walletService = new WalletService(user);
        this.tgCodeType = "withdraw";
    }

    async withdraw(currency, amount, receiver) {
        const amountWithFee = await this.#calculateAmountWithFee(this, currency, amount);
        const wallets = await this.walletService.findWalletsWithBalance(currency,amountWithFee);
        await this.mainClient.sendTgCode(this.tgCodeType);
        const code = await this.telegramClient.getTelegram2FACode();

        const withdrawResp = await this.withdrawClient.withdraw(
            amount,
            code,
            null,
            receiver,
            wallets[0].id
        );

        const orderId = withdrawResp?.data?.orderID;
        if (!orderId) {
            throw new Error("Order ID not found");
        }

        return {
            amountWithFee,
            orderId
        }
    }


    async #calculateAmountWithFee(currency, amount) {
        const tariffResp = this.withdrawClient.getTariff(currency.id);
        const tariff = tariffResp?.data;
        if (!tariff) {
            throw new Error("Tariff not found.");
        }
        let withdrawalAmount = amount;

        if (Number(tariff.percent) > 0) {
            withdrawalAmount = withdrawalAmount + (amount * Number(tariff.percent));
        }
        if (Number(tariff.fixedAmount) > 0) {
            withdrawalAmount = withdrawalAmount + Number(tariff.fixedAmount);
        }

        return withdrawalAmount;
    }



    /**
     * Ожидает, пока у ордера не станет statusID = 2.
     *
     * @param {string} orderId - ID ордера
     * @param {Currency} currency - валюта вывода
     * @param {number} [pollIntervalMs=3000] - интервал между запросами (мс)
     * @returns {Promise<any>} ответ от getInfo
     */
    async waitForStatusCompleted(orderId,currency, pollIntervalMs = 3000) {
        const timeoutMs = getServiceInstance(currency.network).recommendedConfirmationTimeMs + 10_000;
        const start = Date.now();

        while (Date.now() - start < timeoutMs) {
            const response = await this.getInfo(orderId);
            const data = response?.data;

            if (!data) {
                throw new Error(`Пустой ответ при запросе getInfo(${orderId})`);
            }

            if (data.statusID === 2) {
                return data;
            }

            await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        }

        throw new Error(`Ожидание завершения ордера ${orderId} превысило ${timeoutMs} мс`);
    }
}