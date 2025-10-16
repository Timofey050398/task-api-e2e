import {LoginClient} from "./clients/LoginClient";
import {AccountClient} from "./clients/AccountClient";

export class ApiFacade {
    readonly login: LoginClient;
    readonly account: AccountClient;

    constructor() {
        this.login = new LoginClient();
        this.account = new AccountClient();
    }
}