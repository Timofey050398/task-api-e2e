import "dotenv/config";
import {BlockchainService, BtcService, EthService, TonService, TronService} from "../services/blockchain";

export enum Network {
    BTC = 'BTC',
    ETH = 'ETH',
    TRON = 'TRON',
    TON = 'TON'
}

export function getSender(network: Network): string {
    switch (network) {
        case Network.BTC:
            return process.env.BTC_ADDRESS!;
        case Network.ETH:
            return '0x' + process.env.ETH_ADDRESS!;
        case Network.TRON:
            return process.env.TRON_ADDRESS!;
        case Network.TON:
            return process.env.TON_WALLET_PUBLIC_KEY!;
        default:
            throw new Error(`Unsupported network: ${network}`);
    }
}

export function getServiceInstance(network: Network): any {
    switch (network) {
        case Network.BTC:
            return new BtcService();
        case Network.ETH:
            return new EthService();
        case Network.TRON:
            return new TronService();
        case Network.TON:
            return new TonService();
        default:
            throw new Error(`Unsupported network: ${network}`);
    }
}