import { BlockchainTransactionService } from './BlockchainTransactionService.js';

const ONE_MINUTE = 60 * 1000;

export class TonTransactionService extends BlockchainTransactionService {
    constructor(options = {}) {
        super({
            ...options,
            network: 'ton',
            recommendedConfirmationTimeMs: options.recommendedConfirmationTimeMs ?? 1 * ONE_MINUTE,
            pollIntervalMs: options.pollIntervalMs ?? 5 * 1000,
        });
    }
}
