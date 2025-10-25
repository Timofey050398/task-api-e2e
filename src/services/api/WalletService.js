import {AccountClient} from "../../api/clients/AccountClient";
import {BlockchainServiceFacade} from "../blockchain/BlockchainServiceFacade";
import {generateRandomName, getRandomClient} from "../../utils/randomGenerator";
import {Currencies, CurrencyType} from "../../model/Currency";
import {step} from "allure-js-commons";
import {CashClient} from "../../api/clients/CashClient";


export class WalletService {
    constructor(user) {
        this.accountClient = new AccountClient(user, false);
        this.cashClient = new CashClient(user, false);
        this.blockchain = new BlockchainServiceFacade();
        this.logger = console;
    }

    async depositCrypto(amount, currency, walletId) {
        return await step(`deposit ${currency.name} for ${amount}`, async () => {
            if (!currency || amount === undefined || amount === null) {
                throw new Error("Amount and currency required");
            }

            if (currency.type === CurrencyType.FIAT) {
                throw new Error("Fiat currency is not supported");
            }

            const wallet = await this.#findOrCreateWallet(currency, walletId);
            const txResult = await this.blockchain.sendToken(wallet.address, amount, currency);
            return {wallet, txResult};
        });
    }

    async waitForDepositConfirm(currency, wallet, txResult, timeoutMs = 60 * 1000, pollIntervalMs = 1000) {
        const currencyName = currency.name;
        const txHash = txResult?.txHash ?? "unknown";

        return await step(`wait ${timeoutMs}ms for ${currencyName} deposit ${txHash} confirmation`, async () => {
            const initialBalance = parseAmount(wallet?.balance);
            const sentAmount = parseAmount(txResult?.sentAmount);
            const expectedBalance = addAmounts(initialBalance, sentAmount);
            const startedAt = Date.now();

            this.logger?.info?.(
                `[${currencyName}] Waiting for confirmation`,
                { txHash, timeoutMs, pollIntervalMs, expectedBalance: expectedBalance.value.toString() },
            );

            let attempts = 0;

            while (Date.now() - startedAt < timeoutMs) {
                attempts += 1;
                const updatedWallet = await this.getWalletById(wallet.id);

                if (updatedWallet) {
                    const updatedBalance = parseAmount(updatedWallet.balance);

                    if (compareAmounts(updatedBalance, expectedBalance) >= 0) {
                        this.logger?.info?.(
                            `[${currencyName}] Deposit confirmed`,
                            {
                                txHash,
                                attempts,
                                elapsedMs: Date.now() - startedAt,
                                balance: updatedWallet.balance,
                            },
                        );

                        return {
                            wallet: updatedWallet,
                            txResult,
                        };
                    }
                }

                await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
            }

            const error = new Error(`Transaction ${txHash} on ${currencyName} was not deposited within ${timeoutMs}ms`);
            error.transactionId = txHash;
            error.elapsedMs = Date.now() - startedAt;
            error.attempts = attempts;
            error.expectedBalance = expectedBalance.value.toString();

            this.logger?.error?.(
                `[${currencyName}] deposit confirmation timeout`,
                {
                    txHash,
                    attempts,
                    elapsedMs: error.elapsedMs,
                    expectedBalance: error.expectedBalance,
                },
            );

            throw error;
        });
    }

    async createCashInvoice(
        amount,
        countryName = "Россия",
        currency = Currencies.RUB,
        day = new Date().toISOString().split('T')[0],
        client = getRandomClient(),
        comment = "",
        companion = {name:"",surname:"", patronymic:""},
        locationOption =
        {
            cityOption : {first: true},
            officeOption : {first: false}
        },
        multiplyOf = 100
    ) {
        return await step(`create cash invoice for ${amount} ${currency.name}`, async () => {
            if (!(day instanceof Date) || isNaN(day.getTime())) {
                if (day instanceof String) {
                    day = new Date(day);
                } else {
                    throw new Error("Incorrect date format");
                }
            }
            const dateTimestamp = day.getTime();
            const {
                country,
                city,
                office
            } = await this.#findLocation(countryName, locationOption.cityOption, locationOption.officeOption);

            const slot = await this.#getFreeSlot(office, day);

            const wallet = await this.#findOrCreateWallet(currency);
            const accountId = wallet?.accountID;

            if (!accountId) {
                throw new Error("Incorrect account ID");
            }

            const response = await this.cashClient.createCashInvoice(
                accountId,
                amount,
                city.cityId,
                client,
                comment,
                companion,
                country.countryId,
                currency.id,
                dateTimestamp + slot,
                multiplyOf,
                office.id
            );

            return response?.data;
        });
    }

    async cancelCashInvoice(orderId){
        return await step(`cancel cash invoice ${orderId}`, async () => {
            const response = await this.cashClient.cancelCashInvoice(orderId);
            return response?.data;
        });
    }

    async getHistoryEntryByTxId(txId){
        return await step(`get history entry with tx hash ${txId}`, async () => {
            const response = await this.accountClient.getHistory();
            return response?.data?.order?.find(order => order.txHash === txId);
        });
    }

