import { Contract, JsonRpcProvider, Wallet, parseUnits, formatUnits } from 'ethers';
import { BlockchainTransactionService } from './BlockchainTransactionService.js';
import {Network} from "../../model/Network";

const ONE_MINUTE = 60 * 1000;
const DEFAULT_ERC20_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];

export class EthTransactionService extends BlockchainTransactionService {
    constructor(options = {}) {
        super({
            ...options,
            network: 'ETH',
            recommendedConfirmationTimeMs: options.recommendedConfirmationTimeMs ?? 3 * ONE_MINUTE,
            pollIntervalMs: options.pollIntervalMs ?? 15 * 1000,
        });

        const providerCandidate = options.provider ?? process.env.ETH_RPC_URL;
        this.provider = resolveProvider(providerCandidate);
        if (!this.provider) {
            throw new Error('ETH provider is not configured. Set ETH_RPC_URL or pass provider via options.');
        }

        const signerCandidate = options.signer ?? process.env.ETH_PRIVATE_KEY;
        this.signer = resolveSigner(signerCandidate, this.provider);
        if (!this.signer) {
            throw new Error('ETH signer is not configured. Set ETH_PRIVATE_KEY or pass signer via options.');
        }

        if (typeof this.provider.getFeeData !== 'function' || typeof this.provider.getBlockNumber !== 'function') {
            throw new Error('Provided ETH provider does not implement required interface');
        }

        if (typeof this.signer.estimateGas !== 'function' || typeof this.signer.sendTransaction !== 'function') {
            throw new Error('Provided ETH signer does not implement required interface');
        }

        if (this.signer.provider !== this.provider && typeof this.signer.connect === 'function') {
            this.signer = this.signer.connect(this.provider);
        }

        if (this.signer.provider !== this.provider) {
            throw new Error('ETH signer must be connected to the configured provider');
        }
        this.tokenAbi = options.tokenAbi ?? DEFAULT_ERC20_ABI;
    }

    async send(to, amount, currency) {
        if (!currency) {
            throw new Error('Currency required');
        }

        if (currency.network !== Network.ETH) {
            throw new Error('Only ETH network supported');
        }

        if ('tokenContract' in currency && currency.tokenContract) {
            return this.sendTokenTransaction(to, amount, currency);
        }

        return this.sendNativeTransaction(to, amount);
    }

    /**
     * Отправка ETH
     * @param {string} to - получатель
     * @param {string|number|bigint} amount - сумма (в ETH или в wei)
     * @returns {Promise<{txHash: string, feeEth: string}>}
     */
    async sendNativeTransaction(to, amount) {
        if (!this.signer) throw new Error('Signer not set');
        if (!to) throw new Error('Recipient address required');

        this.logger?.info?.('[ETH] Sending native transaction', { to, amount: amount.toString() });

        try {
            const value = parseUnits(amount.toString(), 'ether');

            const { gasPrice } = await this.provider.getFeeData();
            if (!gasPrice) throw new Error('Gas price unavailable from provider');
            const estimate = await this.signer.estimateGas({ to, value });
            const fee = gasPrice * estimate;

            const tx = await this.signer.sendTransaction({ to, value, gasPrice, gasLimit: estimate });
            const result = {
                txHash: tx.hash,
                feeEth: formatUnits(fee, 'ether'),
            };

            this.logger?.info?.('[ETH] Native transaction sent', result);
            return result;
        } catch (error) {
            this.logger?.error?.('[ETH] Failed to send native transaction', error);
            throw error;
        }
    }

    /**
     * @param {string} to
     * @param {string|number} amount
     * @param {typeof Currencies[keyof typeof Currencies]} currency
     * @returns {Promise<{txHash: string, feeEth: string}>}
     */
    async sendTokenTransaction(to, amount, currency) {
        if (!this.signer) throw new Error('Signer not set');
        if (!to) throw new Error('Recipient address required');
        if (!currency) throw new Error('Currency required');

        if (currency.network !== Network.ETH) {
            throw new Error('Only ETH network supported');
        }

        if (!('tokenContract' in currency) || !('decimal' in currency)) {
            throw new Error('Currency must include tokenContract and decimal');
        }

        this.logger?.info?.('[ETH] Sending token transaction', {
            to,
            amount: amount.toString(),
            tokenContract: currency.tokenContract,
        });

        try {
            const tokenAddress = currency.tokenContract;
            const decimals = currency.decimal;
            const contract = new Contract(tokenAddress, this.tokenAbi, this.signer);
            const value = parseUnits(amount.toString(), decimals);

            const { gasPrice } = await this.provider.getFeeData();
            if (!gasPrice) throw new Error('Gas price unavailable from provider');
            const estimate = await contract.estimateGas.transfer(to, value);
            const fee = gasPrice * estimate;

            const tx = await contract.transfer(to, value, { gasPrice, gasLimit: estimate });
            const result = {
                txHash: tx.hash,
                feeEth: formatUnits(fee, 'ether'),
            };

            this.logger?.info?.('[ETH] Token transaction sent', result);
            return result;
        } catch (error) {
            this.logger?.error?.('[ETH] Failed to send token transaction', error);
            throw error;
        }
    }
}

/** --- helpers --- */

function resolveProvider(provider) {
    if (!provider) return null;
    if (typeof provider === 'string') return new JsonRpcProvider(provider);
    return provider;
}

function resolveSigner(signer, provider) {
    if (!signer) return null;
    if (typeof signer === 'string') return new Wallet(signer, provider);
    return signer;
}