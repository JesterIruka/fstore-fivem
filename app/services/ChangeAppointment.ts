import * as database from '../database';
import * as utils from '../utils';

export default class ChangeAppointment {

  static async execute(source: number, args: any[]) {
    const [from, to] = args;
    if (from && to) {
      await database.sql(`UDPATE fstore_appointments SET command=REPLACE(command, '"${from}"', '"${to}"')`);
      utils.emitSuccess(source, `Você transferiu todos os agendamentos do id ${from} para o id ${to}`);
    }
  }
}