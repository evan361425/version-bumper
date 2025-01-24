import { JSONSchema7 } from 'json-schema';
import { createGenerator } from 'ts-json-schema-generator';
import { DEFAULTS } from '../lib/config.js';

const DEFAULT_SCHEMA = 'node_modules/@evan361425/version-bumper/schema.json';

(function main(): void {
  const result = JSON.stringify(generateSchema(), null, 2);
  console.log(result);
})();

function generateSchema(): JSONSchema7 {
  const schema = createGenerator({
    path: 'lib/interfaces.ts',
  }).createSchema('IConfig');

  function setDefault(defs: Definitions, reals: Record<string, any>): void {
    for (let [key, value] of Object.entries(defs)) {
      if (value.description) {
        value.title = value.title ? `${value.title}\n\n${value.description}` : value.description;
        delete value.description;
      }

      if (value.type === 'array') {
        continue;
      }

      if (value.type === 'object') {
        key = key.replace(/^I/, '');
        key = key.charAt(0).toLowerCase() + key.slice(1);
        if (reals[key] && value.properties) {
          setDefault(value.properties as Definitions, reals[key]);
        }
        continue;
      }

      if (!value.type) {
        if (reals[key] && !value.default) {
          value.default = reals[key];
        }
        if (value.$ref) {
          const refs = value.$ref.split('/');
          const ref = refs.pop()!;
          if (ref !== 'ITemplate') {
            const def = schema.definitions![ref] as JSONSchema7;
            setDefault(def.properties as Definitions, reals[key]);
          }
        }
        continue;
      }

      if (!value.default) {
        value.default = reals[key];
      }
    }
  }

  setDefault(schema.definitions as Definitions, DEFAULTS);
  const config = schema.definitions!['IConfig'] as JSONSchema7;
  config.properties!['$schema'] = { type: 'string', default: DEFAULT_SCHEMA };
  config.default = { $schema: DEFAULT_SCHEMA };

  return schema;
}

type Definitions = Record<string, JSONSchema7>;
