import {MainClient} from "../../api/clients/MainClient";
import {CertClient} from "../../api/clients/CertClient";
import {WalletService} from "./WalletService";
import {TelegramService} from "../telegram/TelegramService";
import {step} from "allure-js-commons";

export class CertService {
    constructor(user) {
        this.mainClient = new MainClient(user, false);
        this.certClient = new CertClient(user, false);
        this.walletService = new WalletService(user);
        this.tgClient = new TelegramService(user);
        this.codeType = "fiatCert";
    }

    async createCert(currency, amount) {
        return await step(`create cert for ${amount} ${currency.name}`, async () => {
            let wallets = await this.walletService.findWalletsWithBalance(currency, amount);
            let account;
            for await (const target of wallets) {
                if (target.accounts.length > 0) {
                    let targetAccounts = target.accounts.filter(account => Number(account.balance) >= amount);
                    if (targetAccounts.length > 0) {
                        account = targetAccounts[0];
                        break;
                    }
                }
            }
            if (!account) {
                throw new Error("No account found for this currency");
            }

            await this.mainClient.sendTgCode(this.codeType);
            const code = await this.tgClient.getTelegram2FACode();

            const certResp = await this.certClient.createCert(
                amount,
                account.city?.id,
                code,
                account.country?.id,
                account.id
            )

            const cert = certResp.data?.cert;
            if (!cert) {
                throw new Error("No cert found for this currency");
            }
            return cert;
        });
    }

    async useCert(cert){
        return await step(`use cert ${cert}`, async () => {
            const previewResp = await this.certClient.previewCert(cert);
            const account = await this.#findWalletByCertPreview(previewResp.data);

            const useResp = await this.certClient.depositByCert(
                cert,
                account.city.id,
                account.country.id,
                account.id
            );

            return useResp.data?.orderID;
        });
    }

    async #findWalletByCertPreview(preview) {
        const wallets = await this.walletService.loadWallets();
        let accounts = wallets.flatMap(c => c.accounts ?? []);
        accounts = accounts.filter(account => account.city.id === preview.cityID && account.country.id === preview.countryID);
        if (accounts.length === 0) {
            throw new Error("No accounts found for this currency");
        }
        return accounts[0];
    }
}