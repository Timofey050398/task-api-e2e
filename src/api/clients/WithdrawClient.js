import {BaseClient} from "./core/BaseClient";
import {getServiceInstance} from "../../model/Network";

export class WithdrawClient extends BaseClient {
    constructor(user, processErrors = true) {
        super(user, processErrors);
    }

    async getTariff(currencyId) {
        return await this.post(
            "/tariff/withdraw/crypto",
            {CurrencyID: currencyId}
        );
    }

    async withdraw(amount, code, memo, receiver, walletID){
      return await this.post(
          "/withdraw/crypto",
          {amount, code, memo, receiver, walletID}
      )
    }

    async getInfo(orderId) {
        return await this.post(
            "/details/order/info",
            {
                orderId: orderId,
                type: "cryptoWithdrawal"
            }
        )
    }

}