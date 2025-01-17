import { isVerbose } from './io.js';

export function log(message: string) {
  console.log(message);
}
export function verbose(message: string) {
  isVerbose() && console.log(message);
}
