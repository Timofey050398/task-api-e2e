import {WithdrawClient} from "../../api/clients/WithdrawClient";
import {TelegramService} from "../telegram/TelegramService";
import {WalletService} from "./WalletService";
import {MainClient} from "../../api/clients/MainClient";
import {getServiceInstance} from "../../model/Network";
import {step} from "allure-js-commons";
import {Currencies} from "../../model/Currency";


export class WithdrawService {
    constructor(user) {
        this.withdrawClient = new WithdrawClient(user, false);
        this.mainClient = new MainClient(user, false);
        this.telegramClient = new TelegramService(user);
        this.walletService = new WalletService(user);
        this.tgCodeType = "withdraw";
    }

    async withdraw(currency, amount, receiver) {
        return await step(`withdraw ${amount} ${currency.name} to ${receiver} `, async () => {
            const amountWithFee = await this.#calculateAmountWithFee(currency, amount);
            const wallets = await this.walletService.findWalletsWithBalance(currency, amountWithFee);
            await this.mainClient.sendTgCode(this.tgCodeType);
            const code = await this.telegramClient.getTelegram2FACode();
            const walletId =  wallets[0].id;

            console.log(">>> [withdraw] args:", { amount, code, receiver, walletId });
            const withdrawResp =  await this.withdrawClient.withdraw(
                String(amount),
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
        });
    }


    async #calculateAmountWithFee(currency, amount) {
        return await step(`calculate amount with fee for currency ${currency.name}`, async () => {
            const tariffResp = await this.withdrawClient.getTariff(currency.id);
            const tariff = tariffResp?.data;
            if (!tariff) {
                throw new Error("Tariff not found.");
            }
            let amountWithFee = amount;

            if (Number(tariff.percent) > 0) {
                amountWithFee += (amount * Number(tariff.percent));
            }
            if (Number(tariff.fixedAmount) > 0) {
                amountWithFee += Number(tariff.fixedAmount);
            }

            return amountWithFee;
        });
    }


    /**
     * Ожидает, пока у ордера не станет statusID = 2.
     *
     * @param {string} orderId - ID ордера
     * @param {Currency} currency - валюта вывода
     * @param {number} [pollIntervalMs=3000] - интервал между запросами (мс)
     * @returns {Promise<any>} ответ от getInfo
     */
    async waitForStatusCompleted(orderId, currency, pollIntervalMs = 15000) {
        return await step(`wait for order ${orderId} completed in application`, async () => {
            const fiveMinutesMs = 60 * 1000 * 5;
            const timeoutMs = currency === Currencies.BTC
                ? 60 * 1000 * 90
                : getServiceInstance(currency.network).recommendedConfirmationTimeMs + fiveMinutesMs;
            const start = Date.now();

            while (Date.now() - start < timeoutMs) {
                const response = await this.withdrawClient.getInfo(orderId);
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
        });
    }
}