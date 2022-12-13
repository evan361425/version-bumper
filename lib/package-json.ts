import path from 'node:path';
import { readFile, writeFile } from './helper.js';

export class PackageJson {
  private readonly internal: Record<string, unknown>;

  constructor() {
    try {
      this.internal = JSON.parse(readFile(this.fileName));
    } catch (error) {
      this.internal = {};
    }
  }

  get dependencies(): Record<string, string> {
    return (this.internal['dependencies'] ?? {}) as Record<string, string>;
  }

  get devDependencies(): Record<string, string> {
    return (this.internal['devDependencies'] ?? {}) as Record<string, string>;
  }

  writeBackToFile() {
    writeFile(this.fileName, JSON.stringify(this.internal, undefined, 2));
  }

  isDev(name: string): boolean {
    return !!this.devDependencies[name];
  }

  fixDev(name: string, ver: string) {
    if (typeof this.internal['devDependencies'] === 'object') {
      (this.internal['devDependencies'] as Record<string, string>)[name] = ver;
    } else {
      this.internal['devDependencies'] = { [name]: ver };
    }
  }

  private get fileName(): string {
    return path.join(path.resolve(), 'package.json');
  }
}
