import { test } from "../../fixtures/userPool";
import {Currencies} from "../../model/Currency";
import {assertCode, assertEquals, assertExist} from "../../utils/allureUtils";
import {getApiError} from "../../utils/errorResponseExtractor";

test.describe('cert flow', () => {

    test('should create and use cert flow', async ({certService}) => {
        const cert = await certService.createCert(Currencies.RUB,10);
        await certService.useCert(cert);
    })

    test('should get error when try to use used cert', async ({certService}) => {
        const cert = await certService.createCert(Currencies.RUB,10);
        await certService.useCert(cert);

        const errResponse = await getApiError(() => certService.useCert(cert));

        await assertExist(errResponse);
        await assertCode(errResponse?.status,400);
        await assertEquals(errResponse?.data?.message, 'fiat transfer cert already used');
    })

    test('should get error when try to use undefined cert', async ({certService}) => {
        const errResponse = await getApiError(() => certService.useCert("123456789123"));

        await assertExist(errResponse);
        await assertCode(errResponse?.status,400);
        await assertEquals(errResponse?.data?.message, 'cert not found');
    })
})