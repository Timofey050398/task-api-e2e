import {User} from "../../model/User";
import {Currency} from "../../model/Currency";
import {DepositDto} from "../../model/DepositDto";
import {TxResult} from "../../model/TxResult";

export class WalletService {
    constructor(user: User);

    depositCrypto(
        amount: number | string | bigInt,
        currency: Currency,
        walletId: string | number | undefined
    ): Promise<DepositDto>;

    findOrCreateWallet(
        currency: Currency,
        walletId: string | number | undefined
    ) : Promise<any>;

    waitForDepositConfirm(
        currency: Currency,
        wallet: any,
        txResult: TxResult,
        timeoutMs?: number ,
        pollInterval?: number
    ) :Promise<DepositDto>;

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

    cancelCashInvoice(
        orderId: string
    ): Promise<any>;

    getHistoryEntryByTxId(
        txId: string,
    ) : Promise<any> | undefined;
}