    async #getFreeSlot(office, day) {
        const slotsResponse = await this.cashClient.getInvoiceSlots(day.getTime(), office.id);
        const slot = slotsResponse.data?.slots[0]?.time;
        if (!slot) {
            throw new Error(`Could not find slot at office ${office.address} at date ${day}`);
        }
        const slotTimestamp = typeof slot === "number" ? slot : Number(slot);
        if (isNaN(slotTimestamp)) {
            throw new Error(`Invalid slot format: ${JSON.stringify(slot)}`);
        }
        return slotTimestamp;
    }

    async #findLocation(
        countryName,
        cityOption,
        officeOption
    ) {
        const countriesAndCurrenciesResponse = await this.accountClient.getSupportedCountriesAndCurrencies();

        const country = countriesAndCurrenciesResponse.data?.countries.find(country => country.countryName === countryName);
        if (!country) {
            throw new Error(`Could not find country with name ${countryName}`);
        }
        let city;
        if (cityOption.first) {
            city = country.cities[0];
        } else {
            city = country.cities.find(city => city.cityName === cityOption.name);
        }
        if (!city) {
            throw new Error(`Could not find city at country ${countryName}`);
        }

        const officesResponse = await this.cashClient.getCashOffices(city.cityId, country.countryId);
        let office;
        if (officeOption.first) {
            office = officesResponse.data?.offices[0];
        } else {
            office = officesResponse.data?.offices.find(office => office.address === officeOption.address);
        }

        if (!office) {
            throw new Error("Could not find office");
        }
        return {country, city, office};
    }

    async #findOrCreateWallet(currency, walletId) {
        return await step(`find or create wallet for currency ${currency.name}`, async () => {
            if (walletId) {
                const walletById = await this.getWalletById(walletId);
                if (!walletById) {
                    throw new Error("Wallet not found.");
                }
                return walletById;
            }

            if (!currency) {
                throw new Error("Currency is required when walletId is not provided.");
            }

            let wallet = await this.getWalletByCurrencyId(currency.id);

            if (!wallet) {
                await this.createWallet(currency, generateRandomName());
                wallet = await this.getWalletByCurrencyId(currency.id);
            }

            if (!wallet) {
                throw new Error("Wallet not found.");
            }

            return wallet;
        });
    }

    async createWallet(currency, name) {
        return await step(`create wallet for ${currency.name} with name ${name}`, async () => {
            let response;
            if (currency.type === CurrencyType.CRYPTO) {
                response = await this.accountClient.createCryptoWallet(currency.id, 1, name);
            } else if (currency.type === CurrencyType.FIAT) {
                response = await this.accountClient.createFiatWallet(currency.id, name);
            } else {
                throw new Error("Unsupported currency type");
            }
            return response?.data;
        });
    }

    async getWalletById(walletId) {
        return await step(`get wallet by id ${walletId}`, async () => {
            if (!walletId) {
                return undefined;
            }

            const wallets = await this.#loadWallets();
            return wallets.find((wallet) => wallet.id === walletId);
        });
    }

    async deleteWallet(walletId) {
        return await step(`delete wallet with id ${walletId}`, async () => {
            const response = await this.accountClient.deleteWallet(walletId);
            return response?.data;
        });
    }

    async getWalletByCurrencyId(currencyId) {
        if (currencyId === undefined || currencyId === null) {
            return undefined;
        }

        const wallets = await this.#loadWallets();
        return wallets.find((wallet) => wallet.currencyID === currencyId);
    }

    async #loadWallets() {
        const response = await this.accountClient.getAccounts();
        return response?.data?.ungroupedWallets ?? [];
    }

}

function parseAmount(value) {
    if (typeof value === "bigint") {
        return { type: "bigint", value };
    }

    if (typeof value === "number") {
        return { type: "number", value };
    }

    if (value === null || value === undefined) {
        return { type: "number", value: 0 };
    }

    const stringValue = value.toString();

    if (/^-?\d+$/.test(stringValue)) {
        return { type: "bigint", value: BigInt(stringValue) };
    }

    const numericValue = Number(stringValue);
    if (Number.isNaN(numericValue)) {
        throw new Error(`Unable to parse amount: ${value}`);
    }

    return { type: "number", value: numericValue };
}

function addAmounts(left, right) {
    if (left.type === "bigint" && right.type === "bigint") {
        return { type: "bigint", value: left.value + right.value };
    }

    return {
        type: "number",
        value: Number(left.value) + Number(right.value),
    };
}

function compareAmounts(left, right) {
    if (left.type === "bigint" && right.type === "bigint") {
        if (left.value === right.value) {
            return 0;
        }

        return left.value > right.value ? 1 : -1;
    }

    const leftNumber = Number(left.value);
    const rightNumber = Number(right.value);
    const diff = leftNumber - rightNumber;

    if (Math.abs(diff) <= 1e-9) {
        return 0;
    }

    return diff > 0 ? 1 : -1;
}
