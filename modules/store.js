
const { getEconomy, saveEconomy } = require('./database');

// Company store items: companyOwnerId -> array of items
const companyStoreItems = {
  '290250829921910795': [ // Serayell Capital
    {
      key: 'seguroFinanciero',
      name: 'Seguro Financiero',
      price: 2500,
      description: 'Reduce en un 30% tus pérdidas en los próximos 3 invert fallidos. Luego de esos 3 usos, el seguro expira.',
      emoji: '🛡️',
      uses: 3
    }
  ]
};

function getCompanyStoreItems(companyOwnerId) {
  return companyStoreItems[companyOwnerId] || [];
}

function getAllCompanyStoreItems() {
  return companyStoreItems;
}

function findCompanyItemByKey(key) {
  for (const [ownerId, items] of Object.entries(companyStoreItems)) {
    const found = items.find(i => i.key === key);
    if (found) return { item: found, companyOwnerId: ownerId };
  }
  return null;
}

function hasActiveSeguro(userId) {
  const economy = getEconomy();
  if (!economy[userId] || !economy[userId].inventory) return false;
  return economy[userId].inventory.some(i => i.item === 'seguroFinanciero' && i.usesLeft > 0);
}

function consumeSeguroUse(userId) {
  const economy = getEconomy();
  if (!economy[userId] || !economy[userId].inventory) return false;
  const idx = economy[userId].inventory.findIndex(i => i.item === 'seguroFinanciero' && i.usesLeft > 0);
  if (idx === -1) return false;
  economy[userId].inventory[idx].usesLeft--;
  if (economy[userId].inventory[idx].usesLeft <= 0) {
    economy[userId].inventory.splice(idx, 1);
  }
  saveEconomy();
  return true;
}

function getSeguroUsesLeft(userId) {
  const economy = getEconomy();
  if (!economy[userId] || !economy[userId].inventory) return 0;
  const found = economy[userId].inventory.find(i => i.item === 'seguroFinanciero' && i.usesLeft > 0);
  return found ? found.usesLeft : 0;
}

// Store items configuration
const storeItems = {
  halo: {
    name: 'Halo Personalizado',
    price: 3500,
    description: 'Un aro divino que te rodea y te da un aura distinta',
    emoji: ''
  },
  anillo: {
    name: 'Anillo de Compromiso',
    price: 25000,
    description: 'Casate, ten una vida digna y expresa tu amor a esa persona que tanto amas',
    emoji: ''
  },
  empresa: {
    name: 'Tu propia empresa',
    price: 500000,
    description: 'Quieres tu propia empresa con nombre y a que se dedican? pues compra esto y diviertete (Si, puedes vender tus productos, pero tienen que ser relacionado al tipo de empresa que quieras)',
    emoji: '🏢'
  },
  realeza: {
    name: 'Realeza Celestial',
    price: 1000000,
    description: 'Crea tu propia realeza celestial con nombre, color e iniciales personalizadas.',
    emoji: '👑'
  }
};

// Color configuration for halos
const haloColors = {
  azul: '#0099ff',
  verde: '#00ff00',
  morado: '#9900ff',
  celeste: '#00ffff',
  rojo: '#ff0000',
  negro: '#000000',
  blanco: '#ffffff',
  marron: '#8b4513',
  amarillo: '#ffff00',
  rosa: '#ff69b4'
};

// Add item to user inventory
function addToInventory(userId, item, color = null, extra = {}) {
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

  if (!economy[userId].inventory) {
    economy[userId].inventory = [];
  }

  const inventoryItem = {
    item: item,
    color: color,
    purchaseDate: Date.now(),
    ...extra
  };

  economy[userId].inventory.push(inventoryItem);
  saveEconomy();
}

// Check if user has item in inventory
function hasItem(userId, item) {
  const economy = getEconomy();
  if (!economy[userId] || !economy[userId].inventory) return false;
  return economy[userId].inventory.some(invItem => invItem.item === item);
}

// Remove item from inventory after use
function removeFromInventory(userId, item) {
  const economy = getEconomy();
  if (!economy[userId] || !economy[userId].inventory) return false;

  const itemIndex = economy[userId].inventory.findIndex(invItem => invItem.item === item);
  if (itemIndex !== -1) {
    economy[userId].inventory.splice(itemIndex, 1);
    saveEconomy();
    return true;
  }
  return false;
}

