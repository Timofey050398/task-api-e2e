import {BaseClient} from "./core/BaseClient";
import {Currencies} from "../../model/Currency";

export class FiatClient extends BaseClient {
    constructor(user, processErrors = true) {
        super(user, processErrors);
    }

    async depositByCert(cert) {
        return await this.post(
            "/fiat/cert/preview",
            {cert}
        );
    }
}