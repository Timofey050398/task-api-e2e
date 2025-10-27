import {extractTransactionInfo, normalizeTransactionId, scaleDecimals} from "./utils";
import {Currencies} from "../../../model/Currency";
import {Network} from "../../../model/Network";

export class TronTxSender {
    constructor(tronService) {
        this.tronService = tronService;
    }

    async sendNativeTransaction(to, amount) {
        if (!to) throw new Error('Recipient address required');
        if (!this.tronService.tronWeb) throw new Error('TronWeb client not initialized');

        this.tronService.logger?.info?.('[TRON] Sending native transaction', { to, amount });

        try {
            const from = this.tronService.tronWeb.defaultAddress.base58;
            const amountInSun = this.tronService.tronWeb.toSun(amount);

            const tx = await this.tronService.tronWeb.transactionBuilder.sendTrx(to, amountInSun, from);
            const signed = await this.tronService.tronWeb.trx.sign(tx);
            const receipt = await this.tronService.tronWeb.trx.sendRawTransaction(signed);

            const confirmation = await this.tronService.waitForConfirmation(receipt.txid);
            const info = extractTransactionInfo(confirmation.status);
            const energyFee = info?.receipt?.energy_fee ?? 0;
            const feeTrx = this.tronService.tronWeb.fromSun(energyFee);

            const result = {
                currency: Currencies.TRX,
                txHash: receipt.txid,
                sentAmount: amount,
                fee: feeTrx,
            };

            this.tronService.logger?.info?.('[TRON] Native transaction sent', result);
            return result;
        } catch (error) {
            this.tronService.logger?.error?.('[TRON] Failed to send native transaction', error);
            throw error;
        }
    }

    async sendTokenTransaction(to, amount, currency) {
        if (!to) throw new Error('Recipient address required');
        if (!currency) throw new Error('Currency required');
        if (currency.network !== Network.TRON) throw new Error('Only TRON network supported');

        this.tronService.logger?.info?.('[TRON] Sending token transaction', {
            to,
            amount,
            tokenContract: currency.tokenContract,
        });

        try {
            const tokenAddress = currency.tokenContract;
            const decimals = currency.decimal ?? 6;
            if (!tokenAddress) throw new Error('Token contract missing in currency');

            const contract = await this.tronService.tronWeb.contract().at(tokenAddress);
            const scaledAmount = scaleDecimals(amount, decimals);

            const tx = await contract.transfer(to, scaledAmount).send({
                feeLimit: 30_000_000,
                shouldPollResponse: false,
            });

            const txId = normalizeTransactionId(tx);
            const confirmation = await this.tronService.waitForConfirmation(txId);
            const info = extractTransactionInfo(confirmation.status);
            const feeTrx = this.tronService.tronWeb.fromSun(info?.fee ?? info?.receipt?.energy_fee ?? 0);

            const result = {
                currency: currency,
                txHash: txId,
                sentAmount: amount,
                fee: feeTrx,
            };

            this.tronService.logger?.info?.('[TRON] Token transaction sent', result);
            return result;
        } catch (error) {
            this.tronService.logger?.error?.('[TRON] Failed to send token transaction', error);
            throw error;
        }
    }
}