import TonWeb from 'tonweb';
import { BlockchainTransactionService } from './BlockchainTransactionService.js';
import { Currencies } from '../../model/Currency.js';
import { Network } from '../../model/Network.js';
import { resolveTonEndpoint, resolveTonNetworkName } from './ton/config.js';
import { createTonWallet, createTonWeb } from './ton/wallet.js';
import {
    estimateTonFee,
    normalizeSeqno,
    normalizeTonAmount,
    scaleByDecimals,
} from './ton/utils.js';
import { createTonSeqnoStatusProvider } from './ton/providers.js';
import { ONE_MINUTE_MS } from './ton/constants.js';

export class TonTransactionService extends BlockchainTransactionService {
    constructor(options = {}) {
        const networkName = resolveTonNetworkName();
        super({
            ...options,
            network: 'TON',
            recommendedConfirmationTimeMs: options.recommendedConfirmationTimeMs ?? ONE_MINUTE_MS,
            pollIntervalMs: options.pollIntervalMs ?? 5 * 1000,
        });

        this.tonNetworkName = networkName;

        this.apiKey = process.env.TON_API_KEY;
        this.publicKey = process.env.TON_WALLET_PUBLIC_KEY;
        this.secretKey = process.env.TON_WALLET_PRIVATE_KEY;

        const endpointCandidate = options.endpoint ?? process.env.TON_API_ENDPOINT;
        this.tonEndpoint = resolveTonEndpoint(endpointCandidate, networkName);

        this.tonWeb =
            options.tonWeb ??
            createTonWeb({ apiKey: this.apiKey, endpoint: this.tonEndpoint });

        this.defaultWalletVersion = options.defaultWalletVersion ?? 'v4R2';
        this.defaultWorkchain = options.defaultWorkchain ?? 0;
        this.currency = Currencies.TON;
    }

    async send(toAddress, amount, currency) {
        if (!currency) {
            throw new Error('Currency required');
        }

        if (currency.network !== Network.TON) {
            throw new Error('Only TON network supported');
        }

        if ('tokenContract' in currency && currency.tokenContract) {
            return this.sendTokenTransaction(toAddress, amount, currency);
        }

        return this.sendNativeTransaction(toAddress, amount);
    }

    getWalletContract({
        publicKey = this.publicKey,
        version = this.defaultWalletVersion,
        workchain = this.defaultWorkchain,
    } = {}) {
        if (!publicKey) throw new Error('publicKey is required');

        return createTonWallet(this.tonWeb, { publicKey, version, workchain });
    }

    async sendNativeTransaction(toAddress, amount) {
        if (!this.secretKey || !this.publicKey)
            throw new Error('Wallet keys not configured in environment');
        if (!toAddress) throw new Error('toAddress is required');
        if (!amount) throw new Error('amount is required');

        this.logger?.info?.('[TON] Sending native transaction', { toAddress, amount });

        try {
            const contract = this.getWalletContract();
            const seqnoRaw = await contract.methods.seqno().call();
            const seqno = normalizeSeqno(seqnoRaw);
            const amountNano = normalizeTonAmount(amount);

            const result = await contract.methods.transfer({
                secretKey: this.secretKey,
                toAddress,
                amount: amountNano,
                seqno,
                sendMode: 3,
            }).send();

            const response = {
                currency: Currencies.TON,
                txHash: result?.id?.hash ?? 'unknown',
                sentAmount: amount,
                fee: estimateTonFee(),
            };

            this.logger?.info?.('[TON] Native transaction sent', response);

            const expectedSeqno = seqno + 1;
            await this.waitForConfirmation(response.txHash, {
                statusProvider: createTonSeqnoStatusProvider(contract, expectedSeqno, { logger: this.logger }),
            });

            return response;
        } catch (error) {
            this.logger?.error?.('[TON] Failed to send native transaction', error);
            throw error;
        }
    }

    async sendTokenTransaction(toAddress, amount, currency) {
        if (!currency) throw new Error('Currency required');
        if (currency.network !== Network.TON) throw new Error('Only TON network supported');
        if (!currency.tokenContract) throw new Error('Token contract missing in currency');

        this.logger?.info?.('[TON] Sending token transaction', {
            toAddress,
            amount,
            tokenContract: currency.tokenContract,
        });

        try {
            const contract = this.getWalletContract();
            const seqnoRaw = await contract.methods.seqno().call();
            const seqno = normalizeSeqno(seqnoRaw);

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
            const payload = await jettonWallet.methods.transfer({
                amount: new BN(amountUnits),
                toAddress: new Address(toAddress),
                responseAddress: responseAddr,
                forwardAmount: new BN(toNano('0.02').toString()),
                forwardPayload: null,
            }).getData();

            const result = await contract.methods.transfer({
                secretKey: this.secretKey,
                toAddress: jettonWallet.address.toString(true, true, true),
                amount: toNano('0.05'),
                seqno,
                payload,
                sendMode: 3,
            }).send();

            const response = {
                currency: currency,
                txHash: result?.id?.hash ?? 'unknown',
                sentAmount: amount,
                fee: '0.05',
            };

            this.logger?.info?.('[TON] Token transaction sent', response);

            const expectedSeqno = seqno + 1;
            await this.waitForConfirmation(response.txHash, {
                statusProvider: createTonSeqnoStatusProvider(contract, expectedSeqno, { logger: this.logger }),
            });

            return response;
        } catch (error) {
            this.logger?.error?.('[TON] Failed to send token transaction', error);
            throw error;
        }
    }
}
