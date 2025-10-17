export function normalizeBtcAmount(amount) {
    if (typeof amount === 'bigint') {
        const satoshisBigInt = amount;
        if (satoshisBigInt < 0n) {
            throw new Error('BTC amount must be positive');
        }

        if (satoshisBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
            throw new Error('BTC amount exceeds safe integer range');
        }

        const satoshis = Number(satoshisBigInt);
        return {
            satoshis,
            humanAmount: formatBtcFromSatoshis(satoshisBigInt),
        };
    }

    if (typeof amount === 'number') {
        if (!Number.isFinite(amount)) {
            throw new Error('BTC amount must be a finite number');
        }
        if (amount < 0) {
            throw new Error('BTC amount must be positive');
        }

        const satoshis = Math.round(amount * 100_000_000);

        if (!Number.isSafeInteger(satoshis)) {
            throw new Error('BTC amount exceeds safe integer range');
        }

        const normalized = satoshis / 100_000_000;
        if (Math.abs(normalized - amount) > Number.EPSILON) {
            throw new Error('BTC amount precision exceeds 8 decimal places');
        }

        return {
            satoshis,
            humanAmount: formatBtcFromSatoshis(BigInt(satoshis)),
        };
    }

    if (typeof amount === 'string') {
        const trimmed = amount.trim();
        if (!/^\d+(\.\d+)?$/.test(trimmed)) {
            throw new Error('BTC amount must be a non-negative decimal string');
        }

        const [integerPartRaw, fractionalRaw = ''] = trimmed.split('.');
        if (fractionalRaw.length > 8 && /[1-9]/.test(fractionalRaw.slice(8))) {
            throw new Error('BTC amount precision exceeds 8 decimal places');
        }

        const integerPart = integerPartRaw === '' ? '0' : integerPartRaw;
        const fractionalPart = (fractionalRaw + '0'.repeat(8)).slice(0, 8);

        const satoshiString = `${integerPart}${fractionalPart}`.replace(/^0+(?=\d)/, '');
        const satoshisBigInt = BigInt(satoshiString === '' ? '0' : satoshiString);

        if (satoshisBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
            throw new Error('BTC amount exceeds safe integer range');
        }

        return {
            satoshis: Number(satoshisBigInt),
            humanAmount: formatBtcFromSatoshis(satoshisBigInt),
        };
    }

    throw new Error('Unsupported BTC amount type');
}

export function formatBtcFromSatoshis(value) {
    const bigIntValue = typeof value === 'bigint' ? value : BigInt(value);
    const negative = bigIntValue < 0n;
    const absValue = negative ? -bigIntValue : bigIntValue;
    const integerPart = absValue / 100_000_000n;
    const fractionalPart = absValue % 100_000_000n;
    const fractional = fractionalPart.toString().padStart(8, '0');
    const normalizedFractional = fractional.replace(/0+$/, '');
    const result = normalizedFractional ? `${integerPart.toString()}.${normalizedFractional}` : integerPart.toString();
    return negative ? `-${result}` : result;
}
