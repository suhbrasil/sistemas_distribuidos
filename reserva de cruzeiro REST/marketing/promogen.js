const fs = require('fs');
const path = require('path');

const NUM_PROMOTIONS = 3; // Reduzido para 3 promoções
const FILE_PATH = path.join(__dirname, 'promo.json');
const CRUISES_PATH = path.join(__dirname, '..', 'itinerary', 'cruises.json');

// Lê os cruzeiros do arquivo
const cruises = JSON.parse(fs.readFileSync(CRUISES_PATH, 'utf8'));

// Embaralha o array de cruzeiros para selecionar aleatoriamente
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function generatePromotion(cruise) {
    // Calcula um desconto entre 20% e 40%
    const discountPercent = Math.random() * (40 - 20) + 20;
    const discountedPrice = Math.max(0, Math.round(cruise.pricePerPerson * (1 - discountPercent / 100)));

    return {
        cruiseId: cruise.cruiseId,
        embarkDate: cruise.embarkDate,
        shipName: cruise.shipName,
        embarkPort: cruise.embarkPort,
        disembarkPort: cruise.disembarkPort,
        destination: cruise.visitedPlaces[0],
        cabinsAvailable: cruise.cabinsAvailable,
        duration: cruise.duration,
        pricePerPerson: discountedPrice,

    };
}

function generatePromotions() {
    // Embaralha os cruzeiros e seleciona os primeiros NUM_PROMOTIONS
    const selectedCruises = shuffleArray([...cruises]).slice(0, NUM_PROMOTIONS);

    const promotions = selectedCruises.map(cruise => generatePromotion(cruise));

    fs.writeFileSync(FILE_PATH, JSON.stringify(promotions, null, 2));
    console.log(`✅ ${NUM_PROMOTIONS} promotions saved to ${FILE_PATH}`);

    // Promoções geradas
    promotions.forEach(promo => {
        console.log(`Promoção criada para o cruzeiro ${promo.cruiseId}:`);
        console.log(`Destino: ${promo.destination}`);
        console.log(`Preço promocional: R$ ${promo.pricePerPerson}`);
        console.log('---');
    });
}

generatePromotions();
