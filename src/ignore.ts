import ignore, { type Ignore } from 'ignore';
import fs from 'node:fs/promises';
import path from 'node:path';

const IGNORE_FILE = '.indentierignore';

export async function loadIgnore(cwd: string = process.cwd()): Promise<Ignore> {
  const ig = ignore();
  try {
    const content = await fs.readFile(path.join(cwd, IGNORE_FILE), 'utf8');
    ig.add(content);
  } catch {
    /* no ignore file — nothing is ignored */
  }
  return ig;
}

export function isIgnored(ig: Ignore, file: string, cwd: string): boolean {
  const rel = path.relative(cwd, path.resolve(cwd, file)).replace(/\\/g, '/');
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  return ig.ignores(rel);
}
