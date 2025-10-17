export function scaleDecimals(value, decimals) {
    const [intPart, frac = ''] = value.toString().split('.');
    const padded = (frac + '0'.repeat(decimals)).slice(0, decimals);
    return `${intPart}${padded}`;
}

export function extractTransactionInfo(status) {
    if (!status) return null;
    if (status.info) return status.info;
    if (status.receipt || status.fee) return status;
    return null;
}

export function normalizeTransactionId(tx) {
    if (typeof tx === 'string') return tx;
    if (tx?.txid) return tx.txid;
    if (tx?.transaction?.txID) return tx.transaction.txID;
    throw new Error('Unable to determine TRON transaction id');
}
