import { BlockchainTransactionService } from './BlockchainTransactionService.js';

const ONE_MINUTE = 60 * 1000;

export class EthTransactionService extends BlockchainTransactionService {
    constructor(options = {}) {
        super({
            ...options,
            network: 'eth',
            recommendedConfirmationTimeMs: options.recommendedConfirmationTimeMs ?? 3 * ONE_MINUTE,
            pollIntervalMs: options.pollIntervalMs ?? 15 * 1000,
        });
    }
}
