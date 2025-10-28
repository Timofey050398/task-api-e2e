import {User} from "../model/User";
import {LoginService} from "./api/LoginService";
import {WalletService} from "./api/WalletService";
import {CertService} from "./api/CertService";
import {WithdrawService} from "./api/WithdrawService";

export class ApiServiceFacade {
    readonly login: LoginService;
    readonly account: WalletService;
    readonly cert: CertService;
    readonly wallet: WalletService;
    readonly withdraw: WithdrawService;

    constructor(user: User) {
        this.login = new LoginService(user);
        this.account = new WalletService(user);
        this.cert = new CertService(user);
        this.wallet = new WalletService(user);
        this.withdraw = new WithdrawService(user);
    }
}