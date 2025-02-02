require('dotenv').config();

const puppeteer = require('puppeteer');
const chalk = require('chalk');

const login = require('./src/login');
const getCurrentAppointmentDate = require('./src/getCurrentAppointmentDate');
const goToRescheduleAppointment =  require('./src/goToRescheduleAppointment');
const getEarlierSpot = require('./src/getEarlierSpot');
const Logger = require('./src/logger');
const { sendMessage, messageTypes } = require('./src/notifications');
const reserveAppointment = require('./src/reserveAppointment');
const timeIsValid = require("./src/timeIsValid");
const setStatus = require("./src/status");
const coolDown = require("./src/coolDown");
const {RestartableError} = require("./src/errors");

const waitingTime = 9;
const logger = new Logger();
let isRunning = false;

const startProcess = async () => {

  if (timeIsValid('05:00:00', '13:00:00')) {
    console.log(chalk.yellow('⌛ Waiting for the next morning...'));
    return;
  }
  if (timeIsValid('16:30:00', '17:30:00') || timeIsValid('19:30:00', '18:30:00')) {
    console.log(chalk.yellow('⌛ Trying to dodge the ban hammer...'));
    return;
  }
  console.log(chalk.yellow('⌛ Starting process at ' + new Date().toLocaleString("en-US", {timeZone: "America/Mexico_City"})));

  console.log(chalk.cyan('✨ Lets start the scrapping...'));
  const browser = await puppeteer.launch({ headless: process.env.NODE_ENV === 'prod' });
  const page = await browser.newPage();
  if (process.env.NODE_ENV === 'dev') {
    await page.setViewport({ width: 1366, height: 900});
  }
  try {
    await page.goto('https://ais.usvisa-info.com/es-mx/niv/users/sign_in');
    await login(page);
    const appointmentDates = await getCurrentAppointmentDate(page);
    await goToRescheduleAppointment(page);
    const earlierDay = await getEarlierSpot(page);
    const isEarlier = new Date(earlierDay) < appointmentDates.consularAppointment && new Date(earlierDay) >= new Date().setDate(new Date().getDate() + 5);

    logger.updateLog(`${new Date().toISOString()}: Current date: ${appointmentDates.consularAppointment.toDateString()}, earlier spot: ${earlierDay}. earlier: ${isEarlier}`);

    isRunning = true;
    if (isEarlier) {
      await sendMessage(messageTypes.SPOT_AVAILABLE, earlierDay);
      await reserveAppointment(page);
    }
  
  } catch (error) {
    isRunning = false;
    console.log(chalk.red(`❌ ${error.message}`));
    if (error instanceof RestartableError) {
      setTimeout(() => {
        startProcess();
      }, 5000);
    }
  } finally {
    if (process.env.NODE_ENV === 'prod') {
      await coolDown(isRunning ? 'running' : 'cooling down');
      setStatus(isRunning ? 'running' : 'cooling down');
      console.log(chalk.blue(`🛑 Closing the browser`));
      console.log(chalk.yellow(`⌛ Scraper will run again in ${waitingTime} minutes`));
      console.log();
      console.log();
      await browser.close();
    }
  }
}

if (process.env.NODE_ENV === 'prod') {
  const intervalTime = 1000 * 60 * waitingTime;
  startProcess();

  setInterval(() => {
    startProcess();
  }, intervalTime);
} else {
  startProcess();
}

