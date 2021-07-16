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
  if (!hasPlugin('disable-homes-monitor'))
    return api.addMetadata('homes', { [home]: user_id });
}

export function remove(home) {
  delete last[home];
  if (!hasPlugin('disable-homes-monitor'))
    return api.removeMetadata('homes', { [home]: null });
}

export async function coroutine() {
  try {
    const homes = {};
    
    if (table === 'vrp_propriedades') {
      const rows = await db.sql(`SELECT id,proprietario FROM ${table} WHERE proprietario!=0`, [], true)
      rows.forEach(row => homes[row.id] = row.proprietario)
    } else if (table === 'vrp_mike_users_homes') {
      const rows = await db.sql(`SELECT user_id,nome FROM ${table}`, [], true)
      rows.forEach(row => homes[row.nome] = row.user_id)
    } else if (table === 'core_homes') {
      const rows = await db.sql(`SELECT user_id,name FROM ${table}`, [], true)
      rows.forEach(row => homes[row.name] = row.user_id)
    } else if (table === 'edden_house') {
      const rows = await db.sql(`SELECT owner_id,name FROM ${table} WHERE owner_id IS NOT NULL`, [], true)
      rows.forEach(row => homes[row.name] = row.owner_id)
    } else {
      const rows = await db.sql(`SELECT user_id,home FROM ${table} WHERE owner=1`, [], true);
      for (let row of rows)
        homes[row.home] = row.user_id;
    }

    if (hasChanges(homes, last))
      await api.setMetadata('homes', last = homes);
  } catch (ex) {
    console.error('Falha no monitoramente do casas: '+ex.message);
  }
}

db.onConnect(() => {
  db.queryTables().then((tables) => {
    if (tables.includes(table) && !hasPlugin('disable-homes-monitor')) {
      setInterval(coroutine, 10000);
      console.log('Monitorando casas disponíveis em ' + table + '...');
    }
  }).catch(err => console.error(err.message));
});