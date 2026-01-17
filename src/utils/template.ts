export function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (_, k) => (vars[k] != null ? vars[k] : `{${k}}`));
}
