import { test } from "../../fixtures/userPool";
import {Currencies} from "../../model/Currency";
import {assertCode, assertEquals, assertExist} from "../../utils/allureUtils";
import {getApiError} from "../../utils/errorResponseExtractor";

test.describe('cert flow', () => {

    test('should create and use cert flow', async ({apiService}) => {
        const cert = await apiService.cert.createCert(Currencies.RUB,10);
        await apiService.cert.useCert(cert);
    })

    test('should get error when try to use used cert', async ({apiService}) => {
        const cert = await apiService.cert.createCert(Currencies.RUB,10);
        await apiService.cert.useCert(cert);

        const errResponse = await getApiError(() => apiService.cert.useCert(cert));

        await assertExist(errResponse);
        await assertCode(errResponse?.status,400);
        await assertEquals(errResponse?.data?.message, 'fiat transfer cert already used');
    })

    test('should get error when try to use undefined cert', async ({ apiService }) => {
        const errResponse = await getApiError(() => apiService.cert.useCert("123456789123"));

        await assertExist(errResponse);
        await assertCode(errResponse?.status,400);
        await assertEquals(errResponse?.data?.message, 'cert not found');
    })
})