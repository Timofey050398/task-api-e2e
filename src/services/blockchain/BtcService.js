import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import { BlockchainService } from './BlockchainService.js';
import { normalizeBtcAmount } from './btc/amount.js';
import { ONE_MINUTE_MS } from './btc/constants.js';
import {Buffer} from "buffer";
import {BtcParamSetter} from "./btc/BtcParamSetter";

export class BtcService extends BlockchainService {
    constructor(options = {}) {
        super({
            ...options,
            network: 'BTC',
            recommendedConfirmationTimeMs: options.recommendedConfirmationTimeMs ?? 30 * ONE_MINUTE_MS,
            pollIntervalMs: options.pollIntervalMs ?? 30 * 1000,
        });
        this.paramSetter = new BtcParamSetter(this);
        this.paramSetter.setParams(this.options);
    }

    async generateRandomAddress() {
        const ECPair = ECPairFactory(ecc);
        const btcNetwork = process.env.BTC_NETWORK === 'testnet'
            ? bitcoin.networks.testnet
            : bitcoin.networks.bitcoin;

        const keyPair = ECPair.makeRandom({ network: btcNetwork });
        const { address } = bitcoin.payments.p2wpkh({
            pubkey: Buffer.from(keyPair.publicKey),
            network: btcNetwork,
        });
        // noinspection JSValidateTypes
        return address;
    }

    /**
     * Получает информацию о транзакции по её txid.
     * Возвращает { isTxSuccess, receiver, receiveAmount }.
     *
     * receiveAmount — в BTC (не в сатоши).
     */
    async getTx(txid) {
        return await this.txResolver.getTx(txid);
    }

    async send(to, value, currency = this.currency) {
        if (currency?.network && currency.network !== this.network) {
            throw new Error('Only BTC network supported');
        }

        const { satoshis, humanAmount } = normalizeBtcAmount(value);

        return this.txSender.sendTransaction(to, satoshis, humanAmount);
    }
}
