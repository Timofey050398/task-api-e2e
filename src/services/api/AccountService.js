import {AccountClient} from "../../api/clients/AccountClient";
import {BlockchainServiceFacade} from "../blockchain/BlockchainServiceFacade";
import {generateRandomName} from "../../utils/randomGenerator";
import {Currencies, CurrencyType} from "../../model/Currency";
import {step} from "allure-js-commons";


export class AccountService {
    constructor(user) {
        this.accountClient = new AccountClient(user, false);
        this.blockchain = new BlockchainServiceFacade();
        this.logger = console;
    }

    async depositCrypto(amount, currency, walletId) {
        const currencyLabel = resolveCurrencyLabel(currency);
        return await step(`deposit ${currencyLabel} for ${amount}`, async () => {
            if (!currency || amount === undefined || amount === null) {
                throw new Error("Amount and currency required");
            }

            if (currency.type === CurrencyType.FIAT) {
                throw new Error("Fiat currency is not supported");
            }

            const wallet = await this.findOrCreateWallet(currency, walletId);
            const txResult = await this.blockchain.sendToken(wallet.address, amount, currency);
            return this.waitForDepositConfirm(currency, wallet, txResult);
        });
    }

    async waitForDepositConfirm(currency, wallet, txResult, timeoutMs = 60 * 1000, pollIntervalMs = 1000) {
        const currencyLabel = resolveCurrencyLabel(currency, wallet);
        const txHash = txResult?.txHash ?? "unknown";

        return await step(`wait ${timeoutMs}ms for ${currencyLabel} deposit ${txHash} confirmation`, async () => {
            const initialBalance = parseAmount(wallet?.balance);
            const sentAmount = parseAmount(txResult?.sentAmount);
            const expectedBalance = addAmounts(initialBalance, sentAmount);
            const startedAt = Date.now();

            this.logger?.info?.(
                `[${currencyLabel}] Waiting for confirmation`,
                { txHash, timeoutMs, pollIntervalMs, expectedBalance: formatAmount(expectedBalance) },
            );

            let attempts = 0;

            while (Date.now() - startedAt < timeoutMs) {
                attempts += 1;
                const updatedWallet = await this.getWalletById(wallet.id);

                if (updatedWallet) {
                    const updatedBalance = parseAmount(updatedWallet.balance);

                    if (compareAmounts(updatedBalance, expectedBalance) >= 0) {
                        this.logger?.info?.(
                            `[${currencyLabel}] Deposit confirmed`,
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

                await sleep(pollIntervalMs);
            }

            const error = new Error(`Transaction ${txHash} on ${currencyLabel} was not deposited within ${timeoutMs}ms`);
            error.transactionId = txHash;
            error.elapsedMs = Date.now() - startedAt;
            error.attempts = attempts;
            error.expectedBalance = formatAmount(expectedBalance);

            this.logger?.error?.(
                `[${currencyLabel}] deposit confirmation timeout`,
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

    async findOrCreateWallet(currency, walletId) {
        const currencyLabel = resolveCurrencyLabel(currency);
        return await step(`find or create wallet for currency ${currencyLabel}`, async () => {
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
                if (currency.type === CurrencyType.CRYPTO) {
                    await this.accountClient.createCryptoWallet(currency.id, 1, generateRandomName());
                } else if (currency.type === CurrencyType.FIAT) {
                    await this.accountClient.createFiatWallet(currency.id, generateRandomName());
                } else {
                    throw new Error("Unsupported currency type");
                }

                wallet = await this.getWalletByCurrencyId(currency.id);
            }

            if (!wallet) {
                throw new Error("Wallet not found.");
            }

            return wallet;
        });
    }

    async getWalletById(walletId) {
        if (!walletId) {
            return undefined;
        }

        const wallets = await this.#loadWallets();
        return wallets.find((wallet) => wallet.id === walletId);
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

async function sleep(ms) {
    return await new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveCurrencyLabel(currency, wallet) {
    if (currency) {
        const directMatch = Object.entries(Currencies).find(([, value]) => value === currency || value.id === currency.id);
        if (directMatch) {
            return directMatch[0];
        }

        if (currency.currencyName) {
            return currency.currencyName;
        }

        if (currency.key) {
            return currency.key;
        }

        if (currency.id !== undefined) {
            return String(currency.id);
        }
    }

    if (wallet) {
        if (wallet.currencyName) {
            return wallet.currencyName;
        }

        if (wallet.currencyID !== undefined) {
            const matchById = Object.entries(Currencies).find(([, value]) => value.id === wallet.currencyID);
            if (matchById) {
                return matchById[0];
            }
            return String(wallet.currencyID);
        }
    }

    return "unknown";
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

function formatAmount(amount) {
    return amount.value.toString();
}
