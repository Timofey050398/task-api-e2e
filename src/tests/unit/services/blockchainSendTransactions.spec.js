import { test, expect } from '@playwright/test';
import TonWeb from 'tonweb';
import {
    BtcTransactionService,
    EthTransactionService,
    TronTransactionService,
    TonTransactionService,
} from '../../../services/blockchain/index.js';

const Network = {
    BTC: 'BTC',
    ETH: 'ETH',
    TRON: 'TRON',
    TON: 'TON',
};

class TestBtcTransactionService extends BtcTransactionService {
    constructor(options = {}) {
        super({
            ...options,
            recommendedConfirmationTimeMs: 1,
            pollIntervalMs: 1,
            bitcoinNetwork: 'regtest',
            ecpair: { fromWIF: () => ({}) },
        });
        this.lastSendArgs = null;
    }

    async sendTransaction(recipientAddress, sendValueSatoshis, humanAmount) {
        this.lastSendArgs = { recipientAddress, sendValueSatoshis, humanAmount };
        return {
            currency: { network: Network.BTC },
            txHash: 'btc-tx-hash',
            sentAmount: humanAmount,
            fee: 123n,
        };
    }

    async waitForConfirmation() {
        return { confirmed: true, status: {} };
    }
}

class MockEthSigner {
    constructor(provider) {
        this.provider = provider;
    }

    connect(provider) {
        this.provider = provider;
        return this;
    }

    async estimateGas() {
        return 21_000n;
    }

    async sendTransaction({ to, value, gasPrice, gasLimit }) {
        return {
            hash: 'eth-native-hash',
            wait: async () => ({ status: 1 }),
            to,
            value,
            gasPrice,
            gasLimit,
        };
    }
}

class CapturingEthTokenContract {
    constructor() {
        this.transferCalls = [];
    }

    get estimateGas() {
        return {
            transfer: async (_to, value) => {
                this.estimatedValue = value;
                return 140n;
            },
        };
    }

    async transfer(to, value, overrides) {
        this.transferCalls.push({ to, value, overrides });
        return {
            hash: 'eth-token-hash',
            wait: async () => ({ status: 1 }),
        };
    }
}

class TestTronTransactionService extends TronTransactionService {
    constructor({ tronWeb, statusProvider = async () => ({ confirmed: true, status: {} }) }) {
        super({ tronWeb, statusProvider, recommendedConfirmationTimeMs: 100, pollIntervalMs: 5 });
        this.tronWeb = tronWeb;
        this.setStatusProvider(statusProvider);
    }
}

class TestTonTransactionService extends TonTransactionService {
    constructor(options) {
        super({ ...options, recommendedConfirmationTimeMs: 1, pollIntervalMs: 1 });
        this.mockContract = options.mockContract;
    }

    getWalletContract() {
        return this.mockContract;
    }

    async waitForConfirmation() {
        return { confirmed: true, status: {} };
    }
}

const originalTonUtils = {
    Address: TonWeb.utils.Address,
    BN: TonWeb.utils.BN,
    toNano: TonWeb.utils.toNano,
    fromNano: TonWeb.utils.fromNano,
};

class SimpleAddress {
    constructor(value) {
        this.value = value;
    }

    toString() {
        return this.value;
    }
}

class SimpleBN {
    constructor(value) {
        this.value = BigInt(value.toString());
    }

    toString() {
        return this.value.toString();
    }
}

TonWeb.utils.Address = SimpleAddress;
TonWeb.utils.BN = SimpleBN;
TonWeb.utils.toNano = (value) => BigInt(Math.round(Number(value) * 1_000_000_000));
TonWeb.utils.fromNano = (value) => (Number(value) / 1_000_000_000).toString();

