const fs = require('fs');

// File paths
const ECONOMY_FILE = 'economy.json';
const COMPANIES_FILE = 'companies.json';
const COMPANY_TAXES_FILE = 'company_taxes.json';
const REALEZAS_FILE = 'realezas.json';
const REALEZA_TAXES_FILE = 'realeza_taxes.json';
const MARRIAGES_FILE = 'marriages.json';
const USER_TAXES_FILE = 'user_taxes.json';
const JOBS_FILE = 'jobs.json';
const WARNINGS_FILE = 'warnings.json';

// Data objects
let economy = {};
let companies = {};
let companyTaxes = {};
let realezas = {};
let realezaTaxes = {};
let marriages = {};
let userTaxes = {};
let jobs = {};
let warnings = {};

// Load data functions
function loadAllData() {
  // Load economy data
  if (fs.existsSync(ECONOMY_FILE)) {
    try {
      economy = JSON.parse(fs.readFileSync(ECONOMY_FILE, 'utf8'));
    } catch (error) {
      console.log('Error loading economy data, starting fresh');
      economy = {};
    }
  }

  // Load companies data
  if (fs.existsSync(COMPANIES_FILE)) {
    try {
      companies = JSON.parse(fs.readFileSync(COMPANIES_FILE, 'utf8'));
    } catch (error) {
      console.log('Error loading companies data, starting fresh');
      companies = {};
    }
  }

  // Load company taxes data
  if (fs.existsSync(COMPANY_TAXES_FILE)) {
    try {
      companyTaxes = JSON.parse(fs.readFileSync(COMPANY_TAXES_FILE, 'utf8'));
    } catch (error) {
      console.log('Error loading company taxes data, starting fresh');
      companyTaxes = {};
    }
  }

  // Load realezas data
  if (fs.existsSync(REALEZAS_FILE)) {
    try {
      realezas = JSON.parse(fs.readFileSync(REALEZAS_FILE, 'utf8'));
    } catch (error) {
      console.log('Error loading realezas data, starting fresh');
      realezas = {};
    }
  }

  // Load realeza taxes data
  if (fs.existsSync(REALEZA_TAXES_FILE)) {
    try {
      realezaTaxes = JSON.parse(fs.readFileSync(REALEZA_TAXES_FILE, 'utf8'));
    } catch (error) {
      console.log('Error loading realeza taxes data, starting fresh');
      realezaTaxes = {};
    }
  }

  // Load marriages data
  if (fs.existsSync(MARRIAGES_FILE)) {
    try {
      marriages = JSON.parse(fs.readFileSync(MARRIAGES_FILE, 'utf8'));
    } catch (error) {
      console.log('Error loading marriages data, starting fresh');
      marriages = {};
    }
  }

  // Load user taxes data
  if (fs.existsSync(USER_TAXES_FILE)) {
    try {
      userTaxes = JSON.parse(fs.readFileSync(USER_TAXES_FILE, 'utf8'));
    } catch (error) {
      console.log('Error loading user taxes data, starting fresh');
      userTaxes = {};
    }
  }

  // Load jobs data
  if (fs.existsSync(JOBS_FILE)) {
    try {
      jobs = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8'));
    } catch (error) {
      console.log('Error loading jobs data, starting fresh');
      jobs = {};
    }
  }

  // Load warnings data
  if (fs.existsSync(WARNINGS_FILE)) {
    try {
      warnings = JSON.parse(fs.readFileSync(WARNINGS_FILE, 'utf8'));
    } catch (error) {
      console.log('Error loading warnings data, starting fresh');
      warnings = {};
    }
  }

  if (fs.existsSync('lottery.json')) {
    try {
      const lotteryData = JSON.parse(fs.readFileSync('lottery.json', 'utf8'));
      // Load lottery state and convert endDate back to Date object
      if (lotteryData.endDate) {
        lotteryData.endDate = new Date(lotteryData.endDate);
      }
      Object.assign(require('./economy').lottery, lotteryData);
    } catch (error) {
      console.log('Error loading lottery data, starting fresh');
    }
  }
}

// Save data functions
function saveEconomy() {
  fs.writeFileSync(ECONOMY_FILE, JSON.stringify(economy, null, 2));
}

function saveCompanies() {
  fs.writeFileSync(COMPANIES_FILE, JSON.stringify(companies, null, 2));
}

function saveCompanyTaxes() {
  fs.writeFileSync(COMPANY_TAXES_FILE, JSON.stringify(companyTaxes, null, 2));
}

function saveRealezas() {
  fs.writeFileSync(REALEZAS_FILE, JSON.stringify(realezas, null, 2));
}

function saveRealezaTaxes() {
  fs.writeFileSync(REALEZA_TAXES_FILE, JSON.stringify(realezaTaxes, null, 2));
}

function saveMarriages() {
  fs.writeFileSync(MARRIAGES_FILE, JSON.stringify(marriages, null, 2));
}

function saveUserTaxes() {
  fs.writeFileSync(USER_TAXES_FILE, JSON.stringify(userTaxes, null, 2));
}

function saveJobs() {
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
}

function saveWarnings() {
  fs.writeFileSync(WARNINGS_FILE, JSON.stringify(warnings, null, 2));
}

// Save lottery data
function saveLottery() {
  try {
    const lottery = require('./economy').lottery;
    fs.writeFileSync('lottery.json', JSON.stringify(lottery, null, 2));
  } catch (error) {
    console.error('Error guardando lottery:', error);
  }
}

// Save all data
function saveAllData() {
  console.log('💾 Guardando todos los datos...');

  try {
    saveEconomy();
    saveCompanies();
    saveCompanyTaxes();
    saveRealezas();
    saveRealezaTaxes();
    saveMarriages();
    saveUserTaxes();
    saveJobs();
    saveWarnings();
    saveLottery();
    console.log('✅ Todos los datos guardados exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error al guardar datos:', error);
    return false;
  }
}

// Export data objects and functions
module.exports = {
  economy,
  companies,
  companyTaxes,
  realezas,
  realezaTaxes,
  marriages,
  userTaxes,
  loadAllData,
  saveEconomy,
  saveCompanies,
  saveCompanyTaxes,
  saveRealezas,
  saveRealezaTaxes,
  saveMarriages,
  saveUserTaxes,
  saveAllData,
  saveLottery,
  saveJobs,
  saveWarnings,

  // Getters for data objects (to maintain reference)
  getEconomy: () => economy,
  getCompanies: () => companies,
  getCompanyTaxes: () => companyTaxes,
  getRealezas: () => realezas,
  getRealezaTaxes: () => realezaTaxes,
  getMarriages: () => marriages,
  getUserTaxes: () => userTaxes,
  getJobs: () => jobs,
  getWarnings: () => warnings
};