import TonWeb from 'tonweb';
import { BlockchainService } from './BlockchainService.js';
import { Currencies } from '../../model/Currency.js';
import { Network } from '../../model/Network.js';
import { resolveTonEndpoint, resolveTonNetworkName } from './ton/config.js';
import { createTonWeb } from './ton/wallet.js';
import { ONE_MINUTE_MS } from './ton/constants.js';
import {randomBytes} from "node:crypto";
import {TonTxResolver} from "./ton/TonTxResolver";
import {TonTxSender} from "./ton/TonTxSender";

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
        this.txResolver = new TonTxResolver(this);
        this.txSender = new TonTxSender(this);
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

        return this.txSender.sendNativeTransaction(toAddress, amount);
    }

    /**
     * Получает информацию о нативной транзакции TON по хэшу через tonapi.io.
     *
     * @param {string} txHash - идентификатор транзакции
     * @returns {Promise<{ isTxSuccess: boolean, receiver: string | null, receiveAmount: number }>}
     */
    async getTx(txHash) {
        return await this.txResolver.getTx(txHash);
    }
}
