/**
 * Core language support — JavaScript / TypeScript / JSON family.
 * Support for other languages is provided via plugins (@indentier/plugin-*).
 */

const JS_TS_EXTS = new Set(['.js', '.cjs', '.mjs', '.ts', '.cts', '.mts']);
const JSON_EXTS = new Set(['.json', '.jsonc', '.json5']);

const hasJsTsExt = (ext: string): boolean => JS_TS_EXTS.has(ext.toLowerCase());
const hasJsonExt = (ext: string): boolean => JSON_EXTS.has(ext.toLowerCase());

export function isSupported(file: string): boolean {
  const dot = file.lastIndexOf('.');
  if (dot < 0) return false;
  const ext = file.slice(dot).toLowerCase();
  return hasJsTsExt(ext) || hasJsonExt(ext);
}

/** `true` for JS/TS extensions where ruby mode is valid. */
export const isRubyCompatible = hasJsTsExt;

/** Built-in declaration template for JS/TS, or `null` for other extensions. */
export function defaultDeclarationTemplate(ext: string): string | null {
  return hasJsTsExt(ext) ? 'let end=null;' : null;
}
