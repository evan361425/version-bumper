import { createGenerator } from 'ts-json-schema-generator';
import { DEFAULTS } from '../lib/config.js';

(async function main() {
  const schema = createGenerator({
    path: 'lib/interfaces.ts',
    additionalProperties: true,
  }).createSchema('IConfig');

  DEFAULTS;

  const result = JSON.stringify(schema, null, 2);

  console.log(result);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
