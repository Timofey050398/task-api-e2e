import {toFriendlyAddress} from "./utils";

export class TonTxResolver {
    constructor(tonService) {
        this.tonService = tonService;
    }

    /**
     * Получает информацию о нативной транзакции TON по хэшу через tonapi.io.
     *
     * @param {string} txHash - идентификатор транзакции
     * @returns {Promise<{ isTxSuccess: boolean, receiver: string | null, receiveAmount: number }>}
     */
    async getTx(txHash) {
        if (!txHash) {
            throw new Error("[TON] getTx: txHash is required");
        }

        try {
            const isTestnet = this.tonService.tonEndpoint.includes("testnet");
            const tonapiBaseUrl = isTestnet
                ? "https://testnet.tonapi.io"
                : "https://tonapi.io";

            const url = `${tonapiBaseUrl}/v2/blockchain/transactions/${txHash}`;
            const response = await fetch(url);

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`[TON] tonapi.io request failed (${response.status}): ${errText}`);
            }

            const tx = await response.json();

            // TON специфика: если aborted === true, транзакция не дошла
            const isTxSuccess = Boolean(tx?.success);

            // Для нативных транзакций информация в in_msg
            const msg = tx?.in_msg ?? null;
            const receiver = toFriendlyAddress(msg?.destination?.address) ?? null;

            // Переводим из нанотонов (1 TON = 10^9)
            const rawValue = BigInt(msg?.value ?? 0);
            const receiveAmount = Number(rawValue) / 1e9;

            return { isTxSuccess, receiver, receiveAmount };
        } catch (error) {
            this.tonService.logger?.error?.("[TON] getTx failed", { txHash, error });
            throw error;
        }
    }
}