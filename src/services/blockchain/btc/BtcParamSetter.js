import {
    createBlockstreamBroadcastProvider, createBlockstreamStatusProvider, createBlockstreamTxProvider,
    createBlockstreamUtxoProvider, createMempoolFeeRateProvider
} from "./providers";
import {Currencies} from "../../../model/Currency";
import {
    resolveBitcoinNetwork,
    resolveBitcoinNetworkName,
    resolveBlockstreamApiBaseUrl,
    resolveMempoolApiBaseUrl
} from "./config";
import {BtcTxResolver} from "./BtcTxResolver";
import {BtcTxSender} from "./BtcTxSender";
import {ECPairFactory} from "ecpair";

let defaultECPair = null;

function resolveECPair(pairFactory = ECPairFactory, eccLib = ecc) {
    if (defaultECPair) {
        return defaultECPair;
    }

    defaultECPair = pairFactory(eccLib);
    return defaultECPair;
}

export class BtcParamSetter {
    constructor(btcService) {
        this.btcService = btcService;
    }

    setParams(options) {
        const networkName = resolveBitcoinNetworkName(options.bitcoinNetwork);
        this.btcService.bitcoinNetwork = resolveBitcoinNetwork(networkName);
        this.btcService.bitcoinNetworkName = networkName;

        this.btcService.blockstreamApiBaseUrl = resolveBlockstreamApiBaseUrl(
            options.blockstreamApiBaseUrl ?? process.env.BTC_BLOCKSTREAM_API_BASE_URL,
            this.btcService.bitcoinNetworkName,
        );

        this.btcService.mempoolApiBaseUrl = resolveMempoolApiBaseUrl(
            options.mempoolApiBaseUrl ?? process.env.BTC_MEMPOOL_API_BASE_URL,
            this.btcService.bitcoinNetworkName,
        );

        this.btcService.utxoProvider = options.utxoProvider ?? createBlockstreamUtxoProvider({
            logger: this.btcService.logger,
            apiBaseUrl: this.btcService.blockstreamApiBaseUrl,
        });

        this.btcService.feeRateProvider = options.feeRateProvider ?? createMempoolFeeRateProvider({
            logger: this.btcService.logger,
            apiBaseUrl: this.btcService.mempoolApiBaseUrl,
        });

        this.btcService.broadcastProvider = options.broadcastProvider ?? createBlockstreamBroadcastProvider({
            apiBaseUrl: this.btcService.blockstreamApiBaseUrl,
            logger: this.btcService.logger,
        });

        this.btcService.txProvider = options.txProvider ?? createBlockstreamTxProvider({
            apiBaseUrl: this.btcService.blockstreamApiBaseUrl,
            logger: this.btcService.logger,
        });

        this.btcService.currency = Currencies.BTC;
        this.btcService.ecpair = options.ecpair ?? resolveECPair();

        if (!this.btcService.statusProvider) {
            this.btcService.setStatusProvider(
                createBlockstreamStatusProvider({
                    apiBaseUrl: this.btcService.blockstreamApiBaseUrl,
                    logger: this.btcService.logger,
                }),
            );
        }
        this.btcService.txResolver = new BtcTxResolver(this.btcService);
        this.btcService.txSender = new BtcTxSender(this.btcService);
    }


}