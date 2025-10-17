export function resolveTonNetworkName() {
    return (process.env.TON_NETWORK ?? 'mainnet').toLowerCase();
}

export function resolveTonEndpoint(customEndpoint, networkName) {
    if (customEndpoint) {
        return customEndpoint.replace(/\/$/, '');
    }

    switch (networkName) {
        case 'testnet':
        case 'sandbox':
            return 'https://testnet.toncenter.com/api/v2/jsonRPC';
        default:
            return 'https://toncenter.com/api/v2/jsonRPC';
    }
}
