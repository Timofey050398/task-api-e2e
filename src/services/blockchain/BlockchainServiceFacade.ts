import {BtcService, EthService, TonService, TronService,} from "./index";
import {Currency, CurrencyType} from "../../model/Currency";
import {Network} from "../../model/Network";
import {TxResult} from "../../model/TxResult";
import {BlockchainService} from "./BlockchainService";
import {step} from "allure-js-commons";

type ServiceRegistry = Record<Network, BlockchainService>;

export class BlockchainServiceFacade {
    readonly btc: BlockchainService;
    readonly eth: EthService & BlockchainService;
    readonly tron: TronService & BlockchainService;
    readonly ton: TonService & BlockchainService;

    private readonly services: ServiceRegistry;

    constructor() {
        this.btc = new BtcService() as BtcService & BlockchainService;
        this.eth = new EthService() as EthService & BlockchainService;
        this.tron = new TronService() as TronService & BlockchainService;
        this.ton = new TonService() as TonService & BlockchainService;

        this.services = {
            [Network.BTC]: this.btc,
            [Network.ETH]: this.eth,
            [Network.TRON]: this.tron,
            [Network.TON]: this.ton,
        };
    }

    async sendToken(
        to: string,
        value: string | number | bigint,
        currency: Currency,
    ): Promise<TxResult> {
        return await step(`send ${value} ${currency.name} to ${to}`, async () => {
            if (currency.type === CurrencyType.FIAT) {
                throw new Error("Fiat currencies are not supported");
            }

            if (!currency.network) {
                throw new Error("Currency does not specify a blockchain network");
            }

            const service = this.services[currency.network];

            if (!service) {
                throw new Error(`Unsupported network: ${currency.network}`);
            }

            return service.send(to, value, currency);
        });
    }

    async generateRandomAddress(currency: Currency): Promise<string> {
        return await step(`generate random ${currency.name} address`, async () => {
            if (currency.type === CurrencyType.FIAT) {
                throw new Error("Fiat currencies are not supported");
            }

            if (!currency.network) {
                throw new Error("Currency does not specify a blockchain network");
            }
            const service = this.services[currency.network];

            if (!service) {
                throw new Error(`Unsupported network: ${currency.network}`);
            }
            return service.generateRandomAddress();
        });
    }

    async getTx(txHash: string, currency: Currency): Promise<{ isTxSuccess: boolean, receiver: string | null, receiveAmount: number }> {
        return await step(`get tx ${txHash} info about ${currency.name}`, async () => {
            if (currency.type === CurrencyType.FIAT) {
                throw new Error("Fiat currencies are not supported");
            }

            if (!currency.network) {
                throw new Error("Currency does not specify a blockchain network");
            }
            const service = this.services[currency.network];

            const isToken = 'tokenContract' in currency && !!currency.tokenContract;
            if (isToken) {
                return await service.getTx(txHash, currency);
            }

            return await service.getTx(txHash);
        });
    }
}
