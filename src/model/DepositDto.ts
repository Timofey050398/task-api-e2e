import {TxResult} from "./TxResult";
import {Wallet} from "./Wallet";

export interface DepositDto {
    txResult: TxResult;
    wallet: Wallet;
}