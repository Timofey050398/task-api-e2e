import {LoginClient} from "./clients/LoginClient";
import {AccountClient} from "./clients/AccountClient";
import {LoginService} from "../services/api/LoginService";

export class ApiFacade {
    readonly login: LoginClient;
    readonly account: AccountClient;

    constructor(loginService: LoginService) {
        this.login = new LoginClient();
        this.account = new AccountClient(loginService);
    }
}