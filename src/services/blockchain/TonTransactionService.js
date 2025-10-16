import { BlockchainTransactionService } from './BlockchainTransactionService.js';

const ONE_MINUTE = 60 * 1000;

export class TonTransactionService extends BlockchainTransactionService {
    constructor(options = {}) {
        super({
            ...options,
            network: 'TON',
            recommendedConfirmationTimeMs: options.recommendedConfirmationTimeMs ?? ONE_MINUTE,
            pollIntervalMs: options.pollIntervalMs ?? 5 * 1000,
        });
    }
}
