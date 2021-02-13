import { lua } from '../utils';
import * as api from '../api';
import { sql, pluck, insert, getDatatable, setDatatable, after, tables, queryFields } from '../database';
import config, { hasPlugin } from '../utils/config';
import Warning from '../utils/Warning';
import { firstAvailableNumber } from '../utils';
import * as homesMonitor from './homes_permissions';
import('./ids_monitor');
import('./intelisense');

const { snowflake } = config;

const now = () => Math.floor(Date.now() / 1000);

export async function findIdentifier(id, prefix) {
  if (!prefix.endsWith('%')) prefix += '%';
  const [row] = await sql(`SELECT identifier FROM vrp_user_ids WHERE user_id=? AND identifier LIKE ?`, [id, prefix], true);
  return row ? row.identifier : undefined;
}

export async function addTemporaryPriority(days, id, level) {
  await after(days, `vrp.removePriority("${id}")`);
  await addPriority(id, level);
}

export async function addPriority(id, level) {
  if (hasPlugin('@ilharoleplay')) {
    const identifier = await findIdentifier(id, 'steam');
    if (!identifier) return new Warning(`Player "${id}" não possui steam hex para dar prioridade`);
    return insert('vrp_priority', { passport: id, steam: identifier, priority: level });
  }
  if (hasPlugin('@trustcity'))
    return sql(`REPLACE INTO ${config.snowflake.priority || 'vrp_priority'} VALUES (?)`, [id]);

  const field = hasPlugin('@warriors') ? 'license' : 'steam';
  const prefix = hasPlugin('@warriors') ? 'license:%' : 'steam:%';

  const hex = await findIdentifier(id, prefix);
  if (hex) {
    if (hasPlugin('@crypto')) {
      const [row] = await sql("SELECT priority FROM vrp_priority WHERE steam=?", [hex], true);
      if (row) {
        return sql('UPDATE vrp_priority SET priority=? WHERE steam=?', [row.priority + level, hex]);
      }
    }
    const table = config.snowflake.priority || 'vrp_priority';
    return sql(`REPLACE INTO ${table} (${field},priority) VALUES (?,?)`, [hex, level]);
  } else {
    api.addWebhookBatch('```diff\n- Não foi possível encontrar a ' + field + ' de ' + id + '```');
  }
}

export async function removePriority(id) {
  const table = config.snowflake.priority || 'vrp_priority';
  const fields = await queryFields(table);

  if (fields.includes('passport'))
    sql(`DELETE FROM ${table} WHERE passport=?`, [id]);
  else if (fields.includes('id'))
    sql(`DELETE FROM ${table} WHERE id=?`, [id]);
  else if (fields.includes('user_id'))
    sql(`DELETE FROM ${table} WHERE user_id=?`, [id]);

  const field = fields.includes('license') ? 'license' : 'steam';

  const [hex] = await sql("SELECT identifier FROM vrp_user_ids WHERE user_id=? AND identifier LIKE ?", [id, field+':%']);
  if (hex) {
    return sql(`DELETE FROM ${table} WHERE ${field}=?`, [hex.identifier]);
  } else {
    api.addWebhookBatch('```diff\nNão foi possível encontrar ' + field + ' de ' + id + '```');
  }
}

export async function addBank(id, value) {
  if (await isOnline(id)) {
    if (hasPlugin('@skycity'))
      return lua(`vRP.darDinheiro(${id}, ${value})`);
    else if (hasPlugin('@azteca', 'vrp-old')) return lua(`vRP.giveBankMoney({${id}, ${value}})`);

    return lua(`vRP.giveBankMoney(${id}, ${value})`)
  } else {
    if (hasPlugin('@asgardcity'))
      return sql('UPDATE vrp_users SET bank=bank+? WHERE id=?', [value, id]);
    else if (hasPlugin('@southrp'))
      return sql('UPDATE vrp_user_infos SET bank=bank+? WHERE user_id=?', [value, id]);
    return sql('UPDATE vrp_user_moneys SET bank=bank+? WHERE user_id=?', [value, id]);
  }
}
export const bank = addBank;

