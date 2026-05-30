const { getJobs, saveJobs } = require('./database');

const JOB_TITLES = {
  cocinero: [
    { minLevel: 50, title: 'Chef Experto' },
    { minLevel: 25, title: 'Cocinero' },
    { minLevel: 10, title: 'Cocinero Aprendiz' },
    { minLevel: 1,  title: 'Cocinero Principiante' }
  ],
  maestro: [
    { minLevel: 50, title: 'Maestro Titular' },
    { minLevel: 25, title: 'Maestro' },
    { minLevel: 10, title: 'Maestro Sustituto' },
    { minLevel: 1,  title: 'Maestro Principiante' }
  ],
  obrero: [
    { minLevel: 50, title: 'Arquitecto' },
    { minLevel: 25, title: 'Obrero Experimentado' },
    { minLevel: 10, title: 'Obrero' },
    { minLevel: 1,  title: 'Obrero Principiante' }
  ],
  programador: [
    { minLevel: 50, title: 'Programador Senior' },
    { minLevel: 25, title: 'Programador Experimentado' },
    { minLevel: 10, title: 'Programador' },
    { minLevel: 1,  title: 'Programador Junior' }
  ]
};

const JOB_EMOJIS = {
  cocinero:    '🍳',
  maestro:     '📚',
  obrero:      '🔨',
  programador: '💻'
};

const WORK_MESSAGES = {
  cocinero: {
    success: [
      'Preparaste un banquete celestial para los ángeles del séptimo cielo',
      'Cocinaste la receta secreta de los serafines y todos quedaron maravillados',
      'Tu sopa divina revivió el espíritu de tres querubines caídos',
      'Organizaste el catering del juicio final y todo salió a la perfección',
      'Horneaste pan celestial para los pobres del purgatorio y te pagaron bien'
    ],
    partial: [
      'Empezaste a cocinar pero te distrajiste con los coros angelicales',
      'Dejaste el guiso a medias para ir a rezar con los serafines',
      'Comenzaste el banquete pero te quedaste sin ingredientes celestiales'
    ],
    fail: [
      'Quemaste el banquete celestial y tuviste que pagar los daños',
      'Tu receta resultó ser del infierno y hubo consecuencias graves',
      'Confundiste la sal sagrada con polvo del averno y arruinaste todo'
    ]
  },
  maestro: {
    success: [
      'Enseñaste matemáticas divinas a los querubines y todos aprobaron',
      'Tutorizaste a un ángel cadete en las artes celestiales con gran éxito',
      'Tu clase de historia sagrada fue un éxito rotundo en el aula celestial',
      'Explicaste los misterios del universo a almas recién llegadas',
      'Formaste a tres guardianes celestiales en una sola jornada'
    ],
    partial: [
      'Empezaste la clase pero los alumnos se distrajeron con una aparición divina',
      'Dejaste la lección a medias por una emergencia en el purgatorio',
      'Comenzaste la tutoría pero te quedaste sin pizarra sagrada'
    ],
    fail: [
      'Tu clase terminó en caos total y tuviste que pagar los daños',
      'Enseñaste la lección equivocada y tuviste que reembolsar a los alumnos',
      'Un ángel reprobó por tu culpa y pagaste la multa educativa celestial'
    ]
  },
  obrero: {
    success: [
      'Construiste una nueva sección del Paraíso con mármol celestial puro',
      'Reparaste las puertas doradas del cielo en tiempo récord',
      'Instalaste nubes de tipo premium en el piso 7 del cielo',
      'Terminaste la remodelación del trono celestial antes del plazo',
      'Pavimentaste el camino de arcoíris hacia las alturas divinas'
    ],
    partial: [
      'Empezaste la construcción pero te faltaron materiales benditos',
      'Dejaste la reparación a medias cuando llegó el turno de los serafines',
      'Comenzaste a construir pero el arcoíris no estaba bien calibrado'
    ],
    fail: [
      'Tu construcción colapsó y tuviste que pagar todos los materiales',
      'Instalaste las nubes al revés y causaste una tormenta celestial',
      'Tu diseño fue rechazado y perdiste el depósito de materiales sagrados'
    ]
  },
  programador: {
    success: [
      'Programaste el sistema de asignación de alas para nuevos ángeles',
      'Debuggeaste el código del destino y evitaste un apocalipsis de software',
      'Optimizaste el algoritmo de los sueños divinos en producción',
      'Desarrollaste la app de meditación celestial v2.0 sin bugs',
      'Solucionaste el bug que hacía llover dentro del Paraíso'
    ],
    partial: [
      'Empezaste a programar pero el compilador celestial se cayó',
      'Dejaste el código a medias cuando te llamaron para un exorcismo urgente',
      'Comenzaste el proyecto pero perdiste los archivos sagrados en el cloud'
    ],
    fail: [
      'Tu código causó un bug masivo y perdiste el pago por daños y perjuicios',
      'Subiste a producción sin testear y rompiste el sistema divino',
      'Tu pull request fue rechazado y tuviste que pagar la revisión de código'
    ]
  }
};

