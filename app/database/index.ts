import mysql, { FieldPacket, RowDataPacket } from 'mysql2/promise';
import config from '../utils/config';
import { addWebhookBatch } from '../api';
import * as utils from '../utils';
import { EventEmitter } from 'events';

const dbprefix = config.snowflake.database_prefix || 'vrp';

let $tables: string[] = [];

let connection: mysql.Connection | undefined = undefined;
export const bus = new EventEmitter();

export function ping() {
  return connection?.ping();
}

export const connect = () => (new Promise<mysql.QueryError | null>((resolve) => {
  mysql.createConnection(config.mysql).then(con => {
    connection = con;
    resolve(null);
  }).catch(err => resolve(err));
}));

export function onConnect(callback) {
  if (isConnected()) callback();
  else bus.once('connect', callback);
}

export async function queryTables() {
  if ($tables.length) return $tables;
  const rows = await sql('SHOW TABLES', [], true);
  return $tables = rows?.map(r => Object.values(r)[0]);
}

export const isConnected = () => !!connection;

export async function queryFields(table: string): Promise<string[]> {
  if (!connection) throw new Error('Mysql isnt connected');
  if (table.startsWith('vrp_') && dbprefix != 'vrp') table = table.replace(/vrp_/g, dbprefix + '_');
  const [, fields] = await connection.query(`SELECT * FROM \`${table}\` LIMIT 0`);
  return fields.map(s => s.name);
}

export async function sql(sql: string, args: any[] = [], ignore = false): Promise<RowDataPacket[]> {
  if (!connection) throw new Error('Mysql isnt connected');
  if (sql.includes('vrp_') && dbprefix != 'vrp') sql = sql.replace(/vrp_/g, dbprefix + '_');
  if (!ignore) addWebhookBatch(`\`\`\`sql\n${sql}\n/* [${args.join(',')}] */\`\`\``);
  const [rows] = await connection.query<RowDataPacket[]>(sql, args);
  return rows;
}

export async function after(days: any, command: string | Function) {
  if (command instanceof Function) {
    command = command.toString().replace(/(\(\))|=>/g, '').trim();
  }
  const old = await findAppointment(command);
  if (old && old.expires_at.getTime() > Date.now()) {
    const expires_at = new Date(old.expires_at.getTime() + (days * 86400000));
    return sql("UPDATE fstore_appointments SET expires_at = ? WHERE id=?", [expires_at, old.id], true);
  }
  return createAppointment(command, utils.after(days));
}

export const pluck = async (query: string, column: string, args: any[] = [], ignore = true): Promise<any[]> => {
  const rows = await sql(query, args, ignore);
  return rows.map(r => r[column]);
}

export function insert(table: string, data: Object, ignore = false) {
  const marks = Object.values(data).map(_ => '?').join(',');
  const cmd = `INSERT INTO ${table} (${Object.keys(data).join(',')}) VALUES (${marks})`;
  return sql(cmd, Object.values(data), ignore);
}

export function tables() {
  return $tables;
}

export const createAppointmentsTable = () => (
  sql("CREATE TABLE IF NOT EXISTS fstore_appointments (id BIGINT NOT NULL AUTO_INCREMENT, command VARCHAR(512), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id))", [], true)
);

export function createAppointment(command: string, expires_at: Date) {
  const args = [command, new Date(), expires_at];
  return sql("REPLACE INTO fstore_appointments (command,created_at,expires_at) VALUES (?,?,?)", args, true);
}

export function getAppointments(all = false): Promise<Appointment[]> {
  if (all)
    return sql("SELECT * FROM fstore_appointments", [], true) as Promise<Appointment[]>;
  else
    return sql("SELECT * FROM fstore_appointments WHERE expires_at < ?", [new Date()], true) as Promise<Appointment[]>;
}

export function deleteAppointments(ids: any[] | any) {
  if (!Array.isArray(ids)) ids = [ids];
  const marks = ids.map(s => '?').join(',');
  return sql(`DELETE FROM fstore_appointments WHERE id IN (${marks})`, ids, true);
}

export async function findAppointment(command: string): Promise<Appointment> {
  const [row] = await sql("SELECT * FROM fstore_appointments WHERE command = ?", [command], true);
  return row as Appointment || undefined;
}

export async function getDatatable(id): Promise<any> {
  const [row] = await sql("SELECT dvalue FROM vrp_user_data WHERE user_id=? AND (dkey='vRP:datatable' OR dkey='Datatable')", [id], true);
  return row ? JSON.parse(row.dvalue) : null;
}

export function setDatatable(id: string | number, value: any) {
  return sql(`UPDATE vrp_user_data SET dvalue=? WHERE user_id=? AND (dkey='vRP:datatable' OR dkey='Datatable')`, [JSON.stringify(value), id], true);
}
