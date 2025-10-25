import {BaseClient} from "./core/BaseClient";

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