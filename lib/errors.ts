export class BumperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BumperError';
  }
}
