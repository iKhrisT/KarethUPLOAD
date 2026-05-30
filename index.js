const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder, MessageFlags } = require("discord.js");

// Import modules
const database = require('./modules/database');
const economy = require('./modules/economy');
const companies = require('./modules/companies');
const store = require('./modules/store');
const realezas = require('./modules/realezas');
const marriages = require('./modules/marriages');
const userTaxes = require('./taxes/user_taxes');
const jobs = require('./modules/jobs');

// ─────────────────────────────────────────────
// HELPER: evita que NaN / Infinity entren a la DB
// ─────────────────────────────────────────────
function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return (isNaN(n) || !isFinite(n)) ? fallback : Math.floor(n);
}

// Load all data on startup
database.loadAllData();

// ── Helper: Build paginated store embed ──
const STORE_ITEMS_PER_PAGE = 5;

function buildStorePage(page) {
  const regularEntries = Object.entries(store.storeItems);
  const regularPageCount = Math.ceil(regularEntries.length / STORE_ITEMS_PER_PAGE);

  // Get companies sorted by rank (highest money first) that have store items
  const allCompaniesObj = database.getCompanies();
  const sortedCompanies = Object.entries(allCompaniesObj)
    .sort(([, a], [, b]) => b.money - a.money);

  const companyPageList = [];
  sortedCompanies.forEach(([ownerId, company], index) => {
    const companyItems = store.getCompanyStoreItems(ownerId);
    if (companyItems.length > 0) {
      companyPageList.push({ ownerId, company, rank: index + 1, items: companyItems });
    }
  });

  const totalPages = regularPageCount + companyPageList.length;
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));

  const container = new ContainerBuilder();
  const pageFooter = `— Página ${currentPage + 1} de ${totalPages}`;

  if (currentPage < regularPageCount) {
    // ── Regular items page ──
    container.setAccentColor(0xff69b4);
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## 🛍️ Tienda de Items Especiales\n*Presiona 🦐 para comprar ${pageFooter}*`)
    );

    const start = currentPage * STORE_ITEMS_PER_PAGE;
    const pageEntries = regularEntries.slice(start, start + STORE_ITEMS_PER_PAGE);

    for (const [key, item] of pageEntries) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
      );

      let desc = `${item.emoji} **${item.name}**\n${item.description}`;
      if (key === 'halo') desc += '\n*Colores: Azul, Verde, Morado, Celeste, Rojo, Negro, Blanco, Marrón, Amarillo, Rosa*';

      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(desc))
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId(`buy_item_${key}`)
              .setLabel(`🦐 ${economy.formatNumber(item.price)} Kh`)
              .setStyle(ButtonStyle.Success)
          )
      );
    }
  } else {
    // ── Company store page ──
    const companyIdx = currentPage - regularPageCount;
    const { company, rank, items } = companyPageList[companyIdx];

    container.setAccentColor(0xffd700);
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## 🏪 Tienda de ${company.name}\n` +
        `**Ranking:** #${rank} | **Tipo:** ${company.type}\n` +
        `**Fondos:** ${economy.formatNumber(company.money)} Khronidas\n` +
        `*Las ganancias van a ${company.name} ${pageFooter}*`
      )
    );

    for (const item of items) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
      );

      const desc = `${item.emoji} **${item.name}**\n${item.description}\n*Usos: ${item.uses} veces*`;
      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(desc))
          .setButtonAccessory(
            new ButtonBuilder()
              .setCustomId(`buy_company_item_${item.key}`)
              .setLabel(`🦐 ${economy.formatNumber(item.price)} Kh`)
              .setStyle(ButtonStyle.Success)
          )
      );
    }
  }

  // Navigation row at the bottom of the container
  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
  );

  const prevButton = new ButtonBuilder()
    .setCustomId(`store_page_${currentPage - 1}`)
    .setLabel('◀ Anterior')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage === 0);

  const nextButton = new ButtonBuilder()
    .setCustomId(`store_page_${currentPage + 1}`)
    .setLabel('Siguiente ▶')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage >= totalPages - 1);

  const pageIndicator = new ButtonBuilder()
    .setCustomId('store_page_info')
    .setLabel(`${currentPage + 1} / ${totalPages}`)
    .setStyle(ButtonStyle.Primary)
    .setDisabled(true);

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(prevButton, pageIndicator, nextButton)
  );

  return { container };
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// Define the commands
const commands = [
  new SlashCommandBuilder()
    .setName('say')
    .setDescription('Di algo para que Kareth lo repita.')
    .addStringOption(option =>
      option.setName('mensaje')
        .setDescription('Kareth dira esto')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('confesion')
    .setDescription('Confesion con divinidades')
    .addStringOption(option =>
      option.setName('confession')
        .setDescription('Tu confesion')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('work')
    .setDescription('Trabaja para ganar dinero'),
  new SlashCommandBuilder()
    .setName('crime')
    .setDescription('Comete un crimen para ganar dinero (si, es pecado)'),
  new SlashCommandBuilder()
    .setName('invert')
    .setDescription('Invierte tu dinero en una empresa existente')
    .addStringOption(option =>
      option.setName('empresa')
        .setDescription('Empresa en la que invertir')
        .setRequired(true)
        .setAutocomplete(true))
    .addIntegerOption(option =>
      option.setName('cantidad')
        .setDescription('Cantidad a invertir')
        .setRequired(true)
        .setMinValue(500)),
  new SlashCommandBuilder()
    .setName('bal')
    .setDescription('Ver tu balance actual')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Ve el balance de otro miembro')
        .setRequired(false)),
  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Ver la tabla de clasificaciones de todos los miembros'),
  new SlashCommandBuilder()
    .setName('dep')
    .setDescription('Depositar dinero en el banco')
    .addStringOption(option =>
      option.setName('cantidad')
        .setDescription('Cantidad a depositar (o "all" para todo)')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('with')
    .setDescription('Retirar dinero del banco')
    .addStringOption(option =>
      option.setName('cantidad')
        .setDescription('Cantidad a retirar (o "all" para todo)')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('give')
    .setDescription('Dar dinero a otro usuario')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario al que darle dinero')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('cantidad')
        .setDescription('Cantidad a dar (o "all" para todo)')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('store')
    .setDescription('Ver la tienda de items especiales'),
  new SlashCommandBuilder()
    .setName('buy-item')
    .setDescription('Comprar un item de la tienda')
    .addStringOption(option =>
      option.setName('item')
        .setDescription('Item a comprar')
        .setRequired(true)
        .addChoices(
          { name: 'Halo Personalizado', value: 'halo' },
          { name: 'Anillo de Compromiso', value: 'anillo' },
          { name: 'Tu propia empresa', value: 'empresa' },
          { name: 'Realeza Celestial', value: 'realeza' }
        ))
    .addStringOption(option =>
      option.setName('color')
        .setDescription('Color del halo (solo para Halo Personalizado)')
        .setRequired(false)
        .addChoices(
          { name: 'Azul', value: 'azul' },
          { name: 'Verde', value: 'verde' },
          { name: 'Morado', value: 'morado' },
          { name: 'Celeste', value: 'celeste' },
          { name: 'Rojo', value: 'rojo' },
          { name: 'Negro', value: 'negro' },
          { name: 'Blanco', value: 'blanco' },
          { name: 'Marrón', value: 'marron' },
          { name: 'Amarillo', value: 'amarillo' },
          { name: 'Rosa', value: 'rosa' }
        )),
  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Ver tu inventario de items'),
  new SlashCommandBuilder()
    .setName('item-use')
    .setDescription('Usar un item de tu inventario'),
  new SlashCommandBuilder()
    .setName('add-money')
    .setDescription('Añadir dinero a un usuario (Solo administradores)')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario al que añadir dinero')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('cantidad')
        .setDescription('Cantidad de dinero a añadir')
        .setRequired(true)
        .setMinValue(1))
    .addStringOption(option =>
      option.setName('tipo')
        .setDescription('Donde añadir el dinero')
        .setRequired(true)
        .addChoices(
          { name: 'En mano', value: 'mano' },
          { name: 'En banco', value: 'banco' }
        )),
  new SlashCommandBuilder()
    .setName('ruleta')
    .setDescription('Juega a la ruleta y apuesta tu dinero')
    .addStringOption(option =>
      option.setName('apuesta')
        .setDescription('Cantidad a apostar (o "all" para todo)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('color')
        .setDescription('Apuesta por un color (no usar si eliges número)')
        .setRequired(false)
        .addChoices(
          { name: 'Rojo', value: 'rojo' },
          { name: 'Negro', value: 'negro' },
          { name: 'Verde', value: 'verde' }
        ))
    .addIntegerOption(option =>
      option.setName('numero')
        .setDescription('Apuesta por un número del 1-36 (no usar si eliges color)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(36)),
  new SlashCommandBuilder()
    .setName('loteria')
    .setDescription('Participa en la lotería semanal por 100 Khronidas')
    .addIntegerOption(option =>
      option.setName('numero')
        .setDescription('Elige tu número de la suerte (1-1000)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1000)),
  new SlashCommandBuilder()
    .setName('loteria-info')
    .setDescription('Ver información actual de la lotería'),
  new SlashCommandBuilder()
    .setName('empresa')
    .setDescription('Gestionar tu empresa')
    .addStringOption(option =>
      option.setName('accion')
        .setDescription('Acción a realizar')
        .setRequired(true)
        .addChoices(
          { name: 'Depositar dinero', value: 'depositar' },
          { name: 'Retirar dinero', value: 'sacar' },
          { name: 'Ver información', value: 'info' },
          { name: 'Ver leaderboard de empresas', value: 'leaderboard' },
          { name: 'Reclamar ingresos diarios', value: 'daily' },
          { name: 'Ver estado de impuestos', value: 'taxes' },
          { name: 'Pagar impuestos', value: 'pay-taxes' }
        ))
    .addStringOption(option =>
      option.setName('cantidad')
        .setDescription('Cantidad de dinero (solo para depositar/sacar)')
        .setRequired(false)),
  new SlashCommandBuilder()
    .setName('realeza')
    .setDescription('Gestionar tu realeza')
    .addStringOption(option =>
      option.setName('accion')
        .setDescription('Acción a realizar')
        .setRequired(true)
        .addChoices(
          { name: 'Ver información', value: 'info' },
          { name: 'Ver leaderboard', value: 'leaderboard' },
          { name: 'Depositar dinero', value: 'dep' },
          { name: 'Retirar dinero', value: 'with' },
          { name: 'Gestionar miembros', value: 'miembro' },
          { name: 'Ver impuestos', value: 'taxes' },
          { name: 'Pagar impuestos', value: 'pay-taxes' },
          { name: 'Establecer impuesto de ganancias (Solo Rey)', value: 'set-tax-rate' }
        ))
    .addStringOption(option =>
      option.setName('cantidad')
        .setDescription('Cantidad de dinero (solo para dep/with)')
        .setRequired(false))
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario para gestionar miembros')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('tipo')
        .setDescription('Tipo de gestión de miembro')
        .setRequired(false)
        .addChoices(
          { name: 'Añadir miembro', value: 'add' },
          { name: 'Remover miembro', value: 'remove' }
        ))
    .addNumberOption(option =>
      option.setName('porcentaje')
        .setDescription('Porcentaje de impuesto de ganancias (0-100, solo para set-tax-rate)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(100)),
  new SlashCommandBuilder()
    .setName('matrimonio')
    .setDescription('Gestionar matrimonios')
    .addStringOption(option =>
      option.setName('accion')
        .setDescription('Acción a realizar')
        .setRequired(true)
        .addChoices(
          { name: 'Proponer matrimonio', value: 'proponer' },
          { name: 'Ver información', value: 'info' },
          { name: 'Divorcio', value: 'divorcio' }
        ))
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario para proponer matrimonio')
        .setRequired(false)),
  new SlashCommandBuilder()
    .setName('restart-bot')
    .setDescription('Reiniciar el bot (Solo administradores)'),
  new SlashCommandBuilder()
    .setName('impuestos')
    .setDescription('Ver información sobre tus impuestos ciudadanos')
    .addStringOption(option =>
      option.setName('accion')
        .setDescription('Acción a realizar')
        .setRequired(true)
        .addChoices(
          { name: 'Ver mi información', value: 'info' },
          { name: 'Pagar impuestos', value: 'pagar' }
        ))
    .addStringOption(option =>
      option.setName('cantidad')
        .setDescription('Cantidad a pagar (solo para pagar impuestos)')
        .setRequired(false)),
  new SlashCommandBuilder()
    .setName('collect-taxes')
    .setDescription('Cobrar impuestos ciudadanos (Solo administradores)'),
  new SlashCommandBuilder()
    .setName('active-developer')
    .setDescription('Comando para obtener la insignia de Active Developer (Solo administradores)'),
  new SlashCommandBuilder()
    .setName('bot-retirar')
    .setDescription('Retirar dinero del banco del bot (Solo rol autorizado)')
    .addStringOption(option =>
      option.setName('cantidad')
        .setDescription('Cantidad a retirar (o "all" para todo)')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('bot-ingresar')
    .setDescription('Ingresar dinero al banco del bot (Solo rol autorizado)')
    .addStringOption(option =>
      option.setName('cantidad')
        .setDescription('Cantidad a ingresar (o "all" para todo)')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('bot-dar')
    .setDescription('Dar dinero del bot a un usuario (Solo rol autorizado)')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario al que darle dinero')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('cantidad')
        .setDescription('Cantidad a dar (o "all" para todo)')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('advertment')
    .setDescription('Registrar una advertencia a un usuario')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario a advertir')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('razon')
        .setDescription('Razón de la advertencia')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('lecture')
    .setDescription('Ver las advertencias de un usuario')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario a consultar')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('veredict')
    .setDescription('Emitir un veredicto en el canal'),
];

// Auto-role system for new members
client.on('guildMemberAdd', async member => {
  try {
    const roleId = '1387193940842774528';
    const role = member.guild.roles.cache.get(roleId);

    if (role) {
      await member.roles.add(role);
      console.log(`✅ Rol asignado automáticamente a ${member.user.username} (${member.user.id})`);
    } else {
      console.error(`❌ No se encontró el rol con ID: ${roleId}`);
    }
  } catch (error) {
    console.error(`❌ Error asignando rol a ${member.user.username}:`, error);
  }
});

client.once("ready", async (bot) => {
  client.user.setPresence({
    status: 'dnd',
    activities: [{
      name: 'k!help | Usalo, te ayudara a saber los comandos.',
      type: 4
    }]
  });

  console.log(`Bot: ${bot.user.username}\nStatus: dnd (Do Not Disturb)`);

  companies.updateCompanyTaxes();

  const bankrupted = companies.checkCompanyBankruptcy();
  if (bankrupted.length > 0) {
    bankrupted.forEach(company => {
      if (company.reason === 'negative_money') {
        console.log(`💸 Empresa ${company.name} en bancarrota por deudas excesivas: ${company.debt} Khronidas`);
      } else if (company.reason === 'unpaid_taxes') {
        console.log(`📊 Empresa ${company.name} en bancarrota por impuestos impagos: ${company.weeks} semanas`);
      }
    });
  }

  economy.checkLotteryEnd(client);
  realezas.updateRealezaTaxes();
  realezas.checkRealezaDissolution(client);
  userTaxes.updateUserTaxes(client);

  setInterval(() => {
    companies.updateCompanyTaxes();
    const bankrupted = companies.checkCompanyBankruptcy();
    if (bankrupted.length > 0) {
      console.log(`${bankrupted.length} empresas fueron a la bancarrota:`);
      bankrupted.forEach(company => {
        if (company.reason === 'negative_money') {
          console.log(`💸 ${company.name}: Deudas excesivas (${company.debt} Khronidas)`);
        } else if (company.reason === 'unpaid_taxes') {
          console.log(`📊 ${company.name}: Impuestos impagos (${company.weeks} semanas)`);
        }
      });
    }

    realezas.updateRealezaTaxes();
    const dissolved = realezas.checkRealezaDissolution(client);
    if (dissolved.length > 0) {
      console.log(`${dissolved.length} realezas were dissolved due to unpaid taxes`);
    }

    userTaxes.updateUserTaxes(client);
    economy.checkLotteryEnd(client);
  }, 24 * 60 * 60 * 1000);

  setInterval(() => {
    const now = new Date();
    if (now.getDay() === 0 && now.getHours() === 22) {
      console.log('🕙 Es domingo a las 10 PM - Cobrando impuestos ciudadanos automáticamente');
      userTaxes.collectUserTaxes(client);
    }
  }, 60 * 60 * 1000);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(
      Routes.applicationCommands(bot.user.id),
      { body: commands.map(command => command.toJSON()) },
    );
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
});

// ─────────────────────────────────────────────
// PREFIX COMMANDS (K! / k!)
// ─────────────────────────────────────────────
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const prefixes = ['K!', 'k!'];
  let prefix = null;

  for (const p of prefixes) {
    if (message.content.startsWith(p)) {
      prefix = p;
      break;
    }
  }

  if (!prefix) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // ── K!work ──
  if (command === 'work') {
    const userId   = message.author.id;
    const cooldown = economy.checkCooldown(userId, 'work');

    if (cooldown > 0) {
      const secs = Math.ceil(cooldown / 1000);
      const m    = Math.floor(secs / 60);
      const s    = secs % 60;
      return await message.reply(`Debes esperar **${m > 0 ? m + 'm ' : ''}${s}s** antes de volver a trabajar.`);
    }

    const workResult = jobs.doWork(userId);

    if (!workResult.hasJob) {
      const jobSelect = new StringSelectMenuBuilder()
        .setCustomId('job_select')
        .setPlaceholder('Elige tu profesión celestial...')
        .addOptions([
          { label: 'Cocinero',     value: 'cocinero',     description: 'Prepara manjares para los ángeles',    emoji: '🍳' },
          { label: 'Maestro',      value: 'maestro',      description: 'Enseña a las almas del cielo',         emoji: '📚' },
          { label: 'Obrero',       value: 'obrero',       description: 'Construye el Paraíso con tus manos',   emoji: '🔨' },
          { label: 'Programador',  value: 'programador',  description: 'Programa el sistema divino',           emoji: '💻' }
        ]);
      const row = new ActionRowBuilder().addComponents(jobSelect);

      const embed = new EmbedBuilder()
        .setTitle('💼 Selección de Empleo Celestial')
        .setDescription(`<@${userId}>, aún no tienes un trabajo. ¡Elige tu profesión para empezar a ganar Khronidas y XP!`)
        .addFields(
          { name: '📊 Sistema de Niveles', value: '• 75% éxito → dinero + XP completa\n• 15% interrumpido → sin dinero + poca XP\n• 10% fallo → pierdes dinero y XP\n• Al subir de nivel ganas un bonus de Khronidas\n• Cambiar de trabajo = 30% penalización de XP', inline: false }
        )
        .setColor('#7289da')
        .setFooter({ text: 'Selecciona tu profesión del menú de abajo' });

      await message.reply({ embeds: [embed], components: [row] });
      return;
    }

    const { outcome, jobName, title, level, money, xpGain, workMsg, currentXp, xpToNextLevel } = workResult;

    let actualMoney = money;
    let realezaTax  = 0;
    if (money > 0) {
      actualMoney = safeNumber(realezas.applyRealezaTax(userId, money));
      realezaTax  = money - actualMoney;
    }
    if (actualMoney !== 0) {
      economy.setBalance(userId, safeNumber(economy.getBalance(userId)) + actualMoney);
    }
    economy.setCooldown(userId, 'work');

    const xpResult = jobs.addXp(userId, xpGain);
    let levelUpText = '';
    for (const newLvl of xpResult.levelUps) {
      const bonus = jobs.getLevelUpBonus(newLvl);
      economy.setBalance(userId, safeNumber(economy.getBalance(userId)) + bonus);
      const newTitle = jobs.getJobTitle(jobName, newLvl);
      levelUpText += `\n🎉 **¡Subiste al nivel ${newLvl}!** → **${newTitle}** (+${economy.formatNumber(bonus)} Kh de bonus)`;
    }

    const emoji       = jobs.JOB_EMOJIS[jobName];
    const outcomeEmoji = outcome === 'success' ? '✅' : outcome === 'partial' ? '⚠️' : '❌';
    const outcomeLabel = outcome === 'success' ? 'Trabajo Exitoso' : outcome === 'partial' ? 'Trabajo Interrumpido' : 'Trabajo Fallido';
    const color        = outcome === 'success' ? '#00c851' : outcome === 'partial' ? '#ffaa00' : '#ff4444';
    const xpBar        = jobs.makeXpBar(xpResult.currentXp, xpResult.xpToNextLevel);
    const xpText       = xpGain >= 0 ? `+${xpGain} XP` : `${xpGain} XP`;

    const fields = [
      { name: `${emoji} Profesión`, value: `${title} (Nv. ${level})`, inline: true },
      { name: '💰 Ganancia',       value: money > 0 ? `${economy.formatNumber(actualMoney)} Kh` : (money < 0 ? `${economy.formatNumber(money)} Kh` : 'Sin pago'), inline: true },
      { name: `✨ XP (${xpText})`, value: `${xpBar}\n${xpResult.currentXp}/${xpResult.xpToNextLevel} XP`, inline: false }
    ];
    if (realezaTax > 0) fields.splice(2, 0, { name: '👑 Impuesto Realeza', value: `-${economy.formatNumber(realezaTax)} Kh`, inline: true });
    fields.push({ name: '💵 Balance', value: `${economy.formatNumber(economy.getBalance(userId))} Kh`, inline: true });

    const embed = new EmbedBuilder()
      .setTitle(`${outcomeEmoji} ${outcomeLabel} — ${title}`)
      .setDescription(`${workMsg}${levelUpText}`)
      .addFields(fields)
      .setColor(color);

    await message.reply({ embeds: [embed] });
    return;
  }

  // ── K!crime ──
  if (command === 'crime') {
    const userId = message.author.id;
    const cooldown = economy.checkCooldown(userId, 'crime');

    if (cooldown > 0) {
      const minutes = Math.ceil(cooldown / 60000);
      return await message.reply(`Debes esperar ${minutes} minuto(s) antes de cometer otro crimen.`);
    }

    const currentMoney = safeNumber(economy.getBalance(userId));
    const success = Math.random() > 0.5;

    if (success) {
      const rawEarnings = Math.floor(Math.random() * (1200 - 500 + 1)) + 500;
      const earnings    = safeNumber(realezas.applyRealezaTax(userId, rawEarnings));
      const realezaTax  = rawEarnings - earnings;

      economy.setBalance(userId, currentMoney + earnings);
      economy.setCooldown(userId, 'crime');

      const crimeMessages = [
        `Agarraste la cartera de un pobre Plebeth sin que nadie te viera y conseguiste ${earnings} Khronidas`,
        `Engañaste a un Garath y te pagó ${earnings} Khronidas por un favor falso`,
        `Asaltaste el banco del cielo disfrazado de serafín, ganando ${earnings} Khronidas`,
        `Vendiste reliquias sagradas en el mercado negro por ${earnings} Khronidas`,
        `Intercambiaste tu alma por Khronidas… y luego cancelaste la transacción...Te quedaste con ${earnings} Khronidas`
      ];

      const randomMessage = crimeMessages[Math.floor(Math.random() * crimeMessages.length)];

      const embed = new EmbedBuilder()
        .setTitle('Crimen Exitoso')
        .setDescription(randomMessage)
        .addFields(
          { name: '💰 Ganancia bruta', value: `${economy.formatNumber(rawEarnings)} Khronidas`, inline: true },
          { name: '👑 Impuesto de Realeza', value: realezaTax > 0 ? `-${economy.formatNumber(realezaTax)} Khronidas` : 'Sin realeza', inline: true },
          { name: '💵 Ganancia neta', value: `${economy.formatNumber(earnings)} Khronidas`, inline: true },
          { name: '💰 Dinero actual', value: `${economy.formatNumber(economy.getBalance(userId))} Khronidas`, inline: true }
        )
        .setColor('#ff9900');

      await message.reply({ embeds: [embed] });
    } else {
      const loss = safeNumber(Math.floor(currentMoney * 0.1));
      economy.setBalance(userId, currentMoney - loss);
      economy.setCooldown(userId, 'crime');

      const failureMessages = [
        `Quisiste convencer a un Angel de que tu eras un serafin, pero se dio cuenta y te multaron con ${loss} Khronidas por suplantacion de identidad`,
        `Te agarraron intentando llevarte la corona de un alto cargo, y para salir de tu condena pagaste ${loss} Khronidas`,
        `Te atraparon intentando vender pecados como si fueran NFT... nadie los quiso y te pusieron una multa de ${loss} Khronidas`,
        `Robaste el banco celestial... pero era el banco de pruebas, si, eso existe...Te multaron con ${loss} Khronidas`
      ];

      const randomFailureMessage = failureMessages[Math.floor(Math.random() * failureMessages.length)];

      const embed = new EmbedBuilder()
        .setTitle('Te Atraparon')
        .setDescription(randomFailureMessage)
        .addFields(
          { name: '💰 Dinero en mano', value: `${economy.formatNumber(economy.getBalance(userId))} Khronidas`, inline: true }
        )
        .setColor('#ff0000');

      await message.reply({ embeds: [embed] });
    }
    return;
  }

  // ── K!bal / K!balance ──
  if (command === 'bal' || command === 'balance') {
    const targetUser = message.mentions.users.first() || message.author;
    const money = economy.getBalance(targetUser.id);
    const bank  = economy.getBankBalance(targetUser.id);
    const total = economy.getTotalBalance(targetUser.id);

    const embed = new EmbedBuilder()
      .setTitle(targetUser.id === message.author.id ? 'Tu Balance' : `Balance de ${targetUser.username}`)
      .addFields(
        { name: '💰 Dinero', value: `${economy.formatNumber(money)} Khronidas`, inline: true },
        { name: '🏦 Banco',  value: `${economy.formatNumber(bank)} Khronidas`,  inline: true },
        { name: '💎 Total',  value: `${economy.formatNumber(total)} Khronidas`, inline: true }
      )
      .setColor('#0099ff');

    await message.reply({ embeds: [embed] });
    return;
  }

  // ── K!invert ── FIX: usar result.userEarnings y result.companyEarnings
  if (command === 'invert') {
    const userId = message.author.id;
    const cooldown = economy.checkCooldown(userId, 'invert');

    if (cooldown > 0) {
      const minutes = Math.ceil(cooldown / 60000);
      return await message.reply(`Debes esperar ${minutes} minuto(s) antes de invertir de nuevo.`);
    }

    if (!args[0] || !args[1]) {
      return await message.reply('Uso: `K!invert <empresa> <cantidad>`\nEjemplo: `K!invert TechCorp 5000`');
    }

    const empresaName = args[0];
    const cantidad    = safeNumber(parseInt(args[1]));

    if (cantidad < 500) {
      return await message.reply('La cantidad debe ser un número válido de al menos 500 Khronidas.');
    }

    // Find company by name
    const allCompanies = database.getCompanies();
    let empresaId = null;

    for (const [id, company] of Object.entries(allCompanies)) {
      if (company.name.toLowerCase().includes(empresaName.toLowerCase())) {
        empresaId = id;
        break;
      }
    }

    if (!empresaId) {
      return await message.reply(`No se encontró ninguna empresa con el nombre "${empresaName}".`);
    }

    // Deduct investment amount ONCE
    const currentMoney = safeNumber(economy.getBalance(userId));
    economy.setBalance(userId, currentMoney - cantidad);

    // Process investment
    const result = companies.processInvestment(userId, empresaId, cantidad);

    if (result.success) {
      // FIX: era result.userProfit → ahora result.userEarnings
      const rawProfit  = safeNumber(result.userEarnings);
      const netProfit  = safeNumber(realezas.applyRealezaTax(userId, rawProfit));
      const realezaTax = rawProfit - netProfit;

      // Add net profit to the already-deducted balance
      const balanceAfterDeduction = safeNumber(economy.getBalance(userId));
      economy.setBalance(userId, balanceAfterDeduction + netProfit);
      economy.setCooldown(userId, 'invert');

      const embed = new EmbedBuilder()
        .setTitle('📈 Inversión Exitosa')
        .setDescription(`Tu inversión en **${result.targetCompany.name}** ha sido un éxito rotundo. La empresa ha crecido significativamente.`)
        .addFields(
          { name: '🏢 Empresa',                    value: `**${result.targetCompany.name}** (${result.targetCompany.type})`, inline: true },
          { name: '📊 Posición',                   value: `#${result.companyPosition} de ${result.totalCompanies}`, inline: true },
          { name: '💵 Tu inversión',               value: `${economy.formatNumber(cantidad)} Khronidas`, inline: true },
          // FIX: porcentaje real del resultado
          { name: '💰 Ganancia bruta',              value: `${economy.formatNumber(rawProfit)} Khronidas (+${result.userPercentage}%)`, inline: true },
          { name: '👑 Impuesto de realeza (DESACTIVADO)',  value: realezaTax > 0 ? `${economy.formatNumber(realezaTax)} Khronidas` : 'N/A', inline: true },
          { name: '💵 Ganancia neta',              value: `${economy.formatNumber(netProfit)} Khronidas`, inline: true },
          // FIX: era result.companyProfit → ahora result.companyEarnings
          { name: '📈 Crecimiento empresarial',    value: `${economy.formatNumber(safeNumber(result.companyEarnings))} Khronidas (+${result.companyPercentage}%)`, inline: true },
          { name: '💰 Tu dinero actual',           value: `${economy.formatNumber(economy.getBalance(userId))} Khronidas`, inline: true }
        )
        .setColor('#00ff00')
        .setFooter({ text: `Probabilidad de éxito: ${Math.round(result.successRate * 100)}%` });

      await message.reply({ embeds: [embed] });
    } else {
      economy.setCooldown(userId, 'invert');

      const embed = new EmbedBuilder()
        .setTitle('📉 Inversión Fallida')
        .setDescription(`Tu inversión en **${result.targetCompany.name}** no tuvo los resultados esperados. El mercado puede ser impredecible.`)
        .addFields(
          { name: '🏢 Empresa',             value: `**${result.targetCompany.name}** (${result.targetCompany.type})`, inline: true },
          { name: '📊 Posición',            value: `#${result.companyPosition} de ${result.totalCompanies}`, inline: true },
          { name: '💸 Tu pérdida',          value: `${economy.formatNumber(cantidad)} Khronidas`, inline: true },
          { name: '📉 Pérdida empresarial', value: `${economy.formatNumber(safeNumber(result.companyLoss))} Khronidas (60%)`, inline: true },
          { name: '💰 Tu dinero actual',    value: `${economy.formatNumber(economy.getBalance(userId))} Khronidas`, inline: true },
          { name: '📈 Consejo',             value: 'Considera invertir en empresas mejor posicionadas', inline: false }
        )
        .setColor('#ff0000')
        .setFooter({ text: `Probabilidad de éxito: ${Math.round(result.successRate * 100)}%` });

      await message.reply({ embeds: [embed] });
    }
    return;
  }

  // ── K!leaderboard ──
  if (command === 'leaderboard' || command === 'lb') {
    const economyData = database.getEconomy();
    const sortedUsers = Object.entries(economyData)
      .filter(([userId, userData]) => userData && (userData.money > 0 || userData.bank > 0) && !userData.isBot)
      .sort(([,a], [,b]) => (b.money + (b.bank || 0)) - (a.money + (a.bank || 0)))
      .slice(0, 10);

    if (sortedUsers.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('📊 Tabla de Clasificaciones')
        .setDescription('No hay datos de economía aún. ¡Sé el primero en trabajar o hacer un crimen para aparecer en el leaderboard!')
        .addFields({ name: '💡 Para empezar', value: 'Usa `K!work` o `/work` para ganar tus primeros Khronidas', inline: false })
        .setColor('#0099ff');
      return await message.reply({ embeds: [embed] });
    }

    let leaderboard = '';
    for (let i = 0; i < sortedUsers.length; i++) {
      const [userId, userData] = sortedUsers[i];
      const totalMoney = userData.money + (userData.bank || 0);
      const position   = i + 1;
      const medal      = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
      try {
        const user = await client.users.fetch(userId);
        leaderboard += `${medal} **${user.username}** - ${economy.formatNumber(totalMoney)} Khronidas\n`;
      } catch {
        leaderboard += `${medal} Usuario desconocido - ${economy.formatNumber(totalMoney)} Khronidas\n`;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('📊 Tabla de Clasificaciones')
      .setDescription(`**TOP ${sortedUsers.length} USUARIOS POR DINERO TOTAL**\n\n${leaderboard}`)
      .addFields(
        { name: '💰 Criterio',          value: 'Dinero en mano + Banco', inline: true },
        { name: '👥 Total registrados', value: `${Object.keys(economyData).length} usuarios`, inline: true }
      )
      .setColor('#ffd700')
      .setFooter({ text: 'Solo se muestran usuarios con dinero > 0' });

    await message.reply({ embeds: [embed] });
    return;
  }

  // ── K!help ──
  if (command === 'help') {
    const embed = new EmbedBuilder()
      .setTitle('🎭 Comandos de Kareth')
      .setDescription('Lista de comandos disponibles con prefix K! o k!')
      .addFields(
        { name: '💰 Economía', value: '`K!work` - Trabajar para ganar dinero\n`K!crime` - Cometer un crimen\n`K!bal` - Ver tu balance\n`K!invert <empresa> <cantidad>` - Invertir en una empresa\n`K!leaderboard` - Ver tabla de clasificaciones', inline: false },
        { name: '🎮 Otros',   value: '`K!help` - Mostrar esta ayuda', inline: false },
        { name: '💡 Nota',    value: 'También puedes usar comandos slash (/) para acceder a todas las funciones del bot.', inline: false }
      )
      .setColor('#4CAF50');

    await message.reply({ embeds: [embed] });
    return;
  }
});

// ─────────────────────────────────────────────
// SLASH COMMANDS & INTERACTIONS
// ─────────────────────────────────────────────
client.on('interactionCreate', async interaction => {

  // ── Autocomplete ──
  if (interaction.isAutocomplete()) {
    if (interaction.commandName === 'invert') {
      const focusedValue  = interaction.options.getFocused();
      const allCompanies  = database.getCompanies();

      const companiesList = Object.entries(allCompanies)
        .sort(([,a], [,b]) => b.money - a.money)
        .filter(([, companyData]) =>
          companyData.name.toLowerCase().includes(focusedValue.toLowerCase())
        )
        .slice(0, 25);

      const choices = companiesList.map(([ownerId, companyData]) => {
        const position = Object.entries(allCompanies)
          .sort(([,a], [,b]) => b.money - a.money)
          .findIndex(([id]) => id === ownerId) + 1;
        return {
          name:  `#${position} ${companyData.name} (${companyData.type}) - ${economy.formatNumber(companyData.money)} Khronidas`,
          value: ownerId
        };
      });

      await interaction.respond(choices);
    }
    return;
  }

  // ── Modals ──
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('empresa_modal_')) {
      const userId = interaction.user.id;
      const [, , itemIndex, purchaseDate] = interaction.customId.split('_');
      const index           = parseInt(itemIndex);
      const purchaseDateNum = parseInt(purchaseDate);
      const companyName     = interaction.fields.getTextInputValue('company_name');
      const companyType     = interaction.fields.getTextInputValue('company_type');
      companies.handleCompanyCreation(interaction, userId, index, purchaseDateNum, companyName, companyType, client);
    }

    if (interaction.customId.startsWith('realeza_modal_')) {
      const userId = interaction.user.id;
      const [, , itemIndex, purchaseDate] = interaction.customId.split('_');
      const index           = parseInt(itemIndex);
      const purchaseDateNum = parseInt(purchaseDate);
      const realezaName     = interaction.fields.getTextInputValue('realeza_name');
      const realezaColor    = interaction.fields.getTextInputValue('realeza_color');
      const realezaInitials = interaction.fields.getTextInputValue('realeza_initials');
      realezas.handleRealezaCreation(interaction, userId, index, purchaseDateNum, realezaName, realezaColor, realezaInitials, client);
    }
    return;
  }

  // ── Buttons ──
  if (interaction.isButton()) {
    if (interaction.customId.startsWith('store_page_')) {
      const targetPage = parseInt(interaction.customId.replace('store_page_', ''));
      const { container } = buildStorePage(targetPage);
      await interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
      return;
    }

    // ── Buy regular item button ──
    if (interaction.customId.startsWith('buy_item_')) {
      const userId = interaction.user.id;
      const itemKey = interaction.customId.replace('buy_item_', '');

      if (itemKey === 'halo') {
        const colorSelect = new StringSelectMenuBuilder()
          .setCustomId('buy_halo_color_select')
          .setPlaceholder('Elige el color de tu halo...')
          .addOptions([
            { label: 'Azul',     value: 'azul',     emoji: '🔵' },
            { label: 'Verde',    value: 'verde',    emoji: '🟢' },
            { label: 'Morado',   value: 'morado',   emoji: '🟣' },
            { label: 'Celeste',  value: 'celeste',  emoji: '🩵' },
            { label: 'Rojo',     value: 'rojo',     emoji: '🔴' },
            { label: 'Negro',    value: 'negro',    emoji: '⚫' },
            { label: 'Blanco',   value: 'blanco',   emoji: '⚪' },
            { label: 'Marrón',   value: 'marron',   emoji: '🟤' },
            { label: 'Amarillo', value: 'amarillo', emoji: '🟡' },
            { label: 'Rosa',     value: 'rosa',     emoji: '🩷' }
          ]);
        const colorRow = new ActionRowBuilder().addComponents(colorSelect);
        await interaction.reply({ content: '🎨 **Elige el color de tu Halo Personalizado:**', components: [colorRow], ephemeral: true });
        return;
      }

      const storeItem = store.storeItems[itemKey];
      if (!storeItem) return;
      const currentMoney = safeNumber(economy.getBalance(userId));
      if (currentMoney < storeItem.price) {
        return await interaction.reply({ content: `❌ No tienes suficiente dinero. Necesitas **${economy.formatNumber(storeItem.price)} Khronidas** y tienes **${economy.formatNumber(currentMoney)} Khronidas**.`, ephemeral: true });
      }
      economy.setBalance(userId, currentMoney - storeItem.price);
      store.addToInventory(userId, itemKey, null);
      await interaction.reply({ content: `✅ ¡Compraste **${storeItem.name}**! Fue añadido a tu inventario.\n💰 Dinero restante: **${economy.formatNumber(economy.getBalance(userId))} Khronidas**`, ephemeral: true });
      return;
    }

    // ── Buy company item button ──
    if (interaction.customId.startsWith('buy_company_item_')) {
      const userId = interaction.user.id;
      const itemKey = interaction.customId.replace('buy_company_item_', '');
      const companyItemResult = store.findCompanyItemByKey(itemKey);
      if (!companyItemResult) return;
      const { item: companyItem, companyOwnerId } = companyItemResult;
      const currentMoney = safeNumber(economy.getBalance(userId));
      if (currentMoney < companyItem.price) {
        return await interaction.reply({ content: `❌ No tienes suficiente dinero. Necesitas **${economy.formatNumber(companyItem.price)} Khronidas** y tienes **${economy.formatNumber(currentMoney)} Khronidas**.`, ephemeral: true });
      }
      const targetCompany = companies.getCompany(companyOwnerId);
      if (!targetCompany) return await interaction.reply({ content: '❌ La empresa vendedora ya no existe.', ephemeral: true });
      economy.setBalance(userId, currentMoney - companyItem.price);
      companies.addCompanyMoney(companyOwnerId, companyItem.price);
      store.addToInventory(userId, itemKey, null, { usesLeft: companyItem.uses, companyOwner: companyOwnerId });
      await interaction.reply({ content: `✅ ¡Compraste **${companyItem.name}** de **${targetCompany.name}**! Fue añadido a tu inventario con **${companyItem.uses} usos**.\n💰 Dinero restante: **${economy.formatNumber(economy.getBalance(userId))} Khronidas**`, ephemeral: true });
      return;
    }
    if (interaction.customId.startsWith('accept_marriage_proposal_') || interaction.customId.startsWith('reject_marriage_proposal_')) {
      marriages.handleMarriageProposalResponse(interaction, client);
      return;
    }
    if (interaction.customId.startsWith('accept_member_invitation_') || interaction.customId.startsWith('reject_member_invitation_')) {
      realezas.handleMemberInvitationResponse(interaction, client);
      return;
    }
    if (interaction.customId.startsWith('approve_withdrawal_') || interaction.customId.startsWith('reject_withdrawal_')) {
      realezas.handleWithdrawalApproval(interaction, client);
      return;
    }
    return;
  }

  // ── Select menus ──
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'buy_halo_color_select') {
      const userId = interaction.user.id;
      const color = interaction.values[0];
      const haloItem = store.storeItems.halo;
      const currentMoney = safeNumber(economy.getBalance(userId));
      if (currentMoney < haloItem.price) {
        return await interaction.update({ content: `❌ No tienes suficiente dinero. Necesitas **${economy.formatNumber(haloItem.price)} Khronidas** y tienes **${economy.formatNumber(currentMoney)} Khronidas**.`, components: [] });
      }
      economy.setBalance(userId, currentMoney - haloItem.price);
      store.addToInventory(userId, 'halo', color);
      const colorName = color.charAt(0).toUpperCase() + color.slice(1);
      await interaction.update({ content: `✅ ¡Compraste un **Halo ${colorName}**! Fue añadido a tu inventario.\n💰 Dinero restante: **${economy.formatNumber(economy.getBalance(userId))} Khronidas**`, components: [] });
      return;
    }
    if (interaction.customId === 'company_type_select') {
      const [itemIndex, purchaseDate] = interaction.values[0].split('|');
      const index           = parseInt(itemIndex);
      const purchaseDateNum = parseInt(purchaseDate);
      companies.showCompanyNameTypeModal(interaction, index, purchaseDateNum);
      return;
    }
    if (interaction.customId === 'item_use_select') {
      store.handleItemUse(interaction, client);
      return;
    }

    if (interaction.customId === 'job_select') {
      const userId      = interaction.user.id;
      const selectedJob = interaction.values[0];
      const { isNew, jobData } = jobs.setJob(userId, selectedJob);
      const title = jobs.getJobTitle(selectedJob, jobData.level);
      const emoji = jobs.JOB_EMOJIS[selectedJob];

      const embed = new EmbedBuilder()
        .setTitle(`${emoji} ¡Empleo Seleccionado!`)
        .setDescription(isNew
          ? `¡Bienvenido a tu nuevo trabajo como **${title}**!\nYa puedes usar \`K!work\` o \`/work\` para empezar a trabajar y ganar XP.`
          : `Has vuelto a trabajar como **${title}**.\nTu XP fue reducida un **30%** por el tiempo de inactividad.\nUsa \`K!work\` o \`/work\` para continuar trabajando.`)
        .addFields(
          { name: `${emoji} Profesión`, value: `**${title}**`,                                   inline: true },
          { name: '📊 Nivel',           value: `${jobData.level}`,                               inline: true },
          { name: '✨ XP',              value: `${jobData.xp}/${jobData.xpToNextLevel} XP`,      inline: true }
        )
        .setColor('#00c851')
        .setFooter({ text: 'Puedes cambiar de trabajo en cualquier momento usando K!work o /work' });

      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    return;
  }

  if (!interaction.isChatInputCommand()) return;

  // ── /say ──
  if (interaction.commandName === 'say') {
    if (!interaction.member || !interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: 'You need administrator permissions to use this command.', ephemeral: true });
    }
    const messageText = interaction.options.getString('mensaje');
    await interaction.deferReply({ ephemeral: true });
    await interaction.deleteReply();
    await interaction.channel.send(messageText);
    return;
  }

  // ── /confesion ──
  if (interaction.commandName === 'confesion') {
    if (!interaction.member || !interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: 'You need administrator permissions to use this command.', ephemeral: true });
    }
    const confession = interaction.options.getString('confession');
    const guild      = interaction.guild;
    const user       = interaction.user;

    try {
      await interaction.reply({ content: 'Creating your confession channel...', ephemeral: true });

      const adminRole = guild.roles.cache.find(role =>
        role.name.toLowerCase().includes('admin') || role.permissions.has('Administrator')
      );

      const permissionOverwrites = [
        { id: guild.id,       deny: ['ViewChannel'] },
        { id: user.id,        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] },
        { id: client.user.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
      ];

      if (adminRole) {
        permissionOverwrites.push({ id: adminRole.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] });
      } else {
        const adminMembers = guild.members.cache.filter(m => m.permissions.has('Administrator') && !m.user.bot);
        adminMembers.forEach(admin => {
          permissionOverwrites.push({ id: admin.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] });
        });
      }

      const channel = await guild.channels.create({
        name: `confesion-${user.username}-${Date.now()}`,
        type: 0,
        permissionOverwrites,
        reason: `Confesion por: ${user.tag}`
      });

      await channel.send({ content: `@everyone\nConfesion creada por ${user}:\n\n${user}: ${confession}` });
      await interaction.editReply(`Confesion creada: ${channel}`);
    } catch (error) {
      console.error('Error con la confesion:', error);
      await interaction.editReply('Intentalo de nuevo.');
    }
    return;
  }

  // ── /work ──
  if (interaction.commandName === 'work') {
    const userId   = interaction.user.id;
    const cooldown = economy.checkCooldown(userId, 'work');

    if (cooldown > 0) {
      const secs = Math.ceil(cooldown / 1000);
      const m    = Math.floor(secs / 60);
      const s    = secs % 60;
      return await interaction.reply({ content: `Debes esperar **${m > 0 ? m + 'm ' : ''}${s}s** antes de volver a trabajar.`, ephemeral: true });
    }

    const workResult = jobs.doWork(userId);

    if (!workResult.hasJob) {
      const jobSelect = new StringSelectMenuBuilder()
        .setCustomId('job_select')
        .setPlaceholder('Elige tu profesión celestial...')
        .addOptions([
          { label: 'Cocinero',    value: 'cocinero',    description: 'Prepara manjares para los ángeles',   emoji: '🍳' },
          { label: 'Maestro',     value: 'maestro',     description: 'Enseña a las almas del cielo',        emoji: '📚' },
          { label: 'Obrero',      value: 'obrero',      description: 'Construye el Paraíso con tus manos',  emoji: '🔨' },
          { label: 'Programador', value: 'programador', description: 'Programa el sistema divino',          emoji: '💻' }
        ]);
      const row = new ActionRowBuilder().addComponents(jobSelect);

      const embed = new EmbedBuilder()
        .setTitle('Selección de Empleo Celestial')
        .setDescription(`<@${userId}>, aún no tienes un trabajo. ¡Elige tu profesión para empezar a ganar Khronidas y XP!`)
        .addFields(
          { name: '📊 Sistema de Niveles', value: '• 75% éxito → dinero + XP completa\n• 15% interrumpido → sin dinero + poca XP\n• 10% fallo → pierdes dinero y XP\n• Al subir de nivel ganas un bonus de Khronidas\n• Cambiar de trabajo = 30% penalización de XP', inline: false }
        )
        .setColor('#7289da')
        .setFooter({ text: 'Selecciona tu profesión del menú de abajo' });

      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    const { outcome, jobName, title, level, money, xpGain, workMsg } = workResult;

    let actualMoney = money;
    let realezaTax  = 0;
    if (money > 0) {
      actualMoney = safeNumber(realezas.applyRealezaTax(userId, money));
      realezaTax  = money - actualMoney;
    }
    if (actualMoney !== 0) {
      economy.setBalance(userId, safeNumber(economy.getBalance(userId)) + actualMoney);
    }
    economy.setCooldown(userId, 'work');

    const xpResult = jobs.addXp(userId, xpGain);
    let levelUpText = '';
    for (const newLvl of xpResult.levelUps) {
      const bonus = jobs.getLevelUpBonus(newLvl);
      economy.setBalance(userId, safeNumber(economy.getBalance(userId)) + bonus);
      const newTitle = jobs.getJobTitle(jobName, newLvl);
      levelUpText += `\n🎉 **¡Subiste al nivel ${newLvl}!** → **${newTitle}** (+${economy.formatNumber(bonus)} Kh de bonus)`;
    }

    const emoji        = jobs.JOB_EMOJIS[jobName];
    const outcomeEmoji = outcome === 'success' ? '✅' : outcome === 'partial' ? '⚠️' : '❌';
    const outcomeLabel = outcome === 'success' ? 'Trabajo Exitoso' : outcome === 'partial' ? 'Trabajo Interrumpido' : 'Trabajo Fallido';
    const color        = outcome === 'success' ? '#00c851' : outcome === 'partial' ? '#ffaa00' : '#ff4444';
    const xpBar        = jobs.makeXpBar(xpResult.currentXp, xpResult.xpToNextLevel);
    const xpText       = xpGain >= 0 ? `+${xpGain} XP` : `${xpGain} XP`;

    const fields = [
      { name: `${emoji} Profesión`, value: `${title} (Nv. ${level})`, inline: true },
      { name: '💰 Ganancia',        value: money > 0 ? `${economy.formatNumber(actualMoney)} Kh` : (money < 0 ? `${economy.formatNumber(money)} Kh` : 'Sin pago'), inline: true },
      { name: `✨ XP (${xpText})`,  value: `${xpBar}\n${xpResult.currentXp}/${xpResult.xpToNextLevel} XP`, inline: false }
    ];
    if (realezaTax > 0) fields.splice(2, 0, { name: '👑 Impuesto Realeza', value: `-${economy.formatNumber(realezaTax)} Kh`, inline: true });
    fields.push({ name: '💵 Balance', value: `${economy.formatNumber(economy.getBalance(userId))} Kh`, inline: true });

    const embed = new EmbedBuilder()
      .setTitle(`${outcomeEmoji} ${outcomeLabel} — ${title}`)
      .setDescription(`${workMsg}${levelUpText}`)
      .addFields(fields)
      .setColor(color);

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // ── /crime ──
  if (interaction.commandName === 'crime') {
    const userId   = interaction.user.id;
    const cooldown = economy.checkCooldown(userId, 'crime');

    if (cooldown > 0) {
      const minutes = Math.floor(cooldown / 60000);
      const seconds = Math.floor((cooldown % 60000) / 1000);
      return await interaction.reply({ content: `Debes esperar ${minutes}m ${seconds}s antes de cometer otro crimen.`, ephemeral: true });
    }

    const currentMoney = safeNumber(economy.getBalance(userId));
    const success      = Math.random() > 0.5;

    if (success) {
      const rawEarnings = Math.floor(Math.random() * (1200 - 500 + 1)) + 500;
      const earnings    = safeNumber(realezas.applyRealezaTax(userId, rawEarnings));
      const realezaTax  = rawEarnings - earnings;

      economy.setBalance(userId, currentMoney + earnings);
      economy.setCooldown(userId, 'crime');

      const crimeMessages = [
        `Agarraste la cartera de un pobre Plebeth sin que nadie te viera y conseguiste ${earnings} Khronidas`,
        `Engañaste a un Garath y te pagó ${earnings} Khronidas por un favor falso`,
        `Asaltaste el banco del cielo disfrazado de serafín, ganando ${earnings} Khronidas`,
        `Vendiste reliquias sagradas en el mercado negro por ${earnings} Khronidas`,
        `Intercambiaste tu alma por Khronidas… y luego cancelaste la transacción...Te quedaste con ${earnings} Khronidas`
      ];

      const randomMessage = crimeMessages[Math.floor(Math.random() * crimeMessages.length)];

      const embed = new EmbedBuilder()
        .setTitle('Crimen Exitoso')
        .setDescription(randomMessage)
        .addFields(
          { name: '💰 Ganancia bruta',             value: `${economy.formatNumber(rawEarnings)} Khronidas`, inline: true },
          { name: '👑 Impuesto de Realeza', value: realezaTax > 0 ? `-${economy.formatNumber(realezaTax)} Khronidas` : 'Sin realeza', inline: true },
          { name: '💵 Ganancia neta',             value: `${economy.formatNumber(earnings)} Khronidas`, inline: true },
          { name: '💰 Dinero actual',             value: `${economy.formatNumber(economy.getBalance(userId))} Khronidas`, inline: true }
        )
        .setColor('#ff9900');

      await interaction.reply({ embeds: [embed] });
    } else {
      const loss = safeNumber(Math.floor(currentMoney * 0.1));
      economy.setBalance(userId, currentMoney - loss);
      economy.setCooldown(userId, 'crime');

      const failureMessages = [
        `Quisiste convencer a un Angel de que tu eras un serafin, pero se dio cuenta y te multaron con ${loss} Khronidas por suplantacion de identidad`,
        `Te agarraron intentando llevarte la corona de un alto cargo, y para salir de tu condena pagaste ${loss} Khronidas`,
        `Te atraparon intentando vender pecados como si fueran NFT... nadie los quiso y te pusieron una multa de ${loss} Khronidas`,
        `Robaste el banco celestial... pero era el banco de pruebas, si, eso existe...Te multaron con ${loss} Khronidas`
      ];

      const randomFailureMessage = failureMessages[Math.floor(Math.random() * failureMessages.length)];

      const embed = new EmbedBuilder()
        .setTitle('Te Atraparon')
        .setDescription(randomFailureMessage)
        .addFields(
          { name: '💰 Dinero en mano', value: `${economy.formatNumber(economy.getBalance(userId))} Khronidas`, inline: true }
        )
        .setColor('#ff0000');

      await interaction.reply({ embeds: [embed] });
    }
    return;
  }

  // ── /invert ── FIX: usar result.userEarnings y result.companyEarnings
  if (interaction.commandName === 'invert') {
    const userId   = interaction.user.id;
    const empresaId = interaction.options.getString('empresa');
    const cantidad  = safeNumber(interaction.options.getInteger('cantidad'));
    const cooldown  = economy.checkCooldown(userId, 'invert');

    if (cooldown > 0) {
      const minutes = Math.ceil(cooldown / 60000);
      return await interaction.reply({ content: `Debes esperar ${minutes} minuto(s) antes de invertir de nuevo.`, ephemeral: true });
    }

    if (cantidad < 500) {
      return await interaction.reply({ content: 'La cantidad mínima para invertir es 500 Khronidas.', ephemeral: true });
    }

    // Deduct investment ONCE
    const balanceBeforeInvest = safeNumber(economy.getBalance(userId));
    economy.setBalance(userId, balanceBeforeInvest - cantidad);

    const result = companies.processInvestment(userId, empresaId, cantidad);

    if (result.success) {
      // FIX: era result.userProfit → ahora result.userEarnings
      const rawProfit  = safeNumber(result.userEarnings);
      const netProfit  = safeNumber(realezas.applyRealezaTax(userId, rawProfit));
      const realezaTax = rawProfit - netProfit;

      // Only add net profit — cantidad was already deducted above
      const balanceAfterDeduction = safeNumber(economy.getBalance(userId));
      economy.setBalance(userId, balanceAfterDeduction + netProfit);
      economy.setCooldown(userId, 'invert');

      const embed = new EmbedBuilder()
        .setTitle('📈 Inversión Exitosa')
        .setDescription(`Tu inversión en **${result.targetCompany.name}** ha sido un éxito rotundo. La empresa ha crecido significativamente.`)
        .addFields(
          { name: '🏢 Empresa',                   value: `**${result.targetCompany.name}** (${result.targetCompany.type})`, inline: true },
          { name: '📊 Posición',                  value: `#${result.companyPosition} de ${result.totalCompanies}`, inline: true },
          { name: '💵 Tu inversión',              value: `${economy.formatNumber(cantidad)} Khronidas`, inline: true },
          // FIX: porcentaje real del resultado
          { name: '💰 Ganancia bruta',             value: `${economy.formatNumber(rawProfit)} Khronidas (+${result.userPercentage}%)`, inline: true },
          { name: '👑 Impuesto de Realeza', value: realezaTax > 0 ? `-${economy.formatNumber(realezaTax)} Khronidas` : 'Sin realeza', inline: true },
          { name: '💵 Ganancia neta',             value: `${economy.formatNumber(netProfit)} Khronidas`, inline: true },
          // FIX: era result.companyProfit → ahora result.companyEarnings
          { name: '📈 Crecimiento empresarial',   value: `${economy.formatNumber(safeNumber(result.companyEarnings))} Khronidas (+${result.companyPercentage}%)`, inline: true },
          { name: '💰 Tu dinero actual',          value: `${economy.formatNumber(economy.getBalance(userId))} Khronidas`, inline: true }
        )
        .setColor('#00ff00')
        .setFooter({ text: `Probabilidad de éxito: ${Math.round(result.successRate * 100)}%` });

      await interaction.reply({ embeds: [embed] });
    } else {
      economy.setCooldown(userId, 'invert');

      // Apply Seguro Financiero if active (refund 30% of loss)
      const hadSeguro = store.hasActiveSeguro(userId);
      let actualLoss = cantidad;
      let seguroUsesLeft = 0;

      if (hadSeguro) {
        const refund = Math.floor(cantidad * 0.30);
        economy.setBalance(userId, safeNumber(economy.getBalance(userId)) + refund);
        actualLoss = cantidad - refund;
        store.consumeSeguroUse(userId);
        seguroUsesLeft = store.getSeguroUsesLeft(userId);
      }

      const embed = new EmbedBuilder()
        .setTitle('📉 Inversión Fallida')
        .setDescription(`Tu inversión en **${result.targetCompany.name}** no tuvo los resultados esperados. El mercado puede ser impredecible.`)
        .addFields(
          { name: '🏢 Empresa',             value: `**${result.targetCompany.name}** (${result.targetCompany.type})`, inline: true },
          { name: '📊 Posición',            value: `#${result.companyPosition} de ${result.totalCompanies}`, inline: true },
          { name: '💸 Tu pérdida',          value: `${economy.formatNumber(actualLoss)} Khronidas${hadSeguro ? ' 🛡️ (-30%)' : ''}`, inline: true },
          { name: '📉 Pérdida empresarial', value: `${economy.formatNumber(safeNumber(result.companyLoss))} Khronidas (60%)`, inline: true },
          { name: '💰 Tu dinero actual',    value: `${economy.formatNumber(economy.getBalance(userId))} Khronidas`, inline: true },
          { name: '📈 Consejo',             value: 'Considera invertir en empresas mejor posicionadas', inline: false }
        )
        .setColor('#ff0000')
        .setFooter({ text: `Probabilidad de éxito: ${Math.round(result.successRate * 100)}%` });

      if (hadSeguro) {
        const seguroMsg = seguroUsesLeft > 0
          ? `Tu Seguro Financiero te protegió. Te quedan **${seguroUsesLeft}** uso(s) restante(s).`
          : 'Tu Seguro Financiero te protegió por última vez. ¡Ya no tienes más usos!';
        embed.addFields({ name: '🛡️ Seguro Financiero activado', value: seguroMsg, inline: false });
      }

      await interaction.reply({ embeds: [embed] });
    }
    return;
  }

  // ── /bal ──
  if (interaction.commandName === 'bal') {
    const targetUser = interaction.options.getUser('usuario') || interaction.user;
    const money = economy.getBalance(targetUser.id);
    const bank  = economy.getBankBalance(targetUser.id);
    const total = economy.getTotalBalance(targetUser.id);

    const embed = new EmbedBuilder()
      .setTitle(targetUser.id === interaction.user.id ? 'Tu Balance' : `Balance de ${targetUser.username}`)
      .addFields(
        { name: '💰 Dinero', value: `${economy.formatNumber(money)} Khronidas`, inline: true },
        { name: '🏦 Banco',  value: `${economy.formatNumber(bank)} Khronidas`,  inline: true },
        { name: '💎 Total',  value: `${economy.formatNumber(total)} Khronidas`, inline: true }
      )
      .setColor('#0099ff');

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // ── /dep ──
  if (interaction.commandName === 'dep') {
    const userId      = interaction.user.id;
    const amount      = interaction.options.getString('cantidad');
    const currentMoney = safeNumber(economy.getBalance(userId));
    const currentBank  = safeNumber(economy.getBankBalance(userId));

    if (currentMoney <= 0) {
      return await interaction.reply({ content: `No tienes dinero en mano para depositar. Tienes ${economy.formatNumber(currentMoney)} Khronidas.`, ephemeral: true });
    }

    let depositAmount;
    if (amount.toLowerCase() === 'all') {
      depositAmount = currentMoney;
    } else {
      depositAmount = safeNumber(parseInt(amount));
      if (depositAmount <= 0) {
        return await interaction.reply({ content: 'Cantidad invalida. Usar un numero positivo o "all".', ephemeral: true });
      }
      if (depositAmount > currentMoney) {
        return await interaction.reply({ content: `No tienes suficiente dinero en mano. Tienes ${economy.formatNumber(currentMoney)} Khronidas.`, ephemeral: true });
      }
    }

    economy.setBalance(userId, currentMoney - depositAmount);
    economy.setBankBalance(userId, currentBank + depositAmount);

    const embed = new EmbedBuilder()
      .setTitle('Deposito Exitoso')
      .setDescription(`Has depositado ${economy.formatNumber(depositAmount)} Khronidas en el banco.`)
      .addFields(
        { name: '💰 Dinero', value: `${economy.formatNumber(economy.getBalance(userId))} Khronidas`, inline: true },
        { name: '🏦 Banco',  value: `${economy.formatNumber(economy.getBankBalance(userId))} Khronidas`, inline: true },
        { name: '💎 Total',  value: `${economy.formatNumber(economy.getTotalBalance(userId))} Khronidas`, inline: true }
      )
      .setColor('#00ff00');

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // ── /with ──
  if (interaction.commandName === 'with') {
    const userId      = interaction.user.id;
    const amount      = interaction.options.getString('cantidad');
    const currentMoney = safeNumber(economy.getBalance(userId));
    const currentBank  = safeNumber(economy.getBankBalance(userId));

    if (currentBank <= 0) {
      return await interaction.reply({ content: `No tienes dinero en el banco para retirar. Tienes ${economy.formatNumber(currentBank)} Khronidas.`, ephemeral: true });
    }

    let withdrawAmount;
    if (amount.toLowerCase() === 'all') {
      withdrawAmount = currentBank;
    } else {
      withdrawAmount = safeNumber(parseInt(amount));
      if (withdrawAmount <= 0) {
        return await interaction.reply({ content: 'Cantidad invalida. Usar un numero positivo o "all".', ephemeral: true });
      }
      if (withdrawAmount > currentBank) {
        return await interaction.reply({ content: `No tienes suficiente dinero en el banco. Tienes ${economy.formatNumber(currentBank)} Khronidas.`, ephemeral: true });
      }
    }

    economy.setBalance(userId, currentMoney + withdrawAmount);
    economy.setBankBalance(userId, currentBank - withdrawAmount);

    const embed = new EmbedBuilder()
      .setTitle('Retiro Exitoso')
      .setDescription(`Has retirado ${economy.formatNumber(withdrawAmount)} Khronidas del banco.`)
      .addFields(
        { name: '💰 Dinero', value: `${economy.formatNumber(economy.getBalance(userId))} Khronidas`, inline: true },
        { name: '🏦 Banco',  value: `${economy.formatNumber(economy.getBankBalance(userId))} Khronidas`, inline: true },
        { name: '🦐 Total',  value: `${economy.formatNumber(economy.getTotalBalance(userId))} Khronidas`, inline: true }
      )
      .setColor('#0099ff');

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // ── /give ──
  if (interaction.commandName === 'give') {
    const userId      = interaction.user.id;
    const targetUser  = interaction.options.getUser('usuario');
    const amount      = interaction.options.getString('cantidad');
    const currentMoney = safeNumber(economy.getBalance(userId));

    if (targetUser.id === userId) {
      return await interaction.reply({ content: 'No puedes darte dinero a ti mismo.', ephemeral: true });
    }

    if (currentMoney <= 0) {
      return await interaction.reply({ content: `No tienes dinero en mano para dar. Tienes ${economy.formatNumber(currentMoney)} Khronidas.`, ephemeral: true });
    }

    let giveAmount;
    if (amount.toLowerCase() === 'all') {
      giveAmount = currentMoney;
    } else {
      giveAmount = safeNumber(parseInt(amount));
      if (giveAmount <= 0) {
        return await interaction.reply({ content: 'Cantidad invalida. Usar un numero positivo o "all".', ephemeral: true });
      }
      if (giveAmount > currentMoney) {
        return await interaction.reply({ content: `No tienes suficiente dinero en mano. Tienes ${economy.formatNumber(currentMoney)} Khronidas.`, ephemeral: true });
      }
    }

    if (targetUser.bot) {
      const currentBotMoney = safeNumber(economy.getBotMoney());
      economy.setBalance(userId, currentMoney - giveAmount);
      economy.setBotMoney(currentBotMoney + giveAmount);

      const embed = new EmbedBuilder()
        .setTitle('Transferencia Exitosa al Bot')
        .setDescription(`Has dado ${economy.formatNumber(giveAmount)} Khronidas al bot.`)
        .addFields(
          { name: '💰 Tu dinero restante',     value: `${economy.formatNumber(economy.getBalance(userId))} Khronidas`, inline: true },
          { name: '🎁 Dinero dado',            value: `${economy.formatNumber(giveAmount)} Khronidas`, inline: true },
          { name: '🤖 Dinero del bot en mano', value: `${economy.formatNumber(economy.getBotMoney())} Khronidas`, inline: true }
        )
        .setColor('#ff69b4');

      await interaction.reply({ embeds: [embed] });
    } else {
      const targetCurrentMoney = safeNumber(economy.getBalance(targetUser.id));
      economy.setBalance(userId, currentMoney - giveAmount);
      economy.setBalance(targetUser.id, targetCurrentMoney + giveAmount);

      const embed = new EmbedBuilder()
        .setTitle('Transferencia Exitosa')
        .setDescription(`Has dado ${economy.formatNumber(giveAmount)} Khronidas a ${targetUser.username}.`)
        .addFields(
          { name: '💰 Tu dinero restante', value: `${economy.formatNumber(economy.getBalance(userId))} Khronidas`, inline: true },
          { name: '🎁 Dinero dado',        value: `${economy.formatNumber(giveAmount)} Khronidas`, inline: true },
          { name: '👤 Receptor',           value: `${targetUser.username}`, inline: true }
        )
        .setColor('#ff69b4');

      await interaction.reply({ embeds: [embed] });
    }
    return;
  }

  // ── /store ──
  if (interaction.commandName === 'store') {
    const { container } = buildStorePage(0);
    await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    return;
  }

  // ── /buy-item ──
  if (interaction.commandName === 'buy-item') {
    const userId = interaction.user.id;
    const item   = interaction.options.getString('item');
    const color  = interaction.options.getString('color');
    const currentMoney = safeNumber(economy.getBalance(userId));

    // Check if it's a company item first
    const companyItemResult = store.findCompanyItemByKey(item);
    if (companyItemResult) {
      const { item: companyItem, companyOwnerId } = companyItemResult;
      const targetCompany = companies.getCompany(companyOwnerId);

      if (!targetCompany) {
        return await interaction.reply({ content: 'La empresa vendedora ya no existe.', ephemeral: true });
      }
      if (currentMoney < companyItem.price) {
        return await interaction.reply({ content: `No tienes suficiente dinero en mano. Necesitas ${economy.formatNumber(companyItem.price)} Khronidas pero solo tienes ${economy.formatNumber(currentMoney)} Khronidas.`, ephemeral: true });
      }

      economy.setBalance(userId, currentMoney - companyItem.price);
      companies.addCompanyMoney(companyOwnerId, companyItem.price);
      store.addToInventory(userId, item, null, { usesLeft: companyItem.uses, companyOwner: companyOwnerId });

      const embed = new EmbedBuilder()
        .setTitle('¡Compra Exitosa!')
        .setDescription(`Has comprado **${companyItem.name}** de **${targetCompany.name}**! El item ha sido añadido a tu inventario.`)
        .addFields(
          { name: '💰 Dinero restante',   value: `${economy.formatNumber(economy.getBalance(userId))} Khronidas`, inline: true },
          { name: '🛍️ Item comprado',     value: companyItem.name, inline: true },
          { name: '🏢 Empresa vendedora', value: targetCompany.name, inline: true },
          { name: '📝 Descripción',       value: companyItem.description, inline: false },
          { name: '🔢 Usos disponibles',  value: `${companyItem.uses} usos`, inline: true },
          { name: '💡 Estado',            value: 'Item añadido a tu inventario correctamente.', inline: false }
        )
        .setColor('#00ff00');

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // Regular store item
    const storeItem = store.storeItems[item];
    if (!storeItem) {
      return await interaction.reply({ content: 'Item no encontrado.', ephemeral: true });
    }

    if (currentMoney < storeItem.price) {
      return await interaction.reply({ content: `No tienes suficiente dinero en mano. Necesitas ${economy.formatNumber(storeItem.price)} Khronidas pero solo tienes ${economy.formatNumber(currentMoney)} Khronidas.`, ephemeral: true });
    }

    economy.setBalance(userId, currentMoney - storeItem.price);
    store.addToInventory(userId, item, color);

    const embed = new EmbedBuilder()
      .setTitle('¡Compra Exitosa!')
      .setDescription(`Has comprado **${storeItem.name}**! El item ha sido añadido a tu inventario.`)
      .addFields(
        { name: '💰 Dinero restante', value: `${economy.formatNumber(economy.getBalance(userId))} Khronidas`, inline: true },
        { name: '🛍️ Item comprado',   value: `${storeItem.name}`, inline: true },
        { name: '📝 Descripción',     value: storeItem.description, inline: false },
        { name: '💡 Estado',          value: 'Item añadido a tu inventario correctamente.', inline: false }
      )
      .setColor('#00ff00');

    if (item === 'halo' && color) {
      embed.addFields({ name: '🎨 Color elegido', value: color.charAt(0).toUpperCase() + color.slice(1), inline: true });
    }

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // ── /inventory ──
  if (interaction.commandName === 'inventory') {
    const userId = interaction.user.id;

    if (!economy.economy[userId] || !economy.economy[userId].inventory || economy.economy[userId].inventory.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('📦 Tu Inventario')
        .setDescription('Tu inventario está vacío. ¡Compra algunos items en la tienda usando `/store`!')
        .setColor('#ff6b6b');
      return await interaction.reply({ embeds: [embed] });
    }

    const inventory = economy.economy[userId].inventory;
    let inventoryText = '';

    inventory.forEach((item, index) => {
      const purchaseDate = new Date(item.purchaseDate).toLocaleDateString('es-ES');

      // Check regular store items first, then company store items
      const storeItem = store.storeItems[item.item];
      const companyItemData = store.findCompanyItemByKey(item.item);
      const itemInfo = storeItem || (companyItemData ? companyItemData.item : null);

      if (!itemInfo) {
        inventoryText += `**${index + 1}.** Item desconocido\n   • Comprado: ${purchaseDate}\n\n`;
        return;
      }

      if (item.item === 'halo') {
        inventoryText += `**${index + 1}.** ${itemInfo.emoji || ''} ${itemInfo.name}\n`;
        inventoryText += `   • Color: ${item.color.charAt(0).toUpperCase() + item.color.slice(1)}\n`;
        inventoryText += `   • Comprado: ${purchaseDate}\n`;
        inventoryText += `   • Descripción: ${itemInfo.description}\n\n`;
      } else if (item.item === 'seguroFinanciero') {
        inventoryText += `**${index + 1}.** ${itemInfo.emoji || ''} ${itemInfo.name}\n`;
        inventoryText += `   • Usos restantes: **${item.usesLeft}**\n`;
        inventoryText += `   • Comprado: ${purchaseDate}\n`;
        inventoryText += `   • Descripción: ${itemInfo.description}\n\n`;
      } else {
        inventoryText += `**${index + 1}.** ${itemInfo.emoji || ''} ${itemInfo.name}\n`;
        inventoryText += `   • Comprado: ${purchaseDate}\n`;
        inventoryText += `   • Descripción: ${itemInfo.description}\n\n`;
      }
    });

    const embed = new EmbedBuilder()
      .setTitle('📦 Tu Inventario')
      .setDescription(inventoryText)
      .addFields({ name: '💡 Items en inventario', value: 'Estos son los items que tienes almacenados.', inline: false })
      .setColor('#4CAF50')
      .setFooter({ text: `Items totales: ${inventory.length}` });

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // ── /item-use ──
  if (interaction.commandName === 'item-use') {
    store.handleItemUseCommand(interaction, client);
    return;
  }

  // ── /add-money ──
  if (interaction.commandName === 'add-money') {
    if (!interaction.member || !interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: 'Solo los administradores pueden usar este comando.', ephemeral: true });
    }

    const targetUser   = interaction.options.getUser('usuario');
    const amount       = safeNumber(interaction.options.getInteger('cantidad'));
    const type         = interaction.options.getString('tipo');

    if (targetUser.bot) {
      return await interaction.reply({ content: 'No puedes añadir dinero a un bot.', ephemeral: true });
    }

    const currentMoney = safeNumber(economy.getBalance(targetUser.id));
    const currentBank  = safeNumber(economy.getBankBalance(targetUser.id));

    if (type === 'mano') {
      economy.setBalance(targetUser.id, currentMoney + amount);

      const embed = new EmbedBuilder()
        .setTitle('💰 Dinero Añadido')
        .setDescription(`Has añadido **${economy.formatNumber(amount)} Khronidas** en mano a ${targetUser.username}.`)
        .addFields(
          { name: '👤 Usuario',              value: `${targetUser.username}`, inline: true },
          { name: '💰 Dinero actual en mano', value: `${economy.formatNumber(economy.getBalance(targetUser.id))} Khronidas`, inline: true },
          { name: '🏦 Dinero en banco',      value: `${economy.formatNumber(economy.getBankBalance(targetUser.id))} Khronidas`, inline: true },
          { name: '💎 Total',               value: `${economy.formatNumber(economy.getTotalBalance(targetUser.id))} Khronidas`, inline: true }
        )
        .setColor('#00ff00')
        .setFooter({ text: `Administrador: ${interaction.user.username}` });

      await interaction.reply({ embeds: [embed] });
    } else if (type === 'banco') {
      economy.setBankBalance(targetUser.id, currentBank + amount);

      const embed = new EmbedBuilder()
        .setTitle('🏦 Dinero Añadido al Banco')
        .setDescription(`Has añadido **${economy.formatNumber(amount)} Khronidas** al banco de ${targetUser.username}.`)
        .addFields(
          { name: '👤 Usuario',               value: `${targetUser.username}`, inline: true },
          { name: '💰 Dinero en mano',        value: `${economy.formatNumber(economy.getBalance(targetUser.id))} Khronidas`, inline: true },
          { name: '🏦 Dinero actual en banco', value: `${economy.formatNumber(economy.getBankBalance(targetUser.id))} Khronidas`, inline: true },
          { name: '💎 Total',                value: `${economy.formatNumber(economy.getTotalBalance(targetUser.id))} Khronidas`, inline: true }
        )
        .setColor('#0099ff')
        .setFooter({ text: `Administrador: ${interaction.user.username}` });

      await interaction.reply({ embeds: [embed] });
    }
    return;
  }

  // ── /ruleta ──
  if (interaction.commandName === 'ruleta') {
    const userId    = interaction.user.id;
    const betAmount = interaction.options.getString('apuesta');
    const color     = interaction.options.getString('color');
    const number    = interaction.options.getInteger('numero');
    const currentMoney = safeNumber(economy.getBalance(userId));

    if (color && number) {
      return await interaction.reply({ content: 'No puedes apostar por color y número al mismo tiempo. Elige solo uno.', ephemeral: true });
    }
    if (!color && !number) {
      return await interaction.reply({ content: 'Debes elegir apostar por un color o un número.', ephemeral: true });
    }
    if (currentMoney <= 0) {
      return await interaction.reply({ content: 'No tienes dinero en mano para apostar.', ephemeral: true });
    }

    let bet;
    if (betAmount.toLowerCase() === 'all') {
      bet = currentMoney;
    } else {
      bet = safeNumber(parseInt(betAmount));
      if (bet <= 0) {
        return await interaction.reply({ content: 'Cantidad inválida. Usa un número positivo o "all".', ephemeral: true });
      }
      if (bet > currentMoney) {
        return await interaction.reply({ content: `No tienes suficiente dinero en mano. Tienes ${economy.formatNumber(currentMoney)} Khronidas.`, ephemeral: true });
      }
    }

    economy.setBalance(userId, currentMoney - bet);

    const betType  = color ? `Color: **${color.charAt(0).toUpperCase() + color.slice(1)}**` : `Número: **${number}**`;
    const waitEmbed = new EmbedBuilder()
      .setTitle('🎰 Ruleta en Curso')
      .setDescription(`${interaction.user.username} ha apostado ${economy.formatNumber(bet)} Khronidas por ${betType}`)
      .addFields(
        { name: '⏱️ Tiempo restante', value: '30 segundos', inline: true },
        { name: '💰 Apuesta',         value: `${economy.formatNumber(bet)} Khronidas`, inline: true },
        { name: '🎯 Predicción',      value: betType, inline: true }
      )
      .setColor('#ffff00')
      .setFooter({ text: 'La ruleta girará en 30 segundos...' });

    await interaction.reply({ embeds: [waitEmbed] });

    setTimeout(async () => {
      const specialRoleId  = '1387188650084925490';
      const hasSpecialRole = interaction.member && interaction.member.roles.cache.has(specialRoleId);

      let randomNumber;
      let resultColor;

      if (hasSpecialRole) {
        if (color) {
          if (color === 'verde') {
            randomNumber = 0; resultColor = 'verde';
          } else if (color === 'rojo') {
            const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
            randomNumber = redNumbers[Math.floor(Math.random() * redNumbers.length)];
            resultColor = 'rojo';
          } else {
            const blackNumbers = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];
            randomNumber = blackNumbers[Math.floor(Math.random() * blackNumbers.length)];
            resultColor = 'negro';
          }
        } else if (number) {
          randomNumber = number;
          const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
          resultColor = randomNumber === 0 ? 'verde' : redNumbers.includes(randomNumber) ? 'rojo' : 'negro';
        }
      } else {
        randomNumber = Math.floor(Math.random() * 37);
        const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
        resultColor = randomNumber === 0 ? 'verde' : redNumbers.includes(randomNumber) ? 'rojo' : 'negro';
      }

      let won      = false;
      let winnings = 0;

      if (color && color === resultColor) {
        won      = true;
        winnings = color === 'verde' ? bet * 35 : bet * 2;
      } else if (number && number === randomNumber) {
        won      = true;
        winnings = bet * 36;
      }

      winnings = safeNumber(winnings);

      if (won) {
        const newBalance = safeNumber(economy.getBalance(userId)) + bet + winnings;
        economy.setBalance(userId, newBalance);
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle(won ? '🎉 ¡Ganaste!' : '💸 Perdiste')
        .setDescription(won
          ? `¡Felicidades! El resultado fue **${randomNumber}** ${resultColor.charAt(0).toUpperCase() + resultColor.slice(1)} y tu predicción fue correcta.`
          : `Lo siento, el resultado fue **${randomNumber}** ${resultColor.charAt(0).toUpperCase() + resultColor.slice(1)} y tu predicción no fue correcta.`)
        .addFields(
          { name: '🎯 Tu predicción', value: betType, inline: true },
          { name: '🎰 Resultado',     value: `**${randomNumber}** ${resultColor.charAt(0).toUpperCase() + resultColor.slice(1)}`, inline: true },
          { name: '💰 Apuesta',       value: `${economy.formatNumber(bet)} Khronidas`, inline: true }
        )
        .setColor(won ? '#00ff00' : '#ff0000');

      if (won) {
        resultEmbed.addFields(
          { name: '🎁 Ganancia',    value: `${economy.formatNumber(winnings)} Khronidas`, inline: true },
          { name: '💎 Dinero actual', value: `${economy.formatNumber(economy.getBalance(userId))} Khronidas`, inline: true }
        );
      } else {
        resultEmbed.addFields(
          { name: '💔 Pérdida',     value: `${economy.formatNumber(bet)} Khronidas`, inline: true },
          { name: '💎 Dinero actual', value: `${economy.formatNumber(economy.getBalance(userId))} Khronidas`, inline: true }
        );
      }

      await interaction.editReply({ embeds: [resultEmbed] });
    }, 30000);
    return;
  }

  // ── /loteria ──
  if (interaction.commandName === 'loteria') {
    const userId        = interaction.user.id;
    const chosenNumber  = interaction.options.getInteger('numero');
    const currentMoney  = safeNumber(economy.getBalance(userId));

    if (!economy.lottery.active) economy.initializeLottery();

    if (currentMoney < 100) {
      return await interaction.reply({ content: `No tienes suficiente dinero en mano. Necesitas 100 Khronidas pero solo tienes ${economy.formatNumber(currentMoney)} Khronidas.`, ephemeral: true });
    }
    if (economy.lottery.participants[userId]) {
      return await interaction.reply({ content: `Ya estás participando en la lotería actual con el número **${economy.lottery.participants[userId]}**. Solo puedes participar una vez por lotería.`, ephemeral: true });
    }
    if (!economy.isNumberAvailable(chosenNumber)) {
      return await interaction.reply({ content: `El número **${chosenNumber}** ya ha sido elegido por otro participante. Elige un número diferente.`, ephemeral: true });
    }

    economy.setBalance(userId, currentMoney - 100);
    economy.addParticipant(userId, chosenNumber);

    const lotteryInfo = economy.getLotteryInfo();

    const embed = new EmbedBuilder()
      .setTitle('🎫 ¡Participación Exitosa!')
      .setDescription(`Has entrado a la lotería con el número **${chosenNumber}**`)
      .addFields(
        { name: '🎯 Tu número',        value: `**${chosenNumber}**`, inline: true },
        { name: '💰 Costo',            value: '100 Khronidas', inline: true },
        { name: '🏆 Premio',           value: '150,000 Khronidas', inline: true },
        { name: '👥 Participantes',    value: `${lotteryInfo.participantCount}`, inline: true },
        { name: '🔢 Números disponibles', value: `${lotteryInfo.numbersLeft}`, inline: true },
        { name: '📅 Días restantes',   value: `${lotteryInfo.daysLeft} días`, inline: true },
        { name: '💎 Tu dinero restante', value: `${economy.formatNumber(economy.getBalance(userId))} Khronidas`, inline: false }
      )
      .setColor('#ffd700')
      .setFooter({ text: `Lotería termina: ${lotteryInfo.endDate.toLocaleDateString('es-ES')}` });

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // ── /loteria-info ──
  if (interaction.commandName === 'loteria-info') {
    const lotteryResult = economy.checkLotteryEnd(client);

    if (lotteryResult) {
      let resultMessage = `🎰 **Resultado de la Lotería**\n\nNúmero ganador: **${lotteryResult.winningNumber}**\n\n`;
      if (lotteryResult.winnerId) {
        try {
          const winner = await client.users.fetch(lotteryResult.winnerId);
          resultMessage += `🎉 **¡Ganador!** ${winner.username} ha ganado 1,500,000 Khronidas que han sido depositadas en su banco.`;
        } catch {
          resultMessage += `🎉 **¡Hay un ganador!** Se han depositado 1,500,000 Khronidas en el banco del ganador.`;
        }
      } else {
        resultMessage += `💸 **No hay ganador** - Nadie eligió el número ganador.`;
      }
      resultMessage += `\n\n🔄 Una nueva lotería comenzará cuando alguien compre el primer boleto.`;

      const embed = new EmbedBuilder()
        .setTitle('🎰 Resultados de la Lotería')
        .setDescription(resultMessage)
        .setColor(lotteryResult.winnerId ? '#00ff00' : '#ff6b6b');
      return await interaction.reply({ embeds: [embed] });
    }

    if (!economy.lottery.active) {
      const embed = new EmbedBuilder()
        .setTitle('🎫 Lotería')
        .setDescription('**No hay lotería activa actualmente.**\n\n🎯 **¿Cómo funciona?**\n• Cuesta 100 Khronidas participar\n• Elige un número del 1 al 1000\n• Premio: 150,000 Khronidas al banco del ganador\n• Duración: 7 días\n• Solo un número por persona\n\n💡 **¡Usa `/loteria` para iniciar una nueva lotería!**')
        .setColor('#4CAF50');
      return await interaction.reply({ embeds: [embed] });
    }

    const lotteryInfo = economy.getLotteryInfo();

    const embed = new EmbedBuilder()
      .setTitle('🎫 Información de la Lotería')
      .setDescription('**Lotería Semanal Activa**')
      .addFields(
        { name: '🏆 Premio',              value: '1,500,000 Khronidas', inline: true },
        { name: '💰 Costo de entrada',    value: '100 Khronidas', inline: true },
        { name: '🎯 Rango de números',    value: '1 - 1000', inline: true },
        { name: '👥 Participantes actuales', value: `${lotteryInfo.participantCount}`, inline: true },
        { name: '🔢 Números disponibles', value: `${lotteryInfo.numbersLeft}`, inline: true },
        { name: '📅 Días restantes',      value: `${lotteryInfo.daysLeft} días`, inline: true },
        { name: '📝 Reglas', value: '• Solo un número por persona\n• El premio se deposita en el banco del ganador\n• Si nadie acierta, no hay ganador', inline: false }
      )
      .setColor('#ffd700')
      .setFooter({ text: `Lotería termina: ${lotteryInfo.endDate.toLocaleDateString('es-ES')}` });

    return await interaction.reply({ embeds: [embed] });
  }

  // ── /leaderboard ──
  if (interaction.commandName === 'leaderboard') {
    const economyData = database.getEconomy();
    const sortedUsers = Object.entries(economyData)
      .filter(([, userData]) => userData && (userData.money > 0 || userData.bank > 0) && !userData.isBot)
      .sort(([,a], [,b]) => (b.money + (b.bank || 0)) - (a.money + (a.bank || 0)))
      .slice(0, 10);

    if (sortedUsers.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('📊 Tabla de Clasificaciones')
        .setDescription('No hay datos de economía aún. ¡Sé el primero en trabajar o hacer un crimen para aparecer en el leaderboard!')
        .addFields({ name: '💡 Para empezar', value: 'Usa `/work` o `K!work` para ganar tus primeros Khronidas', inline: false })
        .setColor('#0099ff');
      return await interaction.reply({ embeds: [embed] });
    }

    let leaderboard = '';
    for (let i = 0; i < sortedUsers.length; i++) {
      const [userId, userData] = sortedUsers[i];
      const totalMoney = userData.money + (userData.bank || 0);
      const position   = i + 1;
      const medal      = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
      try {
        const user = await client.users.fetch(userId);
        leaderboard += `${medal} **${user.username}** - ${economy.formatNumber(totalMoney)} Khronidas\n`;
      } catch {
        leaderboard += `${medal} Usuario desconocido - ${economy.formatNumber(totalMoney)} Khronidas\n`;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('📊 Tabla de Clasificaciones')
      .setDescription(`**TOP ${sortedUsers.length} USUARIOS POR DINERO TOTAL**\n\n${leaderboard}`)
      .addFields(
        { name: '💰 Criterio',          value: 'Dinero en mano + Banco', inline: true },
        { name: '👥 Total registrados', value: `${Object.keys(economyData).length} usuarios`, inline: true }
      )
      .setColor('#ffd700')
      .setFooter({ text: 'Solo se muestran usuarios con dinero > 0' });

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // ── /empresa ──
  if (interaction.commandName === 'empresa') {
    const userId  = interaction.user.id;
    const action  = interaction.options.getString('accion');
    const cantidad = interaction.options.getString('cantidad');

    if (action === 'info') {
      if (!companies.hasCompany(userId)) {
        return await interaction.reply({ content: 'No tienes una empresa. Compra el item "Tu propia empresa" en la tienda y úsalo para crear una.', ephemeral: true });
      }

      const company      = companies.getCompany(userId);
      const creationDate = new Date(company.creationDate).toLocaleDateString('es-ES');
      let ceosText = Array.isArray(company.ceos)
        ? company.ceos.map(id => `<@${id}>`).join(', ')
        : company.ceo ? `<@${company.ceo}>` : 'Desconocido';

      const embed = new EmbedBuilder()
        .setTitle('🏢 Información de tu Empresa')
        .setDescription(`Detalles completos de **${company.name}**`)
        .addFields(
          { name: '🏢 Nombre',          value: `**${company.name}**`, inline: true },
          { name: '🔧 Tipo',            value: `**${company.type}**`, inline: true },
          { name: '👤 CEO(s)',          value: ceosText, inline: true },
          { name: '💰 Fondos',          value: `${economy.formatNumber(company.money)} Khronidas`, inline: true },
          { name: '📅 Fecha Creación',  value: creationDate, inline: true },
          { name: '📊 Estado',          value: 'Activa', inline: true },
          { name: '💡 Comandos Disponibles', value: '• `/empresa depositar [cantidad]` - Depositar dinero\n• `/empresa sacar [cantidad]` - Retirar dinero\n• `/empresa info` - Ver información', inline: false }
        )
        .setColor('#1e90ff')
        .setFooter({ text: `Empresa compartida entre ${Array.isArray(company.ceos) ? company.ceos.length : 1} CEO(s)` });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (action === 'leaderboard') {
      const allCompanies  = database.getCompanies();
      const companiesList = Object.entries(allCompanies)
        .sort(([,a], [,b]) => b.money - a.money)
        .slice(0, 10);

      if (companiesList.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('🏢 Leaderboard de Empresas')
          .setDescription('No hay empresas registradas aún.')
          .addFields({ name: '💡 ¿Cómo crear una empresa?', value: 'Compra el item "Tu propia empresa" en la tienda (`/store`) y úsalo con `/item-use`', inline: false })
          .setColor('#ff6b6b');
        return await interaction.reply({ embeds: [embed] });
      }

      let leaderboard = '';
      for (let i = 0; i < companiesList.length; i++) {
        const [ownerId, companyData] = companiesList[i];
        const position = i + 1;
        const medal    = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;

        let ceosText = '';
        try {
          if (Array.isArray(companyData.ceos)) {
            const names = [];
            for (const ceoId of companyData.ceos) {
              try { names.push((await client.users.fetch(ceoId)).username); }
              catch { names.push('Usuario desconocido'); }
            }
            ceosText = names.join(' & ');
          } else if (companyData.ceo) {
            ceosText = (await client.users.fetch(companyData.ceo)).username;
          }
        } catch {
          ceosText = 'Usuario desconocido';
        }

        leaderboard += `${medal} **${companyData.name}** - ${economy.formatNumber(companyData.money)} Khronidas\n`;
        leaderboard += `   └ *CEO(s): ${ceosText}* | *Tipo: ${companyData.type}*\n\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle('🏢 Leaderboard de Empresas')
        .setDescription(`**TOP ${companiesList.length} EMPRESAS POR FONDOS**\n\n${leaderboard}`)
        .addFields(
          { name: '💰 Criterio',          value: 'Ordenado por fondos totales de la empresa', inline: true },
          { name: '📊 Total de empresas', value: `${Object.keys(allCompanies).length}`, inline: true }
        )
        .setColor('#ffd700')
        .setFooter({ text: 'Solo se muestran las top 10 empresas' });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (action === 'depositar') {
      if (!companies.hasCompany(userId)) {
        return await interaction.reply({ content: 'No tienes una empresa. Compra el item "Tu propia empresa" en la tienda y úsalo para crear una.', ephemeral: true });
      }
      if (!cantidad) {
        return await interaction.reply({ content: 'Debes especificar una cantidad para depositar.', ephemeral: true });
      }

      const company      = companies.getCompany(userId);
      const currentMoney = safeNumber(economy.getBalance(userId));
      let depositAmount;

      if (cantidad.toLowerCase() === 'all') {
        depositAmount = currentMoney;
      } else {
        depositAmount = safeNumber(parseInt(cantidad));
        if (depositAmount <= 0) return await interaction.reply({ content: 'Cantidad inválida. Usa un número positivo o "all".', ephemeral: true });
      }

      if (currentMoney <= 0) return await interaction.reply({ content: 'No tienes dinero en mano para depositar.', ephemeral: true });
      if (depositAmount > currentMoney) return await interaction.reply({ content: `No tienes suficiente dinero en mano. Tienes ${economy.formatNumber(currentMoney)} Khronidas.`, ephemeral: true });

      economy.setBalance(userId, currentMoney - depositAmount);
      companies.addCompanyMoney(userId, depositAmount);

      const updatedCompany = companies.getCompany(userId);

      const embed = new EmbedBuilder()
        .setTitle('💰 Depósito Exitoso')
        .setDescription(`Has depositado **${economy.formatNumber(depositAmount)} Khronidas** en ${company.name}`)
        .addFields(
          { name: '🏢 Empresa',           value: company.name, inline: true },
          { name: '💵 Cantidad Depositada', value: `${economy.formatNumber(depositAmount)} Khronidas`, inline: true },
          { name: '🏦 Fondos de la Empresa', value: `${economy.formatNumber(updatedCompany.money)} Khronidas`, inline: true },
          { name: '💰 Tu dinero restante', value: `${economy.formatNumber(economy.getBalance(userId))} Khronidas`, inline: true }
        )
        .setColor('#00ff00')
        .setFooter({ text: 'Los fondos han sido transferidos exitosamente' });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (action === 'sacar') {
      if (!companies.hasCompany(userId)) {
        return await interaction.reply({ content: 'No tienes una empresa. Compra el item "Tu propia empresa" en la tienda y úsalo para crear una.', ephemeral: true });
      }
      if (!cantidad) {
        return await interaction.reply({ content: 'Debes especificar una cantidad para retirar.', ephemeral: true });
      }

      const company = companies.getCompany(userId);
      let withdrawAmount;

      if (cantidad.toLowerCase() === 'all') {
        withdrawAmount = safeNumber(company.money);
      } else {
        withdrawAmount = safeNumber(parseInt(cantidad));
        if (withdrawAmount <= 0) return await interaction.reply({ content: 'Cantidad inválida. Usa un número positivo o "all".', ephemeral: true });
      }

      if (safeNumber(company.money) <= 0) return await interaction.reply({ content: 'La empresa no tiene fondos para retirar.', ephemeral: true });
      if (withdrawAmount > safeNumber(company.money)) return await interaction.reply({ content: `La empresa no tiene suficientes fondos. Tiene ${economy.formatNumber(company.money)} Khronidas.`, ephemeral: true });

      const currentMoney = safeNumber(economy.getBalance(userId));
      companies.removeCompanyMoney(userId, withdrawAmount);
      economy.setBalance(userId, currentMoney + withdrawAmount);

      const updatedCompany = companies.getCompany(userId);

      const embed = new EmbedBuilder()
        .setTitle('💸 Retiro Exitoso')
        .setDescription(`Has retirado **${economy.formatNumber(withdrawAmount)} Khronidas** de ${company.name}`)
        .addFields(
          { name: '🏢 Empresa',           value: company.name, inline: true },
          { name: '💵 Cantidad Retirada', value: `${economy.formatNumber(withdrawAmount)} Khronidas`, inline: true },
          { name: '🏦 Fondos restantes',  value: `${economy.formatNumber(updatedCompany.money)} Khronidas`, inline: true },
          { name: '💰 Tu dinero actual',  value: `${economy.formatNumber(economy.getBalance(userId))} Khronidas`, inline: true }
        )
        .setColor('#ff9900')
        .setFooter({ text: 'Los fondos han sido transferidos exitosamente' });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (action === 'daily') {
      if (!companies.hasCompany(userId)) {
        return await interaction.reply({ content: 'No tienes una empresa. Compra el item "Tu propia empresa" en la tienda y úsalo para crear una.', ephemeral: true });
      }

      const company  = companies.getCompany(userId);
      const cooldown = economy.checkCooldown(userId, 'daily');

      if (cooldown > 0) {
        const hours = Math.ceil(cooldown / 3600000);
        return await interaction.reply({ content: `Ya reclamaste tus ingresos diarios. Debes esperar ${hours} hora(s) antes de poder reclamarlos de nuevo.`, ephemeral: true });
      }

      const allCompanies    = database.getCompanies();
      const companiesList   = Object.entries(allCompanies).sort(([,a],[,b]) => b.money - a.money);
      const companyPosition = companiesList.findIndex(([id]) => id === userId) + 1;

      let dailyEarnings, positionText;
      if (companyPosition === 1)      { dailyEarnings = 7000; positionText = '🥇 Top 1'; }
      else if (companyPosition === 2) { dailyEarnings = 5600; positionText = '🥈 Top 2'; }
      else if (companyPosition === 3) { dailyEarnings = 4000; positionText = '🥉 Top 3'; }
      else                            { dailyEarnings = 2000; positionText = `#${companyPosition}`; }

      const rawDailyEarnings = dailyEarnings;
      const netDailyEarnings = safeNumber(realezas.applyRealezaTax(userId, rawDailyEarnings));
      const realezaTax       = rawDailyEarnings - netDailyEarnings;

      companies.addCompanyMoney(userId, netDailyEarnings);
      economy.setCooldown(userId, 'daily');

      const updatedCompany = companies.getCompany(userId);

      const embed = new EmbedBuilder()
        .setTitle('💰 Ingresos Diarios Reclamados')
        .setDescription(`**${company.name}** ha generado sus ingresos diarios basados en su posición en el mercado.`)
        .addFields(
          { name: '🏢 Empresa',                   value: `**${company.name}**`, inline: true },
          { name: '📊 Posición Actual',           value: positionText, inline: true },
          { name: '💵 Ingresos brutos',           value: `${economy.formatNumber(rawDailyEarnings)} Khronidas`, inline: true },
          { name: '👑 Impuesto de Realeza', value: realezaTax > 0 ? `-${economy.formatNumber(realezaTax)} Khronidas` : 'Sin realeza', inline: true },
          { name: '💰 Ingresos netos',            value: `${economy.formatNumber(netDailyEarnings)} Khronidas`, inline: true },
          { name: '🏦 Fondos Totales',            value: `${economy.formatNumber(updatedCompany.money)} Khronidas`, inline: true },
          { name: '⏰ Próximo Reclamo',           value: 'En 24 horas', inline: true },
          { name: '📈 Mejora tu Posición',        value: 'Invierte más fondos para subir en el ranking y obtener mayores ingresos diarios', inline: false }
        )
        .setColor('#00ff00')
        .setFooter({ text: 'Los ingresos diarios se basan en tu posición en el leaderboard' });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (action === 'taxes') {
      if (!companies.hasCompany(userId)) {
        return await interaction.reply({ content: 'No tienes una empresa. Compra el item "Tu propia empresa" en la tienda y úsalo para crear una.', ephemeral: true });
      }

      const company = companies.getCompany(userId);

      if (companies.areTaxesPaused()) {
        const embed = new EmbedBuilder()
          .setTitle('⏸️ Sistema de Impuestos Empresariales')
          .setDescription(`Estado de impuestos para **${company.name}**`)
          .addFields(
            { name: '🏢 Empresa',              value: `**${company.name}**`, inline: true },
            { name: '🏦 Fondos Actuales',      value: `${economy.formatNumber(company.money)} Khronidas`, inline: true },
            { name: '⏸️ Estado del Sistema',   value: '**IMPUESTOS PAUSADOS**', inline: true },
            { name: '💡 Información',          value: 'Los impuestos empresariales están temporalmente pausados. No se acumularán deudas ni habrá bancarrotas por impuestos durante este período.', inline: false },
            { name: '📊 Beneficios Durante la Pausa', value: '• No se generan deudas fiscales\n• No hay riesgo de bancarrota por impuestos\n• Las empresas pueden operar sin preocupaciones fiscales\n• Los fondos actuales permanecen intactos', inline: false }
          )
          .setColor('#00ff00')
          .setFooter({ text: 'Los impuestos se reanudarán cuando se reactive el sistema' });
        await interaction.reply({ embeds: [embed] });
        return;
      }

      const companyId    = companies.getCompanyId(userId);
      if (!companies.companyTaxes[companyId]) {
        companies.companyTaxes[companyId] = { totalDebt: 0, lastTaxDate: Date.now(), weeksSinceLastPayment: 0, creationDate: Date.now() };
        database.saveCompanyTaxes();
      }

      const taxData     = companies.companyTaxes[companyId];
      const allCompanies = database.getCompanies();
      const companiesList = Object.entries(allCompanies).sort(([,a],[,b]) => b.money - a.money);
      const position     = companiesList.findIndex(([id]) => id === companyId) + 1;
      const weeklyTax    = companies.calculateWeeklyTax(companyId);

      const embed = new EmbedBuilder()
        .setTitle('💰 Sistema de Impuestos Empresariales')
        .setDescription(`Estado de impuestos para **${company.name}**`)
        .addFields(
          { name: '📊 Posición en Ranking', value: `#${position}`, inline: true },
          { name: '🏦 Fondos Actuales',     value: `${economy.formatNumber(company.money)} Khronidas`, inline: true },
          { name: '💸 Impuesto Semanal',    value: `${economy.formatNumber(weeklyTax)} Khronidas (${position === 1 ? '35%' : position === 2 ? '27%' : position <= 5 ? '20%' : '500k fijo'})`, inline: true },
          { name: '💰 Deuda Total',         value: `${economy.formatNumber(taxData.totalDebt)} Khronidas`, inline: true },
          { name: '📅 Semanas sin Pagar',   value: `${taxData.weeksSinceLastPayment}/3 semanas`, inline: true },
          { name: '⏰ Estado',              value: taxData.totalDebt === 0 ? '✅ Al día' : taxData.weeksSinceLastPayment >= 2 ? '🚨 CRÍTICO' : '⚠️ Con deuda', inline: true },
          { name: '📊 Sistema de Impuestos', value: '• Top 1: 35% de fondos semanalmente\n• Top 2: 27% de fondos semanalmente\n• Top 3-5: 20% de fondos semanalmente\n• Top 6+: 500,000 Kh fijo semanalmente\n• Si no pagas en 3 semanas: bancarrota automática', inline: false }
        )
        .setColor(taxData.totalDebt === 0 ? '#00ff00' : taxData.weeksSinceLastPayment >= 2 ? '#ff0000' : '#ffaa00')
        .setFooter({ text: taxData.weeksSinceLastPayment >= 2 ? '¡EMPRESA EN PELIGRO DE BANCARROTA!' : 'Usa /empresa pay-taxes para pagar' });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (action === 'pay-taxes') {
      if (!companies.hasCompany(userId)) {
        return await interaction.reply({ content: 'No tienes una empresa. Compra el item "Tu propia empresa" en la tienda y úsalo para crear una.', ephemeral: true });
      }
      if (companies.areTaxesPaused()) {
        return await interaction.reply({ content: '⏸️ **IMPUESTOS PAUSADOS** - No hay deudas que pagar ya que el sistema de impuestos empresariales está temporalmente pausado.', ephemeral: true });
      }

      const company   = companies.getCompany(userId);
      const companyId = companies.getCompanyId(userId);

      if (!companies.companyTaxes[companyId]) {
        companies.companyTaxes[companyId] = { totalDebt: 0, lastTaxDate: Date.now(), weeksSinceLastPayment: 0, creationDate: Date.now() };
        database.saveCompanyTaxes();
      }

      const taxData = companies.companyTaxes[companyId];
      if (taxData.totalDebt === 0) {
        return await interaction.reply({ content: 'Tu empresa no tiene deudas de impuestos pendientes.', ephemeral: true });
      }
      if (!cantidad) {
        return await interaction.reply({ content: `Debes especificar cuánto quieres pagar. Deuda total: ${economy.formatNumber(taxData.totalDebt)} Khronidas\nUsa un número específico o "all" para pagar toda la deuda.`, ephemeral: true });
      }

      let payAmount;
      if (cantidad.toLowerCase() === 'all') {
        payAmount = taxData.totalDebt;
      } else {
        payAmount = safeNumber(parseInt(cantidad));
        if (payAmount <= 0) return await interaction.reply({ content: 'Cantidad inválida. Usa un número positivo o "all".', ephemeral: true });
      }

      if (payAmount > safeNumber(company.money)) {
        return await interaction.reply({ content: `Tu empresa no tiene suficientes fondos. Tiene ${economy.formatNumber(company.money)} Khronidas y la deuda es ${economy.formatNumber(taxData.totalDebt)} Khronidas.`, ephemeral: true });
      }

      const actualPaid       = companies.payCompanyTax(userId, payAmount);
      companies.removeCompanyMoney(userId, actualPaid);

      const updatedCompany  = companies.getCompany(userId);
      const updatedTaxData  = companies.companyTaxes[companyId];

      const embed = new EmbedBuilder()
        .setTitle('💰 Impuestos Empresariales Pagados')
        .setDescription(`**${company.name}** ha pagado impuestos por ${economy.formatNumber(actualPaid)} Khronidas`)
        .addFields(
          { name: '💸 Cantidad Pagada',  value: `${economy.formatNumber(actualPaid)} Khronidas`, inline: true },
          { name: '💰 Deuda Restante',   value: `${economy.formatNumber(updatedTaxData.totalDebt)} Khronidas`, inline: true },
          { name: '🏦 Fondos Restantes', value: `${economy.formatNumber(updatedCompany.money)} Khronidas`, inline: true },
          { name: '📅 Estado',           value: updatedTaxData.totalDebt === 0 ? '✅ Completamente al día' : `⚠️ ${updatedTaxData.weeksSinceLastPayment} semanas con deuda`, inline: true }
        )
        .setColor(updatedTaxData.totalDebt === 0 ? '#00ff00' : '#ffaa00')
        .setFooter({ text: updatedTaxData.totalDebt === 0 ? '¡Empresa libre de deudas fiscales!' : 'Continúa pagando para evitar la bancarrota' });

      await interaction.reply({ embeds: [embed] });
      return;
    }
  }

  // ── /realeza ──
  if (interaction.commandName === 'realeza') {
    realezas.handleRealezaCommand(interaction, client);
    return;
  }

  // ── /matrimonio ──
  if (interaction.commandName === 'matrimonio') {
    marriages.handleMarriageCommand(interaction, client);
    return;
  }

  // ── /impuestos ──
  if (interaction.commandName === 'impuestos') {
    const userId  = interaction.user.id;
    const action  = interaction.options.getString('accion');
    const cantidad = interaction.options.getString('cantidad');

    if (action === 'info') {
      const taxInfo    = userTaxes.getUserTaxInfo(userId);
      const totalMoney = safeNumber(economy.getBalance(userId)) + safeNumber(economy.getBankBalance(userId));

      let isExempt = false;
      try {
        const member = await interaction.guild.members.fetch(userId);
        isExempt = userTaxes.isUserExempt(member);
      } catch {}

      const embed = new EmbedBuilder()
        .setTitle('💰 Sistema de Impuestos Ciudadanos')
        .setDescription(`Estado de impuestos para ${interaction.user.username}`)
        .addFields(
          { name: '💎 Tu dinero total',    value: `${economy.formatNumber(totalMoney)} Khronidas`, inline: true },
          { name: '💸 Impuesto semanal',   value: totalMoney < 500 ? `1,000 Khronidas (Fijo)` : `${economy.formatNumber(taxInfo.weeklyTax)} Khronidas (2%)`, inline: true },
          { name: '💰 Deuda total',        value: `${economy.formatNumber(taxInfo.totalDebt)} Khronidas`, inline: true },
          { name: '📅 Semanas con deuda',  value: `${taxInfo.weeksSinceLastPayment} semanas`, inline: true },
          { name: '⏰ Estado',             value: isExempt ? '✅ Exento' : taxInfo.totalDebt === 0 ? '✅ Al día' : '⚠️ Con deuda', inline: true },
          { name: '📊 Próximo cobro',      value: 'Domingos automáticamente', inline: true },
          { name: '💡 Sistema de Impuestos', value: '• Todos los ciudadanos pagan impuestos\n• Usuarios con menos de 500 Khronidas: 1,000 fijo\n• Usuarios con más de 500 Khronidas: 2% del total\n• Los impuestos se cobran automáticamente los domingos\n• Algunos roles están exentos', inline: false }
        )
        .setColor(isExempt ? '#00ff00' : taxInfo.totalDebt === 0 ? '#00ff00' : '#ffaa00')
        .setFooter({ text: isExempt ? 'Tienes roles que te eximen de impuestos' : 'Usa /impuestos pagar para pagar manualmente' });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (action === 'pagar') {
      const taxInfo = userTaxes.getUserTaxInfo(userId);

      if (taxInfo.totalDebt === 0) {
        return await interaction.reply({ content: 'No tienes deudas de impuestos pendientes.', ephemeral: true });
      }
      if (!cantidad) {
        return await interaction.reply({ content: `Debes especificar cuánto quieres pagar. Deuda total: ${economy.formatNumber(taxInfo.totalDebt)} Khronidas\nUsa un número específico o "all" para pagar toda la deuda.`, ephemeral: true });
      }

      let payAmount;
      if (cantidad.toLowerCase() === 'all') {
        payAmount = taxInfo.totalDebt;
      } else {
        payAmount = safeNumber(parseInt(cantidad));
        if (payAmount <= 0) return await interaction.reply({ content: 'Cantidad inválida. Usa un número positivo o "all".', ephemeral: true });
      }

      const currentMoney = safeNumber(economy.getBalance(userId));
      if (payAmount > currentMoney) {
        return await interaction.reply({ content: `No tienes suficiente dinero en mano. Tienes ${economy.formatNumber(currentMoney)} Khronidas y necesitas ${economy.formatNumber(payAmount)} Khronidas.`, ephemeral: true });
      }

      const actualPaid       = userTaxes.payUserTax(userId, payAmount);
      economy.setBalance(userId, currentMoney - actualPaid);

      const updatedTaxInfo = userTaxes.getUserTaxInfo(userId);

      const embed = new EmbedBuilder()
        .setTitle('💰 Impuestos Ciudadanos Pagados')
        .setDescription(`Has pagado ${economy.formatNumber(actualPaid)} Khronidas en impuestos`)
        .addFields(
          { name: '💸 Cantidad pagada',  value: `${economy.formatNumber(actualPaid)} Khronidas`, inline: true },
          { name: '💰 Deuda restante',   value: `${economy.formatNumber(updatedTaxInfo.totalDebt)} Khronidas`, inline: true },
          { name: '💎 Tu dinero restante', value: `${economy.formatNumber(economy.getBalance(userId))} Khronidas`, inline: true },
          { name: '📅 Estado',           value: updatedTaxInfo.totalDebt === 0 ? '✅ Completamente al día' : `⚠️ ${updatedTaxInfo.weeksSinceLastPayment} semanas con deuda`, inline: true }
        )
        .setColor(updatedTaxInfo.totalDebt === 0 ? '#00ff00' : '#ffaa00')
        .setFooter({ text: updatedTaxInfo.totalDebt === 0 ? '¡Libre de deudas fiscales!' : 'Continúa pagando para estar al día' });

      await interaction.reply({ embeds: [embed] });
      return;
    }
  }

  // ── /collect-taxes ──
  if (interaction.commandName === 'collect-taxes') {
    if (!interaction.member || !interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: 'Solo los administradores pueden usar este comando.', ephemeral: true });
    }

    await interaction.deferReply();

    try {
      const result = await userTaxes.collectUserTaxes(client);

      const embed = new EmbedBuilder()
        .setTitle('💰 Cobro de Impuestos Ciudadanos')
        .setDescription('Proceso de cobro de impuestos completado')
        .addFields(
          { name: '💸 Total cobrado',       value: `${economy.formatNumber(result.totalCollected)} Khronidas`, inline: true },
          { name: '👥 Usuarios procesados', value: `${result.usersProcessed}`, inline: true },
          { name: '📅 Fecha',               value: new Date().toLocaleDateString('es-ES'), inline: true },
          { name: '💡 Información',         value: 'Los impuestos se cobran automáticamente los domingos. Este comando permite cobrar manualmente.', inline: false }
        )
        .setColor('#00ff00')
        .setFooter({ text: `Ejecutado por ${interaction.user.username}` });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error cobrando impuestos:', error);
      await interaction.editReply({ content: 'Error al procesar el cobro de impuestos. Inténtalo de nuevo.' });
    }
    return;
  }

  // ── /bot-retirar ──
  if (interaction.commandName === 'bot-retirar') {
    const requiredRoleId = '1387188650084925490';
    if (!interaction.member || !interaction.member.roles.cache.has(requiredRoleId)) {
      return await interaction.reply({ content: 'No tienes permiso para usar este comando. Se requiere un rol específico.', ephemeral: true });
    }

    const amount     = interaction.options.getString('cantidad');
    const currentBank = safeNumber(economy.getBotBankBalance());

    if (currentBank <= 0) {
      return await interaction.reply({ content: `El banco del bot está vacío. Tiene ${economy.formatNumber(currentBank)} Khronidas.`, ephemeral: true });
    }

    let withdrawAmount;
    if (amount.toLowerCase() === 'all') {
      withdrawAmount = currentBank;
    } else {
      withdrawAmount = safeNumber(parseInt(amount));
      if (withdrawAmount <= 0) return await interaction.reply({ content: 'Cantidad inválida. Usa un número positivo o "all".', ephemeral: true });
      if (withdrawAmount > currentBank) return await interaction.reply({ content: `El banco del bot no tiene suficiente dinero. Tiene ${economy.formatNumber(currentBank)} Khronidas.`, ephemeral: true });
    }

    const currentMoney = safeNumber(economy.getBotMoney());
    economy.setBotBankBalance(currentBank - withdrawAmount);
    economy.setBotMoney(currentMoney + withdrawAmount);

    const embed = new EmbedBuilder()
      .setTitle('🏦 Retiro del Banco del Bot')
      .setDescription(`Has retirado **${economy.formatNumber(withdrawAmount)} Khronidas** del banco del bot`)
      .addFields(
        { name: '💸 Cantidad retirada',  value: `${economy.formatNumber(withdrawAmount)} Khronidas`, inline: true },
        { name: '🏦 Banco del bot',      value: `${economy.formatNumber(economy.getBotBankBalance())} Khronidas`, inline: true },
        { name: '💰 En mano del bot',    value: `${economy.formatNumber(economy.getBotMoney())} Khronidas`, inline: true }
      )
      .setColor('#0099ff')
      .setFooter({ text: `Operación realizada por ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // ── /bot-ingresar ──
  if (interaction.commandName === 'bot-ingresar') {
    const requiredRoleId = '1387188650084925490';
    if (!interaction.member || !interaction.member.roles.cache.has(requiredRoleId)) {
      return await interaction.reply({ content: 'No tienes permiso para usar este comando. Se requiere un rol específico.', ephemeral: true });
    }

    const amount      = interaction.options.getString('cantidad');
    const currentMoney = safeNumber(economy.getBotMoney());

    if (currentMoney <= 0) {
      return await interaction.reply({ content: `El bot no tiene dinero en mano para ingresar. Tiene ${economy.formatNumber(currentMoney)} Khronidas.`, ephemeral: true });
    }

    let depositAmount;
    if (amount.toLowerCase() === 'all') {
      depositAmount = currentMoney;
    } else {
      depositAmount = safeNumber(parseInt(amount));
      if (depositAmount <= 0) return await interaction.reply({ content: 'Cantidad inválida. Usa un número positivo o "all".', ephemeral: true });
      if (depositAmount > currentMoney) return await interaction.reply({ content: `El bot no tiene suficiente dinero en mano. Tiene ${economy.formatNumber(currentMoney)} Khronidas.`, ephemeral: true });
    }

    const currentBank = safeNumber(economy.getBotBankBalance());
    economy.setBotMoney(currentMoney - depositAmount);
    economy.setBotBankBalance(currentBank + depositAmount);

    const embed = new EmbedBuilder()
      .setTitle('💰 Depósito al Banco del Bot')
      .setDescription(`Has ingresado **${economy.formatNumber(depositAmount)} Khronidas** al banco del bot`)
      .addFields(
        { name: '💸 Cantidad ingresada', value: `${economy.formatNumber(depositAmount)} Khronidas`, inline: true },
        { name: '🏦 Banco del bot',      value: `${economy.formatNumber(economy.getBotBankBalance())} Khronidas`, inline: true },
        { name: '💰 En mano del bot',    value: `${economy.formatNumber(economy.getBotMoney())} Khronidas`, inline: true }
      )
      .setColor('#00ff00')
      .setFooter({ text: `Operación realizada por ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // ── /bot-dar ──
  if (interaction.commandName === 'bot-dar') {
    const requiredRoleId = '1387188650084925490';
    if (!interaction.member || !interaction.member.roles.cache.has(requiredRoleId)) {
      return await interaction.reply({ content: 'No tienes permiso para usar este comando. Se requiere un rol específico.', ephemeral: true });
    }

    const targetUser   = interaction.options.getUser('usuario');
    const amount       = interaction.options.getString('cantidad');
    const currentMoney = safeNumber(economy.getBotMoney());

    if (targetUser.bot) {
      return await interaction.reply({ content: 'No puedes dar dinero a un bot.', ephemeral: true });
    }
    if (currentMoney <= 0) {
      return await interaction.reply({ content: `El bot no tiene dinero en mano para dar. Tiene ${economy.formatNumber(currentMoney)} Khronidas.`, ephemeral: true });
    }

    let giveAmount;
    if (amount.toLowerCase() === 'all') {
      giveAmount = currentMoney;
    } else {
      giveAmount = safeNumber(parseInt(amount));
      if (giveAmount <= 0) return await interaction.reply({ content: 'Cantidad inválida. Usa un número positivo o "all".', ephemeral: true });
      if (giveAmount > currentMoney) return await interaction.reply({ content: `El bot no tiene suficiente dinero en mano. Tiene ${economy.formatNumber(currentMoney)} Khronidas.`, ephemeral: true });
    }

    const targetCurrentMoney = safeNumber(economy.getBalance(targetUser.id));
    economy.setBotMoney(currentMoney - giveAmount);
    economy.setBalance(targetUser.id, targetCurrentMoney + giveAmount);

    const embed = new EmbedBuilder()
      .setTitle('🎁 Transferencia del Bot')
      .setDescription(`El bot ha dado **${economy.formatNumber(giveAmount)} Khronidas** a ${targetUser.username}`)
      .addFields(
        { name: '💸 Cantidad dada',              value: `${economy.formatNumber(giveAmount)} Khronidas`, inline: true },
        { name: '👤 Receptor',                   value: `${targetUser.username}`, inline: true },
        { name: '💰 En mano del bot',            value: `${economy.formatNumber(economy.getBotMoney())} Khronidas`, inline: true },
        { name: '🎁 Nuevo balance del receptor', value: `${economy.formatNumber(economy.getBalance(targetUser.id))} Khronidas`, inline: true }
      )
      .setColor('#ff69b4')
      .setFooter({ text: `Operación realizada por ${interaction.user.username}` });

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // ── /active-developer ──
  if (interaction.commandName === 'active-developer') {
    if (!interaction.member || !interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: 'Solo los administradores pueden usar este comando.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('🔰 Active Developer Badge')
      .setDescription('¡Comando ejecutado exitosamente!')
      .addFields(
        { name: '🎯 Propósito',          value: 'Este comando permite a los desarrolladores obtener la insignia de Active Developer de Discord.', inline: false },
        { name: '🤖 Estado del Bot',     value: `✅ En línea y funcionando\n🏃 Uptime: ${Math.floor(process.uptime())} segundos\n🔗 Conectado a Discord`, inline: false },
        { name: '⚙️ Información Técnica', value: `📊 Servidores: ${client.guilds ? client.guilds.cache.size : 0}\n👥 Usuarios: ${client.users ? client.users.cache.size : 0}\n🕐 Timestamp: ${new Date().toISOString()}`, inline: false },
        { name: '🎉 Insignia',           value: 'Si eres elegible, la insignia aparecerá en tu perfil dentro de 24 horas.', inline: false }
      )
      .setColor('#5865F2')
      .setFooter({ text: `Ejecutado por ${interaction.user.username} | Bot: ${client.user.username}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    console.log(`🔰 Comando Active Developer ejecutado por ${interaction.user.username} (${interaction.user.id})`);
    await interaction.reply({ embeds: [embed] });
    return;
  }

  // ── /advertment ──
  if (interaction.commandName === 'advertment') {
    const ADVERTMENT_ROLES = ['1387194078512283768', '1387188689729486990', '1387188650084925490'];
    const memberRoles = interaction.member?.roles?.cache;
    const hasRole = ADVERTMENT_ROLES.some(id => memberRoles?.has(id));
    if (!hasRole) {
      return await interaction.reply({ content: 'Insuficiente.', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('usuario');
    const razon      = interaction.options.getString('razon');
    const now        = Date.now();
    const modUser    = interaction.user;

    const warnings = database.getWarnings();
    if (!warnings[targetUser.id]) warnings[targetUser.id] = [];
    warnings[targetUser.id].push({
      reason:      razon,
      date:        now,
      modUsername: modUser.username,
      modId:       modUser.id
    });
    database.saveWarnings();

    const dd = String(new Date(now).getDate()).padStart(2, '0');
    const mm = String(new Date(now).getMonth() + 1).padStart(2, '0');
    const yy = String(new Date(now).getFullYear()).slice(-2);
    const dateStr = `${dd}/${mm}/${yy}`;

    const totalWarns = warnings[targetUser.id].length;

    const embed = new EmbedBuilder()
      .setTitle('Advertencia registrada')
      .addFields(
        { name: 'Usuario',       value: `${targetUser.username} (${targetUser.id})`, inline: true },
        { name: 'Responsable',   value: modUser.username,                            inline: true },
        { name: 'Fecha',         value: dateStr,                                     inline: true },
        { name: 'Razon',         value: razon,                                       inline: false },
        { name: 'Total de advertencias', value: `${totalWarns}`,                    inline: true }
      )
      .setColor('#2b2d31');

    await interaction.reply({ embeds: [embed] });

    try {
      const notifyUser = await client.users.fetch('1489327642456100954');
      const dmEmbed = new EmbedBuilder()
        .setTitle(`Advertencias de ${targetUser.username}`)
        .setDescription(`1. ${dateStr} — ${modUser.username}: ${razon}`)
        .addFields({ name: 'Total', value: `${totalWarns}`, inline: true })
        .setColor('#2b2d31');
      await notifyUser.send({ content: 'Mino minino, tenemos nueva advertencia 🦐', embeds: [dmEmbed] });
    } catch {}

    return;
  }

  // ── /lecture ──
  if (interaction.commandName === 'lecture') {
    const LECTURE_ROLE = '1498802042238664834';
    const memberRoles = interaction.member?.roles?.cache;
    console.log(`[lecture] user=${interaction.user.id} roles=${memberRoles ? [...memberRoles.keys()].join(',') : 'null'} hasRole=${memberRoles?.has(LECTURE_ROLE)}`);
    if (!memberRoles?.has(LECTURE_ROLE)) {
      return await interaction.reply({ content: 'Insuficiente.', ephemeral: true });
    }

    const targetUser = interaction.options.getUser('usuario');
    const warnings   = database.getWarnings();
    const userWarns  = warnings[targetUser.id] || [];

    if (userWarns.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle(`Advertencias de ${targetUser.username}`)
        .setDescription('Este usuario no tiene advertencias registradas.')
        .setColor('#2b2d31');
      return await interaction.reply({ embeds: [embed] });
    }

    const lines = userWarns.map((w, i) => {
      const d  = new Date(w.date);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yy = String(d.getFullYear()).slice(-2);
      return `${i + 1}. ${dd}/${mm}/${yy} — ${w.modUsername}: ${w.reason}`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`Advertencias de ${targetUser.username}`)
      .setDescription(lines)
      .addFields({ name: 'Total', value: `${userWarns.length}`, inline: true })
      .setColor('#2b2d31');

    await interaction.reply({ embeds: [embed] });
    return;
  }

  // ── /veredict ──
  if (interaction.commandName === 'veredict') {
    const VEREDICT_ROLE = '1498802042238664834';
    if (!interaction.member?.roles?.cache?.has(VEREDICT_ROLE)) {
      return await interaction.reply({ content: 'Insuficiente.', ephemeral: true });
    }

    const mentions = `<@&1387188650084925490> <@&1387188689729486990>`;
    await interaction.reply({ content: `${mentions} ${interaction.user.username} ha hecho un veredicto.`, allowedMentions: { roles: ['1387188650084925490', '1387188689729486990'] } });
    return;
  }

  // ── /restart-bot ──
  if (interaction.commandName === 'restart-bot') {
    if (!interaction.member || !interaction.member.permissions.has('Administrator')) {
      return await interaction.reply({ content: 'Solo los administradores pueden reiniciar el bot.', ephemeral: true });
    }

    await interaction.reply({ content: '🔄 Reiniciando bot... Guardando datos y reconectando en unos segundos.', ephemeral: false });
    console.log(`🔄 Bot reiniciado manualmente por ${interaction.user.username}`);

    database.saveAllData();
    setTimeout(() => { process.exit(0); }, 900000000);
    return;
  }
});

// ─────────────────────────────────────────────
// HTTP SERVER (Koyeb)
// ─────────────────────────────────────────────
const PORT  = process.env.PORT || 8000;
const express = require('express');
const app   = express();

app.use(express.json());

app.get('/', (req, res) => {
  const isHealthy = client.isReady() && client.user;
  res.status(isHealthy ? 200 : 503).json({
    name:        '🎭 Kareth Discord Bot',
    status:      client.user ? 'Online' : 'Offline',
    guilds:      client.guilds ? client.guilds.cache.size : 0,
    users:       client.users ? client.users.cache.size : 0,
    uptime:      process.uptime(),
    timestamp:   new Date().toISOString(),
    healthy:     isHealthy,
    nextRestart: new Date(Date.now() + (14 * 60 * 1000)).toISOString()
  });
});

app.get('/health', (req, res) => {
  const isHealthy = client.isReady() && client.user;
  res.status(isHealthy ? 200 : 503).json({
    status:      isHealthy ? 'healthy' : 'unhealthy',
    uptime:      process.uptime(),
    timestamp:   new Date().toISOString(),
    botReady:    client.isReady(),
    nextRestart: new Date(Date.now() + (14 * 60 * 1000)).toISOString()
  });
});

app.post('/restart', (req, res) => {
  res.status(200).json({ message: 'Reinicio manual iniciado' });
  console.log('🔄 Reinicio manual solicitado via HTTP');
  database.saveAllData();
  setTimeout(() => { process.exit(1); }, 1000);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Kareth Bot HTTP Server running on port ${PORT} for Koyeb`);
  console.log(`🎭 Bot preparing to connect to Discord...`);
});

// ─────────────────────────────────────────────
// Saves!!!!
// ─────────────────────────────────────────────
setInterval(() => {
  console.log('💾 Guardado automático de seguridad...');
  database.saveAllData();
}, 5 * 60 * 1000);

process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
  console.log('💾 Guardando datos antes de crash...');
  database.saveAllData();
  setTimeout(() => { process.exit(1); }, 1000);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Promesa rechazada:', reason);
  console.log('💾 Guardando datos de emergencia...');
  database.saveAllData();
});

process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM recibido, cerrando bot...');
  database.saveAllData();
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);