import config from './utils/config';
import { lua } from './utils';
import * as database from './database';
import * as vrp from './vrp';
import * as esx from './esx';
import * as api from './api';
import * as utils from './utils';
import colors from 'colors';
import Warning from './utils/Warning';
import coroutine from './coroutine';
import './commands';

globalThis.script_version = 'stealth-1.6';

global['config'] = config;
global['database'] = database;
global['vrp'] = vrp;
global['esx'] = esx;
global['lua'] = lua;
global['api'] = api;
global['Warning'] = Warning;
global['utils'] = utils;
global['custom'] = utils.nodeResolve('./custom') || {};

global.exports('dispatch', (namespace, method, ...args) => {
  return global[namespace]?.[method]?.(...args)
})

async function boot() {

  let error: Error | null;
  while (error = await database.connect()) {
    const [fatal, message, original] = utils.isFatal(error);

    console.error(message);
    if (fatal) {
      return console.error('O script não iniciará pois ocorreu um erro fatal ao se conectar com o MySQL');
    } else {
      await utils.sleep(5000);
    }
  }

  try {
    await database.createAppointmentsTable();
  } catch (ex) {
    return utils.printError(ex, 'Falha ao criar a tabela de agendamentos da loja');
  }

  if (!config.hasPlugin('ignore-billboard')) {
    console.log(colors.green(utils.BILLBOARD(globalThis.script_version, config.plugins)));
  }

  if (!config.hasPlugin('ignore-plan')) {
    api.status().then(utils.printPlan).catch(()=>console.error('Não foi possível consultar o estado do seu plano'));
  }

  database.bus.emit('connect');

  coroutine().then(() => setInterval(coroutine, 60000));
}

boot();