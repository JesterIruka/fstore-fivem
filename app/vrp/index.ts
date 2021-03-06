import * as api from '../api';
import { sql, pluck, insert, getDatatable, setDatatable, after, tables, queryFields, replaceInto, firstTable } from '../database';
import config, { hasPlugin } from '../utils/config';
import Warning from '../utils/Warning';
import { firstAvailableNumber } from '../utils';
import * as homesMonitor from './homes_permissions';
if (hasPlugin('ids-monitor'))
  import('./ids_monitor');
import('./intelisense');

const { snowflake } = config;
const now = () => Math.floor(Date.now() / 1000);

const vRP = new Proxy<{ [key:string]: any|Function }>({ $promises:{}, $last:0 }, {
  get(self, field: string) {
    return self[field] || (self[field] = (...args) => {
      args = args.map(a => {
        if (typeof a === 'string' && !isNaN(Number(a))) return Number(a);
        else return a;
      });
      if (hasPlugin('vrp-old')) args=[args];
      api.addWebhookBatch('```[VRP]: '+`vRP.${field}(${args.map(a=>JSON.stringify(a)).join(',')})`+'```');
      const wait = field[0]!='_';
      if (wait) {
        const id = ++self.$last;
        return new Promise((resolve,reject) => {
          self.$promises[id]={resolve,reject};
          emit('vRP:proxy', field, args, '4C8BA250', id);
          setTimeout(() => {
            if (id in self.$promises) reject('Took more than 5 seconds');
          }, 5000);
        });
      }
      emit('vRP:proxy', field.replace(/^_/,''), args, '4C8BA250', -1);
      return Promise.resolve();
    });
  }
});

on('vRP:4C8BA250:proxy_res', (rid,rval) => {
  const promise = vRP.$promises[rid];
  if (promise) promise.resolve(...rval);
  delete vRP.$promises[rid];
});

globalThis.vRP = vRP;

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
  const columns = await queryFields(config.snowflake.priority);

  const data:any = {};
  const set = async (fields:any[], generator:Function) => {
    const f = columns.find(e=>fields.includes(e));
    if (f) data[f] = await generator(f);
  }
  await set(['user_id', 'passport'], ()=>id);
  await set(['steam', 'license'], v=>findIdentifier(id, v));
  await set(['priority', 'prioridade'], ()=>level);
  if (hasPlugin('@bronx99')) data.id = await findIdentifier(id, 'steam');
  if (hasPlugin('@trustcity')) data.id = id;

  if (hasPlugin('@crypto')) {
    const [row] = await sql("SELECT priority FROM vrp_priority WHERE steam=?", [data.steam], true);
    if (row) {
      return sql('UPDATE vrp_priority SET priority=? WHERE steam=?', [row.priority + level, data.steam]);
    }
  }
  return replaceInto(config.snowflake.priority, data);
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
  value = Number(value);
  if (await isOnline(id)) {
    if (hasPlugin('@skycity'))
      return vRP.darDinheiro(id, value);

    const old = await vRP.getBankMoney(id);
    await vRP.giveBankMoney(id, value);
    const now = await vRP.getBankMoney(id);
    api.addWebhookBatch('```Saldo antigo: '+old+'\nSaldo novo: '+now+'```');
  } else {
    if (hasPlugin('@sx'))
      return sql('UPDATE vrp_user_identities SET banco=banco+? WHERE user_id=?', [value, id]); 
    if (hasPlugin('@asgardcity', 'creative2'))
      return sql('UPDATE vrp_users SET bank=bank+? WHERE id=?', [value, id]);
    else if (hasPlugin('@southrp'))
      return sql('UPDATE vrp_user_infos SET bank=bank+? WHERE user_id=?', [value, id]);
    else if (tables().includes('vrp_characters'))
      return sql('UPDATE vrp_characters SET bank=bank+? WHERE user_id=?', [value, id]) 
    return sql('UPDATE vrp_user_moneys SET bank=bank+? WHERE user_id=?', [value, id]);
  }
}
export const bank = addBank;

export async function removeBank(id, value) {
  value = Number(value);
  if (await isOnline(id)) {
    return vRP.setBankMoney(id, await vRP.getBankMoney(id) - value);
  } else {
    if (hasPlugin('@asgardcity', 'creative2'))
      return sql('UPDATE vrp_users SET bank=bank-? WHERE id=?', [value, id]);
    else if (hasPlugin('@southrp'))
      return sql('UPDATE vrp_user_infos SET bank=bank+? WHERE user_id=?', [value, id]);
    return sql('UPDATE vrp_user_moneys SET bank=bank-? WHERE user_id=?', [value, id]);
  }
}

