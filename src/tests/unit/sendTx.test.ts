import {Currencies, CurrencyType, generateRandomAddress, getMinAmount} from "../../model/Currency";
import {test} from "../../fixtures/userPool";
import {BlockchainServiceFacade} from "../../services/blockchain/BlockchainServiceFacade";


test.describe.parallel('wallet flow', async () => {
    for (const [currencyKey, currency] of Object.entries(Currencies)) {
        if (currency.type !== CurrencyType.CRYPTO) continue;
        test(`should create ${currencyKey} deposit`, async ({blockchain}) => {
            await blockchain.sendToken(generateRandomAddress(currency),getMinAmount(currency),currency);
        });
    }
});

test.describe('BTC deposit', () => {
    const facade = new BlockchainServiceFacade();

    test(`should create trc-20 deposit `, async ({}) => {
        const currency = Currencies.USDT_TRC20;
        await facade.sendToken(generateRandomAddress(currency),getMinAmount(currency),currency);
    });
});