export const PROD_FRONTEND = 'https://serpico.onrender.com';

export function ownerHandleUrl(serial: string): string {
  return `${PROD_FRONTEND}/x-hard-data/hw/${serial}`;
}