export async function removeBank(id, value) {
  if (await isOnline(id)) {
    if (hasPlugin('@azteca', 'vrp-old'))
      return lua(`vRP.setBankMoney({${id}, vRP.getBankMoney({${id}}) - ${value} })`);

    return lua(`vRP.setBankMoney(${id}, vRP.getBankMoney(${id}) - ${value})`)
  } else {
    if (hasPlugin('@asgardcity'))
      return sql('UPDATE vrp_users SET bank=bank-? WHERE id=?', [value, id]);
    else if (hasPlugin('@southrp'))
      return sql('UPDATE vrp_user_infos SET bank=bank+? WHERE user_id=?', [value, id]);
    return sql('UPDATE vrp_user_moneys SET bank=bank-? WHERE user_id=?', [value, id]);
  }
}

export async function addWallet(id, value) {
  if (await isOnline(id)) {
    if (hasPlugin('@azteca', 'vrp-old')) return lua(`vRP.giveMoney({${id}, ${value}})`);
    return lua(`vRP.giveMoney(${id}, ${value})`);
  } else {
    if (hasPlugin('@southrp'))
      return sql('UPDATE vrp_user_infos SET wallet=wallet+? WHERE user_id=?', [value, id]);
    return sql('UPDATE vrp_user_moneys SET wallet=wallet+? WHERE user_id=?', [value, id]);
  }
}
export const money = addWallet;

export async function addCoin(id, value) {
  if (await isOnline(id)) {
    return lua(`vRP.giveBankCoin(${id}, ${value})`);
  } else {
    return sql('UPDATE vrp_user_moneys SET coins=coins+? WHERE user_id=?', [value, id]);
  }
}

export async function addGroup(id, group) {
  if (hasPlugin('@raiocity'))
    return insert('vrp_permissions', { user_id: id, permiss: group });
  if (await isOnline(id)) {
    if (hasPlugin('@skycity'))
      return lua(`vRP.adicionarGrupo(${id}, "${group}")`);
    else if (hasPlugin('@azteca', 'vrp-old'))
      return lua(`vRP.addUserGroup({${id}, "${group}"})`);
    return lua(`vRP.addUserGroup(${id}, "${group}")`);
  } else if (hasPlugin('@southrp')) {
    return lua(`vRP.manageCharacterGroup(${id}, true, "${group}")`);
  } else {
    const dvalue = await getDatatable(id);
    if (dvalue) {
      if (Array.isArray(dvalue.groups)) dvalue.groups = {};
      dvalue.groups[group] = true;
      return setDatatable(id, dvalue);
    } else {
      console.error('Não foi possível encontrar o dvalue para o jogador ' + id);
    }
  }
}
export const group = addGroup;

export async function removeGroup(id, group) {
  if (hasPlugin('@raiocity'))
    return sql(`DELETE FROM vrp_permissions WHERE user_id=? AND permiss=?`, [id, group]);
  if (await isOnline(id)) {
    if (hasPlugin('@azteca', 'vrp-old')) return lua(`vRP.removeUserGroup({${id}, "${group}"})`);
    return lua(`vRP.removeUserGroup(${id}, "${group}")`)
  } else if (hasPlugin('@southrp')) {
    return lua(`vRP.manageCharacterGroup(${id}, false, "${group}")`);
  } else {
    const dvalue = await getDatatable(id);
    if (dvalue) {
      if (Array.isArray(dvalue.groups)) dvalue.groups = {};
      delete dvalue.groups[group];
      return setDatatable(id, dvalue);
    } else {
      console.error('Não foi possível encontrar o dvalue para o jogador ' + id);
    }
  }
}
export const ungroup = removeGroup;

export async function addTemporaryGroup(days, id, group) {
  await after(days, `vrp.removeGroup("${id}", "${group}")`);
  return addGroup(id, group);
}

