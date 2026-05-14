/**
 * Core language support — JavaScript / TypeScript only.
 * Support for other languages is provided via plugins (@indentier/plugin-*).
 */

const JS_TS_EXTS = new Set(['.js', '.cjs', '.mjs', '.ts', '.cts', '.mts', '.jsx', '.tsx']);

const hasJsTsExt = (ext: string): boolean => JS_TS_EXTS.has(ext.toLowerCase());

export function isSupported(file: string): boolean {
  const dot = file.lastIndexOf('.');
  return dot >= 0 && hasJsTsExt(file.slice(dot));
}

/** `true` for JS/TS extensions where ruby mode is valid. */
export const isRubyCompatible = hasJsTsExt;

/** Built-in declaration template for JS/TS, or `null` for other extensions. */
export function defaultDeclarationTemplate(ext: string): string | null {
  return hasJsTsExt(ext) ? 'let end=null;' : null;
}
