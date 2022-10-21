import { isDebug } from './helper.js';

export function info(message: string) {
  isDebug() && console.log(message);
}
export function error(message: string) {
  console.error(message);
}
