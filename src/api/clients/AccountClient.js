import {BaseClient} from "./core/BaseClient";


export class AccountClient extends BaseClient {
    constructor() {
        super();
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
            "/accounts/create/crypto",
            {
                CurrencyID: currencyId,
                name: name,
            }
        );
    }

    async deleteWallet(walletNumber) {
        return await this.post("/accounts/delete_wallet", {walletNumber});
    }
}