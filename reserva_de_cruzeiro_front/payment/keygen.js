const rsa = require('js-crypto-rsa');
const fs = require('fs');

(async () => {
  // gera par de chaves 2048‑bit
  const { publicKey, privateKey } = await rsa.generateKey(2048);
  // salva em disco para que outros microsserviços (Reserva, Bilhete) importem
  fs.writeFileSync('keys/public.jwk.json',  JSON.stringify(publicKey,  null, 2));
  fs.writeFileSync('keys/private.jwk.json', JSON.stringify(privateKey, null, 2));
  console.log('JWK keys geradas em keys/');
})();
