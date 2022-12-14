import { isVerbose } from './helper.js';

export function notice(message: string) {
  console.log(message);
}
export function info(message: string) {
  isVerbose() && console.log(message);
}
export function error(message: string) {
  console.error(message);
}