export async function addWallet(id, value) {
  if (await isOnline(id)) {
    return vRP.giveMoney(id, value);
  } else {
    if (hasPlugin('@southrp'))
      return sql('UPDATE vrp_user_infos SET wallet=wallet+? WHERE user_id=?', [value, id]);
    return sql('UPDATE vrp_user_moneys SET wallet=wallet+? WHERE user_id=?', [value, id]);
  }
}
export const money = addWallet;

export async function addCoin(id, value) {
  if (await isOnline(id)) {
    return vRP.giveBankCoin(id, value);
  } else {
    return sql('UPDATE vrp_user_moneys SET coins=coins+? WHERE user_id=?', [value, id]);
  }
}

export async function addGroup(id, group) {
  if (tables().includes('vrp_permissions'))
    return insert('vrp_permissions', { user_id: id, permiss: group });
    
  if (await isOnline(id)) {
    if (hasPlugin('@skycity'))
      return vRP.adicionarGrupo(id, group);

    return vRP.addUserGroup(id, group);
  } else if (hasPlugin('@southrp')) {
    return vRP.manageCharacterGroup(id, true, group);
  } else if (hasPlugin('creative3')) {
    const [row] = await sql("SELECT groups FROM vrp_users WHERE id=?", [id]);
    if (row) {
      row.groups = JSON.parse(row.groups);
      if (Array.isArray(row.groups)) row.groups = { [group]:true };
      else row.groups[group] = true;
      return sql("UPDATE vrp_users SET groups=? WHERE id=?", [JSON.stringify(row.groups), id]);
    } else return new Warning("Jogador não encontrado");
  } else if (hasPlugin('identity_vip')) {
    return sql('UPDATE vrp_user_identities SET vip=? WHERE user_id=?', [group, id])
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
  if (tables().includes('vrp_permissions'))
    return sql(`DELETE FROM vrp_permissions WHERE user_id=? AND permiss=?`, [id, group]);
  if (await isOnline(id)) {
    return vRP.removeUserGroup(id, group);
  } else if (hasPlugin('@southrp')) {
    return vRP.manageCharacterGroup(id, false, group);
  } else if (hasPlugin('creative3')) {
    const [row] = await sql("SELECT groups FROM vrp_users WHERE id=?", [id]);
    if (row) {
      row.groups = JSON.parse(row.groups);
      delete row.groups[group];
      return sql("UPDATE vrp_users SET groups=? WHERE id=?", [JSON.stringify(row.groups), id]);
    } else return new Warning("Jogador não encontrado");
  } else if (hasPlugin('identity_vip')) {
    return sql('UPDATE vrp_user_identities SET vip=null WHERE user_id=?', [id])
  } else {
    const dvalue = await getDatatable(id);
    if (dvalue) {
      if (Array.isArray(dvalue.groups) || dvalue.groups == null) dvalue.groups = {};
      else delete dvalue.groups[group];
      return setDatatable(id, dvalue);
    } else {
      console.error('Não foi possível encontrar o dvalue para o jogador ' + id);
    }
  }
}
export const ungroup = removeGroup;

export async function addTemporaryGroup(days, id, group) {
  if (hasPlugin('creative3')) {
    await sql("UPDATE vrp_users SET vip_time=? WHERE id=?", [now()+86400*days, id]);
  }
  await after(days, `vrp.removeGroup("${id}", "${group}")`);
  return addGroup(id, group);
}

export async function getName(id): Promise<string | null | undefined> {
  if (hasPlugin('summerz')) {
    const [row] = await sql('SELECT * FROM summerz_characters WHERE id=?', [id]);
    if (row) {
      return row.name+' '+row.name2;
    } else return undefined;
  }
  const utable = firstTable('vrp_characterdata', 'vrp_user_infos', 'identities', 'vrp_characters', 'vrp_user_identities')
  if (utable) {
    const [row] = await sql(`SELECT * FROM ${utable} WHERE user_id=?`, [id]);
    if (row) {
      return (row.name??row.nome??row.firstname)+' '+(row.lastname??row.sobrenome??row.name2??row.firstname)
    } else return undefined;
  }
  const [row] = await sql(`SELECT * FROM vrp_users WHERE id=?`, [id]);
  return row ? (row.name||row.nome||row.firstname)+' '+(row.lastname||row.sobrenome||row.name2||row.firstname) : undefined;
}
export async function getId(source) {
  return vRP.getUserId(source);
}
export async function getSource(id) {
  return vRP.getUserSource(id);
}
export async function isOnline(id) {
  const source = await getSource(id);
  return Number.isInteger(source);
}
export function hasPermission(id, permission): Promise<boolean> {
  return vRP.hasPermission(id, permission);
}

function comandorj_plate() {
  const letters = 'QWERTYUIOPASDFGHJKLZXCVBNM'.split('');
  const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const r = a => a[Math.floor(a.length * Math.random())];

  return 'NNLLLNNN'.replace(/[NL]/g, (str) => r(str==='N' ? numbers : letters));
}

export async function addTemporaryVehicles(days, id, spawns, fields: Object = {}) {
  await after(days, `vrp.removeTemporaryVehicles("${id}", ${JSON.stringify(spawns)})`);
  return addVehicles(id, spawns, { ...fields, _days:days });
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

export async function addVehicle(id, spawn, extra: any = {}) {
  if (hasPlugin('vrp_admin')) {
    return ExecuteCommand(`addcar ${id} ${spawn}`);
  }
  const fields = await queryFields(config.snowflake.vehicles);

  const field = ['model','vehicle','veiculo'].find(s => fields.includes(s));
  if (!field) {
    return new Warning('Campo de veículo não suportado');
  }

  const [row] = await sql(`SELECT * FROM ${config.snowflake.vehicles} WHERE user_id=? AND ${field}=?`, [id, spawn], true);
  if (row) {
    if (fields.includes('premiumtime') && extra.days) {
      await sql(`UPDATE ${config.snowflake.vehicles} SET premiumtime = premiumtime+? WHERE user_id=? AND ${field}=?`, [extra.days*86400, id, spawn])
    }
    return new Warning('Este jogador já possui esse veículo');
  } else {
    const data: Record<string, any> = { user_id: id };
    data[field] = spawn;
    if (hasPlugin('@centralroleplay')) {
      const [old] = await sql(`SELECT vtype FROM fstore_helper WHERE spawn=?`, [spawn], true);
      data.veh_type = old ? old.vtype : 'car';

      const [udata] = await sql(`SELECT registration FROM vrp_user_identities WHERE user_id=?`, [id], true);
      data.vehicle_plate = 'P ' + udata.registration;
    }
    if (fields.includes('ipva')) data.ipva = now();
    if (fields.includes('phone')) {
      if (tables().includes('vrp_characters')) {
        const [row] = await sql("SELECT phone FROM vrp_characters WHERE user_id=?", [id]);
        data.phone = row.phone;
      } else if ((await queryFields('vrp_users')).includes('phone')) {
        const [row] = await sql("SELECT phone FROM vrp_users WHERE id=?", [id]);
        data.phone = row.phone;
      } else {
        const [row] = await sql('SELECT phone FROM vrp_user_identities WHERE user_id=?', [id]);
        data.phone = row.phone;
      }
    }
    if (hasPlugin('@americandream')) data.can_sell = 0;
    if (fields.includes('trunk')) data.trunk = '[]';
    if (fields.includes('placa')) data.placa = comandorj_plate();
    if (fields.includes('premiumtime') && extra._days) data.premiumtime = now() + 86400 * extra._days;
    if (fields.includes('plate')) {
      const plates = await pluck(`SELECT plate FROM ${config.snowflake.vehicles}`, 'plate');
      let plate = comandorj_plate();
      while (plates.includes(plate)) plate = comandorj_plate();
      data.plate = plate;
    }
    for (let [k, v] of Object.entries(extra))
      k[0] != '_' && (data[k] = v);
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
  return addVehicle(id, spawn, { ...fields, _days:days });
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
  if (tables().includes('vrp_homes_permissions') || tables().includes('vrp_player_houses'))
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

export async function addTemporaryHome(days, id, house, extra={}) {
  if (tables().includes(snowflake.homes || snowflake.database_prefix+'_homes_permissions')) {
    if (snowflake.homes === 'vrp_mike_users_homes') {
      return addHomePermission(id, house, { ...extra, days })
    }
    return addTemporaryHomePermission(days, id, house, extra);
  }

  await after(days, `vrp.removeHouse("${id}", "${house}")`);
  return addHome(id, house);
}
export const addTemporaryHouse = addTemporaryHome;

export async function addHousePermission(id, prefix, extra: any={}) {
  if (tables().includes('vrp_mike_users_homes')) {
    const [old] = await sql('SELECT nome FROM vrp_mike_users_homes WHERE user_id=? AND nome=?', [id, prefix], true)
    if (old) {
      return sql('UPDATE vrp_mike_users_homes SET expire_home=expire_home+? WHERE user_id=? AND nome=?', [
        extra.days * 86400, id, prefix
      ])
    }

    const [row] = await sql('SELECT interior,apartamento FROM vrp_mike_homes WHERE nome=?', [prefix])
    if (row) {
      const { interior, apartamento } = row
      const data = {
        user_id: id, nome: prefix, interior, apartamento,
        iptu: now(), expire_home: now() + extra.days * 86400
      }

      await insert('vrp_mike_home_permission', { user_id: id, nome: prefix, apartamento })
      return insert('vrp_mike_users_homes', data)
    } else {
      return console.error('Não foi possivel encontrar informacoes sobre a casa '+prefix)
    }
  } else if (snowflake.homes === 'vrp_propriedades') {
    const [old] = await sql('SELECT proprietario FROM vrp_propriedades WHERE id=?', [prefix])
    if (!old) {
      return new Warning('Esta casa não existe')
    } else if (old.proprietario != 0 && old.proprietario != id) {
      return new Warning('Esta casa já pertence a outra pessoa')
    } else if (old.proprietario == id) {
      return
    } else {
      return sql('UPDATE vrp_propriedades SET proprietario=? WHERE id=?', [id, prefix])
    }
  } else if (snowflake.homes === 'core_homes') {
    const [old] = await sql('SELECT user_id FROM core_homes WHERE name=? AND user_id=?', [prefix, id])
    if (old) {
      return
    } else {
      return sql(`INSERT INTO core_homes (name,interior,user_id,tax) VALUES (?,(SELECT interiorType FROM core_residences WHERE name=?),?,?)`, [prefix, prefix, id, now()])
    }
  } else if (snowflake.homes === 'edden_house') {
    return sql('UPDATE edden_house SET owner_id=? WHERE name=?', [id, prefix]);
  } else if (prefix.length > 2) {
    const table = config.snowflake.homes || 'vrp_homes_permissions';
    const fields = await queryFields(table);

    const [row] = await sql(`SELECT user_id,home FROM ${table} WHERE home=? AND owner=1`, [prefix], true);
    if (row) {
      if (row.user_id == id)
        return new Warning('O jogador já possui a casa (Renovando...)');
      else if (!fields.includes('numero'))
        return new Warning(`A casa ${prefix} já está ocupada por um jogador diferente`);
    }
    const data: any = { user_id: id, home: prefix, owner: 1 };
    if (fields.includes('tax')) data.tax = now();
    if (fields.includes('vip')) data.vip = 1;
    if (fields.includes('garage')) data.garage = 1;
    if (fields.includes('numero')) {
      const numeros = await pluck(`SELECT numero FROM ${table} WHERE home=?`, 'numero', [prefix]);
      data.numero = firstAvailableNumber(numeros);
    }
    Object.assign(data, extra)
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
  const table = config.snowflake.homes || 'vrp_homes_permissions'
  if (table === 'vrp_propriedades') {
    return sql('UPDATE vrp_propriedades SET proprietario=0,moradores=? WHERE id=?', ['{}', prefix])
  } else if (table === 'core_homes') {
    return sql('DELETE FROM core_homes WHERE name=? AND user_id=?', [prefix, id])
  } else if (table === 'edden_house') {
    return sql('UPDATE edden_house SET owner_id=null WHERE name=? AND owner_id=?', [prefix, id])
  } else if (prefix.length > 2) {

    const [row] = await sql(`SELECT home FROM ${table} WHERE user_id=? AND home=?`, [id,prefix], true);

    if (row) {
      await homesMonitor.remove(prefix);
      await sql('UPDATE vrp_srv_data SET dvalue=? WHERE dkey LIKE ? OR dkey LIKE ?', ['{}', `%:${prefix}`, `homesVault:%:${prefix}`]);

      return sql('DELETE FROM vrp_homes_permissions WHERE home = ?', [prefix]);
    } else {
      return new Warning('O jogador não tem casa (Ignorando...)');
    }
  }
  return sql('DELETE FROM '+table+' WHERE user_id=? AND home LIKE ?', [id, prefix + '%']);
}
export const removeHomePermission = removeHousePermission;

export async function addTemporaryHomePermission(days, id, prefix, extra={}) {
  await after(days, `vrp.removeHousePermission("${id}", "${prefix}")`);
  return addHousePermission(id, prefix, extra);
}
export const addTemporaryHousePermission = addTemporaryHomePermission;

//
//  OUTROS
//

export async function addItem(id, item, amount = 1) {
  if (await isOnline(id)) {
    return vRP.giveInventoryItem(id, item, amount);
  } else if (hasPlugin('creative3')) {
    const [row] = await sql("SELECT itemlist FROM vrp_user_inventory WHERE user_id=?", [id]);
    if (row) {
      let items = JSON.parse(row.itemlist);
      if (Array.isArray(items)) items={};
      
      if (items[item]) items[item].amount+=amount;
      else items[item] = { amount };

      return sql('UPDATE vrp_user_inventory SET itemlist=? WHERE user_id=?', [JSON.stringify(items), id]);
    } else return new Warning("Não foi encontrado a linha do jogador em vrp_user_inventory");
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
  if (hasPlugin('creative3')) {
    const identifier = await findIdentifier(id, 'license');
    await replaceInto('vrp_users_banned', { user_id:id, hacker:0, identifier });
  } else {
    await sql(`UPDATE vrp_users SET banned=? WHERE id=?`, [value, id]);
  }

  if (value) {
    const source = await getSource(id);
    if (source) {
      DropPlayer(source, 'Ban');
    }
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