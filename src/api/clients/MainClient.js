import {BaseClient} from "./core/BaseClient";

export class MainClient extends BaseClient {
    constructor(user, processErrors = true) {
        super(user, processErrors);
    }

    async sendTgCode(type) {
        return await this.post(
            "/client/send_tg_code",
            {type},
        )
    }

    async getSupportedCountriesAndCurrencies(){
        return await this.get("/client/balance_localization", {});
    }
}