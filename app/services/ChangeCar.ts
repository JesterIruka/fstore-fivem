import * as database from '../database';
import * as api from '../api';
import * as utils from '../utils';
import * as vrp from '../vrp';

export default class ChangeCar {

  static async execute(source: number, args: any[]) {
    const [user_id, from, to] = args;
    if (user_id && from && to) {
      const command = `vrp.removeVehicle("${user_id}"%`;
      await database.sql(`UDPATE fstore_appointments SET command=REPLACE(command, '${from}', '${to}') WHERE command LIKE ?`, [command]);
      await vrp.changeCar(user_id, from, to);
      utils.emitSuccess(source, `Você trocou o carro ${from} do jogador ${user_id} para ${to}`);
    }
  }
}