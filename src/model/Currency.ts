import {Network} from "./Network";
import {randomBytes} from "node:crypto";
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
        return 0.0001;
    }
    if ('tokenContract' in currency) {
        return 0.000001;
    }
    if (currency === Currencies.BTC){
        return 0.00000001;
    }
    if (currency === Currencies.ETH){
        return '0.0000000001';
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