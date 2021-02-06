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

const script_version = 'stealth-1.2.22';

global['config'] = config;
global['database'] = database;
global['vrp'] = vrp;
global['esx'] = esx;
global['lua'] = lua;
global['api'] = api;
global['Warning'] = Warning;
global['utils'] = utils;
global['custom'] = utils.nodeResolve('./custom') || {};

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

  console.log(colors.green(utils.BILLBOARD(script_version, config.plugins)));

  try {
    utils.printPlan(await api.status());
  } catch (ex) {
    console.error('Não foi possível consultar o estado do seu plano');
  }

  database.bus.emit('connect');

  coroutine().then(() => setInterval(coroutine, 60000));
}

boot();