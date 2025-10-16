import TonWeb from 'tonweb';

import { BlockchainTransactionService } from './BlockchainTransactionService.js';

const ONE_MINUTE = 60 * 1000;

export class TonTransactionService extends BlockchainTransactionService {
    constructor(options = {}) {
        super({
            ...options,
            network: 'TON',
            recommendedConfirmationTimeMs: options.recommendedConfirmationTimeMs ?? ONE_MINUTE,
            pollIntervalMs: options.pollIntervalMs ?? 5 * 1000,
        });

        this.tonWeb = options.tonWeb ?? createDefaultTonWeb();
        this.defaultWalletVersion = options.defaultWalletVersion ?? 'v4R2';
        this.defaultWorkchain = options.defaultWorkchain ?? 0;
    }

    setClient(tonWeb) {
        if (!tonWeb) {
            throw new Error('tonWeb instance is required');
        }

        this.tonWeb = tonWeb;
    }

    getWalletContract({ publicKey, version = this.defaultWalletVersion, workchain = this.defaultWorkchain } = {}) {
        if (!publicKey) {
            throw new Error('publicKey is required to create a wallet contract');
        }

        const walletClass = this.tonWeb.wallet?.all?.[version];
        if (!walletClass) {
            throw new Error(`Unsupported wallet version: ${version}`);
        }

        return new walletClass(this.tonWeb.provider, { publicKey, wc: workchain });
    }

    async sendNativeTransaction({
        publicKey,
        secretKey,
        toAddress,
        amount,
        walletContract,
        seqno,
        sendMode = 3,
        payload,
        version,
        workchain,
    } = {}) {
        const contract = walletContract ?? this.getWalletContract({ publicKey, version, workchain });

        if (!secretKey) {
            throw new Error('secretKey is required to sign the transaction');
        }

        if (!toAddress) {
            throw new Error('toAddress is required');
        }

        if (amount === undefined || amount === null) {
            throw new Error('amount is required');
        }

        const resolvedSeqno = seqno ?? await contract.methods.seqno().call();
        const amountNano = normalizeTonAmount(amount);

        return contract.methods.transfer({
            secretKey,
            toAddress,
            amount: amountNano,
            seqno: resolvedSeqno,
            payload: payload ?? null,
            sendMode,
        }).send();
    }

    async sendTokenTransaction({
        jettonWalletAddress,
        toAddress,
        amount,
        decimals = 9,
        walletContract,
        publicKey,
        secretKey,
        seqno,
        responseAddress,
        forwardAmount = '0',
        forwardPayload = null,
        gasAmount = '0.05',
        version,
        workchain,
    } = {}) {
        const contract = walletContract ?? this.getWalletContract({ publicKey, version, workchain });

        if (!jettonWalletAddress) {
            throw new Error('jettonWalletAddress is required');
        }

        if (!secretKey) {
            throw new Error('secretKey is required to sign the transaction');
        }

        if (!toAddress) {
            throw new Error('toAddress is required');
        }

        const tonWeb = this.tonWeb;
        const { Address, BN, toNano } = TonWeb.utils;
        const jettonWallet = new tonWeb.token.ft.JettonWallet(tonWeb.provider, {
            address: new Address(jettonWalletAddress),
        });

        const resolvedSeqno = seqno ?? await contract.methods.seqno().call();
        const responseAddr = responseAddress ? new Address(responseAddress) : contract.address;
        const amountUnits = scaleByDecimals(amount, decimals);
        const forwardAmountNano = toNano(forwardAmount);
        const payload = await jettonWallet.methods.transfer({
            amount: new BN(amountUnits),
            toAddress: new Address(toAddress),
            responseAddress: responseAddr,
            forwardAmount: new BN(forwardAmountNano.toString()),
            forwardPayload,
        }).getData();

        return contract.methods.transfer({
            secretKey,
            toAddress: jettonWallet.address.toString(true, true, true),
            amount: toNano(gasAmount),
            seqno: resolvedSeqno,
            payload,
            sendMode: 3,
        }).send();
    }
}

function createDefaultTonWeb() {
    if (TonWeb?.HttpProvider) {
        return new TonWeb(new TonWeb.HttpProvider('https://toncenter.com/api/v2/jsonRPC'));
    }

    return new TonWeb();
}

function normalizeTonAmount(amount) {
    const { BN, toNano } = TonWeb.utils;

    if (typeof amount === 'bigint') {
        return new BN(amount.toString());
    }

    if (typeof amount === 'number') {
        if (!Number.isFinite(amount)) {
            throw new Error('amount must be a finite number');
        }

        return toNano(amount.toString());
    }

    if (typeof amount === 'string') {
        return toNano(amount);
    }

    throw new Error('amount must be a bigint, number, or string');
}

function scaleByDecimals(value, decimals) {
    if (typeof value === 'bigint') {
        return value.toString();
    }

    if (!Number.isInteger(decimals) || decimals < 0) {
        throw new Error('decimals must be a non-negative integer');
    }

    const stringValue = typeof value === 'number' ? value.toString() : value;
    if (typeof stringValue !== 'string') {
        throw new Error('value must be a number, string, or bigint');
    }

    const [integerPart, fractionalPart = ''] = stringValue.split('.');
    const paddedFraction = (fractionalPart + '0'.repeat(decimals)).slice(0, decimals);
    const normalized = `${integerPart}${paddedFraction}`.replace(/^0+(\d)/, '$1');
    return normalized === '' ? '0' : normalized;
}
