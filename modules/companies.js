const { getCompanies, saveCompanies, getCompanyTaxes, saveCompanyTaxes } = require('./database');
const { getBalance, setBalance, getBankBalance, setBankBalance, formatNumber } = require('./economy');
const { removeSpecificFromInventory } = require('./store');
const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

// Company management functions
function hasCompany(userId) {
  const companies = getCompanies();
  return companies.hasOwnProperty(userId);
}

function getCompany(userId) {
  const companies = getCompanies();
  return companies[userId];
}

function getCompanyId(userId) {
  return userId; // In this system, company ID is the same as user ID
}

function createCompany(userId, name, type) {
  const companies = getCompanies();
  companies[userId] = {
    name: name,
    type: type,
    money: 0,
    ceo: userId,
    ceos: [userId],
    creationDate: Date.now()
  };
  saveCompanies();
  return companies[userId];
}

function addCompanyMoney(userId, amount) {
  const companies = getCompanies();
  if (companies[userId]) {
    companies[userId].money += amount;
    saveCompanies();
  }
}

function removeCompanyMoney(userId, amount) {
  const companies = getCompanies();
  if (companies[userId]) {
    companies[userId].money -= amount; // Allow negative values
    saveCompanies();
  }
}

// Investment processing with percentage system
function processInvestment(userId, empresaId, cantidad) {
  const companies = getCompanies();
  const targetCompany = companies[empresaId];

  if (!targetCompany) {
    return { success: false, error: 'Company not found' };
  }

  // Calculate company position in leaderboard
  const companiesList = Object.entries(companies)
    .sort(([,a], [,b]) => b.money - a.money);

  const companyPosition = companiesList.findIndex(([id]) => id === empresaId) + 1;
  const totalCompanies = companiesList.length;

  // Calculate success probability based on position
  let successRate;
  if (companyPosition === 1) {
    successRate = 0.85; // 85% success rate for #1
  } else if (companyPosition <= 3) {
    successRate = 0.75; // 75% for top 3
  } else if (companyPosition <= 5) {
    successRate = 0.65; // 65% for top 5
  } else if (companyPosition <= 10) {
    successRate = 0.55; // 55% for top 10
  } else {
    successRate = 0.35; // 35% for others
  }

  // Calculate investment success based on company position
  const success = Math.random() < successRate;

  if (success) {
    // Investor gains 20-50% extra on their investment
    const userPercentage = Math.random() * (50 - 20) + 20; // Between 20% and 50%
    const userEarnings = cantidad + Math.floor(cantidad * (userPercentage / 100));

    // Company gains 50-80% of the received investment
    const companyPercentage = Math.random() * (80 - 50) + 50; // Between 50% and 80%
    const companyEarnings = Math.floor(cantidad * (companyPercentage / 100));

    // Add earnings to company
    addCompanyMoney(empresaId, companyEarnings);

    return {
      success: true,
      userEarnings: userEarnings,
      companyEarnings: companyEarnings,
      userPercentage: Math.round(userPercentage),
      companyPercentage: Math.round(companyPercentage),
      targetCompany: targetCompany,
      companyPosition: companyPosition,
      totalCompanies: totalCompanies,
      successRate: successRate
    };
  } else {
    // Investment failed - user loses money, company loses 60% of the investment
    const companyLoss = Math.floor(cantidad * 0.60); // Company loses 60%
    removeCompanyMoney(empresaId, companyLoss);

    return {
      success: false,
      targetCompany: targetCompany,
      companyPosition: companyPosition,
      totalCompanies: totalCompanies,
      successRate: successRate,
      companyLoss: companyLoss
    };
  }
}

// Tax pause system - set to true to pause all company taxes
const TAXES_PAUSED = false;

// Tax management functions
function updateCompanyTaxes() {
  if (TAXES_PAUSED) {
    console.log('📊 Impuestos empresariales pausados - no se actualizan deudas');
    return;
  }

  const companies = getCompanies();
  const companyTaxes = getCompanyTaxes();
  const now = Date.now();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;

  for (const [companyId, companyData] of Object.entries(companies)) {
    if (!companyTaxes[companyId]) {
      companyTaxes[companyId] = {
        totalDebt: 0,
        lastTaxDate: now,
        weeksSinceLastPayment: 0,
        creationDate: now
      };
    }

    const taxData = companyTaxes[companyId];
    const timeSinceLastTax = now - taxData.lastTaxDate;

    // Calculate weeks passed since last tax calculation (even if bot was offline)
    if (timeSinceLastTax >= oneWeek) {
      const weeksPassed = Math.floor(timeSinceLastTax / oneWeek);

      // Calculate taxes for each week that passed
      for (let i = 0; i < weeksPassed; i++) {
        const weeklyTax = calculateWeeklyTax(companyId);
        taxData.totalDebt += weeklyTax;
        taxData.weeksSinceLastPayment++;
      }

      // Update lastTaxDate to the most recent week boundary
      taxData.lastTaxDate = now - (timeSinceLastTax % oneWeek);
    }
  }

  saveCompanyTaxes();
}

function calculateWeeklyTax(companyId) {
  const companies = getCompanies();
  const company = companies[companyId];

  if (!company) return 0;

  const ranked = Object.entries(companies).sort(([, a], [, b]) => b.money - a.money);
  const rank = ranked.findIndex(([id]) => id === companyId) + 1;

  if (rank === 1) return Math.floor(company.money * 0.35);
  if (rank === 2) return Math.floor(company.money * 0.27);
  if (rank <= 5) return Math.floor(company.money * 0.20);
  return 500000;
}

