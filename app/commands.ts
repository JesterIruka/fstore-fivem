import config from './utils/config';
import * as proxy from './utils/proxy';
import * as database from './database';
import * as utils from './utils';
import ShipWipe from './services/ShipWipe';
import ChangeCar from './services/ChangeCar';

const shortcuts = {
  shipwipe: ShipWipe,
  trocarcarro: ChangeCar
}

RegisterCommand(config.command || 'fval', async (source, args) => {
  if (source != 0) {
    if (!proxy.isVRP) {
      return utils.emitError(source, 'Este comando só pode ser executados por players em servidores vRP');
    }
    const id = await proxy.getId(source);

    if (!proxy.hasPermission(id, "admin.permissao")) {
      return utils.emitError(source, 'Sem permissão!');
    }
  }

  if (args.length > 0) {
    const key = args[0].toLowerCase();
    if (shortcuts[key]) {
      return shortcuts[key].execute(source, args.splice(1));
    } else {
      try {
        await eval(args.join(' '));
        utils.emitSuccess(source, 'O comando foi executado com sucesso');
      } catch (err) {
        utils.emitError(source, 'Ocorreu um erro ao executar este comando');
        utils.printError(err);
      }
    }
  } else {
    utils.emitError(source, 'Não é possível executar um comando vazio');
  }
});



if (!config.hasPlugin('disable-vip-command')) {
  RegisterCommand('vip', async (source, args) => {
    if (source > 0) {
      const player = await (proxy.isVRP ? proxy.getId(source) : proxy.getSteamHex(source));

      const rows = await database.sql('SELECT * FROM fstore_appointments WHERE command LIKE ?', [
        `%remove%("${player}"%`
      ]);

      let content = '';

      for (let { command, expires_at } of rows) {
        const type = command.includes('removeGroup') ? 'group' : (
          command.includes('removeVehicle') ? 'vehicle' : (
            command.includes('removeHouse') || command.includes('removeHome') ? 'home' : undefined
          )
        );
        const name = command.match(/"[^"]+"/g)[1];
        if (type) {
          content += `<p>${config.trans(`/vip.${type}`, {
            name,
            date: utils.formatDate(expires_at)
          })}</p>`;
        }
      }

      utils.emitTemplate(source, utils.createChatPopup(
        config.messages["/vip"][content ? 'color' : 'none_color'],
        content || config.messages["/vip"].none
      ));
    } else {
      console.log('Comando apenas para jogadores');
    }
  });
}