import {Network} from "./Network";

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

export type CurrencyKey = keyof typeof Currencies;