
const { getEconomy, saveEconomy } = require('./database');

// Make economy object available for external access
const economy = getEconomy();

// Get user balance
function getBalance(userId) {
  const economy = getEconomy();
  if (!economy[userId]) {
    economy[userId] = { 
      money: 0, 
      bank: 0, 
      lastWork: 0, 
      lastCrime: 0, 
      lastInvert: 0,
      lastDaily: 0,
      inventory: []
    };
  }
  return economy[userId].money;
}

// Get user bank balance
function getBankBalance(userId) {
  const economy = getEconomy();
  if (!economy[userId]) {
    economy[userId] = { 
      money: 0, 
      bank: 0, 
      lastWork: 0, 
      lastCrime: 0, 
      lastInvert: 0,
      lastDaily: 0,
      inventory: []
    };
  }
  return economy[userId].bank || 0;
}

// Get total balance (money + bank)
function getTotalBalance(userId) {
  return getBalance(userId) + getBankBalance(userId);
}

// Bot bank balance (special user ID for bot)
const BOT_BANK_ID = 'BOT_BANK_SYSTEM';

// Get bot bank balance
function getBotBankBalance() {
  const economy = getEconomy();
  if (!economy[BOT_BANK_ID]) {
    economy[BOT_BANK_ID] = { 
      money: 0, 
      bank: 0, 
      lastWork: 0, 
      lastCrime: 0, 
      lastInvert: 0,
      lastDaily: 0,
      inventory: [],
      isBot: true // Mark as bot account
    };
  }
  return economy[BOT_BANK_ID].bank || 0;
}

// Set bot bank balance
function setBotBankBalance(amount) {
  const economy = getEconomy();
  if (!economy[BOT_BANK_ID]) {
    economy[BOT_BANK_ID] = { 
      money: 0, 
      bank: 0, 
      lastWork: 0, 
      lastCrime: 0, 
      lastInvert: 0,
      lastDaily: 0,
      inventory: [],
      isBot: true
    };
  }
  economy[BOT_BANK_ID].bank = amount;
  saveEconomy();
}

// Get bot money (hand)
function getBotMoney() {
  const economy = getEconomy();
  if (!economy[BOT_BANK_ID]) {
    economy[BOT_BANK_ID] = { 
      money: 0, 
      bank: 0, 
      lastWork: 0, 
      lastCrime: 0, 
      lastInvert: 0,
      lastDaily: 0,
      inventory: [],
      isBot: true
    };
  }
  return economy[BOT_BANK_ID].money || 0;
}

// Set bot money (hand)
function setBotMoney(amount) {
  const economy = getEconomy();
  if (!economy[BOT_BANK_ID]) {
    economy[BOT_BANK_ID] = { 
      money: 0, 
      bank: 0, 
      lastWork: 0, 
      lastCrime: 0, 
      lastInvert: 0,
      lastDaily: 0,
      inventory: [],
      isBot: true
    };
  }
  economy[BOT_BANK_ID].money = amount;
  saveEconomy();
}

// Set user balance
function setBalance(userId, amount) {
  const economy = getEconomy();
  if (!economy[userId]) {
    economy[userId] = { 
      money: 0, 
      bank: 0, 
      lastWork: 0, 
      lastCrime: 0, 
      lastInvert: 0,
      lastDaily: 0,
      inventory: []
    };
  }
  economy[userId].money = amount; // Allow negative values
  saveEconomy();
}

// Set user bank balance
function setBankBalance(userId, amount) {
  const economy = getEconomy();
  if (!economy[userId]) {
    economy[userId] = { 
      money: 0, 
      bank: 0, 
      lastWork: 0, 
      lastCrime: 0, 
      lastInvert: 0,
      lastDaily: 0,
      inventory: []
    };
  }
  economy[userId].bank = amount; // Allow negative values
  saveEconomy();
}

