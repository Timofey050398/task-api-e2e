export interface Wallet {
    id: string;
    balance: string;
    frozenBalance: string;
    createdAt: number;
    name: string;
    address: string;
    currencyID: number;
    currencyName: string;
    accounts: Account[];
}

export interface Account {
    id: string;
    balance: string;
    frozenBalance: string;
    createdAt: number;
    name: string;
    address: string;
    currencyID: number;
    currencyName: string;
    country: Country;
    city: City;
}

export interface City {
    id: number;
    name: string;
}
export interface Country {
    id: number;
    name: string;
}