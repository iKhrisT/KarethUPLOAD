
const { getEconomy, saveEconomy } = require('../modules/database');
const { getBalance, getBankBalance, setBalance, setBankBalance, formatNumber } = require('../modules/economy');
const fs = require('fs');

const USER_TAXES_FILE = 'taxes/user_taxes.json';

// User tax data
let userTaxes = {};

// Load user taxes data
function loadUserTaxes() {
  if (fs.existsSync(USER_TAXES_FILE)) {
    try {
      userTaxes = JSON.parse(fs.readFileSync(USER_TAXES_FILE, 'utf8'));
    } catch (error) {
      console.log('Error loading user taxes data, starting fresh');
      userTaxes = {};
    }
  }
}

// Save user taxes data
function saveUserTaxes() {
  fs.writeFileSync(USER_TAXES_FILE, JSON.stringify(userTaxes, null, 2));
}

// Exempt role IDs
const EXEMPT_ROLES = [
  "1387188689729486990",
  "1387194078512283768", 
  "1387194111001628745",
  "1387188650084925490"
];

// Calculate weekly tax for a user
function calculateWeeklyUserTax(userId) {
  const totalMoney = getBalance(userId) + getBankBalance(userId);
  
  if (totalMoney < 500) {
    return 1000; // Fixed 1k tax for users with less than 500 total
  } else {
    return Math.floor(totalMoney * 0.02); // 2% tax
  }
}

// Check if user is exempt from taxes
function isUserExempt(member) {
  if (!member || !member.roles) return false;
  
  return EXEMPT_ROLES.some(roleId => member.roles.cache.has(roleId));
}

// Update user taxes (run weekly on Sundays)
function updateUserTaxes(client) {
  const economy = getEconomy();
  const now = Date.now();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  
  // Load user taxes data
  loadUserTaxes();
  
  let taxesUpdated = 0;
  
  for (const [userId, userData] of Object.entries(economy)) {
    // Skip users with no money
    if (!userData || (userData.money + (userData.bank || 0)) === 0) continue;
    
    // Initialize tax data if not exists
    if (!userTaxes[userId]) {
      userTaxes[userId] = {
        totalDebt: 0,
        lastTaxDate: now,
        weeksSinceLastPayment: 0,
        creationDate: now
      };
    }
    
    const taxData = userTaxes[userId];
    const timeSinceLastTax = now - taxData.lastTaxDate;
    
    // Calculate weeks passed since last tax calculation
    if (timeSinceLastTax >= oneWeek) {
      const weeksPassed = Math.floor(timeSinceLastTax / oneWeek);
      
      // Calculate taxes for each week that passed
      for (let i = 0; i < weeksPassed; i++) {
        // Check if user is exempt (we'll check this when collecting, not calculating)
        const weeklyTax = calculateWeeklyUserTax(userId);
        taxData.totalDebt += weeklyTax;
        taxData.weeksSinceLastPayment++;
      }
      
      // Update lastTaxDate to the most recent week boundary
      taxData.lastTaxDate = now - (timeSinceLastTax % oneWeek);
      taxesUpdated++;
    }
  }
  
  saveUserTaxes();
  
  if (taxesUpdated > 0) {
    console.log(`📊 Impuestos de usuarios actualizados para ${taxesUpdated} usuarios`);
  }
}

// Collect taxes from users (deduct from their money)
async function collectUserTaxes(client) {
  const economy = getEconomy();
  const guilds = client.guilds.cache;
  let totalCollected = 0;
  let usersProcessed = 0;
  let exemptUsers = 0;
  
  // Load user taxes data
  loadUserTaxes();
  
  const now = new Date();
  console.log(`📊 Iniciando cobro de impuestos ciudadanos - ${now.toLocaleString('es-ES')}`);
  
  for (const [userId, taxData] of Object.entries(userTaxes)) {
    if (taxData.totalDebt <= 0) continue;
    
    // Check if user exists in economy
    if (!economy[userId]) continue;
    
    let isExempt = false;
    
    // Check if user is exempt in any guild
    for (const guild of guilds.values()) {
      try {
        const member = await guild.members.fetch(userId);
        if (isUserExempt(member)) {
          isExempt = true;
          break;
        }
      } catch (error) {
        // User not in this guild, continue
        continue;
      }
    }
    
    // If user is exempt, clear their tax debt
    if (isExempt) {
      taxData.totalDebt = 0;
      taxData.weeksSinceLastPayment = 0;
      exemptUsers++;
      continue;
    }
    
    // Collect taxes from user's money
    const userMoney = getBalance(userId);
    const userBank = getBankBalance(userId);
    const totalUserMoney = userMoney + userBank;
    
    if (totalUserMoney > 0) {
      const taxToCollect = Math.min(taxData.totalDebt, totalUserMoney);
      
      // Deduct from wallet first, then bank
      if (userMoney >= taxToCollect) {
        setBalance(userId, userMoney - taxToCollect);
      } else {
        setBalance(userId, 0);
        const remainingTax = taxToCollect - userMoney;
        setBankBalance(userId, userBank - remainingTax);
      }
      
      // Update tax data
      taxData.totalDebt -= taxToCollect;
      if (taxData.totalDebt === 0) {
        taxData.weeksSinceLastPayment = 0;
      }
      
      totalCollected += taxToCollect;
      usersProcessed++;
    }
  }
  
  saveUserTaxes();
  
  console.log(`💰 Cobro de impuestos completado:`);
  console.log(`   • Total cobrado: ${formatNumber(totalCollected)} Khronidas`);
  console.log(`   • Usuarios procesados: ${usersProcessed}`);
  console.log(`   • Usuarios exentos: ${exemptUsers}`);
  console.log(`   • Fecha: ${now.toLocaleString('es-ES')}`);
  
  return {
    totalCollected,
    usersProcessed,
    exemptUsers,
    collectionDate: now.toISOString()
  };
}

// Pay user taxes manually
function payUserTax(userId, amount) {
  loadUserTaxes();
  
  if (!userTaxes[userId]) {
    userTaxes[userId] = {
      totalDebt: 0,
      lastTaxDate: Date.now(),
      weeksSinceLastPayment: 0,
      creationDate: Date.now()
    };
  }
  
  const taxData = userTaxes[userId];
  const actualPaid = Math.min(amount, taxData.totalDebt);
  
  taxData.totalDebt -= actualPaid;
  
  if (taxData.totalDebt === 0) {
    taxData.weeksSinceLastPayment = 0;
  }
  
  saveUserTaxes();
  return actualPaid;
}

// Get user tax info
function getUserTaxInfo(userId) {
  loadUserTaxes();
  
  if (!userTaxes[userId]) {
    return {
      totalDebt: 0,
      weeksSinceLastPayment: 0,
      weeklyTax: calculateWeeklyUserTax(userId)
    };
  }
  
  return {
    totalDebt: userTaxes[userId].totalDebt,
    weeksSinceLastPayment: userTaxes[userId].weeksSinceLastPayment,
    weeklyTax: calculateWeeklyUserTax(userId)
  };
}

module.exports = {
  loadUserTaxes,
  saveUserTaxes,
  calculateWeeklyUserTax,
  isUserExempt,
  updateUserTaxes,
  collectUserTaxes,
  payUserTax,
  getUserTaxInfo,
  EXEMPT_ROLES
};
