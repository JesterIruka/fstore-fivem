import * as db from '../database';
import * as api from '../api';
import config, { hasPlugin } from '../utils/config';

const table = config.snowflake.homes || 'vrp_homes_permissions';
var last = {};

function hasChanges(a = {}, b = {}) {
  for (let k in a) if (a[k] != b[k]) return true;
  for (let k in b) if (b[k] != a[k]) return true;
  return false;
}

export function add(home, user_id) {
  last[home] = user_id;
  return api.addMetadata('homes', { home: user_id });
}

export function remove(home) {
  delete last[home];
  return api.removeMetadata('homes', { home: null });
}

export async function coroutine() {
  const homes = {};

  const rows = await db.sql(`SELECT user_id,home FROM ${table} WHERE owner=1`, [], true);
  for (let { user_id, home } of rows)
    homes[home] = user_id;

  if (hasChanges(homes, last))
    await api.setMetadata('homes', last = homes);
}

db.onConnect(() => {
  db.queryTables().then((tables) => {
    if (tables.includes(table) && !hasPlugin('disable-homes-monitor')) {
      setInterval(coroutine, 10000);
      console.log('Monitorando casas disponíveis em ' + table + '...');
    }
  }).catch(err => console.error(err.message));
});