export async function getName(id): Promise<string | null | undefined> {
  if (hasPlugin('@asgardcity')) {
    const [row] = await sql('SELECT * FROM vrp_users WHERE id=?', [id]);
    if (row) {
      return row.name + ' ' + row.name2;
    } else return undefined;
  }
  if (hasPlugin('@southrp')) {
    const [row] = await sql('SELECT * FROM vrp_user_infos WHERE user_id=?', [id]);
    if (row) {
      return (row.name||'')+' '+(row.firstname||'');
    } else return undefined;
  }
  const table = hasPlugin('name_in_vrp_users') ? 'vrp_users' : 'vrp_user_identities';
  const field = hasPlugin('name_in_vrp_users') ? 'id' : 'user_id';
  const [row] = await sql(`SELECT * FROM ${table} WHERE ${field}=?`, [id]);
  if (row) {
    if (row.name !== undefined && row.firstname !== undefined) {
      return row.name + ' ' + row.firstname;
    } else if (row.nome && row.sobrenome) {
      return row.nome + ' ' + row.sobrenome;
    } else return null;
  }
  return undefined;
}
export async function getId(source) {
  if (hasPlugin('@azteca', 'vrp-old')) return lua(`vRP.getUserId({${source}})`);
  else return lua(`vRP.getUserId(${source})`);
}
export async function getSource(id) {
  if (hasPlugin('@azteca', 'vrp-old')) return lua(`vRP.getUserSource({${id}})`);
  return lua(`vRP.getUserSource(${id})`);
}
export async function isOnline(id) {
  if (hasPlugin('@azteca', 'vrp-old')) return lua(`vRP.getUserSource({${id}}) ~= nil`);
  return lua(`vRP.getUserSource(${id}) ~= nil`);
}
export function hasPermission(id, permission): Promise<boolean> {
  return lua(`vRP.hasPermission(${id}, "${permission}")`);
}

//
//  VEÍCULOS
//

function comandorj_plate(letters = 3, numbers = 5) {
  let builder = '';
  const a = 'QWERTYUIOPASDFGHJKLZXCVBNM'.split('');
  const b = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  while (letters > 0 || numbers > 0) {
    if (Math.random() <= 0.5 && letters > 0) {
      builder += a[Math.floor(a.length * Math.random())];
      letters -= 1;
    } else if (numbers > 0) {
      builder += b[Math.floor(b.length * Math.random())];
      numbers -= 1;
    }
  }
  return builder;
}

export async function addTemporaryVehicles(days, id, spawns, fields: Object = {}) {
  await after(days, `vrp.removeTemporaryVehicles("${id}", ${JSON.stringify(spawns)})`);
  return addVehicles(id, spawns, fields);
}
export const addTemporaryCars = addTemporaryVehicles;

export async function addVehicles(id, spawns, fields: Object = {}) {
  let lastWarning: Warning | null = null;
  for (let spawn of spawns) {
    const warning = await addVehicle(id, spawn, fields);
    if (warning instanceof Warning) lastWarning = warning;
  }
  return lastWarning;
}
export const addCars = addVehicles;

