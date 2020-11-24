import config from './utils/config';
import * as proxy from './utils/proxy';
import * as api from './api';
import * as utils from './utils';
import * as database from './database';
import Warning from './utils/Warning';

const { after, sql, insert } = database; // Inject sql/insert in eval context

async function fetch() {
  const response = await api.fetch();

  const changed: number[] = [];

  const all = [...response.approved, ...response.refunded];
  if (proxy.isESX) {
    all.forEach(s => s.player = 'steam:' + s.player);
    if (config.hasPlugin('esx-user-identifiers')) {
      for (let sale of all) {
        sale.player = await proxy.esx.getLicense(sale.player);
      }
    }
  }
  all.forEach(s => s.commands = s.commands.map(c => c.replace(/\?/g, s.player.toString())));

  for (let sale of all) {
    if (sale.delivery) {
      if (config.requireOnlineToDelivery && !proxy.isOnline(sale.player)) continue;

      const source = await proxy.getSource(sale.player);
      let fullname = await proxy.getName(sale.player);
      if (fullname === undefined) {
        api.addWebhookBatch(`\`\`\`diff\n- ERRO: O jogador ${sale.player} não existe\`\`\``);
        await api.sendWebhookBatch();
        continue;
      } else if (fullname === null) {
        api.addWebhookBatch(`\`\`\`diff\n- AVISO: O jogador ${sale.player} não possui nome\`\`\``);
        fullname = 'Sem nome';
      }

      api.addWebhookBatch(`Processando entrega #${sale.id}`);

      const $data = {
        name: fullname,
        product: Object.values(sale.products).join(' & ')
      };

      if (config.nui.enabled && source) {
        const { title, subtitle } = config.nui;
        utils.sendTitle(source, config.$trans(title, $data), config.$trans(subtitle, $data));
      }
      if (config.chat.enabled && (config.chat.global || source)) {
        const { global, color, format } = config.chat;
        const template = utils.createChatPopup(color, config.$trans(format, $data), {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        });
        utils.emitTemplate(global ? -1 : source, template);
      }
    } else {
      api.addWebhookBatch(`Processando reembolso #${sale.id}`);
    }
    for (const command of sale.commands) {
      try {
        api.addWebhookBatch(`\`\`\`js\n${command}\`\`\``);
        const response = await eval(command);
        if (response instanceof Warning) api.addWebhookBatch(`\`\`\`diff\n- AVISO: ${response.message}\`\`\``);
      } catch (error) {
        console.error('Falha ao executar o comando: ' + command);
        utils.printError(error);
        api.addWebhookBatch('Falha ao executar');
        api.addWebhookBatch('```diff\n' + `- ${error.message}` + '```')
        continue;
      }
    }
    await api.sendWebhookBatch();
    changed.push(sale.id);
  }

  if (changed.length > 0 || response.widgets['online_players']) {
    await api.callback(GetNumPlayerIndices(), changed);
  }
}

async function fetchAppointments() {
  const appointments = await database.getAppointments();

  if (appointments.length > 0) {
    api.addWebhookBatch(`Processando ${appointments.length} agendamento${appointments.length > 1 ? 's' : ''}`);
    for (let a of appointments) {
      api.addWebhookBatch(`\`\`\`js\n${a.command}\n/* ${utils.formatDate(a.expires_at)} */\`\`\``);
      await eval(a.command);
    }
    await api.sendWebhookBatch();
    await database.deleteAppointments(appointments.map(i => i.id));
  }
}

export default async function () {
  await fetch().catch(error => utils.printError(error, 'Falha ao executar a fase 1 da corrotina'));
  await fetchAppointments().catch(error => utils.printError(error, 'Falha ao executar a fase 2 da corrotina'));
}