const fs = require('fs');
const crypto = require('crypto');
const { PRIVATE_KEY_PATH } = require('./config');

const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');

function signPayload(payloadObj) {
    // Convertemos o objeto para string JSON.
    const payload = JSON.stringify(payloadObj);

    // Criamos um Sign com algoritmo RSA-SHA256.
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(payload);
    signer.end();

    // Geramos assinatura em base64 e reagregamos ao objeto.
    const signature = signer.sign(privateKey, 'base64');
    return { ...payloadObj, signature };
}

module.exports = { signPayload };
