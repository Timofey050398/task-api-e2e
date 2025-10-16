import {LoginClient} from "../api/clients/LoginClient";
import {AccountClient} from "../api/clients/AccountClient";

export class ApiFacade {
    readonly login: LoginClient;
    readonly account: AccountClient;

    constructor() {
        this.login = new LoginClient();
        this.account = new AccountClient();
    }
}