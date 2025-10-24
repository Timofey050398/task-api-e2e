import {Currencies, CurrencyType, generateRandomAddress, getMinAmount} from "../../model/Currency";
import {test} from "../../fixtures/userPool";
import {BlockchainServiceFacade} from "../../services/blockchain/BlockchainServiceFacade";


test.describe('wallet flow', () => {
    const facade = new BlockchainServiceFacade();
    for (const [currencyKey, currency] of Object.entries(Currencies)) {
        if (currency.type !== CurrencyType.CRYPTO) continue;
        if (currency === Currencies.BTC) continue;
        test(`should create ${currencyKey} deposit`, async ({}) => {
            await facade.sendToken(generateRandomAddress(currency),getMinAmount(currency),currency);
        });
    }
});

test.describe('BTC deposit', () => {
    const facade = new BlockchainServiceFacade();

    test(`should create bitcoin deposit `, async ({}) => {
        const currency = Currencies.BTC;
        await facade.sendToken(generateRandomAddress(currency),getMinAmount(currency),currency);
    });

    test(`should create erc-20 deposit `, async ({}) => {
        const currency = Currencies.USDT_ERC20;
        await facade.sendToken(generateRandomAddress(currency),getMinAmount(currency),currency);
    });
});