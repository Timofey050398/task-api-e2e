import { test } from "../../fixtures/userPool";
import {assertCode, assertEquals, assertExist} from "../../utils/allureUtils";
import {Currencies, Currency, CurrencyType, getMinAmount} from "../../model/Currency";
import {generateRandomName} from "../../utils/randomGenerator";
import {WalletService} from "../../services/api/WalletService";

test.describe('wallet flow', () => {
    test.setTimeout(60000);
    const name = generateRandomName();
    for (const [key, currency] of Object.entries(Currencies)) {
        test(`should can create and delete ${currency.type} wallet (${key})`, async ({ api }) => {
            let walletId: string | undefined;
            try {
                let response;
                if (currency.type === CurrencyType.CRYPTO) {
                    response = await api.account.createCryptoWallet(currency.id, 1, name);
                } else {
                    response = await api.account.createFiatWallet(currency.id, name);
                }

                await assertCode(response.status, 200);
                const accountsResponse = await api.account.getAccounts();
                await assertCode(accountsResponse.status, 200);

                walletId = response.data?.walletID;
                const wallets  = accountsResponse.data?.ungroupedWallets ?? [];
                const wallet = wallets.find((w: any) => w.id === walletId);
                await assertEquals(wallet.name,name);
                await assertEquals(wallet.currencyID, currency.id);
                if (currency.type === CurrencyType.CRYPTO) {
                    await assertEquals(wallet.address, response.data?.address);
                }
            } finally {
                if (walletId) {
                    const response = await api.account.deleteWallet(walletId);
                    await assertCode(response.status, 200);
                }
            }
        });
    }

    for (const [currencyKey, currency] of Object.entries(Currencies)) {
        if (currency.type !== CurrencyType.CRYPTO) continue;
        test(`should create ${currencyKey} deposit`, async ({ walletService }) => {
            let depositDto = await walletService.depositCrypto(
                getMinAmount(currency),
                currency,
                undefined
            );

            depositDto = await walletService.waitForDepositConfirm(
                currency,
                depositDto.wallet,
                depositDto.txResult
            );

            const historyEntry = await  walletService.getHistoryEntryByTxId(depositDto.txResult.txHash);

            await assertExist(historyEntry,`Транзакция ${depositDto.txResult} не отобразилась в истории`)
        });
    }

    test('should create and cancel cash invoice', async ({ walletService }) => {
       const data = await walletService.createCashInvoice("10000");
       await walletService.cancelCashInvoice(data.orderID);
    });
});