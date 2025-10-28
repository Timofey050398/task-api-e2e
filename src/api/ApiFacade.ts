import {LoginClient} from "./clients/LoginClient";
import {AccountClient} from "./clients/AccountClient";
import {User} from "../model/User";
import {CashClient} from "./clients/CashClient";
import {CertClient} from "./clients/CertClient";
import {MainClient} from "./clients/MainClient";
import {WithdrawClient} from "./clients/WithdrawClient";

export class ApiFacade {
    readonly login: LoginClient;
    readonly account: AccountClient;
    readonly cash: CashClient;
    readonly cert: CertClient;
    readonly main: MainClient;
    readonly withdraw: WithdrawClient;

    constructor(user: User) {
        this.login = new LoginClient();
        this.account = new AccountClient(user);
        this.cash = new CashClient(user);
        this.cert = new CertClient(user);
        this.main = new MainClient(user);
        this.withdraw = new WithdrawClient(user);
    }
}