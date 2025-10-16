import {LoginClient} from "./clients/LoginClient";
import {AccountClient} from "./clients/AccountClient";
import {User} from "../model/User";

export class ApiFacade {
    readonly login: LoginClient;
    readonly account: AccountClient;

    constructor(user: User) {
        this.login = new LoginClient();
        this.account = new AccountClient(user);
    }
}