/** Officer-typed fields must never be machine-translated on nation change. */
export function applyNationToOfficerFields<T extends Record<string, unknown>>(fields: T, _nation: string): T {
  return fields;
}
