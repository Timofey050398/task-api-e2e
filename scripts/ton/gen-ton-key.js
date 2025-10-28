// gen-ton-key.js
//Генерирует ключи для тона
const nacl = require('tweetnacl');
const { randomBytes } = require('crypto');

const seed = randomBytes(32); // 32 bytes — это seed для ed25519
const keyPair = nacl.sign.keyPair.fromSeed(seed);

console.log("privateKeySeed (32 bytes hex):", seed.toString('hex'));
console.log("publicKey (32 bytes hex):      ", Buffer.from(keyPair.publicKey).toString('hex'));
console.log("secretKey (64 bytes hex):      ", Buffer.from(keyPair.secretKey).toString('hex'));