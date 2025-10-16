import {
    BtcTransactionService,
    EthTransactionService,
    TonTransactionService,
    TronTransactionService
} from "./index";
import {Currencies, CurrencyKey, CurrencyType} from "../../model/Currency";
import {Network} from "../../model/Network";

type Currency = typeof Currencies[CurrencyKey];

export class BlockchainServiceFacade {
    readonly btc: BtcTransactionService;
    readonly eth: EthTransactionService;
    readonly tron: TronTransactionService;
    readonly ton: TonTransactionService;

    constructor() {
        this.btc = new BtcTransactionService();
        this.eth = new EthTransactionService();
        this.tron = new TronTransactionService();
        this.ton = new TonTransactionService();
    }

    getInstance(currency: Currency):
        | BtcTransactionService
        | EthTransactionService
        | TronTransactionService
        | TonTransactionService {
        if (currency.type === CurrencyType.FIAT) {
            throw new Error("Fiat currencies are not supported");
        }

        switch (currency.network) {
            case Network.BTC:
                return this.btc;
            case Network.ETH:
                return this.eth;
            case Network.TRON:
                return this.tron;
            case Network.TON:
                return this.ton;
            default:
                throw new Error(`Unsupported network: ${currency.network}`);
        }
    }
}