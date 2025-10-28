// pubkey-to-ton-address.js
//Возвращает тон адрес из сгенерированного ключа
require('dotenv').config();
const TonWeb = require('tonweb');
const nacl = require('tweetnacl');

// публичный ключ (32 bytes hex)
const publicKeyHex = process.env.TON_WALLET_PUBLIC_KEY_32_HEX;


(async () => {
    try {
        if (!publicKeyHex || publicKeyHex.length !== 64) {
            console.error('Ожидается publicKey 32 байта в hex (64 hex символа).');
            process.exit(1);
        }

        const publicKey = Buffer.from(publicKeyHex, 'hex');

        const tonweb = new TonWeb(); // без провайдера — только для утилит
        // Создаём "контракт-кошелёк" — wallet v3/v4 отличаются, выбирай ту версию, что использует твой кошелёк.
        // Обычно используют Wallet V3 (version = 0) или V4 (version = 1). Попробуй v3 (0) сначала.
        const WalletClass = tonweb.wallet.create({ publicKey }); // вариант, TONWeb сам поймёт
        // но более явный вариант:
        // const WalletClass = tonweb.wallet.create({ publicKey, wc: 0, walletId: 0 }); // wc - workchain (0)

        // getAddress() возвращает объект Address
        const addressObj = await WalletClass.getAddress();
        // toString(true, true, true) даёт friendly base64 в форме EQ...
        const friendly = addressObj.toString(true, true, true);

        console.log('Friendly address (EQ...):', friendly);
        console.log('Raw (Hex) address:', addressObj.toString()); // альтернативный формат
    } catch (err) {
        console.error('Ошибка:', err.message || err);
        console.error('(Если метод getAddress() не работает с версией tonweb у тебя, скажи версию tonweb и я подгоню код.)');
    }
})();
