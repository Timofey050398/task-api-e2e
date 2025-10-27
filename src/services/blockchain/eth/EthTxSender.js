import {formatUnits, parseUnits} from "ethers";
import {Currencies} from "../../../model/Currency";
import {Network} from "../../../model/Network";

export class EthTxSender {
    constructor(ethService) {
        this.ethService = ethService;
    }

    async sendNativeTransaction(to, amount) {
        if (!this.ethService.signer) throw new Error('Signer not set');
        if (!to) throw new Error('Recipient address required');

        this.ethService.logger?.info?.('[ETH] Sending native transaction', { to, amount: amount.toString() });

        try {
            const value = parseUnits(amount.toString(), 'ether');

            const { gasPrice } = await this.ethService.provider.getFeeData();
            this.ethService.logger?.info?.('[ETH] tx gasPrice', { gasPrice });
            if (!gasPrice) throw new Error('Gas price unavailable from provider');
            const estimate = await this.ethService.signer.estimateGas({ to, value });
            this.ethService.logger?.info?.('[ETH] tx estimate', { estimate });
            const fee = gasPrice * estimate;
            this.ethService.logger?.info?.('[ETH] tx fee', { fee });
            const tx = await this.ethService.signer.sendTransaction({ to, value, gasPrice, gasLimit: estimate });
            const receipt = await tx.wait();

            if (!receipt || (receipt.status !== 1n && receipt.status !== 1)) {
                throw new Error(`[ETH] Native transaction ${tx.hash} was not confirmed successfully`);
            }

            const result = {
                currency: Currencies.ETH,
                txHash: tx.hash,
                sentAmount: amount,
                fee: formatUnits(fee, 'ether'),
            };

            this.ethService.logger?.info?.('[ETH] Native transaction sent', result);
            return result;
        } catch (error) {
            this.ethService.logger?.error?.('[ETH] Failed to send native transaction', error);
            throw error;
        }
    }

    async sendTokenTransaction(to, amount, currency) {
        if (!this.ethService.signer) throw new Error('Signer not set');
        if (!to) throw new Error('Recipient address required');
        if (!currency) throw new Error('Currency required');

        if (currency.network !== Network.ETH) {
            throw new Error('Only ETH network supported');
        }

        if (!('tokenContract' in currency) || !('decimal' in currency)) {
            throw new Error('Currency must include tokenContract and decimal');
        }

        this.ethService.logger?.info?.('[ETH] Sending token transaction', {
            to,
            amount: amount.toString(),
            tokenContract: currency.tokenContract,
        });

        try {
            const tokenAddress = currency.tokenContract;
            const decimals = currency.decimal;
            const contract = await this.ethService.createTokenContract(tokenAddress);
            const value = parseUnits(amount.toString(), decimals);

            const { gasPrice } = await this.ethService.provider.getFeeData();
            if (!gasPrice) throw new Error('Gas price unavailable from provider');
            const estimate = await contract.getFunction('transfer').estimateGas(to, value);
            const fee = gasPrice * estimate;

            this.ethService.logger?.info?.('[ETH] tx fee', { gasPrice, fee });
            const tx = await contract.transfer(to, value, { gasPrice, gasLimit: estimate });
            const receipt = await tx.wait();

            if (!receipt || (receipt.status !== 1n && receipt.status !== 1)) {
                throw new Error(`[ETH] Token transaction ${tx.hash} was not confirmed successfully`);
            }

            const result = {
                currency: currency,
                txHash: tx.hash,
                sentAmount: amount,
                fee: formatUnits(fee, 'ether'),
            };

            this.ethService.logger?.info?.('[ETH] Token transaction sent', result);
            return result;
        } catch (error) {
            this.ethService.logger?.error?.('[ETH] Failed to send token transaction', error);
            throw error;
        }
    }


}