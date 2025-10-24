export function createTronStatusProvider(getTronWeb, { logger } = {}) {
    return async (txId) => {
        const tronWeb = getTronWeb();
        if (!tronWeb) {
            throw new Error('TronWeb client is not initialized');
        }

        try {
            const info = await tronWeb.trx.getTransactionInfo(txId);
            logger.info(info);
            if (info && Object.keys(info).length > 0) {
                return {
                    confirmed: isSuccessfulTronReceipt(info),
                    info,
                };
            }

            const confirmedInfo = await fetchConfirmedTransaction(tronWeb, txId);
            if (confirmedInfo) {
                return {
                    confirmed: isSuccessfulTronReceipt(confirmedInfo),
                    info: confirmedInfo,
                };
            }

            return { confirmed: false, info: null };
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

function isSuccessfulTronReceipt(info) {
    const result = info.receipt?.result ?? info.result ?? info.ret?.[0]?.contractRet ?? info.contractRet;
    if (typeof result === 'string') {
        return result.toLowerCase() === 'success';
    }

    if (info.receipt) {
        return true;
    }

    return Boolean(info.blockNumber || info.blockHash);
}

async function fetchConfirmedTransaction(tronWeb, txId) {
    const methods = [
        () => tronWeb.trx.getConfirmedTransaction?.(txId),
        () => tronWeb.trx.getTransaction?.(txId),
    ];

    for (const getTx of methods) {
        if (typeof getTx !== 'function') continue;

        try {
            const info = await getTx();
            if (info && Object.keys(info).length > 0 && (info.blockNumber || info.blockHash)) {
                return info;
            }
        } catch (error) {
            const message = error?.message ?? '';
            if (/not found|doesn't exist|transaction has not existed/i.test(message)) {
                return null;
            }
        }
    }

    return null;
}
