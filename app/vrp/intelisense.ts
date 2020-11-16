import * as database from '../database';
import { printError } from '../utils';
import config from '../utils/config';

const query = database.queryFields;
const plugins = config.plugins;

database.onConnect(async () => {
  const tables = await database.queryTables();

  const vehicles = await query(config.snowflake.vehicles);

  if (vehicles.includes('ipva') && !plugins.includes('ipva')) {
    plugins.push('ipva');
    console.log('O Plugin "ipva" foi adicionado automaticamente');
  }

  const home_table = config.snowflake.homes || 'vrp_homes_permissions';

  const homes = tables.includes(home_table) ? await query(home_table) : [];

  if (!homes.includes('tax') && !plugins.includes('home-no-tax')) {
    plugins.push('home-no-tax');
    console.log('O Plugin "home-no-tax" foi adicionado automaticamente');
  }
});