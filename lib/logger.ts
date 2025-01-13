import { isVerbose } from './helper.js';

export function log(message: string) {
  console.log(message);
}
export function verbose(message: string) {
  isVerbose() && console.log(message);
}
export function error(message: string) {
  console.error(message);
  process.exit(1);
}
