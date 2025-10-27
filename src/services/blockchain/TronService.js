import TronWebModule from 'tronweb';
const TronWeb = TronWebModule.TronWeb || TronWebModule.default || TronWebModule;
import { BlockchainService } from './BlockchainService.js';
import { Currencies } from '../../model/Currency.js';
import { Network } from '../../model/Network.js';
import { createTronStatusProvider } from './tron/providers.js';
import { resolveTronNetworkName, resolveTronNodes } from './tron/config.js';
import { extractTransactionInfo, normalizeTransactionId, scaleDecimals } from './tron/utils.js';

const ONE_MINUTE = 60 * 1000;

export class TronService extends BlockchainService {
    constructor(options = {}) {
        const networkName = resolveTronNetworkName();
        super({
            ...options,
            network: 'TRON',
            recommendedConfirmationTimeMs: options.recommendedConfirmationTimeMs ?? 2 * ONE_MINUTE,
            pollIntervalMs: options.pollIntervalMs ?? 10 * 1000,
        });

        const { fullNode, solidityNode, eventServer } = resolveTronNodes(networkName);
        const privateKey = process.env.TRON_PRIVATE_KEY;

        if (!privateKey) {
            throw new Error('TRON_PRIVATE_KEY not found in environment');
        }

        this.tronWeb =
            options.tronWeb ??
            new TronWeb(fullNode, solidityNode, eventServer, privateKey);

        const statusProvider = options.statusProvider ?? createTronStatusProvider(() => this.tronWeb, { logger: this.logger });
        this.setStatusProvider(statusProvider);
    }

    async generateRandomAddress() {
        const tronWeb = new TronWeb({
            fullHost: process.env.TRON_FULL_NODE || 'https://api.shasta.trongrid.io',
        });
        const account = tronWeb.utils.accounts.generateAccount();
        // noinspection JSValidateTypes
        return account.address.base58;
    }

    /**
     * Получает информацию о транзакции в сети Tron (TRX или TRC20)
     *
     * @param {string} txId - идентификатор транзакции (txid)
     * @param {Currency | undefined} currency - объект валюты, содержащий decimal и tokenContract
     * @returns {Promise<{ isTxSuccess: boolean, receiver: string | null, receiveAmount: number }>}
     */
    async getTx(txId, currency) {
        if (!txId) {
            throw new Error("[TRON] getTx: txId is required");
        }

        try {
            const tronWeb = this.tronWeb;
            if (!tronWeb) {
                throw new Error("[TRON] TronWeb not initialized");
            }

            // 1️⃣ Получаем детальную информацию о транзакции
            const txInfo = await tronWeb.trx.getTransaction(txId).catch(() => null);
            if (!txInfo) {
                throw new Error(`[TRON] Transaction not found for txId: ${txId}`);
            }

            const receipt = await tronWeb.trx.getTransactionInfo(txId).catch(() => null);
            const isTxSuccess = receipt?.receipt?.result === "SUCCESS" || receipt?.result === "SUCCESS";

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

                // Если получатель не определён напрямую, пробуем из логов
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
            this.logger?.error?.("[TRON] getTx failed", { txId, error });
            throw error;
        }
    }


    async send(to, amount, currency) {
        if (!currency) {
            throw new Error('Currency required');
        }

        if (currency.network !== Network.TRON) {
            throw new Error('Only TRON network supported');
        }

        if ('tokenContract' in currency && currency.tokenContract) {
            return this.sendTokenTransaction(to, amount, currency);
        }

        return this.sendNativeTransaction(to, amount);
    }

    async sendNativeTransaction(to, amount) {
        if (!to) throw new Error('Recipient address required');
        if (!this.tronWeb) throw new Error('TronWeb client not initialized');

        this.logger?.info?.('[TRON] Sending native transaction', { to, amount });

        try {
            const from = this.tronWeb.defaultAddress.base58;
            const amountInSun = this.tronWeb.toSun(amount);

            const tx = await this.tronWeb.transactionBuilder.sendTrx(to, amountInSun, from);
            const signed = await this.tronWeb.trx.sign(tx);
            const receipt = await this.tronWeb.trx.sendRawTransaction(signed);

            const confirmation = await this.waitForConfirmation(receipt.txid);
            const info = extractTransactionInfo(confirmation.status);
            const energyFee = info?.receipt?.energy_fee ?? 0;
            const feeTrx = this.tronWeb.fromSun(energyFee);

            const result = {
                currency: Currencies.TRX,
                txHash: receipt.txid,
                sentAmount: amount,
                fee: feeTrx,
            };

            this.logger?.info?.('[TRON] Native transaction sent', result);
            return result;
        } catch (error) {
            this.logger?.error?.('[TRON] Failed to send native transaction', error);
            throw error;
        }
    }

    async sendTokenTransaction(to, amount, currency) {
        if (!to) throw new Error('Recipient address required');
        if (!currency) throw new Error('Currency required');
        if (currency.network !== Network.TRON) throw new Error('Only TRON network supported');

        this.logger?.info?.('[TRON] Sending token transaction', {
            to,
            amount,
            tokenContract: currency.tokenContract,
        });

        try {
            const tokenAddress = currency.tokenContract;
            const decimals = currency.decimal ?? 6;
            if (!tokenAddress) throw new Error('Token contract missing in currency');

            const contract = await this.tronWeb.contract().at(tokenAddress);
            const scaledAmount = scaleDecimals(amount, decimals);

            const tx = await contract.transfer(to, scaledAmount).send({
                feeLimit: 30_000_000,
                shouldPollResponse: false,
            });

            const txId = normalizeTransactionId(tx);
            const confirmation = await this.waitForConfirmation(txId);
            const info = extractTransactionInfo(confirmation.status);
            const feeTrx = this.tronWeb.fromSun(info?.fee ?? info?.receipt?.energy_fee ?? 0);

            const result = {
                currency: currency,
                txHash: txId,
                sentAmount: amount,
                fee: feeTrx,
            };

            this.logger?.info?.('[TRON] Token transaction sent', result);
            return result;
        } catch (error) {
            this.logger?.error?.('[TRON] Failed to send token transaction', error);
            throw error;
        }
    }
}
