import {User} from "../model/User";
import {LoginService} from "./api/LoginService";
import {AccountService} from "./api/AccountService";
import {AccountClient} from "../api/clients/AccountClient";
import {MailTmService} from "./mail/MailTmService";

export class ServiceFacade {
    readonly login: LoginService;
    readonly account: AccountService;
    readonly mail: MailTmService;

    constructor(user: User) {
        this.login = new LoginService(user);
        this.account = new AccountClient(user);
        this.mail = new MailTmService(user);
    }
}