import { test } from "../../fixtures/userPool";
import {assertEquals, assertExist} from "../../utils/allureUtils";
import {Currencies, CurrencyType, getMinAmount} from "../../model/Currency";
import {generateRandomName} from "../../utils/randomGenerator";

test.describe('wallet flow', () => {
    for (const [key, currency] of Object.entries(Currencies)) {
        test(`should can create and delete ${currency.type} wallet (${key})`, async ({ walletService }) => {
            const name = generateRandomName();
            let walletId: string | undefined;
            try {
                //Создаем кошелек
                const walletData = await walletService.createWallet(currency,name);
                walletId = walletData?.walletID;

                //Получаем dto кошелька
                const wallet = await walletService.getWalletById(walletId!);

                //Проверяем кошелек
                await assertEquals(wallet!.name,name);
                await assertEquals(wallet!.currencyID, currency.id);
                if (currency.type === CurrencyType.CRYPTO) {
                    await assertEquals(wallet!.address, walletData?.address!);
                }
            } finally {
                //Удаляем созданный кошелёк
                if (walletId) {
                    await walletService.deleteWallet(walletId);
                }
            }
        });
    }

    for (const [currencyKey, currency] of Object.entries(Currencies)) {
        if (currency.type !== CurrencyType.CRYPTO) continue;
        test(`should create ${currencyKey} deposit`, async ({ walletService }) => {
            let depositDto = await walletService.depositCrypto(
                getMinAmount(currency),
                currency
            );

            depositDto = await walletService.waitForDepositConfirm(
                currency,
                depositDto.wallet,
                depositDto.txResult
            );

            const historyEntry = await walletService.getHistoryEntryByTxId(depositDto.txResult.txHash);

            await assertExist(historyEntry,`Транзакция ${depositDto.txResult} не отобразилась в истории`)
        });
    }

    test('should create and cancel cash invoice', async ({ walletService }) => {
       const data = await walletService.createCashInvoice("10000");
       await walletService.cancelCashInvoice(data.orderID);
    });
});