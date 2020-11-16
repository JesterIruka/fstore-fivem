import { Entry } from "webpack";

const config: Config = eval(`require('./config.json');`);

interface Config {
  hasPlugin(...plugins: string[]): boolean;
  trans(entry: string, data: object): string | undefined;
  $trans(template: string, data: object): string;
  token: string;
  command?: string;
  mysql: {
    host: string;
    port: any;
    database: string;
    user: string;
    password: any;
  },
  snowflake: {
    database_prefix: string;
    vehicles: string;
    priority: string;
    homes?: string;
    esx: {
      admin_group: string;
      default_group: string;
      vehicle_plate: string;
    }
  },
  requireOnlineToDelivery: boolean;
  plugins: string[];
  chat: {
    enabled: boolean;
    global: boolean;
    color: string;
    format: string;
  },
  nui: {
    enabled: boolean;
    title: string;
    subtitle: string;
  },
  messages: {
    ['/vip']: {
      color: string;
      none_color: string;
      none: string;
      group: string;
      vehicle: string;
      home: string;
    }
  },
  webhook: string;
  webhook_url: string;
}

config.webhook_url = config.webhook;

export function hasPlugin(...plugins: string[]): boolean {
  for (let pl of plugins)
    if (config.plugins.some(o => o.toLowerCase() === pl.toLowerCase()))
      return true;
  return false;
}

export function trans(entry: string, data: object) {
  let tmp = config.messages;
  for (let key of entry.split('.')) {
    tmp = tmp?.[key];
  }
  if (typeof tmp == 'string') {
    return $trans(tmp, data);
  } else {
    console.error(`Entry ${entry} not found`);
  }
}

export function $trans(template: string, data: object) {
  return template.replace(/:[A-z0-9]+/g, sub => data[sub.substring(1)]);
}

config.hasPlugin = hasPlugin;
config.trans = trans;
config.$trans = $trans;

export const token = config.token;

export default config as Config;