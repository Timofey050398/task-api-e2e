export function createTronStatusProvider(getTronWeb, { logger } = {}) {
    return async (txId) => {
        const tronWeb = getTronWeb();
        if (!tronWeb) {
            throw new Error('TronWeb client is not initialized');
        }

        try {
            const info = await tronWeb.trx.getTransactionInfo(txId);
            if (!info || Object.keys(info).length === 0) {
                return { confirmed: false, info: null };
            }

            const result = info.receipt?.result ?? info.result;
            const confirmed = typeof result === 'string'
                ? result.toLowerCase() === 'success'
                : Boolean(info.receipt);

            return { confirmed, info };
        } catch (error) {
            const message = error?.message ?? '';
            if (/not found|doesn't exist|transaction has not existed/i.test(message)) {
                return { confirmed: false, info: null };
            }

            logger?.warn?.('TRON status check error:', message || error);
            return { confirmed: false, error };
        }
    };
}