export async function addVehicle(id, spawn, extra = {}) {
  if (hasPlugin('vrp_admin')) {
    return ExecuteCommand(`addcar ${id} ${spawn}`);
  }
  const fields = await queryFields(config.snowflake.vehicles);

  const field = fields.includes('model') ? 'model' : 'vehicle';

  const [row] = await sql(`SELECT * FROM ${config.snowflake.vehicles} WHERE user_id=? AND ${field}=?`, [id, spawn], true);
  if (row) return new Warning('Este jogador já possui esse veículo');
  else {
    const data = { user_id: id };
    data[field] = spawn;
    if (hasPlugin('@centralroleplay')) {
      const [old] = await sql(`SELECT vtype FROM fstore_helper WHERE spawn=?`, [spawn], true);
      data['veh_type'] = old ? old.vtype : 'car';

      const [udata] = await sql(`SELECT registration FROM vrp_user_identities WHERE user_id=?`, [id], true);
      data['vehicle_plate'] = 'P ' + udata.registration;
    }
    if (hasPlugin('@crypto') || hasPlugin('ipva')) data['ipva'] = now();
    if (hasPlugin('@americandream')) data['can_sell'] = 0;
    if (hasPlugin('@comandorj', 'vehicle-trunk')) data['trunk'] = '[]';
    if (hasPlugin('@comandorj')) {
      const plates = await pluck(`SELECT plate FROM ${config.snowflake.vehicles}`, 'plate');
      let plate = comandorj_plate();
      while (plates.includes(plate)) plate = comandorj_plate();
      data['plate'] = plate;
    }
    for (let [k, v] of Object.entries(extra)) data[k] = v;
    await insert(config.snowflake.vehicles, data);
  }
}
export const addCar = addVehicle;

export async function removeVehicles(id, spawns) {
  const field = hasPlugin('@comandorj') ? 'model' : 'vehicle';
  return sql(`DELETE FROM ${snowflake.vehicles} WHERE user_id=? AND ${field} IN ?`, [id, spawns]);
}
export const removeCars = removeVehicles;

export async function removeVehicle(id, spawn) {
  const field = hasPlugin('@comandorj') ? 'model' : 'vehicle';
  return sql(`DELETE FROM ${snowflake.vehicles} WHERE user_id=? AND ${field}=?`, [id, spawn]);
}
export const removeCar = removeVehicle;

export async function removeScheduledCars(id) {
  return sql(`UPDATE fstore_appointments SET expires_at=? WHERE \`command\` LIKE 'vrp.removeVehicle("${id}"%`, [new Date()]);
}
export async function removeAllCars(id) {
  return sql(`DELETE FROM ${snowflake.vehicles} WHERE user_id=?`, [id]);
}
export async function addTemporaryVehicle(days, id, spawn, fields = {}) {
  await after(days, `vrp.removeVehicle("${id}", "${spawn}")`);
  return addVehicle(id, spawn, fields);
}
export const addTemporaryCar = addTemporaryVehicle;

export async function changeCar(id, from, to) {
  const field = hasPlugin('@comandorj') ? 'model' : 'vehicle';
  const command = `vrp.removeVehicle("${id}"%`;
  await sql(`UDPATE fstore_appointments SET command=REPLACE(command, '${from}', '${to}') WHERE command LIKE ?`, [command]);
  await sql(`UPDATE ${snowflake.vehicles} SET ${field}=? WHERE ${field}=?`, [to, from]);
  return sql(`DELETE FROM vrp_srv_data WHERE dkey=?`, [`custom:u${id}veh_${from}`]);
}
export async function changeId(from, to) {

}

//
//  CASAS
//

export async function addHouse(id, home) {
  if (tables().includes('vrp_homes_permissions'))
    return addHousePermission(id, home);

  const [row] = await sql("SELECT number FROM vrp_user_homes WHERE user_id=? AND home=?", [id, home], true)
  if (row) return new Warning("Este jogador já possui esta casa");

  let numbers = await pluck("SELECT number FROM vrp_user_homes WHERE home=?", 'number', [home]);
  const number = firstAvailableNumber(numbers);

  const data = { user_id: id, home, number };
  if (hasPlugin('@americandream')) data['can_sell'] = 0;
  if (hasPlugin('home-tax')) data['tax'] = now();

  return insert('vrp_user_homes', data, true);
}
export const addHome = addHouse;

export async function removeHouse(id, house) {
  return sql("DELETE FROM vrp_user_homes WHERE user_id=? AND home=?", [id, house]);
}
export const removeHome = removeHouse;

export async function addTemporaryHome(days, id, house) {
  if (tables().includes(snowflake.homes || snowflake.database_prefix+'_homes_permissions')) {
    return addTemporaryHomePermission(days, id, house);
  }

  await after(days, `vrp.removeHouse("${id}", "${house}")`);
  return addHome(id, house);
}
export const addTemporaryHouse = addTemporaryHome;

