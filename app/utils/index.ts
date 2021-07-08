import colors from 'colors';
import { addWebhookBatch } from '../api';

export function formatDate(date?: Date) {
  if (!date) date = new Date();
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();

  const hr = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  const secs = date.getSeconds().toString().padStart(2, '0');

  return `${d}/${m}/${y} ${hr}:${min}:${secs}`;
}

export function after(days: any) {
  return new Date(Date.now() + (86400000 * days));
}

export function lua(code: string, log=false): Promise<any> {
  if(log) {
    addWebhookBatch('```[LUA]: '+code+'```');
  }
  return new Promise(resolve => emit('evalua', code, resolve));
}

export function sendTitle(source: number, title: string, subtitle: string) {
  emitNet('__title', source, title, subtitle);
}

type Styles = Partial<CSSStyleDeclaration>;

export function createChatPopup(color: string, content: string, extraStyles: Styles = {}) {
  const styles: Styles = {
    padding: "10px",
    margin: "5px 0",
    backgroundImage: `linear-gradient(to right, ${color} 3%, ${color.length > 7 ? color : color + '19'} 95%)`,
    borderRadius: "5px",
    color: 'snow',
    ...extraStyles
  };
  return createElement('div', content, styles);
}

export function createElement(tag: string, children: string, styles: Styles = {}) {
  const style = Object.entries(styles).map(([k, v]) => {
    k = k.replace(/[A-Z]/g, (s) => '-' + s.toLowerCase());
    return `${k}:${v}`;
  }).join(';');
  return `<${tag} style="${style}">${children}</${tag}>`;
}

export function emitTemplate(source: number, template: string) {
  emitNet('chat:addMessage', source, { template });
}

export function emitError(source: number, text: string) {
  if (source != 0)
    emitNet('chatMessage', source, '', [229, 57, 53], text);
  else
    console.error(text);
}

export function emitSuccess(source: number, text: string) {
  if (source != 0)
    emitNet('chatMessage', source, '', [67, 160, 71], text);
  else
    console.log(colors.green(text));
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function nodeResolve(path: string, force: boolean = false) {
  if (force) {
    return eval(`require(${JSON.stringify(path)})`);
  } else {
    try {
      eval(`require.resolve(${JSON.stringify(path)})`);
      return nodeResolve(path, true);
    } catch (ex) {
      return null;
    }
  }
}

export async function asyncFilter<T>(array: Array<T>, predicate: (o: T) => Promise<any>) {
  const newArray: T[] = [];
  for (let item of array) {
    if (await predicate(item)) {
      newArray.push(item);
    }
  }
  return newArray;
}

type FatalResponse = (string | boolean)[];

const knowErrors = {
  'TIMEDOUT': [false, 'Um timedout ocorreu ao se conectar com o banco de dados'],
  'ENOTFOUND': [false, 'Não foi possível resolver o endereço de ip do banco de dados'],
  'Access denied': [true, 'Combinação de usuário e senha inválida para o banco de dados'],
  'Unknown database': [true, 'A database inserida na config.json não existe'],
  'ECONNREFUSED': [true, 'Não foi possível se conectar no banco de dados (Conexão recusada)']
};

export function isFatal(error: Error): FatalResponse {
  const msg = error.message;
  for (let [k, v] of Object.entries(knowErrors))
    if (msg.includes(k))
      return v;
  return [false, 'Erro não catalogado, o script tentará se conectar ao MySQL em 5 segundos', msg];
}

export function firstAvailableNumber(array: number[]): Number {
  let number = 1;
  while (array.includes(number)) number += 1;
  return number;
}

export function printError(error: Error, title?: string) {
  if (title) console.error(title);
  if (error.name != 'Error') console.error(error.name);
  console.error(error.message);
  if (Array.isArray(error.stack)) {
    console.error(error.stack.map(({ file, line, name }) => {
      return `${file}:${line} <--> ${name}`;
    }).join('\n'));
  } else {
    console.error(error.stack);
  }
}

const planColors = {
  free: 'gray',
  basic: 'green',
  pro: 'yellow',
  diamond: 'cyan'
}

export function printPlan({ plan, remaining }: StatusResponse) {
  console.log(`Seu plano: ${colors[planColors[plan.toLowerCase()]](plan)}`);
  if (remaining != -1) {
    const color = remaining > 10 ? 'green' : (remaining > 5 ? 'yellow' : 'red');
    console.log(`Dias restantes: ${colors[color](remaining.toString())}\n`);
  }
}

export const BILLBOARD = (version, plugins: string[]) => `
 ______ _______      ________          __  __    _____ _______ ____  _____  ______ 
|  ____|_   _\\ \\    / /  ____|        |  \\/  |  / ____|__   __/ __ \\|  __ \\|  ____|
| |__    | |  \\ \\  / /| |__   ______  | \\  / | | (___    | | | |  | | |__) | |__   
|  __|   | |   \\ \\/ / |  __| |______| | |\\/| |  \\___ \\   | | | |  | |  _  /|  __|  
| |     _| |_   \\  /  | |____         | |  | |_ ____) |  | | | |__| | | \\ \\| |____ 
|_|    |_____|   \\/   |______|        |_|  |_(_)_____/   |_|  \\____/|_|  \\_\\______|

Script inicializado com sucesso. Versão: ${colors.yellow(version)}
Plugins utilizados: ${plugins.length ? colors.yellow(plugins.join(', ')) : colors.white('Nenhum')}
`;