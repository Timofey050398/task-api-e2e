import {
    BtcTransactionService,
    EthTransactionService,
    TonTransactionService,
    TronTransactionService
} from "./index";

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
}