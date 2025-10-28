import { test } from "../../fixtures/userPool";
import {assertEquals, assertExist} from "../../utils/allureUtils";
import {Currencies, CurrencyType, getMinAmount} from "../../model/Currency";
import {generateRandomName} from "../../utils/randomGenerator";

test.describe('wallet flow', () => {
    for (const [key, currency] of Object.entries(Currencies)) {
        test(`should can create and delete ${currency.type} wallet (${key})`, async ({ apiService }) => {
            const name = generateRandomName();
            let walletId: string | undefined;
            try {
                //Создаем кошелек
                const walletData = await apiService.wallet.createWallet(currency,name);
                walletId = walletData?.walletID;

                //Получаем dto кошелька
                const wallet = await apiService.wallet.getWalletById(walletId!);

                //Проверяем кошелек
                await assertEquals(wallet!.name,name);
                await assertEquals(wallet!.currencyID, currency.id);
                if (currency.type === CurrencyType.CRYPTO) {
                    await assertEquals(wallet!.address, walletData?.address!);
                }
            } finally {
                //Удаляем созданный кошелёк
                if (walletId) {
                    await apiService.wallet.deleteWallet(walletId);
                }
            }
        });
    }

    for (const [currencyKey, currency] of Object.entries(Currencies)) {
        if (currency.type !== CurrencyType.CRYPTO) continue;
        if (currency === Currencies.BTC && process.env.ENVIRONMENT === 'PROD') continue;
        test(`should create ${currencyKey} deposit`, async ({ apiService }) => {
            let depositDto = await apiService.wallet.depositCrypto(
                getMinAmount(currency),
                currency
            );

            depositDto = await apiService.wallet.waitForDepositConfirm(
                currency,
                depositDto.wallet,
                depositDto.txResult
            );

            const historyEntry = await apiService.wallet.getHistoryEntryByTxId(depositDto.txResult.txHash);

            await assertExist(historyEntry,`Транзакция ${depositDto.txResult} не отобразилась в истории`)
        });
    }

    test('should create and cancel cash invoice', async ({ apiService }) => {
       const data = await apiService.wallet.createCashInvoice("10000");
       await apiService.wallet.cancelCashInvoice(data.orderID);
    });
});