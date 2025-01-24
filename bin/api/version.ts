import { command } from '../../lib/command.js';

export async function versionCommand(): Promise<string> {
  const info = await command('npm', ['search', '@evan361425/version-bumper', '--parseable', '--prefer-online']);
  const result = info
    .split('\t')
    .map((e) => e.trim())
    .filter((e) => Boolean(e));
  return result[result.length - 1]?.trim() ?? 'unknown';
}
