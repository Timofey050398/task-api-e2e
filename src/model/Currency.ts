import {Network} from "./Network";
import {randomBytes} from "node:crypto";

export enum CurrencyType {
    CRYPTO = 'crypto',
    FIAT = 'fiat',
}

export const Currencies = {
    RUB: { id: 1000, type: CurrencyType.FIAT },
    EUR: { id: 1020, type: CurrencyType.FIAT },
    USD: { id: 1010, type: CurrencyType.FIAT },
    AED: { id: 1030, type: CurrencyType.FIAT },
    BTC: { id: 2100, type: CurrencyType.CRYPTO, network: Network.BTC },
    ETH: { id: 2110, type: CurrencyType.CRYPTO, network: Network.ETH },
    TRX: { id: 2120, type: CurrencyType.CRYPTO, network: Network.TRON },
    USDT_ERC20: { id: 2000, type: CurrencyType.CRYPTO, network: Network.ETH, tokenContract: process.env.USDT_ERC20_CONTRACT, decimal: 6 },
    USDT_TRC20: { id: 2001, type: CurrencyType.CRYPTO, network: Network.TRON, tokenContract: process.env.USDT_TRC20_CONTRACT, decimal: 6 },
    USDC_ERC20: { id: 2002, type: CurrencyType.CRYPTO, network: Network.ETH, tokenContract: process.env.USDC_ERC20_CONTRACT, decimal: 6 },
    TON: { id: 2130, type: CurrencyType.CRYPTO, network: Network.TON },
} as const;

export function getMinAmount(currency: typeof Currencies[keyof typeof Currencies]) {
    if (currency.type === CurrencyType.FIAT
    || currency === Currencies.TON || currency === Currencies.TRX) {
        return 0.01;
    }
    if ('tokenContract' in currency) {
        return 0.000001;
    }
    if (currency === Currencies.BTC){
        return 0.00000001;
    }
    if (currency === Currencies.ETH){
        return 0.0000000001;
    }
    throw new Error(`Unsupported currency type ${currency.type}`);
}

export function generateRandomAddress(currency: Currency): string {
    if (!('network' in currency)) {
        throw new Error(`Currency ${currency.id} is not crypto and has no network`);
    } 
    const network = currency.network;
    switch (network) {
        // -------------------- BTC --------------------
        case Network.BTC: {
            const btcNetwork = process.env.BTC_NETWORK || "mainnet";
            // Фейковая логика: просто разные префиксы для примера
            const prefix = btcNetwork === "testnet" ? "tb1q" : "bc1q";
            const random = randomBytes(20).toString("hex");
            return `${prefix}${random}`;
        }

        // -------------------- ETH --------------------
        case Network.ETH: {
            // Ethereum-адреса одинаковы на mainnet и testnet, но можем учитывать RPC_URL
            const random = randomBytes(20).toString("hex");
            return `0x${random}`;
        }

        // -------------------- TRON --------------------
        case Network.TRON: {
            // Для TRON адреса начинаются с 'T' на mainnet и с 'T'/'a'/'b' на testnet, в реальности зависит от base58
            const isMainnet = (process.env.TRON_FULL_NODE || "").includes("trongrid.io");
            const prefix = isMainnet ? "T" : "a";
            const random = randomBytes(20).toString("hex").slice(0, 33);
            return `${prefix}${random}`;
        }

        // -------------------- TON --------------------
        case Network.TON: {
            // Для TON различия зависят от API, но адрес формата EQ...
            const random = randomBytes(32).toString("base64url").slice(0, 48);
            const prefix = process.env.TON_API_KEY ? "EQ" : "kQ"; // EQ — mainnet, kQ — testnet
            return `${prefix}${random}`;
        }

        default:
            throw new Error(`Unsupported network: ${network}`);
    }
}

export type Currency = (typeof Currencies)[CurrencyKey];
export type CurrencyKey = keyof typeof Currencies;