import { Contract, JsonRpcProvider, Wallet, parseUnits } from 'ethers';

import { BlockchainTransactionService } from './BlockchainTransactionService.js';

const ONE_MINUTE = 60 * 1000;

const DEFAULT_ERC20_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
];

export class EthTransactionService extends BlockchainTransactionService {
    constructor(options = {}) {
        super({
            ...options,
            network: 'ETH',
            recommendedConfirmationTimeMs: options.recommendedConfirmationTimeMs ?? 3 * ONE_MINUTE,
            pollIntervalMs: options.pollIntervalMs ?? 15 * 1000,
        });

        this.provider = resolveProvider(options.provider);
        this.signer = resolveSigner(options.signer, this.provider);
        this.tokenAbi = options.tokenAbi ?? DEFAULT_ERC20_ABI;
    }

    setProvider(provider) {
        this.provider = resolveProvider(provider);
    }

    setSigner(signer) {
        this.signer = resolveSigner(signer, this.provider);
    }

    setTokenAbi(tokenAbi) {
        if (!Array.isArray(tokenAbi)) {
            throw new Error('tokenAbi must be an array describing the contract interface');
        }

        this.tokenAbi = tokenAbi;
    }

    async sendNativeTransaction({
        to,
        amount,
        unit = 'wei',
        gasLimit,
        gasPrice,
        data,
        nonce,
        signer,
    } = {}) {
        const resolvedSigner = resolveSigner(signer, this.provider) ?? this.signer;
        if (!resolvedSigner) {
            throw new Error('A signer must be provided to send native transactions');
        }

        if (!to) {
            throw new Error('Recipient address is required');
        }

        if (amount === undefined || amount === null) {
            throw new Error('amount is required');
        }

        const value = normalizeAmount(amount, unit);

        const transactionRequest = {
            to,
            value,
            data,
            gasLimit,
            gasPrice,
            nonce,
        };

        return resolvedSigner.sendTransaction(transactionRequest);
    }

    async sendTokenTransaction({
        tokenAddress,
        to,
        amount,
        decimals = 18,
        gasLimit,
        gasPrice,
        nonce,
        signer,
        tokenAbi,
    } = {}) {
        const resolvedSigner = resolveSigner(signer, this.provider) ?? this.signer;
        if (!resolvedSigner) {
            throw new Error('A signer must be provided to send token transactions');
        }

        if (!tokenAddress) {
            throw new Error('tokenAddress is required');
        }

        if (!to) {
            throw new Error('Recipient address is required');
        }

        if (amount === undefined || amount === null) {
            throw new Error('amount is required');
        }

        const abi = tokenAbi ?? this.tokenAbi;
        if (!Array.isArray(abi)) {
            throw new Error('tokenAbi must be an array describing the contract interface');
        }

        const contract = new Contract(tokenAddress, abi, resolvedSigner);
        const value = normalizeAmount(amount, decimals);

        return contract.transfer(to, value, {
            gasLimit,
            gasPrice,
            nonce,
        });
    }
}

function resolveProvider(provider) {
    if (!provider) {
        return null;
    }

    if (typeof provider === 'string') {
        return new JsonRpcProvider(provider);
    }

    return provider;
}

function resolveSigner(signer, provider) {
    if (!signer) {
        return null;
    }

    if (typeof signer === 'string') {
        if (!provider) {
            throw new Error('A provider must be supplied when signer is a private key');
        }

        return new Wallet(signer, provider);
    }

    return signer;
}

function normalizeAmount(amount, unit) {
    if (typeof amount === 'bigint') {
        return amount;
    }

    if (typeof amount === 'number') {
        if (!Number.isFinite(amount)) {
            throw new Error('amount must be a finite number');
        }

        return parseAmountFromString(amount.toString(), unit);
    }

    if (typeof amount === 'string') {
        return parseAmountFromString(amount, unit);
    }

    throw new Error('amount must be a bigint, number, or string');
}

function parseAmountFromString(value, unit) {
    if (unit === 'wei') {
        return BigInt(value);
    }

    if (typeof unit === 'number') {
        return parseUnits(value, unit);
    }

    if (typeof unit === 'string' && /^\d+$/.test(unit)) {
        return parseUnits(value, Number(unit));
    }

    return parseUnits(value, unit);
}
