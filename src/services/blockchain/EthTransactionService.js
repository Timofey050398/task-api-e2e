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

        this.provider = resolveProvider(process.env.ETH_RPC_URL);
        this.signer = resolveSigner(process.env.ETH_PRIVATE_KEY, this.provider);
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

        const value = parseUnits(amount.toString(), 'ether');

        const { gasPrice } = await this.provider.getFeeData();
        if (!gasPrice) throw new Error('Gas price unavailable from provider');
        const estimate = await this.signer.estimateGas({ to, value });
        const fee = gasPrice * estimate;

        const tx = await this.signer.sendTransaction({ to, value, gasPrice, gasLimit: estimate });

        return {
            txHash: tx.hash,
            feeEth: formatUnits(fee, 'ether'),
        };
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

        const tokenAddress = currency.tokenContract;
        const decimals = currency.decimal;
        const contract = new Contract(tokenAddress, this.tokenAbi, this.signer);
        const value = parseUnits(amount.toString(), decimals);

        const { gasPrice } = await this.provider.getFeeData();
        if (!gasPrice) throw new Error('Gas price unavailable from provider');
        const estimate = await contract.estimateGas.transfer(to, value);
        const fee = gasPrice * estimate;

        const tx = await contract.transfer(to, value, { gasPrice, gasLimit: estimate });

        return {
            txHash: tx.hash,
            feeEth: formatUnits(fee, 'ether'),
        };
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