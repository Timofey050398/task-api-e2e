import {Network} from "../../model/Network";
import {Currency} from "../../model/Currency";
import {TxResult} from "../../model/TxResult";

export type BlockchainService = {
    network: Network;
    send: (to: string, value: string | number | bigint, currency: Currency) => Promise<TxResult>;
    generateRandomAddress: () => Promise<string>;
    waitForConfirmation: (transactionId:string, options?:any) => Promise<any>;
    getTx:(
        transactionId: string,
        currency?: Currency,
    ) => Promise<any>;
};