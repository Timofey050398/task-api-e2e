export class BlockchainTransactionService {
    /**
     * @param {Object} options
     * @param {string} options.network
     * @param {number} options.recommendedConfirmationTimeMs
     * @param {number} [options.pollIntervalMs=5000]
     * @param {(transactionId: string, context: { attempts: number, elapsedMs: number, network: string }) => Promise<unknown>|unknown} [options.statusProvider]
     */
    constructor({
        network,
        recommendedConfirmationTimeMs,
        pollIntervalMs = 5000,
        statusProvider = null,
    } = {}) {
        if (!network) {
            throw new Error('network is required');
        }

        if (!recommendedConfirmationTimeMs || recommendedConfirmationTimeMs <= 0) {
            throw new Error('recommendedConfirmationTimeMs must be a positive number');
        }

        if (!pollIntervalMs || pollIntervalMs <= 0) {
            throw new Error('pollIntervalMs must be a positive number');
        }

        this.network = network;
        this.recommendedConfirmationTimeMs = recommendedConfirmationTimeMs;
        this.pollIntervalMs = pollIntervalMs;
        this.statusProvider = statusProvider;
    }

    /**
     * @param {(transactionId: string, context: { attempts: number, elapsedMs: number, network: string }) => Promise<unknown>|unknown} statusProvider
     */
    setStatusProvider(statusProvider) {
        if (typeof statusProvider !== 'function') {
            throw new Error('statusProvider must be a function');
        }

        this.statusProvider = statusProvider;
    }

    /**
     * Waits for the transaction to be confirmed using polling.
     *
     * @param {string} transactionId
     * @param {Object} [options]
     * @param {number} [options.timeoutMs]
     * @param {number} [options.pollIntervalMs]
     * @param {(transactionId: string, context: { attempts: number, elapsedMs: number, network: string }) => Promise<unknown>|unknown} [options.statusProvider]
     * @returns {Promise<{ confirmed: true, status: unknown, elapsedMs: number, attempts: number }>}
     */
    async waitForConfirmation(transactionId, options = {}) {
        if (!transactionId) {
            throw new Error('transactionId is required');
        }

        const timeoutMs = options.timeoutMs ?? this.recommendedConfirmationTimeMs;
        if (!timeoutMs || timeoutMs <= 0) {
            throw new Error('timeoutMs must be a positive number');
        }

        const pollIntervalMs = options.pollIntervalMs ?? this.pollIntervalMs;
        if (!pollIntervalMs || pollIntervalMs <= 0) {
            throw new Error('pollIntervalMs must be a positive number');
        }

        const statusProvider = options.statusProvider ?? this.statusProvider;
        if (typeof statusProvider !== 'function') {
            throw new Error('A statusProvider function must be supplied either in the constructor or call options');
        }

        const startedAt = Date.now();
        let attempts = 0;
        let lastStatus = null;

        while (Date.now() - startedAt < timeoutMs) {
            attempts += 1;
            lastStatus = await statusProvider(transactionId, {
                attempts,
                elapsedMs: Date.now() - startedAt,
                network: this.network,
            });

            if (this.isConfirmed(lastStatus)) {
                const elapsedMs = Date.now() - startedAt;
                return {
                    confirmed: true,
                    status: lastStatus,
                    elapsedMs,
                    attempts,
                };
            }

            await delay(pollIntervalMs);
        }

        const error = new Error(`Transaction ${transactionId} on ${this.network} was not confirmed within ${timeoutMs}ms`);
        error.transactionId = transactionId;
        error.network = this.network;
        error.lastStatus = lastStatus;
        error.elapsedMs = Date.now() - startedAt;
        error.attempts = attempts;

        throw error;
    }

    /**
     * Determines whether the provided status represents a confirmed transaction.
     *
     * @param {unknown} status
     * @returns {boolean}
     */
    // eslint-disable-next-line class-methods-use-this
    isConfirmed(status) {
        if (typeof status === 'boolean') {
            return status;
        }

        if (status && typeof status === 'object') {
            if (Object.prototype.hasOwnProperty.call(status, 'confirmed')) {
                return Boolean(status.confirmed);
            }

            if (Object.prototype.hasOwnProperty.call(status, 'status')) {
                const value = status.status;
                if (typeof value === 'string') {
                    return ['confirmed', 'success', 'completed', 'ok'].includes(value.toLowerCase());
                }
            }
        }

        return false;
    }
}

function delay(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
