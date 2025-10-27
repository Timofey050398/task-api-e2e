import {Contract} from 'ethers';
import { BlockchainService } from './BlockchainService.js';
import { Network } from '../../model/Network.js';
import {
    resolveEthNetworkName,
    resolveEthProviderCandidate,
    resolveProvider,
    resolveSigner,
} from './eth/config.js';
import {randomBytes} from "node:crypto";
import {EthTxResolver} from "./eth/EthTxResolver";
import {EthTxSender} from "./eth/EthTxSender";

const ONE_MINUTE = 60 * 1000;
const DEFAULT_ERC20_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];

export class EthService extends BlockchainService {
    constructor(options = {}) {
        const networkName = resolveEthNetworkName();
        super({
            ...options,
            network: 'ETH',
            recommendedConfirmationTimeMs: options.recommendedConfirmationTimeMs ?? 3 * ONE_MINUTE,
            pollIntervalMs: options.pollIntervalMs ?? 15 * 1000,
        });

        const providerCandidate = options.provider ?? resolveEthProviderCandidate(networkName);
        this.provider = resolveProvider(providerCandidate);
        if (!this.provider) {
            throw new Error('ETH provider is not configured. Set ETH_RPC_URL, configure ETH_NETWORK, or pass provider via options.');
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
        this.createTokenContract =
            options.createTokenContract ??
            ((tokenAddress) => new Contract(tokenAddress, this.tokenAbi, this.signer));
        this.txResolver = new EthTxResolver(this);
        this.txSender = new EthTxSender(this);
    }

    async generateRandomAddress() {
        // noinspection JSValidateTypes
        return `0x${randomBytes(20).toString("hex")}`;
    }

    /**
     * Получает информацию о транзакции в сети Ethereum (ETH или ERC-20).
     *
     * @param {string} txHash - хеш транзакции
     * @param {Currency | undefined} currency - объект валюты (может содержать .decimal и .tokenContract)
     * @returns {Promise<{ isTxSuccess: boolean, receiver: string | null, receiveAmount: number }>}
     */
    async getTx(txHash, currency) {
        return await this.txResolver.getTx(txHash, currency);
    }

    async send(to, amount, currency) {
        if (!currency) {
            throw new Error('Currency required');
        }

        if (currency.network !== Network.ETH) {
            throw new Error('Only ETH network supported');
        }

        if ('tokenContract' in currency && currency.tokenContract) {
            return this.txSender.sendTokenTransaction(to, amount, currency);
        }

        return this.txSender.sendNativeTransaction(to, amount);
    }
}
