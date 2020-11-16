import * as vrp from '../vrp';
import * as esx from '../esx';

export const isVRP = GetResourceState('vrp') != 'missing';
export const isESX = GetResourceState('es_extended') != 'missing';

export { vrp, esx };

export function isOnline(player) {
  if (isVRP) return vrp.isOnline(player);
  else return esx.isOnline(player);
}
export function getSource(player) {
  if (isVRP) return vrp.getSource(player);
  else return esx.getSource(player);
}
export function getName(player) {
  if (isVRP) return vrp.getName(player);
  else return esx.getName(player);
}
export function getId(player) {
  if (isVRP) return vrp.getId(player);
  else return undefined;
}
export function getSteamHex(source) {
  if (isVRP) return undefined;
  else return esx.getSteamHex(source);
}

export function hasPermission(player, permission) {
  if (isVRP) return vrp.hasPermission(player, permission);
  else return undefined;
}