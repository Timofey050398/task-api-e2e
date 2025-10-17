import {BaseClient} from "./core/BaseClient";
export class AccountClient extends BaseClient {
    constructor(user, processErrors = true) {
        super(user, processErrors);
    }

    async createCryptoWallet(currencyId, groupId, name){
        return await this.post(
            "/accounts/create/crypto",
            {
                CurrencyID: currencyId,
                group_id: groupId,
                name: name,
            }
        );
    }

    async createFiatWallet(currencyId, name){
        return await this.post(
            "/accounts/create/fiat",
            {
                CurrencyID: currencyId,
                name: name,
            }
        );
    }

    async deleteWallet(walletNumber) {
        return await this.post("/accounts/delete_wallet", {walletNumber});
    }

    async getAccounts() {
        return await this.post("/accounts/", {});
    }
}