import {User} from "../../model/User";
import {Currency} from "../../model/Currency";
import {TxResult} from "../blockchain/BlockchainServiceFacade";

export class AccountService {
    constructor(user: User);

    depositCrypto(
        amount: number | string | bigInt,
        currency: Currency,
        walletId: string | number | undefined
    ): Promise<TxResult>;
}