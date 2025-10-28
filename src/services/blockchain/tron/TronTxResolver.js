
export class TronTxResolver {
    constructor(tronService) {
        this.tronService = tronService;
    }

    /**
     * Получает информацию о транзакции в сети Tron (TRX или TRC20)
     *
     * @param {string} txId - идентификатор транзакции (txid)
     * @param {Currency | undefined} currency - объект валюты, содержащий decimal и tokenContract
     * @returns {Promise<{ isTxSuccess: boolean, receiver: string | null, receiveAmount: number }>}
     */
    async getTx(txId, currency) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (!txId) {
            throw new Error("[TRON] getTx: txId is required");
        }

        try {
            const tronWeb = this.tronService.tronWeb;
            if (!tronWeb) {
                throw new Error("[TRON] TronWeb not initialized");
            }

            // 1️⃣ Получаем детальную информацию о транзакции
            const txInfo = await tronWeb.trx.getTransaction(txId).catch(() => null);
            if (!txInfo) {
                throw new Error(`[TRON] Transaction not found for txId: ${txId}`);
            }

            const receipt = await tronWeb.trx.getTransactionInfo(txId).catch(() => null);
            const isTxSuccess =
                receipt?.receipt?.result === "SUCCESS" ||
                receipt?.result === "SUCCESS" ||
                receipt?.contractRet === "SUCCESS" ||
                receipt?.ret?.some((r) => r.contractRet === "SUCCESS") ||
                txInfo?.ret.some((r) => r.contractRet === "SUCCESS");


            let receiver = null;
            let receiveAmount = 0;

            // Определяем decimals (по currency)
            const decimals = currency?.decimal ?? 6;

            // 2️⃣ Проверяем тип транзакции
            const contractType = txInfo.raw_data?.contract?.[0]?.type;

            // --- TRX native transfer ---
            if (contractType === "TransferContract") {
                const param = txInfo.raw_data.contract[0].parameter?.value;
                receiver = param?.to_address
                    ? tronWeb.address.fromHex(param.to_address)
                    : null;
                const rawAmount = param?.amount ?? 0;
                receiveAmount = Number(tronWeb.fromSun(rawAmount));
            }

            // --- TRC20 token transfer ---
            else if (contractType === "TriggerSmartContract") {
                const param = txInfo.raw_data.contract[0].parameter?.value;
                const dataHex = param?.data;

                // Проверяем, что это стандартный transfer(address,uint256)
                if (dataHex && dataHex.startsWith("a9059cbb")) {
                    const recipientHex = "41" + dataHex.slice(32, 72); // Tron-адрес (hex)
                    receiver = tronWeb.address.fromHex(recipientHex);

                    const amountHex = dataHex.slice(72);
                    const rawAmount = BigInt("0x" + amountHex);
                    receiveAmount = Number(Number(rawAmount) / 10 ** decimals);
                }

                else if (!receiver && receipt?.log?.length) {
                    const log = receipt.log.find(
                        (l) =>
                            l.topics?.length === 3 &&
                            l.topics[0]?.toLowerCase() ===
                            "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
                    );
                    if (log) {
                        const toHex = "41" + log.topics[2].slice(26);
                        receiver = tronWeb.address.fromHex(toHex);
                        const rawAmount = BigInt(log.data);
                        receiveAmount = Number(Number(rawAmount) / 10 ** decimals);
                    }
                }
            }

            return { isTxSuccess, receiver, receiveAmount };
        } catch (error) {
            this.tronService.logger?.error?.("[TRON] getTx failed", { txId, error });
            throw error;
        }
    }
}