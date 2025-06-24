const fs  = require('fs');
const rsa = require('js-crypto-rsa');
const { PAYMENT_PUBLIC_JWK_PATH } = require('./config');

// Carrega JWK público do Payment
const publicJwk = JSON.parse(
  fs.readFileSync(PAYMENT_PUBLIC_JWK_PATH, 'utf8')
);

/**
 * payloadObj deve ter { signature, ...campos }
 * Retorna Promise<boolean> se a assinatura for válida.
 */
async function verifyPayload(payloadObj) {
  const { signature, ...msg } = payloadObj;
  const msgBytes = new TextEncoder().encode(JSON.stringify(msg));
  const sigBytes = Buffer.from(signature, 'base64');
  return rsa.verify(
    msgBytes,
    sigBytes,
    publicJwk,
    'SHA-256',
    { name: 'RSA-PSS', saltLength: 64 }
  );
}

module.exports = { verifyPayload };
