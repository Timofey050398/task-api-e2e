import {Currencies, CurrencyType, generateRandomAddress, getMinAmount} from "../../model/Currency";
import {test} from "../../fixtures/userPool";


test.describe('wallet flow', () => {
    for (const [currencyKey, currency] of Object.entries(Currencies)) {
        if (currency.type !== CurrencyType.CRYPTO) continue;
        test(`should create ${currencyKey} deposit`, async ({blockchain}) => {
            const txResult = await blockchain.sendToken(generateRandomAddress(currency),getMinAmount(currency),currency);
            console.log(`txResult: ${txResult}`);
        });
    }
});