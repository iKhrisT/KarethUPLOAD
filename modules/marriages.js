
const { getMarriages, saveMarriages } = require('./database');
const { getBalance, setBalance, formatNumber } = require('./economy');
const { hasItem, removeFromInventory } = require('./store');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Marriage management functions
function isMarried(userId) {
  const marriages = getMarriages();
  
  for (const [marriageId, marriageData] of Object.entries(marriages)) {
    if ((marriageData.proposer === userId || marriageData.partner === userId) && marriageData.status === 'married') {
      return { married: true, marriageData, marriageId };
    }
  }
  
  return { married: false };
}

function createMarriage(proposerId, partnerId) {
  const marriages = getMarriages();
  const marriageId = `${proposerId}_${partnerId}`;
  
  marriages[marriageId] = {
    proposer: proposerId,
    partner: partnerId,
    marriageDate: Date.now(),
    status: 'married'
  };
  
  saveMarriages();
  return marriages[marriageId];
}

function divorceMarriage(userId) {
  const marriages = getMarriages();
  
  for (const [marriageId, marriageData] of Object.entries(marriages)) {
    if ((marriageData.proposer === userId || marriageData.partner === userId) && marriageData.status === 'married') {
      marriages[marriageId].status = 'divorced';
      marriages[marriageId].divorceDate = Date.now();
      saveMarriages();
      return true;
    }
  }
  
  return false;
}