// Remove specific item instance from inventory
function removeSpecificFromInventory(userId, itemIndex, purchaseDate) {
  const economy = getEconomy();
  if (!economy[userId] || !economy[userId].inventory) return false;

  const actualIndex = economy[userId].inventory.findIndex((item, index) => 
    index === itemIndex && item.purchaseDate === purchaseDate
  );

  if (actualIndex !== -1) {
    economy[userId].inventory.splice(actualIndex, 1);
    saveEconomy();
    return true;
  }
  return false;
}

// Handle item use command
async function handleItemUseCommand(interaction, client) {
  const userId = interaction.user.id;
  const { getEconomy } = require('./database');
  const economy = getEconomy();

  if (!economy[userId] || !economy[userId].inventory || economy[userId].inventory.length === 0) {
    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder()
      .setTitle('📦 Inventario Vacío')
      .setDescription('No tienes items en tu inventario para usar.')
      .setColor('#ff6b6b');

    return await interaction.reply({ embeds: [embed] });
  }

  const inventory = economy[userId].inventory;
  const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

  // Create select menu with inventory items
  const options = inventory.map((item, index) => {
    let itemDef = storeItems[item.item];
    let isCompanyItem = false;

    if (!itemDef) {
      const companyResult = findCompanyItemByKey(item.item);
      if (companyResult) {
        itemDef = companyResult.item;
        isCompanyItem = true;
      }
    }

    if (!itemDef) return null;

    const purchaseDate = new Date(item.purchaseDate).toLocaleDateString('es-ES');
    let label = itemDef.name;
    let description = `Comprado: ${purchaseDate}`;

    if (item.item === 'halo' && item.color) {
      label += ` (${item.color.charAt(0).toUpperCase() + item.color.slice(1)})`;
    }

    if (isCompanyItem) {
      const usesLeft = item.usesLeft ?? itemDef.uses;
      description += ` • ${usesLeft} uso(s) restante(s)`;
    }

    return {
      label,
      description,
      value: `${index}|${item.purchaseDate}|${item.item}`,
      emoji: itemDef.emoji || '📦'
    };
  }).filter(Boolean);

  if (options.length === 0) {
    const embed = new EmbedBuilder()
      .setTitle('📦 Inventario Vacío')
      .setDescription('No tienes items utilizables en tu inventario.')
      .setColor('#ff6b6b');
    return await interaction.reply({ embeds: [embed] });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('item_use_select')
    .setPlaceholder('Selecciona un item para usar')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  const embed = new EmbedBuilder()
    .setTitle('📦 Usar Item del Inventario')
    .setDescription('Selecciona el item que quieres usar del menú desplegable.')
    .addFields(
      { name: '📋 Items disponibles', value: `${inventory.length} item(s)`, inline: true },
      { name: '💡 Instrucciones', value: 'Usa el menú para seleccionar y usar un item', inline: true }
    )
    .setColor('#4CAF50');

  await interaction.reply({ embeds: [embed], components: [row] });
}

// Handle item use selection
async function handleItemUse(interaction, client) {
  const userId = interaction.user.id;
  const [itemIndex, purchaseDate, itemType] = interaction.values[0].split('|');
  const index = parseInt(itemIndex);
  const purchaseDateNum = parseInt(purchaseDate);

  const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

  if (itemType === 'halo') {
    try {
      const economy = getEconomy();
      const userInventory = economy[userId].inventory;
      const haloItem = userInventory[index];
      
      if (!haloItem || haloItem.item !== 'halo') {
        await interaction.update({ 
          content: 'Error: No se pudo encontrar el halo en tu inventario.', 
          embeds: [], 
          components: [] 
        });
        return;
      }

      const haloColor = haloItem.color;
      const guild = interaction.guild;
      
      // Get the hex color for the halo
      const hexColor = haloColors[haloColor] || '#ffd700';
      
      // Create role name
      const roleName = `Halo ${haloColor.charAt(0).toUpperCase() + haloColor.slice(1)}`;
      
      // Check if role already exists
      let haloRole = guild.roles.cache.find(role => role.name === roleName);
      
      if (!haloRole) {
        // Create new role
        haloRole = await guild.roles.create({
          name: roleName,
          color: hexColor,
          reason: `Halo role for ${interaction.user.username}`,
          permissions: []
        });
      }
      
      // Add role to user
      const member = guild.members.cache.get(userId);
      if (member) {
        await member.roles.add(haloRole);
        
        // Remove the item from inventory after successful use
        removeSpecificFromInventory(userId, index, purchaseDateNum);
        
        const embed = new EmbedBuilder()
          .setTitle('✨ Halo Equipado')
          .setDescription(`Tu halo **${haloColor}** personalizado está ahora activo y visible en tu perfil.`)
          .addFields(
            { name: '🎨 Color', value: haloColor.charAt(0).toUpperCase() + haloColor.slice(1), inline: true },
            { name: '🎭 Efecto', value: 'Aura divina activada', inline: true },
            { name: '⏰ Duración', value: 'Permanente', inline: true },
            { name: '👑 Rol Asignado', value: `@${roleName}`, inline: true }
          )
          .setColor(hexColor);

        await interaction.update({ embeds: [embed], components: [] });
      } else {
        await interaction.update({ 
          content: 'Error: No se pudo encontrar tu usuario en el servidor.', 
          embeds: [], 
          components: [] 
        });
      }
    } catch (error) {
      console.error('Error al equipar halo:', error);
      await interaction.update({ 
        content: 'Hubo un error al equipar tu halo. Por favor intenta de nuevo.', 
        embeds: [], 
        components: [] 
      });
    }
    return;
  }

  if (itemType === 'anillo') {
    // Ring item - show info about marriage
    const embed = new EmbedBuilder()
      .setTitle('💍 Anillo de Compromiso')
      .setDescription('Tienes un anillo de compromiso listo para usar.')
      .addFields(
        { name: '💕 Uso', value: 'Usa `/matrimonio proponer @usuario` para proponer matrimonio', inline: false },
        { name: '💎 Estado', value: 'Listo para usar', inline: true }
      )
      .setColor('#ff69b4');

    await interaction.update({ embeds: [embed], components: [] });
    return;
  }

  if (itemType === 'empresa') {
    // Company item - show company type selection
    const companies = require('./companies');
    companies.showCompanyNameTypeModal(interaction, index, purchaseDateNum);
    return;
  }

  if (itemType === 'realeza') {
    // Realeza item - show modal for creation
    const modal = new ModalBuilder()
      .setCustomId(`realeza_modal_${index}_${purchaseDateNum}`)
      .setTitle('Crear tu Realeza Celestial');

    const nameInput = new TextInputBuilder()
      .setCustomId('realeza_name')
      .setLabel('Nombre de la Realeza')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Introduce el nombre de tu realeza')
      .setRequired(true)
      .setMaxLength(50);

    const colorInput = new TextInputBuilder()
      .setCustomId('realeza_color')
      .setLabel('Color de la Realeza (hex)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('#ff0000 (rojo), #00ff00 (verde), etc.')
      .setRequired(true)
      .setMaxLength(7);

    const initialsInput = new TextInputBuilder()
      .setCustomId('realeza_initials')
      .setLabel('Iniciales (2-3 letras)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ej: RC, REY, etc.')
      .setRequired(true)
      .setMaxLength(3);

    const firstRow = new ActionRowBuilder().addComponents(nameInput);
    const secondRow = new ActionRowBuilder().addComponents(colorInput);
    const thirdRow = new ActionRowBuilder().addComponents(initialsInput);

    modal.addComponents(firstRow, secondRow, thirdRow);

    await interaction.showModal(modal);
    return;
  }

  // Company items (auto-use, solo mostrar info)
  const companyResult = findCompanyItemByKey(itemType);
  if (companyResult) {
    const companyItem = companyResult.item;
    const economy = getEconomy();
    const inventoryItem = economy[userId]?.inventory?.[index];
    const usesLeft = inventoryItem?.usesLeft ?? 0;

    const embed = new EmbedBuilder()
      .setTitle(`${companyItem.emoji} ${companyItem.name}`)
      .setDescription(companyItem.description)
      .addFields(
        { name: '⚡ Activación', value: 'Este item se activa **automáticamente** cuando corresponda. No hace falta usarlo manualmente.', inline: false },
        { name: '🔢 Usos restantes', value: `${usesLeft} de ${companyItem.uses}`, inline: true }
      )
      .setColor('#ffd700');

    await interaction.update({ embeds: [embed], components: [] });
    return;
  }
}

module.exports = {
  storeItems,
  haloColors,
  companyStoreItems,
  getCompanyStoreItems,
  getAllCompanyStoreItems,
  findCompanyItemByKey,
  hasActiveSeguro,
  consumeSeguroUse,
  getSeguroUsesLeft,
  addToInventory,
  hasItem,
  removeFromInventory,
  removeSpecificFromInventory,
  handleItemUseCommand,
  handleItemUse
};
