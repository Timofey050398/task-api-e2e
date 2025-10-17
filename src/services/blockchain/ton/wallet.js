import TonWeb from 'tonweb';

export function createTonWeb({ apiKey, endpoint }) {
    const provider = new TonWeb.HttpProvider(endpoint, { apiKey });
    return new TonWeb(provider);
}

export function getWalletClass(tonWeb, version) {
    return tonWeb.wallet?.all?.[version] ?? null;
}

export function createTonWallet(tonWeb, { publicKey, version, workchain }) {
    const walletClass = getWalletClass(tonWeb, version);
    if (!walletClass) throw new Error(`Unsupported wallet version: ${version}`);

    return new walletClass(tonWeb.provider, { publicKey, wc: workchain });
}
