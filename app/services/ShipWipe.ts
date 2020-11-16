import * as database from '../database';
import * as api from '../api';
import * as utils from '../utils';

export default class ShipWipe {

  static async execute(source: number, args: any[]) {
    let commands = await database.pluck('SELECT command FROM fstore_appointments', 'command');
    commands = commands.map(s => s.replace('remove', 'add'));
    api.addWebhookBatch('Ship Wipe');
    for (let cmd of commands) {
      try {
        await eval(cmd);
      } catch (ex) {
        api.addWebhookBatch('Erro: ' + ex.message);
      }
    }
    await api.sendWebhookBatch();
    utils.emitSuccess(source, 'ShipWipe finalizado!');
  }
}