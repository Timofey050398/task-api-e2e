import TonWeb from 'tonweb';
import { BlockchainService } from './BlockchainService.js';
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
import {randomBytes} from "node:crypto";

export class TonService extends BlockchainService {
    constructor(options = {}) {
        const networkName = resolveTonNetworkName();
        super({
            ...options,
            network: 'TON',
            recommendedConfirmationTimeMs: options.recommendedConfirmationTimeMs ?? ONE_MINUTE_MS,
            pollIntervalMs: options.pollIntervalMs ?? 5 * 1000,
        });

        const {hexToBytes} = TonWeb.utils;
        this.apiKey = process.env.TON_API_KEY;

        const parseHexKey = (value, {expectedBytes, envName}) => {
            if (!value) return undefined;

            const bytes = hexToBytes(value);
            if (bytes.length !== expectedBytes) {
                throw new Error(
                    `${envName} must be a hex string representing ${expectedBytes} bytes,` +
                    ` but ${bytes.length} ${bytes.length === 1 ? 'byte was' : 'bytes were'} provided`,
                );
            }

            return bytes;
        };

        this.publicKey = parseHexKey(process.env.TON_WALLET_PUBLIC_KEY_32_HEX, {
            expectedBytes: 32,
            envName: 'TON_WALLET_PUBLIC_KEY_32_HEX',
        });

        this.secretKey = parseHexKey(process.env.TON_WALLET_PRIVATE_KEY, {
            expectedBytes: 64,
            envName: 'TON_WALLET_PRIVATE_KEY',
        });

        const endpointCandidate = options.endpoint ?? process.env.TON_API_ENDPOINT;
        this.tonEndpoint = resolveTonEndpoint(endpointCandidate, networkName);

        this.tonWeb =
            options.tonWeb ??
            createTonWeb({apiKey: this.apiKey, endpoint: this.tonEndpoint});

        this.defaultWalletVersion = options.defaultWalletVersion ?? 'v4R2';
        this.defaultWorkchain = options.defaultWorkchain ?? 0;
        this.currency = Currencies.TON;
    }

    async generateRandomAddress() {
        const {Address} = TonWeb.utils;
        const randomHash = randomBytes(32).toString("hex");
        const address = new Address(`0:${randomHash}`);
        const isMainnet = Boolean(process.env.TON_API_KEY);
        // noinspection JSValidateTypes
        return address.toString(true, true, true, !isMainnet);
    }

    async send(toAddress, amount, currency) {
        if (!currency) {
            throw new Error('Currency required');
        }

        if (currency.network !== Network.TON) {
            throw new Error('Only TON network supported');
        }

        return this.sendNativeTransaction(toAddress, amount);
    }

    getWalletContract({
                          publicKey = this.publicKey,
                          version = this.defaultWalletVersion,
                          workchain = this.defaultWorkchain,
                      } = {}) {
        if (!publicKey) throw new Error('publicKey is required');

        return createTonWallet(this.tonWeb, {publicKey, version, workchain});
    }

    async sendNativeTransaction(toAddress, amount) {
        if (!this.secretKey || !this.publicKey)
            throw new Error('Wallet keys not configured in environment');
        if (!toAddress) throw new Error('toAddress is required');
        if (!amount) throw new Error('amount is required');

        this.logger?.info?.('[TON] Sending native transaction', {toAddress, amount});

        try {
            const contract = this.getWalletContract();
            let seqnoRaw = await contract.methods.seqno().call();
            if (seqnoRaw === null || seqnoRaw === undefined) {
                this.logger?.info?.('[TON] Wallet not deployed yet, sending deploy transaction...');
                await contract.deploy(this.secretKey).send();
                await new Promise(res => setTimeout(res, 5000));
                seqnoRaw = await contract.methods.seqno().call();
            }
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
                statusProvider: createTonSeqnoStatusProvider(contract, expectedSeqno, {logger: this.logger}),
            });

            return response;
        } catch (error) {
            this.logger?.error?.('[TON] Failed to send native transaction', error);
            throw error;
        }
    }

    /**
     * Получает информацию о нативной транзакции в сети TON.
     *
     * @param {string} txHash - идентификатор транзакции (boc hash)
     * @param {Currency | undefined} currency - объект валюты, может содержать decimal
     * @returns {Promise<{ isTxSuccess: boolean, receiver: string | null, receiveAmount: number }>}
     */
    async getTx(txHash) {
        if (!txHash) {
            throw new Error("[TON] getTx: txHash is required");
        }

        try {
            const tonWeb = this.tonWeb;
            if (!tonWeb) {
                throw new Error("[TON] tonWeb client not initialized");
            }

            // 1️⃣ Получаем данные транзакции
            const tx = await tonWeb.provider.getTransaction(txHash).catch(() => null);
            if (!tx) {
                throw new Error(`[TON] Transaction not found for hash: ${txHash}`);
            }

            // 2️⃣ Проверяем статус
            const isTxSuccess = tx?.in_msg?.value || tx?.out_msgs?.length > 0;

            // 3️⃣ Определяем получателя и сумму
            let receiver = null;
            let receiveAmount = 0;

            // Используем первый выходящий message
            if (tx.out_msgs && tx.out_msgs.length > 0) {
                const msg = tx.out_msgs[0];
                receiver = msg.destination?.address ?? null;

                // Получаем value в нанотонах (BigInt)
                const rawValue = BigInt(msg.value ?? 0);
                const decimals = 9; // TON — 9 знаков после запятой
                receiveAmount = Number(rawValue) / 10 ** decimals;
            }

            return {isTxSuccess, receiver, receiveAmount};
        } catch (error) {
            this.logger?.error?.("[TON] getTx failed", {txHash, error});
            throw error;
        }
    }
}
