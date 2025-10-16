import {AccountClient} from "../../api/clients/AccountClient";


export class AccountService {
    constructor(user) {
        this.accountClient = new AccountClient(user);
    }
}