// Check cooldown
function checkCooldown(userId, command) {
  const economy = getEconomy();
  if (!economy[userId]) {
    economy[userId] = { 
      money: 0, 
      bank: 0, 
      lastWork: 0, 
      lastCrime: 0, 
      lastInvert: 0,
      lastDaily: 0,
      inventory: []
    };
  }

  const now = Date.now();
  const cooldowns = {
    work: 40000,
    crime: 200000,
    invert: 300000,
    daily: 86400000 // 24 hours in milliseconds
  };

  const lastUsed = economy[userId][`last${command.charAt(0).toUpperCase() + command.slice(1)}`];
  const timeLeft = lastUsed + cooldowns[command] - now;

  return timeLeft > 0 ? timeLeft : 0;
}

// Set cooldown
function setCooldown(userId, command) {
  const economy = getEconomy();
  if (!economy[userId]) {
    economy[userId] = { 
      money: 0, 
      bank: 0, 
      lastWork: 0, 
      lastCrime: 0, 
      lastInvert: 0,
      lastDaily: 0,
      inventory: []
    };
  }
  economy[userId][`last${command.charAt(0).toUpperCase() + command.slice(1)}`] = Date.now();
  saveEconomy();
}

// Function to format numbers with thousand separators (Spanish format)
function formatNumber(number) {
  const isNegative = number < 0;
  const absNumber = Math.abs(number);
  const formatted = absNumber.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return isNegative ? `-${formatted}` : formatted;
}

// Lottery system
const lottery = {
  active: false,
  participants: {},
  endDate: null,
  winningNumber: null
};

// Initialize lottery
function initializeLottery() {
  lottery.active = true;
  lottery.participants = {};
  lottery.endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  lottery.winningNumber = null;
  console.log('Nueva lotería iniciada');
  
  // Save lottery state
  const { saveLottery } = require('./database');
  saveLottery();
}

// Add participant to lottery
function addParticipant(userId, number) {
  lottery.participants[userId] = number;
  
  // Save lottery state
  const { saveLottery } = require('./database');
  saveLottery();
}

// Check if number is available
function isNumberAvailable(number) {
  return !Object.values(lottery.participants).includes(number);
}

// Get lottery info
function getLotteryInfo() {
  if (!lottery.active) return null;
  
  const now = new Date();
  const timeLeft = lottery.endDate - now;
  const daysLeft = Math.ceil(timeLeft / (24 * 60 * 60 * 1000));
  
  return {
    participantCount: Object.keys(lottery.participants).length,
    numbersLeft: 1000 - Object.keys(lottery.participants).length,
    daysLeft: Math.max(0, daysLeft),
    endDate: lottery.endDate
  };
}

// Check if lottery ended and process results
function checkLotteryEnd(client) {
  if (!lottery.active) return null;
  
  const now = new Date();
  
  // Check if lottery should have ended (even if bot was offline)
  if (now >= lottery.endDate) {
    // Lottery has ended, process results
    const winningNumber = Math.floor(Math.random() * 1000) + 1;
    lottery.winningNumber = winningNumber;
    
    // Find winner
    let winnerId = null;
    for (const [userId, userNumber] of Object.entries(lottery.participants)) {
      if (userNumber === winningNumber) {
        winnerId = userId;
        break;
      }
    }
    
    // Award prize if there's a winner
    if (winnerId) {
      const currentBank = getBankBalance(winnerId);
      setBankBalance(winnerId, currentBank + 1500000);
      console.log(`Lotería ganada por usuario ${winnerId} con número ${winningNumber}`);
    } else {
      console.log(`Lotería terminada, número ganador: ${winningNumber}, sin ganador`);
    }
    
    // Reset lottery
    lottery.active = false;
    lottery.participants = {};
    lottery.endDate = null;
    
    // Save lottery state
    const { saveLottery } = require('./database');
    saveLottery();
    
    return {
      winningNumber,
      winnerId
    };
  }
  
  return null;
}

module.exports = {
  getBalance,
  getBankBalance,
  getTotalBalance,
  setBalance,
  setBankBalance,
  checkCooldown,
  setCooldown,
  formatNumber,
  economy,
  lottery,
  initializeLottery,
  addParticipant,
  isNumberAvailable,
  getLotteryInfo,
  checkLotteryEnd,
  getBotBankBalance,
  setBotBankBalance,
  getBotMoney,
  setBotMoney
};
