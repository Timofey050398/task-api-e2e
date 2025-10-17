export function resolveTronNetworkName() {
    return (process.env.TRON_NETWORK ?? 'mainnet').toLowerCase();
}

export function resolveTronNodes({ networkName, fullNode, solidityNode, eventServer }) {
    const defaults = getDefaultTronNodes(networkName);

    const resolvedFullNode = (fullNode ?? defaults.fullNode).replace(/\/$/, '');
    const resolvedSolidityNode = (solidityNode ?? defaults.solidityNode ?? resolvedFullNode).replace(/\/$/, '');
    const resolvedEventServer = (eventServer ?? defaults.eventServer ?? resolvedFullNode).replace(/\/$/, '');

    return {
        fullNode: resolvedFullNode,
        solidityNode: resolvedSolidityNode,
        eventServer: resolvedEventServer,
    };
}

function getDefaultTronNodes(networkName) {
    switch (networkName) {
        case 'shasta':
        case 'testnet':
            return {
                fullNode: 'https://api.shasta.trongrid.io',
                solidityNode: 'https://api.shasta.trongrid.io',
                eventServer: 'https://api.shasta.trongrid.io',
            };
        case 'nile':
            return {
                fullNode: 'https://nile.trongrid.io',
                solidityNode: 'https://nile.trongrid.io',
                eventServer: 'https://nile.trongrid.io',
            };
        default:
            return {
                fullNode: 'https://api.trongrid.io',
                solidityNode: 'https://api.trongrid.io',
                eventServer: 'https://api.trongrid.io',
            };
    }
}
