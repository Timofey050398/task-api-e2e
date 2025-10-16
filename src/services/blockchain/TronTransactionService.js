import TronWeb from 'tronweb';

import { BlockchainTransactionService } from './BlockchainTransactionService.js';

const ONE_MINUTE = 60 * 1000;

export class TronTransactionService extends BlockchainTransactionService {
    constructor(options = {}) {
        super({
            ...options,
            network: 'TRON',
            recommendedConfirmationTimeMs: options.recommendedConfirmationTimeMs ?? 2 * ONE_MINUTE,
            pollIntervalMs: options.pollIntervalMs ?? 10 * 1000,
        });

        this.tronWeb = options.tronWeb ?? null;
    }

    setClient(tronWeb) {
        if (!tronWeb) {
            throw new Error('tronWeb instance is required');
        }

        this.tronWeb = tronWeb;
    }

    async sendNativeTransaction({
        from,
        to,
        amount,
        unit = 'sun',
        privateKey,
        tronWeb,
        feeLimit,
    } = {}) {
        const client = tronWeb ?? this.tronWeb;
        if (!client) {
            throw new Error('A TronWeb instance must be provided');
        }

        if (!from || !to) {
            throw new Error('Both from and to addresses are required');
        }

        if (!privateKey) {
            throw new Error('privateKey is required to sign the transaction');
        }

        const amountInSun = normalizeTronAmount(amount, unit, client);
        const amountAsNumber = normalizeSunToNumber(amountInSun);
        const unsignedTx = await client.transactionBuilder.sendTrx(to, amountAsNumber, from);
        if (feeLimit) {
            unsignedTx.raw_data.fee_limit = feeLimit;
        }

        const signedTx = await client.trx.sign(unsignedTx, privateKey);
        return client.trx.sendRawTransaction(signedTx);
    }

    async sendTokenTransaction({
        tokenAddress,
        from,
        to,
        amount,
        decimals = 6,
        privateKey,
        feeLimit = 1_000_000,
        tronWeb,
    } = {}) {
        const client = tronWeb ?? this.tronWeb;
        if (!client) {
            throw new Error('A TronWeb instance must be provided');
        }

        if (!tokenAddress) {
            throw new Error('tokenAddress is required');
        }

        if (!from || !to) {
            throw new Error('Both from and to addresses are required');
        }

        if (!privateKey) {
            throw new Error('privateKey is required to sign the transaction');
        }

        const contract = await client.contract().at(tokenAddress);
        const value = normalizeTokenAmount(amount, decimals);

        return contract.transfer(to, value).send({ feeLimit, shouldPollResponse: false, from }, privateKey);
    }
}

function normalizeTronAmount(amount, unit, client) {
    if (typeof amount === 'bigint') {
        return amount.toString();
    }

    if (typeof amount === 'number') {
        if (!Number.isFinite(amount)) {
            throw new Error('amount must be a finite number');
        }

        return convertByUnit(amount.toString(), unit, client);
    }

    if (typeof amount === 'string') {
        return convertByUnit(amount, unit, client);
    }

    throw new Error('amount must be a bigint, number, or string');
}

function normalizeSunToNumber(value) {
    const asBigInt = BigInt(value);
    if (asBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error('amount is too large to be represented safely for TronWeb');
    }

    return Number(asBigInt);
}

function convertByUnit(value, unit, client) {
    if (unit === 'sun') {
        return value;
    }

    if (unit === 'trx') {
        return client.toSun(value).toString();
    }

    throw new Error(`Unsupported unit ${unit}. Use "sun" or "trx".`);
}

function normalizeTokenAmount(amount, decimals) {
    if (typeof amount === 'bigint') {
        return amount.toString();
    }

    if (typeof amount === 'number') {
        if (!Number.isFinite(amount)) {
            throw new Error('amount must be a finite number');
        }

        return scaleDecimals(amount.toString(), decimals);
    }

    if (typeof amount === 'string') {
        return scaleDecimals(amount, decimals);
    }

    throw new Error('amount must be a bigint, number, or string');
}

function scaleDecimals(value, decimals) {
    if (!Number.isInteger(decimals) || decimals < 0) {
        throw new Error('decimals must be a non-negative integer');
    }

    const [integerPart, fractionalPart = ''] = value.split('.');
    const paddedFraction = (fractionalPart + '0'.repeat(decimals)).slice(0, decimals);
    const normalized = `${integerPart}${paddedFraction}`.replace(/^0+(\d)/, '$1');
    return normalized === '' ? '0' : normalized;
}
