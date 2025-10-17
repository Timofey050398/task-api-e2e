import {AccountClient} from "../../api/clients/AccountClient";
import {BlockchainServiceFacade} from "../blockchain/BlockchainServiceFacade";
import {generateRandomName} from "../../utils/randomGenerator";
import {CurrencyType} from "../../model/Currency";
import {step} from "allure-js-commons";


export class AccountService {
    constructor(user) {
        this.accountClient = new AccountClient(user, false);
        this.blockchain = new BlockchainServiceFacade();
        this.logger = console;
    }

    async depositCrypto(amount, currency, walletId){
        return await step(`deposit ${currency.key} for ${amount}`, async () => {
            if (!currency || !amount) {
                throw new Error("Amount and currency required");
            }
            if (currency && currency.type === CurrencyType.FIAT) {
                throw new Error('Fiat currency is not supported');
            }
            let wallet = await this.findOrCreateWallet(currency, walletId);
            const txResult = await this.blockchain.sendToken(wallet.address, amount);
            return this.waitForDepositConfirm(wallet, txResult);
        });
    }

    async waitForDepositConfirm(wallet, txResult, timeoutMs = 60 * 1000, pollIntervalMs = 1000){
        return await step(`wait ${timeoutMs} for confirm deposit ${txResult.txHash} in app`, async () => {
            const expectedBalance = BigInt(wallet.balance) + BigInt(txResult.sentAmount);
            const currencyName = wallet.currencyName;
            const startedAt = Date.now();
            const txHash = txResult.txHash;
            this.logger?.info?.(
                `[${currencyName}] Waiting for confirmation`,
                {txHash, timeoutMs, pollIntervalMs},
            );
            let attempts = 0;

            while (Date.now() - startedAt < timeoutMs) {
                attempts += 1;
                let updatedWallet = this.findOrCreateWallet(wallet.id);
                if (BigInt(updatedWallet.balance) === expectedBalance) {
                    this.logger?.info?.(`[${currencyName}] Deposit confirmed`);
                    return {
                        wallet: updatedWallet,
                        txResult: txResult
                    };
                }

                await new Promise((resolve) => {
                    setTimeout(resolve, pollIntervalMs);
                });
            }

            const error = new Error(`Transaction ${txHash} on ${currencyName} was not deposited ${timeoutMs}ms`);
            error.transactionId = txHash;
            error.elapsedMs = Date.now() - startedAt;
            error.attempts = attempts;

            this.logger?.error?.(
                `[${currencyName}] deposit confirmation timeout`,
                {txHash, attempts, elapsedMs: error.elapsedMs},
            );

            throw error;
        });
    }

    async findOrCreateWallet(currency, walletId) {
        return await step(`find or create if undefined wallet for currency ${currency.currencyName}`, async () => {
            const {data} = await this.accountClient.getAccounts();
            const wallets = data.ungroupedWallets;
            let wallet;
            if (walletId) {
                wallet = wallets.find((wallet) => wallet.id === walletId)[0];
                if (!wallet) {
                    throw new Error("Wallet not found.");
                }
            } else if (currency) {
                wallet = wallets.find((wallet) => wallet.currencyID === currency.id)[0];
                if (!wallet) {
                    if (currency.type === CurrencyType.CRYPTO) {
                        await this.accountClient.createCryptoWallet(currency.id, 1, generateRandomName());
                    }
                    if (currency.type === CurrencyType.FIAT) {
                        await this.accountClient.createFiatWallet(currency.id, generateRandomName());
                    }
                    const {newData} = await this.accountClient.getAccounts();
                    const newWallets = newData.ungroupedWallets;
                    wallet = newWallets.find((wallet) => wallet.currencyID === currency.id)[0];
                }
            }
            if (!wallet) {
                throw new Error("Wallet not found.");
            }
            return wallet;
        });
    }

}