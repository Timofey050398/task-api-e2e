import { Psbt, networks } from 'bitcoinjs-lib';

import { BlockchainTransactionService } from './BlockchainTransactionService.js';

const ONE_MINUTE = 60 * 1000;

export class BtcTransactionService extends BlockchainTransactionService {
    constructor(options = {}) {
        super({
            ...options,
            network: 'BTC',
            recommendedConfirmationTimeMs: options.recommendedConfirmationTimeMs ?? 60 * ONE_MINUTE,
            pollIntervalMs: options.pollIntervalMs ?? 30 * 1000,
        });

        this.broadcastProvider = options.broadcastProvider ?? null;
        this.bitcoinNetwork = resolveBitcoinNetwork(options.bitcoinNetwork);
    }

    setBroadcastProvider(broadcastProvider) {
        if (typeof broadcastProvider !== 'function') {
            throw new Error('broadcastProvider must be a function');
        }

        this.broadcastProvider = broadcastProvider;
    }

    async sendNativeTransaction({
        inputs,
        outputs,
        signers = [],
        broadcastProvider,
        finalize = true,
    } = {}) {
        if (!Array.isArray(inputs) || inputs.length === 0) {
            throw new Error('inputs must be a non-empty array');
        }

        if (!Array.isArray(outputs) || outputs.length === 0) {
            throw new Error('outputs must be a non-empty array');
        }

        const network = this.bitcoinNetwork;
        const psbt = new Psbt({ network });

        inputs.forEach((input) => {
            psbt.addInput(input);
        });

        outputs.forEach((output) => {
            psbt.addOutput(output);
        });

        signers.forEach((signer, index) => {
            psbt.signInput(index, signer);
        });

        if (finalize) {
            psbt.validateSignaturesOfAllInputs();
            psbt.finalizeAllInputs();
        }

        const transaction = finalize ? psbt.extractTransaction() : null;
        const rawTransaction = transaction ? transaction.toHex() : psbt.toBase64();

        const broadcaster = broadcastProvider ?? this.broadcastProvider;
        if (broadcaster) {
            const broadcastResult = await broadcaster(rawTransaction, { network: this.network, finalize });
            return {
                rawTransaction,
                broadcastResult,
                finalized: Boolean(finalize),
            };
        }

        return {
            rawTransaction,
            finalized: Boolean(finalize),
        };
    }
}

function resolveBitcoinNetwork(networkName = 'mainnet') {
    switch (networkName) {
        case 'testnet':
            return networks.testnet;
        case 'regtest':
            return networks.regtest ?? networks.testnet;
        case 'signet':
            return networks.testnet;
        case 'mainnet':
        case 'bitcoin':
        default:
            return networks.bitcoin;
    }
}
