import * as database from '../database';
import config from '../utils/config';

const query = database.queryFields;
const plugins = config.plugins;

database.onConnect(async () => {
  const tables = await database.queryTables();

  if (tables.includes('vrp_characterdata')) {
    plugins.push('vrp_characterdata');
  } else if (tables.includes('summerz_characters')) {
    plugins.push('summerz');
  } else if (tables.includes('identities') && tables.includes('users_data')) {
    plugins.push('avg');
  }

  const vehicles = await query(config.snowflake.vehicles);

  if (vehicles.includes('ipva') && !plugins.includes('ipva')) {
    plugins.push('ipva');
    console.log('O Plugin "ipva" foi adicionado automaticamente');
  }

  const home_table = config.snowflake.homes || 'vrp_homes_permissions';

  const homes = tables.includes(home_table) ? await query(home_table) : [];

  if (!homes.includes('tax'))
    plugins.push('home-no-tax');
});