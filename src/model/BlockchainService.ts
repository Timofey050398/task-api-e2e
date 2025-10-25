import {Network} from "./Network";
import {Currency} from "./Currency";
import {TxResult} from "./TxResult";

export type BlockchainService = {
    network: Network;
    send: (to: string, value: string | number | bigint, currency: Currency) => Promise<TxResult>;
};