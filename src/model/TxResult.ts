import {Currency} from "./Currency";

export interface TxResult {
    currency: Currency;
    txHash: string;
    sentAmount: string | number | bigint;
    fee: string | number | bigint;
}