import {User} from "../../model/User";
import {Currency} from "../../model/Currency";
import {DepositDto} from "../../model/DepositDto";
import {TxResult} from "../../model/TxResult";
import {Wallet} from "../../model/Wallet";

export class WalletService {
    constructor(user: User);

    //создать кошелек
    createWallet(
        currency: Currency,
        name: string
    ) : Promise<any>;

    //получить кошелек по id
    getWalletById(id: string) : Promise<Wallet | undefined>;

    //удалить кошелек по id
    deleteWallet(id: string) : Promise<any>;

    //сделать депозит криптовалюты
    depositCrypto(
        amount: number | string | bigInt,
        currency: Currency,
        walletId?: string | number
    ): Promise<DepositDto>;

    //дождаться появления депозита на платформе
    waitForDepositConfirm(
        currency: Currency,
        wallet: any,
        txResult: TxResult,
        pollInterval?: number
    ) :Promise<DepositDto>;

    //создать заявку на пополнение наличными
    createCashInvoice(
        amount: number | string,
        countryName?: string,
        currency?: Currency,
        day?: string | Date,
        client?: any,
        comment?:string,
        companion?: any,
        locationOption?: any,
        multiplyOf? : number
    ): Promise<any>;

    //отменить заявку на пополнение наличными
    cancelCashInvoice(
        orderId: string
    ): Promise<any>;

    //получить запись из истории по хешу транзакции
    getLastHistoryEntry() : Promise<any> | undefined;

    compareHistoryEntry(
        entry : any,
        depositDto: DepositDto,
    ) : Promise<void>;

    loadWallets(): Promise<Wallet[]>;

    findWalletsWithBalance(
        currency: Currency,
        amount: number | string
    ) : Promise<Wallet[]>;
}