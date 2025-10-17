import { normalizeSeqno } from './utils.js';

export function createTonSeqnoStatusProvider(contract, expectedSeqno, { logger } = {}) {
    return async () => {
        try {
            const currentRaw = await contract.methods.seqno().call();
            const current = normalizeSeqno(currentRaw);
            return { confirmed: current >= expectedSeqno, seqno: current };
        } catch (error) {
            logger?.warn?.('[TON] Status check error', error?.message ?? error);
            return { confirmed: false, error };
        }
    };
}
