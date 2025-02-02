const chalk = require('chalk');
const { delay, selectEarlierAvailableDay } = require('./utils');

const getEarlierSpot = async (page) => {
  await page.waitForSelector('#appointments_consulate_appointment_date');
  await delay(2000);
  console.log(chalk.yellow('⌛ Looking for spots avilable for consulate appointment...'));
  const earlierDay = await selectEarlierAvailableDay(page, '#appointments_consulate_appointment_date');
  console.log(chalk.green('✅ Spots found', earlierDay));

  return earlierDay;
};

module.exports = getEarlierSpot;
