import { test } from "../../fixtures/userPool";
import {assertCode, assertEquals} from "../../utils/allureUtils";
import {Currencies, Currency, CurrencyType, getMinAmount} from "../../model/Currency";
import {generateRandomName} from "../../utils/randomGenerator";
import {AccountService} from "../../services/api/AccountService";

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
                const accountsReponse = await api.account.getAccounts();
                await assertCode(accountsReponse.status, 200);

                walletId = response.data?.walletID;
                const wallets  = accountsReponse.data?.ungroupedWallets ?? [];
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

    for (const currency of Object.values(Currencies).filter(
        (c): c is Currency => c.type === CurrencyType.CRYPTO
    )) {
        test(`should create ${currency} deposit`, async ({ user }) => {
            await new AccountService(user).depositCrypto(
                getMinAmount(currency),
                currency,
                undefined
            );
        });
    }
});