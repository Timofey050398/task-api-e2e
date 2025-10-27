import { test } from "../../fixtures/userPool";
import {Currencies, CurrencyType, getMinWithdrawAmount} from "../../model/Currency";
import {getSender} from "../../model/Network";
import {getApiError} from "../../utils/errorResponseExtractor";
import {assertCode, assertEquals, assertExist} from "../../utils/allureUtils";

test.describe('cert flow', () => {

    for (const [currencyKey, currency] of Object.entries(Currencies)) {
        if (currency.type !== CurrencyType.CRYPTO) continue;
        test(`should create ${currencyKey} withdrawal`, async ({ withdrawService, blockchain }) => {
            const amount = Number(getMinWithdrawAmount(currency));
            const receiverAddr = getSender(currency.network);
            const {amountWithFee, orderId} = await withdrawService.withdraw(
               currency,
               getMinWithdrawAmount(currency),
                receiverAddr
           )

            const orderDetail = await withdrawService.waitForStatusCompleted(orderId,currency);

            await assertEquals(Number(orderDetail.amount), amount);
            await assertEquals(Number(orderDetail.userFee), amountWithFee - amount);
            await assertEquals(Number(orderDetail.receiver.data), receiverAddr);

            const txHash = orderDetail.txHash;

            const {isTxSuccess, receiver, receiveAmount} = await blockchain.getTx(txHash, currency);

            await assertEquals(isTxSuccess,true);
            await assertEquals(receiver, receiverAddr);
            await assertEquals(receiveAmount, amount);
        });
    }

    test(`should get error when try withdraw ETH to incorrect address`, async ({ withdrawService }) => {
        const currency = Currencies.ETH;
        const apiError = await getApiError(() =>
            withdrawService.withdraw(
                currency,
                getMinWithdrawAmount(currency),
                process.env.BTC_ADDRESS!
            )
        );

        await assertExist(apiError);
        await assertCode(apiError?.status,400);
    });

    test(`should get error when try withdraw BTC to incorrect address`, async ({ withdrawService }) => {
        const currency = Currencies.BTC;
        const apiError = await getApiError(() =>
            withdrawService.withdraw(
                currency,
                getMinWithdrawAmount(currency),
                process.env.TRON_ADDRESS!
            )
        );

        await assertExist(apiError);
        await assertCode(apiError?.status,400);
    });

    test(`should get error when try withdraw USDC_ERC_20 to incorrect address`, async ({ withdrawService }) => {
        const currency = Currencies.USDC_ERC20;
        const apiError = await getApiError(() =>
            withdrawService.withdraw(
                currency,
                getMinWithdrawAmount(currency),
                process.env.TRON_ADDRESS!
            )
        );

        await assertExist(apiError);
        await assertCode(apiError?.status,400);
    });

    test(`should get error when try withdraw TON to incorrect address`, async ({ withdrawService }) => {
        const currency = Currencies.TON;

        const apiError = await getApiError(() =>
            withdrawService.withdraw(
                currency,
                getMinWithdrawAmount(currency),
                process.env.BTC_ADDRESS!
            )
        );

        await assertExist(apiError);
        await assertCode(apiError?.status,400);
    });
})