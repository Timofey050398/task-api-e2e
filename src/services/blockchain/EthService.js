import {parseUnits, formatUnits, Contract} from 'ethers';
import { BlockchainService } from './BlockchainService.js';
import { Network } from '../../model/Network.js';
import { Currencies } from '../../model/Currency.js';
import {
    resolveEthNetworkName,
    resolveEthProviderCandidate,
    resolveProvider,
    resolveSigner,
} from './eth/config.js';
import {randomBytes} from "node:crypto";

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
        if (!txHash) {
            throw new Error("[ETH] getTx: txHash is required");
        }

        try {
            const tx = await this.provider.getTransaction(txHash);
            if (!tx) {
                throw new Error(`[ETH] Transaction not found for hash: ${txHash}`);
            }

            const receipt = await this.provider.getTransactionReceipt(txHash);
            if (!receipt) {
                throw new Error(`[ETH] Receipt not found for hash: ${txHash}`);
            }

            const isTxSuccess = receipt.status === 1 || receipt.status === 1n;
            let receiver = tx.to ?? null;
            let receiveAmount = 0;

            const decimals = currency?.decimal ?? 18;

            if (!tx.data || tx.data === "0x" || tx.data.length <= 10) {
                receiveAmount = Number(formatUnits(tx.value ?? 0, decimals));
            }

            else if (tx.data.startsWith("0xa9059cbb")) {
                // Стандартная сигнатура transfer(address,uint256)
                const recipientHex = "0x" + tx.data.slice(34, 74);
                const amountHex = tx.data.slice(74);

                receiver = recipientHex.toLowerCase();
                const rawAmount = BigInt("0x" + amountHex);
                receiveAmount = Number(formatUnits(rawAmount, decimals));
            }

            else if (receipt.logs?.length) {
                try {
                    const transferTopic =
                        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
                    const log = receipt.logs.find(
                        (l) =>
                            l.topics?.[0]?.toLowerCase() === transferTopic &&
                            l.topics?.length === 3
                    );

                    if (log) {
                        const recipient = "0x" + log.topics[2].slice(26);
                        receiver = recipient.toLowerCase();
                        const rawAmount = BigInt(log.data);
                        receiveAmount = Number(formatUnits(rawAmount, decimals));
                    }
                } catch (parseError) {
                    this.logger?.warn?.("[ETH] Failed to parse logs for transfer", parseError);
                }
            }

            return { isTxSuccess, receiver, receiveAmount };
        } catch (error) {
            this.logger?.error?.("[ETH] getTx failed", { txHash, error });
            throw error;
        }
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

    async sendNativeTransaction(to, amount) {
        if (!this.signer) throw new Error('Signer not set');
        if (!to) throw new Error('Recipient address required');

        this.logger?.info?.('[ETH] Sending native transaction', { to, amount: amount.toString() });

        try {
            const value = parseUnits(amount.toString(), 'ether');

            const { gasPrice } = await this.provider.getFeeData();
            this.logger?.info?.('[ETH] tx gasPrice', { gasPrice });
            if (!gasPrice) throw new Error('Gas price unavailable from provider');
            const estimate = await this.signer.estimateGas({ to, value });
            this.logger?.info?.('[ETH] tx estimate', { estimate });
            const fee = gasPrice * estimate;
            this.logger?.info?.('[ETH] tx fee', { fee });
            const tx = await this.signer.sendTransaction({ to, value, gasPrice, gasLimit: estimate });
            const receipt = await tx.wait();

            if (!receipt || (receipt.status !== 1n && receipt.status !== 1)) {
                throw new Error(`[ETH] Native transaction ${tx.hash} was not confirmed successfully`);
            }

            const result = {
                currency: Currencies.ETH,
                txHash: tx.hash,
                sentAmount: amount,
                fee: formatUnits(fee, 'ether'),
            };

            this.logger?.info?.('[ETH] Native transaction sent', result);
            return result;
        } catch (error) {
            this.logger?.error?.('[ETH] Failed to send native transaction', error);
            throw error;
        }
    }

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
            const contract = await this.createTokenContract(tokenAddress);
            const value = parseUnits(amount.toString(), decimals);

            const { gasPrice } = await this.provider.getFeeData();
            if (!gasPrice) throw new Error('Gas price unavailable from provider');
            const estimate = await contract.getFunction('transfer').estimateGas(to, value);
            const fee = gasPrice * estimate;

            this.logger?.info?.('[ETH] tx fee', { gasPrice, fee });
            const tx = await contract.transfer(to, value, { gasPrice, gasLimit: estimate });
            const receipt = await tx.wait();

            if (!receipt || (receipt.status !== 1n && receipt.status !== 1)) {
                throw new Error(`[ETH] Token transaction ${tx.hash} was not confirmed successfully`);
            }

            const result = {
                currency: currency,
                txHash: tx.hash,
                sentAmount: amount,
                fee: formatUnits(fee, 'ether'),
            };

            this.logger?.info?.('[ETH] Token transaction sent', result);
            return result;
        } catch (error) {
            this.logger?.error?.('[ETH] Failed to send token transaction', error);
            throw error;
        }
    }
}
