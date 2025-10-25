import {User} from "../model/User";
import {LoginService} from "./api/LoginService";
import {WalletService} from "./api/WalletService";
import {MailTmService} from "./mail/MailTmService";

export class ServiceFacade {
    readonly login: LoginService;
    readonly account: WalletService;
    readonly mail: MailTmService;

    constructor(user: User) {
        this.login = new LoginService(user);
        this.account = new WalletService(user);
        this.mail = new MailTmService(user);
    }
}