function payCompanyTax(userId, amount) {
  const companyTaxes = getCompanyTaxes();

  if (!companyTaxes[userId]) {
    companyTaxes[userId] = {
      totalDebt: 0,
      lastTaxDate: Date.now(),
      weeksSinceLastPayment: 0,
      creationDate: Date.now()
    };
  }

  const taxData = companyTaxes[userId];
  const actualPaid = Math.min(amount, taxData.totalDebt);

  taxData.totalDebt -= actualPaid;

  if (taxData.totalDebt === 0) {
    taxData.weeksSinceLastPayment = 0;
  }

  saveCompanyTaxes();
  return actualPaid;
}

function checkCompanyBankruptcy() {
  const companies = getCompanies();
  const companyTaxes = getCompanyTaxes();
  const bankrupted = [];

  // Check for bankruptcy due to negative money (always active)
  for (const [companyId, companyData] of Object.entries(companies)) {
    if (companyData.money <= -100000 && !companyData.bankrupt) {
      console.log(`Marking company ${companyData.name} as bankrupt due to negative funds`);
      companies[companyId].bankrupt = true;
      bankrupted.push({ id: companyId, name: companyData.name, reason: 'negative_money', debt: companyData.money });
    }
  }

  // Check for bankruptcy due to unpaid taxes (only if taxes are not paused)
  if (!TAXES_PAUSED) {
    for (const [companyId, taxData] of Object.entries(companyTaxes)) {
      if (taxData.weeksSinceLastPayment >= 3 && companies[companyId] && !companies[companyId].bankrupt) {
        console.log(`Marking company ${companies[companyId].name} as bankrupt due to unpaid taxes`);
        companies[companyId].bankrupt = true;
        bankrupted.push({ id: companyId, name: companies[companyId].name, reason: 'unpaid_taxes', weeks: taxData.weeksSinceLastPayment });
      }
    }
  } else {
    console.log('📊 Impuestos empresariales pausados - no hay bancarrotas por impuestos');
  }

  if (bankrupted.length > 0) {
    saveCompanies();
    saveCompanyTaxes();
  }

  return bankrupted;
}

// Company creation modal and handling
function showCompanyNameTypeModal(interaction, itemIndex, purchaseDate) {
  const modal = new ModalBuilder()
    .setCustomId(`empresa_modal_${itemIndex}_${purchaseDate}`)
    .setTitle('Crear tu Empresa');

  const nameInput = new TextInputBuilder()
    .setCustomId('company_name')
    .setLabel('Nombre de la Empresa')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Introduce el nombre de tu empresa')
    .setRequired(true)
    .setMaxLength(50);

  const typeInput = new TextInputBuilder()
    .setCustomId('company_type')
    .setLabel('Tipo de Empresa')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ej: Tecnología, Alimentaria, Entretenimiento')
    .setRequired(true)
    .setMaxLength(30);

  const firstActionRow = new ActionRowBuilder().addComponents(nameInput);
  const secondActionRow = new ActionRowBuilder().addComponents(typeInput);

  modal.addComponents(firstActionRow, secondActionRow);

  interaction.showModal(modal);
}

async function handleCompanyCreation(interaction, userId, itemIndex, purchaseDate, companyName, companyType, client) {
  // Check if user already has a company
  if (hasCompany(userId)) {
    return await interaction.reply({
      content: 'Ya tienes una empresa. Solo puedes tener una empresa por usuario.',
      ephemeral: true
    });
  }

  // Create the company
  const newCompany = createCompany(userId, companyName, companyType);

  // Remove the item from inventory
  const removed = removeSpecificFromInventory(userId, itemIndex, purchaseDate);

  if (!removed) {
    return await interaction.reply({
      content: 'Error al usar el item. Inténtalo de nuevo.',
      ephemeral: true
    });
  }

  // Initialize company taxes
  const companyTaxes = getCompanyTaxes();
  companyTaxes[userId] = {
    totalDebt: 0,
    lastTaxDate: Date.now(),
    weeksSinceLastPayment: 0,
    creationDate: Date.now()
  };
  saveCompanyTaxes();

  const embed = new EmbedBuilder()
    .setTitle('🏢 ¡Empresa Creada Exitosamente!')
    .setDescription(`Has fundado **${companyName}** con éxito`)
    .addFields(
      { name: '🏢 Nombre', value: `**${companyName}**`, inline: true },
      { name: '🔧 Tipo', value: `**${companyType}**`, inline: true },
      { name: '👤 CEO', value: `${interaction.user.username}`, inline: true },
      { name: '💰 Fondos Iniciales', value: '0 Khronidas', inline: true },
      { name: '📅 Fecha de Fundación', value: new Date().toLocaleDateString('es-ES'), inline: true },
      { name: '📊 Estado', value: 'Activa', inline: true },
      { name: '💡 Próximos Pasos', value: 'Deposita fondos para hacer crecer tu empresa y atraer inversores', inline: false }
    )
    .setColor('#00ff00')
    .setFooter({ text: '¡Bienvenido al mundo empresarial!' });

  await interaction.reply({ embeds: [embed] });
}

// Function to check if taxes are paused
function areTaxesPaused() {
  return TAXES_PAUSED;
}

module.exports = {
  hasCompany,
  getCompany,
  getCompanyId,
  createCompany,
  addCompanyMoney,
  removeCompanyMoney,
  processInvestment,
  updateCompanyTaxes,
  calculateWeeklyTax,
  payCompanyTax,
  checkCompanyBankruptcy,
  showCompanyNameTypeModal,
  handleCompanyCreation,
  areTaxesPaused,

  // Export tax data for access
  get companyTaxes() {
    return getCompanyTaxes();
  }
};