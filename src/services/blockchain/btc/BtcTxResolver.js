import * as bitcoin from "bitcoinjs-lib";

export class BtcTxResolver {
    constructor(btcService) {
        this.btcService = btcService;
    }

    /**
     * Получает информацию о транзакции по её txid.
     * Возвращает { isTxSuccess, receiver, receiveAmount }.
     *
     * receiveAmount — в BTC, не в сатоши.
     */
    async getTx(txid) {
        if (!txid) throw new Error("[BTC] getTx: txid is required");

        try {
            const raw = await this.btcService.txProvider(txid);
            const status = await this.btcService.statusProvider(txid);
            const isTxSuccess =
                typeof status === "boolean"
                    ? status
                    : status?.confirmed === true ||
                    status?.status === "confirmed" ||
                    status?.status === "success";

            let receiver = null;
            let receiveAmount = 0;

            // 👇 если txProvider возвращает raw hex
            if (typeof raw === "string") {
                const tx = bitcoin.Transaction.fromBuffer(Buffer.from(raw, "hex"));

                // В raw hex мы не можем достать адреса из входов без предыдущих транзакций.
                // Поэтому берём первый декодируемый выход с ненулевой суммой.
                for (const out of tx.outs) {
                    const sat = out.value || 0;
                    if (sat <= 0) continue;
                    try {
                        receiver = bitcoin.address.fromOutputScript(out.script, this.btcService.bitcoinNetwork);
                        receiveAmount = sat / 1e8;
                        break;
                    } catch {}
                }
            }
            // 👇 если провайдер возвращает JSON (Blockstream REST)
            else {
                const inputs = raw.vin || raw.inputs || [];
                const outputs = raw.vout || raw.outputs || [];

                // Собираем уникальные адреса отправителей
                const senderAddrs = new Set();
                for (const vin of inputs) {
                    const addr =
                        vin.prevout?.scriptpubkey_address ||
                        vin.address ||
                        vin.scriptSig?.addresses?.[0] ||
                        null;
                    if (addr) senderAddrs.add(addr);
                }

                // Ищем выход, чей адрес не встречается среди отправителей
                for (const out of outputs) {
                    const sat =
                        typeof out.value === "number"
                            ? out.value
                            : typeof out.scriptpubkey_value === "number"
                                ? out.scriptpubkey_value
                                : 0;
                    if (sat <= 0) continue;

                    const addr =
                        out.scriptpubkey_address ||
                        out.address ||
                        out.scriptPubKey?.addresses?.[0] ||
                        out.addresses?.[0] ||
                        out.scriptpubkey_addresses?.[0] ||
                        null;
                    if (!addr) continue;

                    // пропускаем выходы на адреса, участвовавшие во входах (change/self-send)
                    if (senderAddrs.has(addr)) continue;

                    receiver = addr;
                    receiveAmount = sat / 1e8;
                    break;
                }

                // fallback: если все совпали — берём первый ненулевой выход
                if (!receiver && outputs.length > 0) {
                    for (const out of outputs) {
                        const sat =
                            typeof out.value === "number"
                                ? out.value
                                : typeof out.scriptpubkey_value === "number"
                                    ? out.scriptpubkey_value
                                    : 0;
                        if (sat <= 0) continue;
                        const addr =
                            out.scriptpubkey_address ||
                            out.address ||
                            out.scriptPubKey?.addresses?.[0] ||
                            out.addresses?.[0] ||
                            out.scriptpubkey_addresses?.[0] ||
                            null;
                        if (addr) {
                            receiver = addr;
                            receiveAmount = sat / 1e8;
                            break;
                        }
                    }
                }
            }

            return { isTxSuccess, receiver, receiveAmount };
        } catch (error) {
            this.btcService.logger?.error?.("[BTC] getTx failed", { txid, error });
            throw error;
        }
    }


}