// Handle marriage command
async function handleMarriageCommand(interaction, client) {
  const userId = interaction.user.id;
  const action = interaction.options.getString('accion');
  const targetUser = interaction.options.getUser('usuario');

  if (action === 'proponer') {
    if (!targetUser) {
      return await interaction.reply({
        content: 'Debes mencionar a quien quieres proponerle matrimonio.',
        ephemeral: true
      });
    }

    // Check if user has engagement ring
    if (!hasItem(userId, 'anillo')) {
      return await interaction.reply({
        content: 'Necesitas un Anillo de Compromiso para proponer matrimonio. Puedes comprarlo en la tienda.',
        ephemeral: true
      });
    }

    // Check if proposing to themselves
    if (targetUser.id === userId) {
      return await interaction.reply({
        content: 'No puedes casarte contigo mismo.',
        ephemeral: true
      });
    }

    // Check if proposing to a bot
    if (targetUser.bot) {
      return await interaction.reply({
        content: 'No puedes casarte con un bot.',
        ephemeral: true
      });
    }

    // Check if already married
    const userMarried = isMarried(userId);
    const targetMarried = isMarried(targetUser.id);

    if (userMarried.married) {
      return await interaction.reply({
        content: 'Ya estás casado. Primero debes divorciarte.',
        ephemeral: true
      });
    }

    if (targetMarried.married) {
      return await interaction.reply({
        content: 'Esa persona ya está casada.',
        ephemeral: true
      });
    }

    // Create proposal embed with buttons
    const proposalEmbed = new EmbedBuilder()
      .setTitle('💍 Propuesta de Matrimonio')
      .setDescription(`${interaction.user} te está proponiendo matrimonio, ${targetUser}!`)
      .addFields(
        { name: '💕 Propuesta', value: `${interaction.user.username} quiere casarse contigo`, inline: false },
        { name: '💎 Con un anillo', value: 'Anillo de Compromiso', inline: true },
        { name: '⏰ Tiempo límite', value: '60 segundos para responder', inline: true }
      )
      .setColor('#ff69b4')
      .setFooter({ text: 'Usa los botones para responder' });

    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`accept_marriage_proposal_${userId}_${targetUser.id}`)
          .setLabel('💕 Aceptar')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reject_marriage_proposal_${userId}_${targetUser.id}`)
          .setLabel('💔 Rechazar')
          .setStyle(ButtonStyle.Danger)
      );

    await interaction.reply({
      content: `${targetUser}`,
      embeds: [proposalEmbed],
      components: [buttons]
    });

    // Set timeout to expire proposal
    setTimeout(async () => {
      try {
        const expiredEmbed = new EmbedBuilder()
          .setTitle('💔 Propuesta Expirada')
          .setDescription('La propuesta de matrimonio ha expirado.')
          .setColor('#ff0000');

        await interaction.editReply({
          embeds: [expiredEmbed],
          components: []
        });
      } catch (error) {
        console.error('Error expiring marriage proposal:', error);
      }
    }, 60000);

    return;
  }

  if (action === 'info') {
    const userMarried = isMarried(userId);

    if (!userMarried.married) {
      return await interaction.reply({
        content: 'No estás casado actualmente.',
        ephemeral: true
      });
    }

    const marriage = userMarried.marriageData;
    const partnerId = marriage.proposer === userId ? marriage.partner : marriage.proposer;
    
    try {
      const partner = await client.users.fetch(partnerId);
      const marriageDate = new Date(marriage.marriageDate).toLocaleDateString('es-ES');

      const embed = new EmbedBuilder()
        .setTitle('💕 Información del Matrimonio')
        .setDescription(`Detalles de tu matrimonio celestial`)
        .addFields(
          { name: '💑 Pareja', value: `${partner.username}`, inline: true },
          { name: '📅 Fecha de Matrimonio', value: marriageDate, inline: true },
          { name: '💗 Estado', value: 'Casados', inline: true },
          { name: '💍 Beneficios', value: 'Comparten el amor eterno en el reino celestial', inline: false }
        )
        .setColor('#ff69b4')
        .setFooter({ text: `Matrimonio registrado en el reino celestial` });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({
        content: 'Error al obtener información de tu pareja.',
        ephemeral: true
      });
    }
    return;
  }

  if (action === 'divorcio') {
    const userMarried = isMarried(userId);

    if (!userMarried.married) {
      return await interaction.reply({
        content: 'No estás casado, no puedes divorciarte.',
        ephemeral: true
      });
    }

    const marriage = userMarried.marriageData;
    const partnerId = marriage.proposer === userId ? marriage.partner : marriage.proposer;

    try {
      const partner = await client.users.fetch(partnerId);
      
      // Process divorce
      divorceMarriage(userId);

      const embed = new EmbedBuilder()
        .setTitle('💔 Divorcio Procesado')
        .setDescription(`Te has divorciado de ${partner.username}`)
        .addFields(
          { name: '📋 Estado', value: 'Divorciado', inline: true },
          { name: '📅 Fecha de Divorcio', value: new Date().toLocaleDateString('es-ES'), inline: true },
          { name: '💸 Costo', value: 'Ninguno', inline: true }
        )
        .setColor('#ff0000')
        .setFooter({ text: 'El matrimonio ha sido disuelto' });

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      await interaction.reply({
        content: 'Error al procesar el divorcio.',
        ephemeral: true
      });
    }
    return;
  }
}

// Handle marriage proposal response
async function handleMarriageProposalResponse(interaction, client) {
  const parts = interaction.customId.split('_');
  const action = parts[0]; // 'accept' or 'reject'
  const proposerId = parts[3]; // proposer user ID
  const partnerId = parts[4]; // partner user ID
  const userId = interaction.user.id;

  // Check if the user clicking is the intended recipient
  if (userId !== partnerId) {
    return await interaction.reply({
      content: 'Esta propuesta no es para ti.',
      ephemeral: true
    });
  }

  try {
    const proposer = await client.users.fetch(proposerId);

    if (action === 'accept') {
      // Check if both users are still unmarried
      const proposerMarried = isMarried(proposerId);
      const partnerMarried = isMarried(partnerId);

      if (proposerMarried.married || partnerMarried.married) {
        const embed = new EmbedBuilder()
          .setTitle('💔 Matrimonio Cancelado')
          .setDescription('Uno de ustedes ya está casado.')
          .setColor('#ff0000');

        return await interaction.update({
          embeds: [embed],
          components: []
        });
      }

      // Remove engagement ring from proposer
      if (!removeFromInventory(proposerId, 'anillo')) {
        const embed = new EmbedBuilder()
          .setTitle('💔 Error en el Matrimonio')
          .setDescription('El anillo de compromiso ya no está disponible.')
          .setColor('#ff0000');

        return await interaction.update({
          embeds: [embed],
          components: []
        });
      }

      // Create marriage
      createMarriage(proposerId, partnerId);

      const embed = new EmbedBuilder()
        .setTitle('💕 ¡Se Casaron!')
        .setDescription(`${proposer.username} y ${interaction.user.username} ahora están casados!`)
        .addFields(
          { name: '💑 Pareja', value: `${proposer.username} & ${interaction.user.username}`, inline: false },
          { name: '📅 Fecha', value: new Date().toLocaleDateString('es-ES'), inline: true },
          { name: '💍 Estado', value: 'Casados', inline: true }
        )
        .setColor('#00ff00')
        .setFooter({ text: '¡Felicidades por su matrimonio celestial!' });

      await interaction.update({
        content: '',
        embeds: [embed],
        components: []
      });

    } else if (action === 'reject') {
      const embed = new EmbedBuilder()
        .setTitle('💔 Propuesta Rechazada')
        .setDescription(`${interaction.user.username} ha rechazado la propuesta de matrimonio de ${proposer.username}.`)
        .setColor('#ff0000')
        .setFooter({ text: 'El anillo de compromiso permanece en el inventario' });

      await interaction.update({
        embeds: [embed],
        components: []
      });
    }

  } catch (error) {
    console.error('Error handling marriage proposal response:', error);
    await interaction.update({
      content: 'Error al procesar la respuesta.',
      components: []
    });
  }
}

module.exports = {
  isMarried,
  createMarriage,
  divorceMarriage,
  handleMarriageCommand,
  handleMarriageProposalResponse
};
