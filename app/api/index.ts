import axios from 'axios';
import { formatDate } from '../utils';
import cfg, { token } from '../utils/config';

let hasWebhook = cfg.webhook.toLowerCase().includes("/api/webhooks");

const endpoint = axios.create({
  baseURL: `https://five-m.store/api/v2`,
  headers: {
    Authorization: token
  }
});

const batch: string[] = [];

export function setHasWebhook(url: boolean | string) {
  if (typeof url === 'boolean') hasWebhook = url;
  else hasWebhook = url.includes('/api/webhooks');
}

export async function status() {
  const { data } = await endpoint.get('/status');
  return data as StatusResponse;
}

export async function fetch() {
  const { data } = await endpoint.get('/fetch');
  return data as FetchResponse;
}

export async function callback(players: number, sales: any[]) {
  const { data } = await endpoint.post('/callback', { players, sales });
  return data as CallbackResponse;
}

export async function setMetadata(key: string, value: any) {
  return endpoint.put('/setmetadata', { key, value }).catch(_ => {
    console.error('Falha ao modificar a metadata: ' + key);
    console.error('Este erro pode ser grave, é recomendado que se reinicie o script.');
  });
}

export function addMetadata(key: string, value: any) {
  return endpoint.patch('/addmetadata', { key, value }).catch(_ => {
    console.error(`Falha ao adicionar ${JSON.stringify(value)} da loja (Metadata error)`);
  });
}

export function removeMetadata(key: string, value: any) {
  return endpoint.patch('/removemetadata', { key, value }).catch(_ => {
    console.error(`Falha ao remover ${JSON.stringify(value)} da loja (Metadata error)`);
  });
}

export function addWebhookBatch(content: string) {
  if (hasWebhook && batch.join('\n').length >= 1750) {
    sendWebhookBatch();
    batch.push('Continuação...');
  }
  batch.push(content);
}

export function sendWebhookBatch() {
  const text = batch.join('\n');
  batch.splice(0, batch.length);
  return sendWebhook(text, 0xF1F1F1);
}

export function sendWebhook(content, color) {
  if (!hasWebhook) {
    const formatted = content.replace(/(```[a-z]+\n|```)/g, '');
    console.log(formatted);
    return Promise.resolve();
  }
  else return endpoint.post(cfg.webhook, {
    embeds: [
      {
        title: formatDate(),
        description: content,
        color: color
      }
    ]
  }).catch(err => {
    if (err.response) {
      const status = err.response.status;
      console.error('Falha ao enviar webhook para o discord (Erro ' + err.response.status + ')');
      if (status === 429)
        console.error('O erro 429 é comum quando ocorre muitas entregas simultaneas');
      else
        console.error('Este erro é desconhecido pela nossa equipe, por favor envie para nós =]');
    } else console.error('Erro ao enviar webhook para o discord, não foi obtido uma resposta do servidor...');
  });
}