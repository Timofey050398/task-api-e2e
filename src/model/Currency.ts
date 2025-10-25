import {Network} from "./Network";
import {randomBytes} from "node:crypto";
import TonWeb from "tonweb";
import {TronWeb} from "tronweb";
import * as bitcoin from 'bitcoinjs-lib';
import {ECPairFactory} from "ecpair";
import * as ecc from 'tiny-secp256k1';
import { Buffer } from 'buffer';

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

export function generateRandomAddress(currency: Currency): string {
    if (!('network' in currency)) {
        throw new Error(`Currency ${currency.id} is not crypto and has no network`);
    } 
    const network = currency.network;
    switch (network) {
        // -------------------- BTC --------------------
        case Network.BTC: {
            const ECPair = ECPairFactory(ecc);
            const btcNetwork = process.env.BTC_NETWORK === 'testnet'
                ? bitcoin.networks.testnet
                : bitcoin.networks.bitcoin;

            const keyPair = ECPair.makeRandom({ network: btcNetwork });
            const { address } = bitcoin.payments.p2wpkh({
                pubkey: Buffer.from(keyPair.publicKey),
                network: btcNetwork,
            });
            return address!;
        }

        // -------------------- ETH --------------------
        case Network.ETH: {
            // Ethereum-адреса одинаковы на mainnet и testnet, но можем учитывать RPC_URL
            const random = randomBytes(20).toString("hex");
            return `0x${random}`;
        }

        // -------------------- TRON --------------------
        case Network.TRON: {
            const tronWeb = new TronWeb({
                fullHost: process.env.TRON_FULL_NODE || 'https://api.shasta.trongrid.io',
            });
            const account = tronWeb.utils.accounts.generateAccount();
            return account.address.base58; // ✅ корректный адрес, типа "TQZkD8s4..."
        }

        // -------------------- TON --------------------
        case Network.TON: {
            const { Address } = TonWeb.utils;
            const randomHash = randomBytes(32).toString("hex");
            const address = new Address(`0:${randomHash}`);
            const isMainnet = Boolean(process.env.TON_API_KEY);
            return address.toString(true, true, true, !isMainnet);
        }

        default:
            throw new Error(`Unsupported network: ${network}`);
    }
}

export type Currency = (typeof Currencies)[CurrencyKey];
export type CurrencyKey = keyof typeof Currencies;