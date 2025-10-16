import { BlockchainTransactionService } from './BlockchainTransactionService.js';

const ONE_MINUTE = 60 * 1000;

export class BtcTransactionService extends BlockchainTransactionService {
    constructor(options = {}) {
        super({
            ...options,
            network: 'btc',
            recommendedConfirmationTimeMs: options.recommendedConfirmationTimeMs ?? 60 * ONE_MINUTE,
            pollIntervalMs: options.pollIntervalMs ?? 30 * 1000,
        });
    }
}
