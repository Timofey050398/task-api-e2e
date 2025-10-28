import { test } from "../../fixtures/userPool";
import {Currencies, CurrencyType, getMinWithdrawAmount} from "../../model/Currency";
import {getSender} from "../../model/Network";
import {getApiError} from "../../utils/errorResponseExtractor";
import {assertCode, assertEquals, assertExist, assertNumberEquals} from "../../utils/allureUtils";

test.describe('cert flow', () => {

    for (const [currencyKey, currency] of Object.entries(Currencies)) {
        if (currency.type !== CurrencyType.CRYPTO) continue;
        if (currency === Currencies.BTC && process.env.ENVIRONMENT === 'PROD') continue;
        test(`_should create ${currencyKey} withdrawal`, async ({ apiService, blockchain }) => {
            const amount = Number(getMinWithdrawAmount(currency));
            const expectedAddress = getSender(currency.network);
            const {amountWithFee, orderId} = await apiService.withdraw.withdraw(
               currency,
               getMinWithdrawAmount(currency),
                expectedAddress
           )

            const orderDetail = await apiService.withdraw.waitForStatusCompleted(orderId,currency);

            await assertNumberEquals(Number(orderDetail.amount), amount);
            await assertNumberEquals(Number(orderDetail.userFee), amountWithFee - amount);
            await assertEquals(orderDetail.receiver.data.toLowerCase(), expectedAddress.toLowerCase());

            const {isTxSuccess, receiver, receiveAmount} = await blockchain.getTx(orderDetail.txHash, currency);

            await assertEquals(isTxSuccess,true);
            await assertEquals(receiver?.toLowerCase(), expectedAddress.toLowerCase());
            await assertNumberEquals(receiveAmount, amount);
        });
    }

    test(`should create USDС_ERC_20 withdrawal`, async ({ apiService, blockchain }) => {
        const currency = Currencies.BTC;
        const amount = Number(getMinWithdrawAmount(currency));
        const receiverAddr = getSender(currency.network);
        const {amountWithFee, orderId} = await apiService.withdraw.withdraw(
            currency,
            amount,
            receiverAddr
        )

        const orderDetail = await apiService.withdraw.waitForStatusCompleted(orderId,currency);

        await assertEquals(Number(orderDetail.amount), amount);

        await assertNumberEquals(Number(orderDetail.userFee), amountWithFee - amount);
        await assertEquals(orderDetail.receiver.data.toLowerCase(), receiverAddr.toLowerCase());

        const {isTxSuccess, receiver, receiveAmount} = await blockchain.getTx(orderDetail.txHash, currency);

        await assertEquals(isTxSuccess,true);
        await assertEquals(receiver?.toLowerCase(), receiverAddr.toLowerCase());
        await assertNumberEquals(receiveAmount, amount);
    });

    test(`should get error when try withdraw ETH to incorrect address`, async ({ apiService }) => {
        const currency = Currencies.ETH;
        const apiError = await getApiError(() =>
            apiService.withdraw.withdraw(
                currency,
                getMinWithdrawAmount(currency),
                process.env.BTC_ADDRESS!
            )
        );

        await assertExist(apiError);
        await assertCode(apiError?.status,400);
        await assertEquals(apiError?.data.message,'invalid address');
    });

    test(`should get error when try withdraw BTC to incorrect address`, async ({ apiService }) => {
        const currency = Currencies.BTC;
        const apiError = await getApiError(() =>
            apiService.withdraw.withdraw(
                currency,
                getMinWithdrawAmount(currency),
                process.env.TRON_ADDRESS!
            )
        );

        await assertExist(apiError);
        await assertCode(apiError?.status,400);
        await assertEquals(apiError?.data.message,'invalid address');
    });

    test(`should get error when try withdraw USDC_ERC_20 to incorrect address`, async ({ apiService }) => {
        const currency = Currencies.USDC_ERC20;
        const apiError = await getApiError(() =>
            apiService.withdraw.withdraw(
                currency,
                getMinWithdrawAmount(currency),
                process.env.TRON_ADDRESS!
            )
        );

        await assertExist(apiError);
        await assertCode(apiError?.status,400);
        await assertEquals(apiError?.data.message,'invalid address');
    });

    test(`should get error when try withdraw TON to incorrect address`, async ({ apiService }) => {
        const currency = Currencies.TON;

        const apiError = await getApiError(() =>
            apiService.withdraw.withdraw(
                currency,
                getMinWithdrawAmount(currency),
                process.env.BTC_ADDRESS!
            )
        );

        await assertExist(apiError);
        await assertCode(apiError?.status,400);
        await assertEquals(apiError?.data.message,'invalid address');
    });
})