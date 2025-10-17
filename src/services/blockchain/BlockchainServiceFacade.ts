import {
    BtcTransactionService,
    EthTransactionService,
    TonTransactionService,
    TronTransactionService,
} from "./index";
import {Currencies, CurrencyKey, CurrencyType} from "../../model/Currency";
import {Network} from "../../model/Network";

type Currency = typeof Currencies[CurrencyKey];

type BlockchainService = {
    network: Network;
    send: (to: string, value: string | number | bigint, currency: Currency) => Promise<TxResult>;
};

export interface TxResult {
    currency: Currency;
    txHash: string;
    sentAmount: string | number | bigint;
    fee: string | number | bigint;
}

type ServiceRegistry = Record<Network, BlockchainService>;

export class BlockchainServiceFacade {
    readonly btc: BtcTransactionService & BlockchainService;
    readonly eth: EthTransactionService & BlockchainService;
    readonly tron: TronTransactionService & BlockchainService;
    readonly ton: TonTransactionService & BlockchainService;

    private readonly services: ServiceRegistry;

    constructor() {
        this.btc = new BtcTransactionService() as BtcTransactionService & BlockchainService;
        this.eth = new EthTransactionService() as EthTransactionService & BlockchainService;
        this.tron = new TronTransactionService() as TronTransactionService & BlockchainService;
        this.ton = new TonTransactionService() as TonTransactionService & BlockchainService;

        this.services = {
            [Network.BTC]: this.btc,
            [Network.ETH]: this.eth,
            [Network.TRON]: this.tron,
            [Network.TON]: this.ton,
        };
    }

    async sendToken(
        to: string,
        value: string | number | bigint,
        currency: Currency,
    ): Promise<TxResult> {
        if (currency.type === CurrencyType.FIAT) {
            throw new Error("Fiat currencies are not supported");
        }

        if (!currency.network) {
            throw new Error("Currency does not specify a blockchain network");
        }

        const service = this.services[currency.network];

        if (!service) {
            throw new Error(`Unsupported network: ${currency.network}`);
        }

        return service.send(to, value, currency);
    }
}
