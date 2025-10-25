import {Currencies, CurrencyType, getMinAmount} from "../../model/Currency";
import {test} from "../../fixtures/userPool";


test.describe('wallet flow', () => {
    for (const [currencyKey, currency] of Object.entries(Currencies)) {
        if (currency.type !== CurrencyType.CRYPTO) continue;
        test(`should create ${currencyKey} deposit`, async ({blockchain}) => {
            const receiverAddress = await blockchain.generateRandomAddress(currency);
            const txResult = await blockchain.sendToken(receiverAddress,getMinAmount(currency),currency);
            console.log(`txResult: ${txResult}`);
        });
    }
});