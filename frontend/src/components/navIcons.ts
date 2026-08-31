/** Fleet nav vehicle geometry — must fill most of the 24×24 viewBox. */

export const FLEET_NAV_BODY_D = 'M4 11h16v7H4zM8 5h8v6H8z';

export const FLEET_NAV_WHEELS: Array<{ cx: number; cy: number; r: number }> = [
  { cx: 8, cy: 18.5, r: 2 },
  { cx: 16, cy: 18.5, r: 2 },
];

/** Walk SVG path commands and return the smallest absolute Y. */
export function pathMinY(d: string): number {
  let x = 0;
  let y = 0;
  let minY = Number.POSITIVE_INFINITY;
  const tokens = d.match(/[A-Za-z]|-?\d+(?:\.\d+)?/g) || [];
  let i = 0;
  const bump = (ny: number) => {
    y = ny;
    if (y < minY) minY = y;
  };
  while (i < tokens.length) {
    const cmd = tokens[i];
    if (!/^[A-Za-z]$/.test(cmd)) {
      i += 1;
      continue;
    }
    i += 1;
    const nums: number[] = [];
    while (i < tokens.length && !/^[A-Za-z]$/.test(tokens[i])) {
      nums.push(Number(tokens[i]));
      i += 1;
    }
    switch (cmd) {
      case 'M':
      case 'L':
        for (let n = 0; n + 1 < nums.length; n += 2) {
          x = nums[n];
          bump(nums[n + 1]);
        }
        break;
      case 'm':
      case 'l':
        for (let n = 0; n + 1 < nums.length; n += 2) {
          x += nums[n];
          bump(y + nums[n + 1]);
        }
        break;
      case 'H':
        nums.forEach((nx) => {
          x = nx;
        });
        break;
      case 'h':
        nums.forEach((dx) => {
          x += dx;
        });
        break;
      case 'V':
        nums.forEach((ny) => bump(ny));
        break;
      case 'v':
        nums.forEach((dy) => bump(y + dy));
        break;
      default:
        break;
    }
  }
  return minY;
}

export function fleetNavArtworkMinY(): number {
  const wheelTop = Math.min(...FLEET_NAV_WHEELS.map((w) => w.cy - w.r));
  return Math.min(pathMinY(FLEET_NAV_BODY_D), wheelTop);
}
