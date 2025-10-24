import {Contract, JsonRpcProvider, Wallet} from 'ethers';

export function resolveEthNetworkName() {
    return (process.env.ETH_NETWORK ?? 'mainnet').toLowerCase();
}

export function resolveEthProviderCandidate(networkName) {
    if (process.env.ETH_RPC_URL) {
        return process.env.ETH_RPC_URL;
    }

    switch (networkName) {
        case 'sepolia':
            return `https://sepolia.infura.io/v3/${process.env.ETH_INFURA_PROJECT_ID}`;
        case 'goerli':
            return 'https://rpc.ankr.com/eth_goerli';
        case 'holesky':
            return 'https://ethereum-holesky.publicnode.com';
        default:
            return null;
    }
}

export function resolveProvider(provider) {
    if (!provider) return null;
    if (typeof provider === 'string') return new JsonRpcProvider(provider);
    return provider;
}

export function resolveSigner(signer, provider) {
    if (!signer) return null;
    if (typeof signer === 'string') return new Wallet(signer, provider);
    return signer;
}

export async function resolveTokenContract(tokenAddress, abi, providerOrSigner) {
    const proxyAbi = [
        "function implementation() view returns (address)",
        "function getImplementation() view returns (address)", // иногда используется это имя
    ];

    let implementationAddress;

    try {
        const proxy = new Contract(tokenAddress, proxyAbi, providerOrSigner);

        implementationAddress = await proxy.implementation().catch(async () => {
            try {
                return await proxy.getImplementation();
            } catch {
                return null;
            }
        });

    } catch (err) {
        implementationAddress = null;
    }

    if (implementationAddress) {
        console.log(`🔍 Token ${tokenAddress} is a Proxy → implementation = ${implementationAddress}`);
        return new Contract(implementationAddress, abi, providerOrSigner);
    }

    console.log(`✅ Token ${tokenAddress} is a regular ERC-20`);
    return new Contract(tokenAddress, abi, providerOrSigner);
}
