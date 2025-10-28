import {Network} from "./Network";

export enum CurrencyType {
    CRYPTO = 'crypto',
    FIAT = 'fiat',
}

export const Currencies = {
    RUB: { name: "RUB", id: 1000, type: CurrencyType.FIAT },
    EUR: { name: "EUR",  id: 1020, type: CurrencyType.FIAT },
    USD: { name: "USD",  id: 1010, type: CurrencyType.FIAT },
    AED: { name: "AED",  id: 1030, type: CurrencyType.FIAT },
    BTC: { name: "BTC Bitcoin", id: 2100, type: CurrencyType.CRYPTO, network: Network.BTC },
    ETH: { name: "ETH Ethereum", id: 2110, type: CurrencyType.CRYPTO, network: Network.ETH },
    TRX: { name: "TRX Tron", id: 2120, type: CurrencyType.CRYPTO, network: Network.TRON },
    USDT_ERC20: { name: "USDT ERC-20", id: 2000, type: CurrencyType.CRYPTO, network: Network.ETH, tokenContract: process.env.USDT_ERC20_CONTRACT, decimal: 6 },
    USDT_TRC20: { name: "USDT TRC-20", id: 2001, type: CurrencyType.CRYPTO, network: Network.TRON, tokenContract: process.env.USDT_TRC20_CONTRACT, decimal: 6 },
    USDC_ERC20: { name: "USDC ERC-20", id: 2002, type: CurrencyType.CRYPTO, network: Network.ETH, tokenContract: process.env.USDC_ERC20_CONTRACT, decimal: 6 },
    TON: { name: "TON", id: 2130, type: CurrencyType.CRYPTO, network: Network.TON },
} as const;

export function getMinAmount(currency: Currency) {
    if (currency.type === CurrencyType.FIAT ) return 0.01;

    if (currency === Currencies.TON || currency === Currencies.TRX) {
        return 0.0001;
    }

    if (currency === Currencies.BTC){
        return 0.000003;
    }
    if (currency === Currencies.ETH){
        return '0.0000000001';
    }

    if ('decimal' in currency) {
        return 1 / 10 ** currency.decimal;
    }

    throw new Error(`Unsupported currency type ${currency.type}`);
}

export function getMinWithdrawAmount(currency: Currency) {
    if (currency.type === CurrencyType.FIAT ||  'decimal' in currency) return 0.01;

    if (currency === Currencies.TON || currency === Currencies.TRX) {
        return 0.01;
    }

    if (currency === Currencies.BTC){
        return 0.000003;
    }
    if (currency === Currencies.ETH){
        return '0.0000001';
    }

    throw new Error(`Unsupported currency type ${currency.type}`);
}

export type Currency = (typeof Currencies)[CurrencyKey];
export type CurrencyKey = keyof typeof Currencies;