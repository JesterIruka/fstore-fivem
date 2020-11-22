interface Sale {
  id: number;
  products: { [key: string]: string }
  player: number | string;
  commands: string[];
  delivery: boolean;
}

interface StatusResponse {
  plan: string;
  remaining: number;
  hours: number;
}

interface FetchResponse {
  approved: Sale[];
  refunded: Sale[];
  widgets: { [key: string]: boolean };
  elapsed: number;
}

interface CallbackResponse {
  count: number;
  elapsed: number;
}

declare interface Appointment {
  id: number;
  command: string;
  created_at: Date;
  expires_at: Date
}

declare function emit(event: string, ...args: any[]): void;
declare function emitNet(event: string, player: number, ...args: any[]): void;
declare function ExecuteCommand(command: string);
declare function GetResourceState(resource: string): string;
declare function GetHashKey(key: string): number;
declare function GetNumPlayerIndices(): number;
declare function GetResourcePath(resource: string): string;
declare function GetCurrentResourceName(): string;
declare function DropPlayer(source: number, string: reason): void;

declare interface CommandCallback {
  (source: number, args: any[]): void;
}

declare function RegisterCommand(cmd: string, callback: CommandCallback);