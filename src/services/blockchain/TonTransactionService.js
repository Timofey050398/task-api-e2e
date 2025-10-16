import TonWeb from 'tonweb';
import { BlockchainTransactionService } from './BlockchainTransactionService.js';
import { Currencies } from '../../model/Currency.js';
import { Network } from '../../model/Network.js';

const ONE_MINUTE = 60 * 1000;

export class TonTransactionService extends BlockchainTransactionService {
    constructor(options = {}) {
        super({
            ...options,
            network: 'TON',
            recommendedConfirmationTimeMs: options.recommendedConfirmationTimeMs ?? ONE_MINUTE,
            pollIntervalMs: options.pollIntervalMs ?? 5 * 1000,
        });

        this.apiKey = process.env.TON_API_KEY;
        this.publicKey = process.env.TON_WALLET_PUBLIC_KEY;
        this.secretKey = process.env.TON_WALLET_PRIVATE_KEY;

        this.tonWeb =
            options.tonWeb ??
            createTonWeb(this.apiKey);

        this.defaultWalletVersion = options.defaultWalletVersion ?? 'v4R2';
        this.defaultWorkchain = options.defaultWorkchain ?? 0;
        this.currency = Currencies.TON;
    }

    /** Создает контракт кошелька TON */
    getWalletContract({
                          publicKey = this.publicKey,
                          version = this.defaultWalletVersion,
                          workchain = this.defaultWorkchain,
                      } = {}) {
        if (!publicKey) throw new Error('publicKey is required');

        const walletClass = this.tonWeb.wallet?.all?.[version];
        if (!walletClass) throw new Error(`Unsupported wallet version: ${version}`);

        return new walletClass(this.tonWeb.provider, { publicKey, wc: workchain });
    }

    /** Отправка TON */
    async sendNativeTransaction(toAddress, amount) {
        if (!this.secretKey || !this.publicKey)
            throw new Error('Wallet keys not configured in environment');
        if (!toAddress) throw new Error('toAddress is required');
        if (!amount) throw new Error('amount is required');

        const contract = this.getWalletContract();
        const seqno = await contract.methods.seqno().call();
        const amountNano = normalizeTonAmount(amount);

        const result = await contract.methods.transfer({
            secretKey: this.secretKey,
            toAddress,
            amount: amountNano,
            seqno,
            sendMode: 3,
        }).send();

        return {
            txHash: result?.id?.hash ?? 'unknown',
            feeTon: estimateTonFee(amountNano),
        };
    }

    /** Отправка Jetton (токена TON) */
    async sendTokenTransaction(toAddress, amount, currency) {
        if (!currency) throw new Error('Currency required');
        if (currency.network !== Network.TON) throw new Error('Only TON network supported');
        if (!currency.tokenContract) throw new Error('Token contract missing in currency');

        const contract = this.getWalletContract();
        const seqno = await contract.methods.seqno().call();

        const tonWeb = this.tonWeb;
        const { Address, BN, toNano } = TonWeb.utils;

        const { token } = tonWeb;
        if (!token?.ft?.JettonWallet) {
            throw new Error('JettonWallet class not found in tonWeb.token.ft');
        }

        const jettonWallet = new token.ft.JettonWallet(tonWeb.provider, {
            address: new Address(currency.tokenContract),
        });


        const responseAddr = contract.address;
        const amountUnits = scaleByDecimals(amount, currency.decimal ?? 9);
        // noinspection JSUnresolvedFunction
        const payload = await jettonWallet.methods.transfer({
            amount: new BN(amountUnits),
            toAddress: new Address(toAddress),
            responseAddress: responseAddr,
            forwardAmount: new BN(toNano('0.02').toString()), // отправляем немного TON на исполнение
            forwardPayload: null,
        }).getData();

        const result = await contract.methods.transfer({
            secretKey: this.secretKey,
            toAddress: jettonWallet.address.toString(true, true, true),
            amount: toNano('0.05'), // комиссия в TON
            seqno,
            payload,
            sendMode: 3,
        }).send();

        return {
            txHash: result?.id?.hash ?? 'unknown',
            feeTon: '0.05',
        };
    }
}

/** --- helpers --- */
function createTonWeb(apiKey) {
    const endpoint = 'https://toncenter.com/api/v2/jsonRPC';
    const provider = new TonWeb.HttpProvider(endpoint, { apiKey });
    return new TonWeb(provider);
}

function normalizeTonAmount(amount) {
    const { BN, toNano } = TonWeb.utils;

    if (typeof amount === 'bigint') return new BN(amount.toString());
    if (typeof amount === 'number') return toNano(amount.toString());
    if (typeof amount === 'string') return toNano(amount);
    throw new Error('amount must be a bigint, number, or string');
}

function scaleByDecimals(value, decimals) {
    if (typeof value === 'bigint') return value.toString();
    const stringValue = value.toString();
    const [integerPart, fractionalPart = ''] = stringValue.split('.');
    const paddedFraction = (fractionalPart + '0'.repeat(decimals)).slice(0, decimals);
    const normalized = `${integerPart}${paddedFraction}`.replace(/^0+(\d)/, '$1');
    return normalized === '' ? '0' : normalized;
}

// Т.к. точный расчет fee по TON API недоступен без RPC-трейсинга, делаем простую оценку
function estimateTonFee() {
    const { fromNano } = TonWeb.utils;
    const baseFeeNano = BigInt(200_000_000); // ~0.2 TON запасом
    return fromNano(baseFeeNano);
}