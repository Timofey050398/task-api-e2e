import { TonClient, WalletContractV4, internal, fromNano, toNano } from "@ton/ton";
import dotenv from "dotenv";

dotenv.config();
//Активирует сгенерированный адрес
async function main() {
    const testnetValue = process.env.TON_NETWORK === "testnet"
        ? 'testnet.'
        : '';
    const endpoint = `https://${testnetValue}toncenter.com/api/v2/jsonRPC";`
    const client = new TonClient({
        endpoint,
        apiKey: process.env.TON_API_KEY,
    });

    const key = {
        publicKey: Buffer.from(process.env.TON_WALLET_PUBLIC_KEY_32_HEX, "hex"),
        secretKey: Buffer.from(process.env.TON_WALLET_PRIVATE_KEY, "hex"),
    };

    const wallet = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });
    const contract = client.open(wallet);

    console.log("Wallet address:", wallet.address.toString());
    const balance = await contract.getBalance();
    console.log("Current balance:", fromNano(balance), "TON");

    const state = await client.getContractState(wallet.address);
    if (state.state === "active") {
        console.log("✅ Wallet already active");
        return;
    }

    console.log("Deploying wallet...");
    const seqno = await contract.getSeqno();

    await contract.sendTransfer({
        seqno,
        secretKey: key.secretKey,
        messages: [
            internal({
                value: toNano("0.05"),
                to: wallet.address,
                body: "Deploy wallet",
            }),
        ],
    });

    console.log("🚀 Deploy transaction sent!");
    console.log(`Check: https://testnet.tonscan.org/address/${wallet.address.toString()}`);
}

main().catch(console.error);