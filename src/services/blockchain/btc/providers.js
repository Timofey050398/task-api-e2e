import { DUST_THRESHOLD } from './constants.js';

export function createBlockstreamUtxoProvider({ logger, timeoutMs = 10_000, retries = 3, apiBaseUrl = 'https://blockstream.info/api' } = {}) {
    return async (address) => {
        const base = apiBaseUrl.replace(/\/$/, '');
        const url = `${base}/address/${address}/utxo`;
        return retry(async () => {
            const res = await fetchWithTimeout(url, { timeoutMs });
            if (!res.ok) throw new Error(`UTXO fetch failed: ${res.status}`);
            return res.json();
        }, { retries, logger });
    };
}

export function createMempoolFeeRateProvider({ logger, timeoutMs = 10_000, retries = 3, apiBaseUrl } = {}) {
    return async () => {
        return retry(async () => {
            const base = (apiBaseUrl ?? 'https://mempool.space/api').replace(/\/$/, '');
            const res = await fetchWithTimeout(`${base}/v1/fees/recommended`, { timeoutMs });
            if (!res.ok) throw new Error(`Fee rate fetch failed: ${res.status}`);
            const data = await res.json();
            return data.fastestFee || 15; // сатоши за байт
        }, { retries, fallback: () => 10, logger });
    };
}

export function createBlockstreamBroadcastProvider({ apiBaseUrl = 'https://blockstream.info/api', logger } = {}) {
    const baseUrl = apiBaseUrl.replace(/\/$/, '');
    return async (rawTx) => {
        const res = await fetchWithTimeout(`${baseUrl}/tx`, {
            timeoutMs: 15_000,
            fetchOptions: {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: rawTx,
            },
        });
        if (!res.ok) {
            const message = await res.text();
            logger?.error?.('[BTC] Broadcast error', message);
            throw new Error(`Broadcast failed: ${message}`);
        }
        const txid = await res.text();
        return { txid };
    };
}

export function createBlockstreamTxProvider({ apiBaseUrl = 'https://blockstream.info/api', logger, timeoutMs = 10_000, retries = 3 } = {}) {
    const baseUrl = apiBaseUrl.replace(/\/$/, '');

    return async (txid) => {
        return retry(
            async () => {
                const res = await fetchWithTimeout(`${baseUrl}/tx/${txid}/hex`, { timeoutMs });
                if (!res.ok) throw new Error(`Transaction fetch failed: ${res.status}`);
                return res.text();
            },
            { retries, logger },
        );
    };
}

export function createBlockstreamStatusProvider({ apiBaseUrl, logger, timeoutMs = 10_000, retries = 5 } = {}) {
    if (!apiBaseUrl) {
        throw new Error('apiBaseUrl is required for Blockstream status provider');
    }

    const baseUrl = apiBaseUrl.replace(/\/$/, '');

    return async (txId) => {
        const url = `${baseUrl}/tx/${txId}`;

        try {
            const response = await retry(
                async () => {
                    const res = await fetchWithTimeout(url, { timeoutMs });
                    if (res.status === 404) {
                        return { confirmed: false };
                    }

                    if (!res.ok) {
                        throw new Error(`Status fetch failed: ${res.status}`);
                    }

                    return res.json();
                },
                { retries, logger },
            );

            if (!response) {
                return { confirmed: false };
            }

            if (response.confirmed === false) {
                return { confirmed: false };
            }

            const status = response.status ?? response;
            if (status && typeof status === 'object') {
                return { confirmed: Boolean(status.confirmed), status };
            }

            return { confirmed: false, status };
        } catch (error) {
            logger?.warn?.('[BTC] Status check error', error?.message ?? error);
            return { confirmed: false, error };
        }
    };
}

export async function fetchWithTimeout(url, { timeoutMs = 10_000, fetchOptions = {} } = {}) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...fetchOptions, signal: controller.signal });
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
        }
        throw error;
    } finally {
        clearTimeout(id);
    }
}

export async function retry(fn, { retries = 3, fallback = null, logger = console }) {
    let attempt = 0;
    while (attempt < retries) {
        try {
            return await fn();
        } catch (error) {
            attempt += 1;
            logger?.warn?.(`BTC provider error (attempt ${attempt}/${retries}):`, error.message ?? error);
            if (attempt >= retries) {
                if (fallback !== null) {
                    return typeof fallback === 'function' ? fallback() : fallback;
                }
                throw error;
            }
        }
    }

    return typeof fallback === 'function' ? fallback() : fallback;
}

export function calculateFeeAndChange({ totalInputValue, inputCount, sendValue, feeRate }) {
    const baseOutputs = 1;
    let fee = estimateFee({ inputCount, outputCount: baseOutputs, feeRate });
    let changeValue = totalInputValue - sendValue - fee;

    if (changeValue >= DUST_THRESHOLD) {
        fee = estimateFee({ inputCount, outputCount: baseOutputs + 1, feeRate });
        changeValue = totalInputValue - sendValue - fee;
        if (changeValue < DUST_THRESHOLD) {
            fee = estimateFee({ inputCount, outputCount: baseOutputs, feeRate });
            changeValue = 0;
        }
    } else if (changeValue < 0) {
        fee = estimateFee({ inputCount, outputCount: baseOutputs, feeRate });
        changeValue = totalInputValue - sendValue - fee;
    }

    return { fee, changeValue: Math.max(changeValue, 0) };
}

export function estimateFee({ inputCount, outputCount, feeRate }) {
    const estimatedVBytes = inputCount * 148 + outputCount * 34 + 10;
    return Math.ceil(estimatedVBytes * feeRate);
}

export function selectUtxosForAmount({ utxos, sendValue, feeRate }) {
    const sorted = [...utxos].sort((a, b) => b.value - a.value);
    const selectedUtxos = [];
    let total = 0;

    for (const utxo of sorted) {
        selectedUtxos.push({
            hash: utxo.txid,
            index: utxo.vout,
            value: utxo.value,
        });
        total += utxo.value;

        const { fee, changeValue } = calculateFeeAndChange({
            totalInputValue: total,
            inputCount: selectedUtxos.length,
            sendValue,
            feeRate,
        });

        if (total >= sendValue + fee) {
            return { selectedUtxos, fee, changeValue };
        }
    }

    const { fee } = calculateFeeAndChange({
        totalInputValue: total,
        inputCount: selectedUtxos.length,
        sendValue,
        feeRate,
    });

    throw new Error(`Insufficient balance. Available: ${total}, need: ${sendValue + fee}`);
}
