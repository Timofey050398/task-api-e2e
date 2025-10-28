import {createTonWallet} from "./wallet";
import {estimateTonFee, normalizeSeqno, normalizeTonAmount} from "./utils";
import {Currencies} from "../../../model/Currency";
import {createTonSeqnoStatusProvider} from "./providers";

export class TonTxSender {
    constructor(tonService) {
        this.tonService = tonService;
    }

    #getWalletContract({
                           publicKey = this.tonService.publicKey,
                           version = this.tonService.defaultWalletVersion,
                           workchain = this.tonService.defaultWorkchain,
                       } = {}) {
        if (!publicKey) throw new Error('publicKey is required');

        return createTonWallet(this.tonService.tonWeb, {publicKey, version, workchain});
    }

    async sendNativeTransaction(toAddress, amount) {
        if (!this.tonService.secretKey || !this.tonService.publicKey)
            throw new Error('Wallet keys not configured in environment');
        if (!toAddress) throw new Error('toAddress is required');
        if (!amount) throw new Error('amount is required');

        this.tonService.logger?.info?.('[TON] Sending native transaction', {toAddress, amount});

        try {
            const contract = this.#getWalletContract();
            let seqnoRaw = await contract.methods.seqno().call();
            if (seqnoRaw === null || seqnoRaw === undefined) {
                this.tonService.logger?.info?.('[TON] Wallet not deployed yet, sending deploy transaction...');
                await contract.deploy(this.tonService.secretKey).send();
                await new Promise(res => setTimeout(res, 5000));
                seqnoRaw = await contract.methods.seqno().call();
            }
            const seqno = normalizeSeqno(seqnoRaw);
            const amountNano = normalizeTonAmount(amount);

            const result = await contract.methods.transfer({
                secretKey: this.tonService.secretKey,
                toAddress,
                amount: amountNano,
                seqno,
                sendMode: 3,
            }).send();

            const response = {
                currency: Currencies.TON,
                txHash: result?.id?.hash ?? 'unknown',
                sentAmount: amount,
                fee: estimateTonFee(),
            };

            this.tonService.logger?.info?.('[TON] Native transaction sent', response);

            const expectedSeqno = seqno + 1;
            await this.tonService.waitForConfirmation(response.txHash, {
                statusProvider: createTonSeqnoStatusProvider(contract, expectedSeqno, {logger: this.tonService.logger}),
            });

            return response;
        } catch (error) {
            this.tonService.logger?.error?.('[TON] Failed to send native transaction', error);
            throw error;
        }
    }
}