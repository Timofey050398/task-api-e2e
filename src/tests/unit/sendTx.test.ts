import {Currencies, Currency, CurrencyType, generateRandomAddress, getMinAmount} from "../../model/Currency";
import {test} from "../../fixtures/userPool";
import {BlockchainServiceFacade} from "../../services/blockchain/BlockchainServiceFacade";


test.describe('wallet flow', () => {
    const facade = new BlockchainServiceFacade();
    for (const currency of Object.values(Currencies).filter(
        (c): c is Currency => c.type === CurrencyType.CRYPTO
    )) {
        test(`should create ${currency} deposit`, async ({}) => {
            await facade.sendToken(generateRandomAddress(currency),getMinAmount(currency),currency);
        });
    }
});