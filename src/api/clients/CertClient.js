import {BaseClient} from "./core/BaseClient";

export class CertClient extends BaseClient {
    constructor(user, processErrors = true) {
        super(user, processErrors);
    }

    async previewCert(cert) {
        return await this.post(
            "/fiat/cert/preview",
            {cert}
        );
    }

    async depositByCert(cert, cityId, countryId, walletId) {
        return await this.post(
            "/fiat/cert/use",
            {cert, cityID : cityId, countryID : countryId, walletID : walletId},
        )
    }

    async createCert(amount, cityId, code, countryId, walletId){
        return await this.post(
            "/fiat/cert/create",
            {amount, cityID : cityId, code : code, countryID : countryId, walletID : walletId},
        )
    }
}