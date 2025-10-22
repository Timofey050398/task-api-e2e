import {Currencies, Currency, CurrencyType, generateRandomAddress, getMinAmount} from "../../model/Currency";
import {test} from "../../fixtures/userPool";
import {BlockchainServiceFacade} from "../../services/blockchain/BlockchainServiceFacade";


test.describe('wallet flow', () => {
    const facade = new BlockchainServiceFacade();
    for (const [currencyKey, currency] of Object.entries(Currencies)) {
        if (currency.type !== CurrencyType.CRYPTO) continue;
        test(`should create ${currencyKey} deposit`, async ({}) => {
            await facade.sendToken(generateRandomAddress(currency),getMinAmount(currency),currency);
        });
    }
});