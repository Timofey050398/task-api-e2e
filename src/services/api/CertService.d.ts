import {User} from "../../model/User";
import {Currency} from "../../model/Currency";

export class CertService {
    constructor(user: User);

    createCert(
        currency: Currency,
        amount: number | string
    ) : Promise<string>;

    useCert(
        cert: string
    ) : Promise<string | undefined>;
}