test.describe('Blockchain transaction send flows without external dependencies', () => {
    test('BTC service normalizes amount before delegating to sendTransaction', async () => {
        const service = new TestBtcTransactionService();

        const result = await service.send('btc-recipient', '0.0005', { network: Network.BTC });

        expect(service.lastSendArgs).toEqual({
            recipientAddress: 'btc-recipient',
            sendValueSatoshis: 50_000,
            humanAmount: '0.0005',
        });
        expect(result.txHash).toBe('btc-tx-hash');
        expect(result.currency.network).toBe(Network.BTC);
        expect(result.sentAmount).toBe('0.0005');
    });

    test('ETH service sends native transaction using provided signer/provider', async () => {
        const provider = {
            async getFeeData() {
                return { gasPrice: 1_500_000_000n };
            },
            async getBlockNumber() {
                return 0;
            },
        };
        const signer = new MockEthSigner(provider);

        const service = new EthTransactionService({
            provider,
            signer,
            recommendedConfirmationTimeMs: 1,
            pollIntervalMs: 1,
        });

        const result = await service.send('0xrecipient', '1.5', { network: Network.ETH });

        expect(result.txHash).toBe('eth-native-hash');
        expect(result.currency.network).toBe(Network.ETH);
        expect(result.sentAmount).toBe('1.5');
        expect(result.fee).toBe('0.0000315');
    });

    test('ETH service sends token transaction via injected contract factory', async () => {
        const provider = {
            async getFeeData() {
                return { gasPrice: 2_000_000_000n };
            },
            async getBlockNumber() {
                return 0;
            },
        };
        const signer = new MockEthSigner(provider);
        const tokenContract = new CapturingEthTokenContract();

        const service = new EthTransactionService({
            provider,
            signer,
            recommendedConfirmationTimeMs: 1,
            pollIntervalMs: 1,
            createTokenContract: () => tokenContract,
        });

        const currency = { network: Network.ETH, tokenContract: '0xtoken', decimal: 6 };
        const result = await service.send('0xrecipient', '3.25', currency);

        expect(result.txHash).toBe('eth-token-hash');
        expect(result.currency).toBe(currency);
        expect(result.sentAmount).toBe('3.25');
        expect(result.fee).toBe('0.00000028');
        expect(tokenContract.estimatedValue).toBeDefined();
        expect(tokenContract.transferCalls).toHaveLength(1);
    });

    test('TRON service sends native transaction via stub TronWeb client', async () => {
        const originalPrivateKey = process.env.TRON_PRIVATE_KEY;
        process.env.TRON_PRIVATE_KEY = 'test-private-key';

        const tronWeb = {
            defaultAddress: { base58: 'TSenderAddress' },
            toSun: (value) => Math.round(Number(value) * 1_000_000),
            fromSun: (value) => value / 1_000_000,
            transactionBuilder: {
                async sendTrx(to, amountInSun, from) {
                    return { to, amountInSun, from };
                },
            },
            trx: {
                async sign(tx) {
                    return { ...tx, signed: true };
                },
                async sendRawTransaction() {
                    return { txid: 'tron-native-hash' };
                },
            },
        };

        const statusProvider = async () => ({ confirmed: true, receipt: { energy_fee: 2_000_000 } });
        const service = new TestTronTransactionService({ tronWeb, statusProvider });

        const result = await service.send('TRecipient', 2.5, { network: Network.TRON });

        expect(result.txHash).toBe('tron-native-hash');
        expect(result.currency.network).toBe(Network.TRON);
        expect(result.sentAmount).toBe(2.5);
        expect(result.fee).toBe(2);

        process.env.TRON_PRIVATE_KEY = originalPrivateKey;
    });

    test('TRON service sends token transaction without hitting network', async () => {
        const originalPrivateKey = process.env.TRON_PRIVATE_KEY;
        process.env.TRON_PRIVATE_KEY = 'test-private-key';

        let capturedTransfer = null;
        const tronWeb = {
            defaultAddress: { base58: 'TSenderAddress' },
            toSun: (value) => Math.round(Number(value) * 1_000_000),
            fromSun: (value) => value / 1_000_000,
            contract() {
                return {
                    async at() {
                        return {
                            transfer: (to, amount) => {
                                capturedTransfer = { to, amount };
                                return {
                                    async send() {
                                        return { txid: 'tron-token-hash' };
                                    },
                                };
                            },
                        };
                    },
                };
            },
            trx: {
                async sign(tx) {
                    return { ...tx, signed: true };
                },
                async sendRawTransaction() {
                    return { txid: 'tron-native-hash' };
                },
            },
        };

        const statusProvider = async () => ({ confirmed: true, receipt: { energy_fee: 3_000_000 } });
        const service = new TestTronTransactionService({ tronWeb, statusProvider });

        const currency = { network: Network.TRON, tokenContract: 'TToken', decimal: 6 };
        const result = await service.send('TRecipient', 1.5, currency);

        expect(result.txHash).toBe('tron-token-hash');
        expect(result.currency).toBe(currency);
        expect(result.sentAmount).toBe(1.5);
        expect(result.fee).toBe(3);
        expect(capturedTransfer).toEqual({ to: 'TRecipient', amount: '1500000' });

        process.env.TRON_PRIVATE_KEY = originalPrivateKey;
    });

    test('TON service sends native transaction through mocked wallet contract', async () => {
        const originalPublic = process.env.TON_WALLET_PUBLIC_KEY;
        const originalPrivate = process.env.TON_WALLET_PRIVATE_KEY;
        process.env.TON_WALLET_PUBLIC_KEY = 'test-public';
        process.env.TON_WALLET_PRIVATE_KEY = 'test-private';

        const contractCalls = [];
        const mockContract = {
            address: 'sender-address',
            methods: {
                seqno: () => ({
                    call: async () => 41,
                }),
                transfer: (args) => ({
                    send: async () => {
                        contractCalls.push(args);
                        return { id: { hash: 'ton-native-hash' } };
                    },
                }),
            },
        };

        const tonWeb = { provider: {}, token: { ft: { JettonWallet: class {} } } };
        const service = new TestTonTransactionService({ tonWeb, mockContract });

        const result = await service.send('ton-recipient', '1.2', { network: Network.TON });

        expect(result.txHash).toBe('ton-native-hash');
        expect(result.currency.network).toBe(Network.TON);
        expect(result.sentAmount).toBe('1.2');
        expect(contractCalls).toHaveLength(1);

        process.env.TON_WALLET_PUBLIC_KEY = originalPublic;
        process.env.TON_WALLET_PRIVATE_KEY = originalPrivate;
    });

    test('TON service sends token transaction using stub Jetton wallet', async () => {
        const originalPublic = process.env.TON_WALLET_PUBLIC_KEY;
        const originalPrivate = process.env.TON_WALLET_PRIVATE_KEY;
        process.env.TON_WALLET_PUBLIC_KEY = 'test-public';
        process.env.TON_WALLET_PRIVATE_KEY = 'test-private';

        class MockJettonWallet {
            constructor() {
                this.address = {
                    toString: () => 'jetton-wallet-address',
                };
                this.methods = {
                    transfer: () => ({
                        getData: async () => 'mocked-payload',
                    }),
                };
            }
        }

        const tonWeb = { provider: {}, token: { ft: { JettonWallet: MockJettonWallet } } };
        const contractCalls = [];
        const mockContract = {
            address: 'sender-address',
            methods: {
                seqno: () => ({
                    call: async () => 7,
                }),
                transfer: (args) => ({
                    send: async () => {
                        contractCalls.push(args);
                        return { id: { hash: 'ton-token-hash' } };
                    },
                }),
            },
        };

        const service = new TestTonTransactionService({ tonWeb, mockContract });
        const currency = { network: Network.TON, tokenContract: 'ton-token', decimal: 9 };

        const result = await service.send('ton-recipient', '5.5', currency);

        expect(result.txHash).toBe('ton-token-hash');
        expect(result.currency).toBe(currency);
        expect(result.sentAmount).toBe('5.5');
        expect(result.fee).toBe('0.05');
        expect(contractCalls).toHaveLength(1);
        expect(contractCalls[0].payload).toBe('mocked-payload');

        process.env.TON_WALLET_PUBLIC_KEY = originalPublic;
        process.env.TON_WALLET_PRIVATE_KEY = originalPrivate;
    });
});

test.afterAll(() => {
    TonWeb.utils.Address = originalTonUtils.Address;
    TonWeb.utils.BN = originalTonUtils.BN;
    TonWeb.utils.toNano = originalTonUtils.toNano;
    TonWeb.utils.fromNano = originalTonUtils.fromNano;
});
