import { cosmiconfig } from 'cosmiconfig';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import type { ResolvedOptions, UserOptions } from './types.ts';
import { resolveOptions } from './defaults.ts';

const MODULE_NAME = 'indentier';

const RC_EXTS = ['json', 'yaml', 'yml', 'js', 'cjs', 'mjs', 'ts', 'cts', 'mts'];
const CONFIG_EXTS = ['js', 'cjs', 'mjs', 'ts', 'cts', 'mts'];

const importLoader = async (filepath: string): Promise<unknown> => {
  const mod = (await import(pathToFileURL(filepath).href)) as {
    default?: unknown;
  };
  return mod.default ?? mod;
};

const explorer = cosmiconfig(MODULE_NAME, {
  searchPlaces: [
    'package.json',
    `.${MODULE_NAME}rc`,
    ...RC_EXTS.map((ext) => `.${MODULE_NAME}rc.${ext}`),
    ...CONFIG_EXTS.map((ext) => `${MODULE_NAME}.config.${ext}`),
  ],
  loaders: {
    '.mjs': importLoader,
    '.ts': importLoader,
    '.cts': importLoader,
    '.mts': importLoader,
  },
});

export async function loadConfig(cwd: string = process.cwd()): Promise<{
  options: ResolvedOptions;
  filepath: string | null;
}> {
  const result = await explorer.search(cwd);
  return {
    options: resolveOptions(result?.config as UserOptions | undefined),
    filepath: result?.filepath ?? null,
  };
}

export function applyOverrides(
  options: ResolvedOptions,
  filePath: string,
  cwd: string,
): ResolvedOptions {
  if (!options.overrides?.length) return options;
  const rel = path.relative(cwd, filePath).replace(/\\/g, '/');
  return options.overrides.reduce<ResolvedOptions>((acc, override) => {
    const patterns = Array.isArray(override.files) ? override.files : [override.files];
    if (!patterns.some((p) => globToRegExp(p).test(rel))) return acc;
    return resolveOptions({
      ...acc,
      ...override.options,
      ruby: { ...acc.ruby, ...override.options.ruby },
    });
  }, options);
}

const GLOB_SPECIAL_CHARS = new Set('.+^$|()[]{}\\');

function globToRegExp(glob: string): RegExp {
  let re = '^';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === '*' && glob[i + 1] === '*') {
      re += '.*';
      i++;
    } else if (c === '*') {
      re += '[^/]*';
    } else if (c === '?') {
      re += '[^/]';
    } else if (GLOB_SPECIAL_CHARS.has(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp(re + '$');
}
