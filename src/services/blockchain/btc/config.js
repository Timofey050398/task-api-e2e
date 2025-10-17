import * as bitcoin from 'bitcoinjs-lib';

export function resolveBitcoinNetworkName(optionsNetwork) {
    const envNetwork = process.env.BTC_NETWORK?.trim();
    return (envNetwork || optionsNetwork || 'mainnet').toLowerCase();
}

export function resolveBitcoinNetwork(name = 'mainnet') {
    switch (name) {
        case 'testnet':
            return bitcoin.networks.testnet;
        case 'regtest':
            return bitcoin.networks.regtest ?? bitcoin.networks.testnet;
        default:
            return bitcoin.networks.bitcoin;
    }
}

export function resolveMempoolApiBaseUrl(customUrl, networkName = 'mainnet') {
    if (customUrl) {
        return customUrl.replace(/\/$/, '');
    }

    switch (networkName) {
        case 'testnet':
        case 'regtest':
            return 'https://mempool.space/testnet/api';
        default:
            return 'https://mempool.space/api';
    }
}

export function resolveBlockstreamApiBaseUrl(customUrl, networkName = 'mainnet') {
    if (customUrl) {
        return customUrl.replace(/\/$/, '');
    }

    switch (networkName) {
        case 'testnet':
        case 'regtest':
            return 'https://blockstream.info/testnet/api';
        default:
            return 'https://blockstream.info/api';
    }
}
