import {formatUnits} from "ethers";

export class EthTxResolver {
    constructor(ethService) {
        this.ethService = ethService;
    }

    /**
     * Получает информацию о транзакции в сети Ethereum (ETH или ERC-20).
     *
     * @param {string} txHash - хеш транзакции
     * @param {Currency | undefined} currency - объект валюты (может содержать .decimal и .tokenContract)
     * @returns {Promise<{ isTxSuccess: boolean, receiver: string | null, receiveAmount: number }>}
     */
    async getTx(txHash, currency) {
        if (!txHash) {
            throw new Error("[ETH] getTx: txHash is required");
        }

        try {
            const tx = await this.ethService.provider.getTransaction(txHash);
            if (!tx) {
                throw new Error(`[ETH] Transaction not found for hash: ${txHash}`);
            }

            const receipt = await this.ethService.provider.getTransactionReceipt(txHash);
            if (!receipt) {
                throw new Error(`[ETH] Receipt not found for hash: ${txHash}`);
            }

            const isTxSuccess = receipt.status === 1 || receipt.status === 1n;
            let receiver = tx.to ?? null;
            let receiveAmount = 0;

            const decimals = currency?.decimal ?? 18;

            if (!tx.data || tx.data === "0x" || tx.data.length <= 10) {
                receiveAmount = Number(formatUnits(tx.value ?? 0, decimals));
            }

            else if (tx.data.startsWith("0xa9059cbb")) {
                // Стандартная сигнатура transfer(address,uint256)
                const recipientHex = "0x" + tx.data.slice(34, 74);
                const amountHex = tx.data.slice(74);

                receiver = recipientHex.toLowerCase();
                const rawAmount = BigInt("0x" + amountHex);
                receiveAmount = Number(formatUnits(rawAmount, decimals));
            }

            else if (receipt.logs?.length) {
                try {
                    const transferTopic =
                        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
                    const log = receipt.logs.find(
                        (l) =>
                            l.topics?.[0]?.toLowerCase() === transferTopic &&
                            l.topics?.length === 3
                    );

                    if (log) {
                        const recipient = "0x" + log.topics[2].slice(26);
                        receiver = recipient.toLowerCase();
                        const rawAmount = BigInt(log.data);
                        receiveAmount = Number(formatUnits(rawAmount, decimals));
                    }
                } catch (parseError) {
                    this.ethService.logger?.warn?.("[ETH] Failed to parse logs for transfer", parseError);
                }
            }

            return { isTxSuccess, receiver, receiveAmount };
        } catch (error) {
            this.ethService.logger?.error?.("[ETH] getTx failed", { txHash, error });
            throw error;
        }
    }


}