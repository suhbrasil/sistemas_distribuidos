const fs = require('fs');
const path = require('path');

const destinations = ["Salvador", "Maceio", "Natal", "Paraty", "Ilheus"];
const NUM_PROMOTIONS = 5; // adjust for more or fewer promotions
const FILE_PATH = path.join(__dirname, 'promo.json');

function generateFutureDate(daysFromToday) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  return date.toISOString().split('T')[0];
}

// Alteração aqui:
let currentIndex = 0;
function generateRandomPromotion() {
  if (currentIndex >= destinations.length) {
    throw new Error("Número de promoções excede número de destinos únicos.");
  }

  const destination = destinations[currentIndex];
  currentIndex++;

  const startInDays = Math.floor(Math.random() * 60) + 5;
  const durationDays = Math.floor(Math.random() * 10) + 3;

  return {
    destination,
    start_date: generateFutureDate(startInDays),
    end_date: generateFutureDate(startInDays + durationDays),
    price: (Math.random() * (5000 - 1500) + 1500).toFixed(2)
  };
}

function generatePromotions() {
  const promotions = [];

  for (let i = 0; i < NUM_PROMOTIONS; i++) {
    promotions.push(generateRandomPromotion());
  }

  fs.writeFileSync(FILE_PATH, JSON.stringify(promotions, null, 2));
  console.log(`✅ ${NUM_PROMOTIONS} promotions saved to ${FILE_PATH}`);
}

generatePromotions();
