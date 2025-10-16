import { test, expect } from '@playwright/test';
import {
    BtcTransactionService,
    EthTransactionService,
    TryTransactionService,
    TonTransactionService,
} from '../../services/blockchain/index.js';

function createDelayedConfirmationProvider(confirmOnAttempt, resolvedStatus = true) {
    let attempts = 0;
    return async () => {
        attempts += 1;
        if (attempts >= confirmOnAttempt) {
            return resolvedStatus;
        }

        if (resolvedStatus && typeof resolvedStatus === 'object') {
            return { ...resolvedStatus, confirmed: false };
        }

        return false;
    };
}

test.describe('Blockchain transaction services', () => {
    test('BTC service resolves when confirmation is received before timeout', async () => {
        const service = new BtcTransactionService({
            recommendedConfirmationTimeMs: 200,
            pollIntervalMs: 20,
            statusProvider: createDelayedConfirmationProvider(3, true),
        });

        const result = await service.waitForConfirmation('btc-tx');

        expect(result.confirmed).toBe(true);
        expect(result.attempts).toBe(3);
        expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    });

    test('ETH service throws when the confirmation never arrives', async () => {
        const service = new EthTransactionService({
            recommendedConfirmationTimeMs: 120,
            pollIntervalMs: 30,
            statusProvider: async () => ({ confirmed: false, status: 'pending' }),
        });

        await expect(service.waitForConfirmation('eth-tx')).rejects.toThrow(/eth-tx/);
    });

    test('TON service allows passing a custom status provider per call', async () => {
        const service = new TonTransactionService();

        const result = await service.waitForConfirmation('ton-tx', {
            timeoutMs: 150,
            pollIntervalMs: 30,
            statusProvider: createDelayedConfirmationProvider(2, { status: 'confirmed' }),
        });

        expect(result.confirmed).toBe(true);
        expect(result.status).toEqual({ status: 'confirmed' });
    });

    test('TRY service works with setStatusProvider helper', async () => {
        const service = new TryTransactionService({
            recommendedConfirmationTimeMs: 150,
            pollIntervalMs: 40,
        });

        service.setStatusProvider(async (_transactionId, context) => {
            return context.attempts >= 2 ? { confirmed: true } : { confirmed: false };
        });

        const result = await service.waitForConfirmation('try-tx');

        expect(result.confirmed).toBe(true);
        expect(result.attempts).toBe(2);
    });
});
