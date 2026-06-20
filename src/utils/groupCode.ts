const PREFIX = 'HH';

export function generateGroupCode(): string {
  const digits = Math.floor(100000 + Math.random() * 900000).toString();
  return `${PREFIX}-${digits}`;
}

export function isValidGroupCode(code: string): boolean {
  return /^HH-\d{6}$/.test(code);
}
