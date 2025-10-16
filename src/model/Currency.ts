export enum CurrencyType {
    CRYPTO = 'crypto',
    FIAT = 'fiat',
}

export const Currencies = {
    RUB: { id: 1000, type: CurrencyType.FIAT },
    EUR: { id: 1020, type: CurrencyType.FIAT },
    USD: { id: 1010, type: CurrencyType.FIAT },
    AED: { id: 1030, type: CurrencyType.FIAT },
    BTC: { id: 2100, type: CurrencyType.CRYPTO },
    ETH: { id: 2110, type: CurrencyType.CRYPTO },
    TRX: { id: 2120, type: CurrencyType.CRYPTO },
    USDT_ERC20: { id: 2000, type: CurrencyType.CRYPTO },
    USDT_TRC20: { id: 2001, type: CurrencyType.CRYPTO },
    USDC_ERC20: { id: 2002, type: CurrencyType.CRYPTO },
    TON: { id: 2130, type: CurrencyType.CRYPTO },
} as const;

export type CurrencyKey = keyof typeof Currencies;