export async function addHousePermission(id, prefix) {
  if (prefix.length > 2) {
    const table = config.snowflake.homes || 'vrp_homes_permissions';
    const fields = await queryFields(table);

    const [row] = await sql(`SELECT user_id,home FROM ${table} WHERE home=? AND owner=1`, [prefix], true);
    if (row) {
      if (row.user_id == id)
        return new Warning('O jogador já possui a casa (Renovando...)');
      else if (!fields.includes('numero'))
        return new Warning(`A casa ${prefix} já está ocupada por um jogador diferente`);
    }
    const data: any = { user_id: id, home: prefix, owner: 1, garage: 1 };
    if (fields.includes('tax'))
      data.tax = now();
    if (fields.includes('vip'))
      data.vip = 1;
    if (fields.includes('numero')) {
      const numeros = await pluck(`SELECT numero FROM ${table} WHERE home=?`, 'numero', [prefix]);
      data.numero = firstAvailableNumber(numeros);
    }
    await insert(table, data);
    await homesMonitor.add(prefix, id);
    return prefix;
  }
  /* CASAS ALEATÓRIAS COM PRIMEIRA DISPONIBILIDADE (LEGADO) */
  let occupied = await pluck(`SELECT home FROM vrp_homes_permissions WHERE home LIKE '${prefix}%'`, 'home');
  const higher = firstAvailableNumber(occupied.map(s => parseInt(s.substring(prefix.length))));
  const home = prefix + (higher.toString().padStart(2, '0'));

  const data = { user_id: id, home, owner: 1, garage: 1 };
  if (hasPlugin('@crypto') || hasPlugin('home-tax')) data['tax'] = now();

  await insert('vrp_homes_permissions', data);
  return home;
}
export const addHomePermission = addHousePermission;

export async function removeHousePermission(id, prefix) {
  if (prefix.length > 2) {
    await homesMonitor.remove(prefix);
    await sql('UPDATE vrp_srv_data SET dvalue=? WHERE dkey LIKE ?', ['{}', `%:${prefix}`]);
    return sql('DELETE FROM vrp_homes_permissions WHERE home = ?', [prefix]);
  }
  return sql('DELETE FROM vrp_homes_permissions WHERE user_id=? AND home LIKE ?', [id, prefix + '%']);
}
export const removeHomePermission = removeHousePermission;

export async function addTemporaryHomePermission(days, id, prefix) {
  await after(days, `vrp.removeHousePermission("${id}", "${prefix}")`);
  return addHousePermission(id, prefix);
}
export const addTemporaryHousePermission = addTemporaryHomePermission;

//
//  OUTROS
//

export async function addItem(id, item, amount: number = 1) {
  if (await isOnline(id)) {
    return lua(`vRP.giveInventoryItem(${id}, "${item}", ${amount})`);
  } else {
    const data = await getDatatable(id);
    if (data) {
      if (Array.isArray(data.inventory))
        data.inventory = {};

      if (data.inventory[item] && data.inventory[item].amount) {
        data.inventory[item] = { amount: data.inventory[item].amount + amount };
      } else data.inventory[item] = { amount };
      await setDatatable(id, data);
    }
  }
}
export const addInventory = addItem;

export async function setBanned(id, value) {
  await sql(`UPDATE vrp_users SET banned=? WHERE id=?`, [value, id])

  const source = await getSource(id);
  if (source) {
    DropPlayer(source, 'Ban');
  }
}

export const unban = (id) => setBanned(id, false);
export const ban = (id) => setBanned(id, true);

export async function setWhitelisted(id, value) {
  const fields = await queryFields('vrp_users');
  const field = fields.includes('whitelist') ? 'whitelist' : 'whitelisted';
  return sql(`UPDATE vrp_users SET ${field}=? WHERE id=?`, [value, id]);
}
export const setWhitelist = setWhitelisted;