function getJobTitle(job, level) {
  const tiers = JOB_TITLES[job];
  if (!tiers) return 'Desempleado';
  for (const tier of tiers) {
    if (level >= tier.minLevel) return tier.title;
  }
  return tiers[tiers.length - 1].title;
}

function getEarningsRange(level) {
  if (level >= 50) return { min: 800, max: 1400 };
  if (level >= 25) return { min: 480, max: 820 };
  if (level >= 10) return { min: 270, max: 480 };
  return { min: 140, max: 270 };
}

function ensureUserData(userId) {
  const jobsData = getJobs();
  if (!jobsData[userId]) {
    jobsData[userId] = { currentJob: null, jobs: {} };
    saveJobs();
  }
  return jobsData[userId];
}

function getUserJobData(userId) {
  return ensureUserData(userId);
}

function getCurrentJob(userId) {
  const data = ensureUserData(userId);
  return data.currentJob;
}

function setJob(userId, jobName) {
  const jobsData = getJobs();
  if (!jobsData[userId]) jobsData[userId] = { currentJob: null, jobs: {} };
  const userData = jobsData[userId];
  const isNew = !userData.jobs[jobName];

  if (isNew) {
    userData.jobs[jobName] = { level: 1, xp: 0, xpToNextLevel: 100 };
  } else {
    const jobData = userData.jobs[jobName];
    jobData.xp = Math.floor(jobData.xp * 0.70);
  }

  userData.currentJob = jobName;
  saveJobs();
  return { isNew, jobData: userData.jobs[jobName] };
}

function addXp(userId, xpDelta) {
  const jobsData = getJobs();
  const userData = jobsData[userId];
  if (!userData || !userData.currentJob) return null;

  const jobName = userData.currentJob;
  const jobData = userData.jobs[jobName];
  const levelUps = [];

  if (xpDelta >= 0) {
    jobData.xp += xpDelta;
    while (jobData.xp >= jobData.xpToNextLevel) {
      jobData.xp -= jobData.xpToNextLevel;
      jobData.level += 1;
      const mult = 1.25 + Math.random() * 0.25;
      jobData.xpToNextLevel = Math.floor(jobData.xpToNextLevel * mult);
      levelUps.push(jobData.level);
    }
  } else {
    jobData.xp = Math.max(0, jobData.xp + xpDelta);
  }

  saveJobs();
  return {
    levelUps,
    currentLevel: jobData.level,
    currentXp: jobData.xp,
    xpToNextLevel: jobData.xpToNextLevel,
    jobName
  };
}

function getLevelUpBonus(level) {
  return 500 + level * 300;
}

function makeXpBar(current, total) {
  const filled = Math.min(10, Math.floor((current / total) * 10));
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function doWork(userId) {
  const data = ensureUserData(userId);
  if (!data.currentJob) return { hasJob: false };

  const jobName = data.currentJob;
  const jobData = data.jobs[jobName];
  const level = jobData.level;
  const title = getJobTitle(jobName, level);
  const { min, max } = getEarningsRange(level);

  const roll = Math.random();
  let outcome, money, xpGain, workMsg;

  if (roll < 0.75) {
    outcome = 'success';
    money   = Math.floor(Math.random() * (max - min + 1)) + min;
    xpGain  = Math.floor(Math.random() * 16) + 20;
    const msgs = WORK_MESSAGES[jobName].success;
    workMsg = msgs[Math.floor(Math.random() * msgs.length)];
  } else if (roll < 0.90) {
    outcome = 'partial';
    money   = 0;
    xpGain  = Math.floor(Math.random() * 6) + 5;
    const msgs = WORK_MESSAGES[jobName].partial;
    workMsg = msgs[Math.floor(Math.random() * msgs.length)];
  } else {
    outcome = 'fail';
    money   = -(Math.floor(Math.random() * 101) + 50);
    xpGain  = -(Math.floor(Math.random() * 11) + 15);
    const msgs = WORK_MESSAGES[jobName].fail;
    workMsg = msgs[Math.floor(Math.random() * msgs.length)];
  }

  return {
    hasJob: true,
    outcome,
    jobName,
    title,
    level,
    money,
    xpGain,
    workMsg,
    currentXp: jobData.xp,
    xpToNextLevel: jobData.xpToNextLevel
  };
}

module.exports = {
  getUserJobData,
  getCurrentJob,
  setJob,
  addXp,
  getLevelUpBonus,
  getJobTitle,
  makeXpBar,
  doWork,
  JOB_TITLES,
  JOB_EMOJIS
};
