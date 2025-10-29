import TonWeb from "tonweb";
import {resolveTonEndpoint} from "./config";
import {createTonWeb} from "./wallet";
import {Currencies} from "../../../model/Currency";
import TonTxSender from "./TonTxSender";
import {TonTxResolver} from "./TonTxResolver";

export class TonParamSetter {
    constructor(tonService) {
        this.tonService = tonService;
    }

     setParams(options = {}, networkName) {
        const {hexToBytes} = TonWeb.utils;
        this.tonService.apiKey = process.env.TON_API_KEY;

        const parseHexKey = (value, {expectedBytes, envName}) => {
            if (!value) return undefined;

            const bytes = hexToBytes(value);
            if (bytes.length !== expectedBytes) {
                throw new Error(
                    `${envName} must be a hex string representing ${expectedBytes} bytes,` +
                    ` but ${bytes.length} ${bytes.length === 1 ? 'byte was' : 'bytes were'} provided`,
                );
            }

            return bytes;
        };

        this.tonService.publicKey = parseHexKey(process.env.TON_WALLET_PUBLIC_KEY_32_HEX, {
            expectedBytes: 32,
            envName: 'TON_WALLET_PUBLIC_KEY_32_HEX',
        });

        this.tonService.secretKey = parseHexKey(process.env.TON_WALLET_PRIVATE_KEY, {
            expectedBytes: 64,
            envName: 'TON_WALLET_PRIVATE_KEY',
        });

        const endpointCandidate = options.endpoint ?? process.env.TON_API_ENDPOINT;
        this.tonService.tonEndpoint = resolveTonEndpoint(endpointCandidate, networkName);

        this.tonService.tonWeb =
            options.tonWeb ??
            createTonWeb({apiKey: this.tonService.apiKey, endpoint: this.tonService.tonEndpoint});

        this.tonService.defaultWalletVersion = 'v4R2';
        this.tonService.defaultWorkchain = options.defaultWorkchain ?? 0;
        this.tonService.currency = Currencies.TON;
        this.tonService.txResolver = new TonTxResolver(this.tonService);
        this.tonService.txSender = new TonTxSender(this.tonService);
    }
}