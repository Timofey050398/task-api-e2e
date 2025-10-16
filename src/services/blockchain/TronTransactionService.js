import { BlockchainTransactionService } from './BlockchainTransactionService.js';

const ONE_MINUTE = 60 * 1000;

export class TronTransactionService extends BlockchainTransactionService {
    constructor(options = {}) {
        super({
            ...options,
            network: 'TRON',
            recommendedConfirmationTimeMs: options.recommendedConfirmationTimeMs ?? 2 * ONE_MINUTE,
            pollIntervalMs: options.pollIntervalMs ?? 10 * 1000,
        });
    }
}
