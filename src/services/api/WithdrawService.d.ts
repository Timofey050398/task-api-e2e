import {User} from "../../model/User";
import {Currency} from "../../model/Currency";

export class WithdrawService {
    constructor(user: User);

    withdraw(
        currency: Currency,
        amount: number | string,
        receiver: string
    ) : Promise<any>;

    waitForStatusCompleted(
        orderId: string,
        currency: Currency,
        pollIntervalMs?: number
    ) : Promise<any>;
}