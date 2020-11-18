import { lua } from '../utils';
import * as api from '../api';
import { sql, pluck, insert, createAppointment, after } from '../database';
import config, { hasPlugin } from '../utils/config';
import Warning from '../utils/Warning';
import { vrp } from '../utils/proxy';

const snowflake = config.snowflake.esx;

export const isOnline = (steam_hex) => lua(`isOnline("${steam_hex}")`);
export const getSource = (steam_hex) => lua(`getSource("${steam_hex}")`);
export const getSteamHex = (source) => lua(`ESX.Players[${source}].identifier`)
export const getLicense = async (steam_hex) => {
  if (hasPlugin('esx-user-identifiers')) {
    const [row] = await sql('SELECT license FROM user_identifiers WHERE identifier=?', [steam_hex]);
    return row ? row.license.split(':')[1] : undefined;
  }
}

export const getName = async (steam_hex) => {
  const [row] = await sql('SELECT firstname,lastname FROM users WHERE identifier=?', [steam_hex]);
  if (row) {
    if (row.firstname && row.lastname) return row.firstname + ' ' + row.lastname;
    else return null;
  }
  else return undefined;
}

export const _baixadaPaulista = async (days, identifier, nivel) => {
  const time = Date.now() + (86400000 * days);
  const data = new Date(time).toISOString().split('T')[0].split('-').reverse().join('/');

  emitNet('esx_vip:checkset', await getSource(identifier), nivel)

  const [old] = await sql('SELECT * FROM vip WHERE identifier=? AND nivel=?', [identifier, nivel]);
  if (old) {
    return sql('UPDATE vip SET `data`=? WHERE identifier=? AND nivel=?', [data, identifier, nivel]);
  }

  return insert('vip', { identifier, data, nivel });
}

export const addTemporaryGroup = async (days, steam_hex, group) => {
  await after(days, `esx.setGroup("${steam_hex}", "${snowflake.default_group}")`);
  return setGroup(steam_hex, group);
}

export const setGroup = async (steam_hex, group) => {
  if (await isOnline(steam_hex))
    return lua(`setGroup("${steam_hex}", "${group}")`)
  else
    return sql('UPDATE users SET group=? WHERE identifier=?', [group, steam_hex]);
}

//steam_hex turn into license hex using esx-user-identifiers
export const addBank = async (steam_hex, value) => {
  if (await isOnline(steam_hex))
    return lua(`addBank("${steam_hex}", ${value})`);
  else {
    if (hasPlugin('esx-user-identifiers')) {
      let [{ accounts }] = await sql('SELECT accounts FROM users WHERE identifier=?', [steam_hex]);
      accounts = JSON.parse(accounts);
      accounts.bank += value;
      accounts = JSON.stringify(accounts);

      return sql('UPDATE users SET accounts=? WHERE identifier=?', [accounts, steam_hex]);
    } else {
      return sql('UPDATE users SET bank=bank+? WHERE identifier=?', [value, steam_hex]);
    }
  }
}

export const addWallet = async (steam_hex, value) => {
  if (await isOnline(steam_hex))
    return lua(`addMoney("${steam_hex}", ${value})`);
  else
    return sql('UPDATE users SET money=money+? WHERE identifier=?', [value, steam_hex]);
}

/*
   Criar um veículo completo
*/

function sample(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generateVehiclePlate() {
  const letters = 'QWERTYUIOPASDFGHJKLZXCVBNM'.split('');
  const numbers = '0123456789'.split('');

  let builder = '';

  for (const c of snowflake.vehicle_plate) {
    if (c === 'A') builder += sample(letters)
    else if (c === '0') builder += sample(numbers);
    else builder += c;
  }

  return builder;
}

function createVehicle(model, plate) {
  return {
    model,
    plate,
    plateIndex: 0,

    bodyHealth: 1000,
    engineHealth: 1000,
    fuelLevel: 100,
    dirtLevel: 0,

    color1: [255, 255, 255],
    color2: [255, 255, 255],

    pearlescentColor: [0, 0, 0],
    wheelColor: [0, 0, 0],
    wheels: 7,
    windowTint: -1,
    neonEnabled: [false, false, false, false],
    extras: {},
    neonColor: [0, 0, 0],
    tyreSmokeColor: [0, 0, 0],
    modSpoilers: -1,
    modFrontBumper: -1,
    modRearBumper: -1,
    modSideSkirt: -1,
    modExhaust: -1,
    modFrame: -1,
    modGrille: -1,
    modHood: -1,
    modFender: -1,
    modRightFender: -1,
    modRoof: -1,
    modEngine: -1,
    modBrakes: -1,
    modTransmission: -1,
    modHorns: -1,
    modSuspension: -1,
    modArmor: -1,
    modTurbo: -1,
    modSmokeEnabled: -1,
    modXenon: -1,
    modFrontWheels: -1,
    modBackWheels: -1,
    modPlateHolder: -1,
    modVanityPlate: -1,
    modTrimA: -1,
    modOrnaments: -1,
    modDashboard: -1,
    modDial: -1,
    modDoorSpeaker: -1,
    modSeats: -1,
    modSteeringWheel: -1,
    modShifterLeavers: -1,
    modAPlate: -1,
    modSpeakers: -1,
    modTrunk: -1,
    modHydrolic: -1,
    modEngineBlock: -1,
    modAirFilter: -1,
    modStruts: -1,
    modArchCover: -1,
    modAerials: -1,
    modTrimB: -1,
    modTank: -1,
    modWindows: -1,
    modLivery: -1
  }
}
/*
   FIM
*/

export const addTemporaryCar = async (days, steam_hex, model, type = 'car') => {
  await after(days, `esx.removeVehicle("${steam_hex}", "${model}")`);
  return addCar(steam_hex, model, type);
}
export const addTemporaryVehicle = addTemporaryCar;

export const addCar = async (steam_hex, model, type = 'car') => {
  const hash = typeof model === 'number' ? model : GetHashKey(model.toLowerCase());

  let plate = generateVehiclePlate();
  while (true) {
    const [old] = await sql(`SELECT plate FROM owned_vehicles WHERE plate=?`, [plate]);
    if (old) plate = generateVehiclePlate()
    else break;
  }

  const data = {
    owner: steam_hex,
    security: 0,
    state: 0,
    plate,
    vehicle: JSON.stringify(createVehicle(hash, plate)),
    type,
    job: '',
    stored: 0,
    vehiclename: 'veiculo',
    price: 0
  }

  await insert('owned_vehicles', data);
}
export const addVehicle = addCar;

export const removeCar = (steam_hex, model) => {
  const hash = typeof model === 'number' ? model : GetHashKey(model.toLowerCase());
  return sql(`DELETE FROM owned_vehicles WHERE owner=? AND vehicle LIKE '%${hash}%'`, [steam_hex]);
}
export const removeVehicle = removeCar;