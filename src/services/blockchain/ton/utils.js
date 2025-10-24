import TonWeb from 'tonweb';

export function normalizeTonAmount(amount) {
    const { BN, toNano } = TonWeb.utils;

    if (typeof amount === 'bigint') return new BN(amount.toString());
    if (typeof amount === 'number') return toNano(amount.toString());
    if (typeof amount === 'string') return toNano(amount);
    throw new Error('amount must be a bigint, number, or string');
}

export function scaleByDecimals(value, decimals) {
    if (typeof value === 'bigint') return value.toString();
    const stringValue = value.toString();
    const [integerPart, fractionalPart = ''] = stringValue.split('.');
    const paddedFraction = (fractionalPart + '0'.repeat(decimals)).slice(0, decimals);
    const normalized = `${integerPart}${paddedFraction}`.replace(/^0+(\d)/, '$1');
    return normalized === '' ? '0' : normalized;
}

export function normalizeSeqno(value) {
    if (value === null || value === undefined) {
        throw new Error('TON seqno value is not available');
    }

    if (typeof value === 'number') {
        return value;
    }

    if (typeof value === 'bigint') {
        return Number(value);
    }

    if (value && typeof value.toNumber === 'function') {
        return value.toNumber();
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
        throw new Error('Unable to parse TON seqno value');
    }
    return parsed;
}

export function estimateTonFee() {
    const { fromNano } = TonWeb.utils;
    const baseFeeNano = BigInt(200_000_000); // ~0.2 TON запасом
    return fromNano(baseFeeNano.toString());
}
