const fs  = require('fs');
const rsa = require('js-crypto-rsa');
const { PRIVATE_KEY_PATH } = require('./config');

// Carrega o JWK privado já gerado
const privateJwk = JSON.parse(
  fs.readFileSync(PRIVATE_KEY_PATH, 'utf8')
);

/**
 * Assina payloadObj usando RSASSA-PSS/SHA-256.
 * Retorna um novo objeto com campo `signature` em base64.
 */
async function signPayload(payloadObj) {
  const payloadStr   = JSON.stringify(payloadObj);
  const payloadBytes = new TextEncoder().encode(payloadStr);

  // Chama diretamente rsa.sign, passando o JWK
  const sigBytes = await rsa.sign(
    payloadBytes,
    privateJwk,
    'SHA-256',
    {
      name: 'RSA-PSS',    // ou 'RSASSA-PKCS1-v1_5' se preferir
      saltLength: 64      // padrão RSA‑PSS
    }
  );

  const signature = Buffer.from(sigBytes).toString('base64');
  return { ...payloadObj, signature };
}

module.exports = { signPayload };
