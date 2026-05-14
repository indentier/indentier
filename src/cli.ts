#!/usr/bin/env node
import { Command } from 'commander';
import { consola } from 'consola';
import pc from 'picocolors';
import fg from 'fast-glob';
import fs from 'node:fs/promises';
import path from 'node:path';
import { format } from './format.ts';
import { loadConfig, applyOverrides } from './config.ts';
import { loadIgnore, isIgnored } from './ignore.ts';
import { isSupported } from './language.ts';
import { loadPlugins, getPlugin, isPluginExt } from './plugin.ts';
import type { Mode, ResolvedOptions } from './types.ts';

const DEFAULT_RC = `{
  "mode": "default",
  "tabWidth": 2,
  "useTabs": false,
  "offset": 20,
  "minColumn": 80,
  "brackets": true,
  "semicolon": true,
  "comma": true,
  "ruby": {
    "variableName": "end",
    "injectDeclaration": true,
    "smartEnd": true
  }
}
`;

const DEFAULT_IGNORE = `node_modules
dist
build
out
.git
.next
.nuxt
`;

interface CliOptions {
  write?: boolean;
  check?: boolean;
  init?: boolean;
  mode?: Mode;
  offset?: string;
  noSemi?: boolean;
  noComma?: boolean;
}

interface FormatOutcome {
  output: string;
  changed: boolean;
}

async function expandPaths(patterns: string[], cwd: string): Promise<string[]> {
  if (patterns.length === 0) return [];
  const ig = await loadIgnore(cwd);

  const resolved: string[] = [];
  for (const p of patterns) {
    const candidate = path.isAbsolute(p) ? p : path.join(cwd, p);
    const normalised = p.replace(/\\/g, '/').replace(/\/+$/, '');
    try {
      const stat = await fs.stat(candidate);
      resolved.push(stat.isDirectory() ? `${normalised}/**/*` : normalised);
    } catch {
      // Not on disk — assume the user passed a glob pattern.
      resolved.push(p);
    }
  }

  const entries = await fg(resolved, {
    cwd,
    dot: false,
    onlyFiles: true,
    absolute: true,
    followSymbolicLinks: false,
  });
  return entries.filter(
    (f) => (isSupported(f) || isPluginExt(path.extname(f))) && !isIgnored(ig, f, cwd),
  );
}

function applyCliOverrides(options: ResolvedOptions, cli: CliOptions): ResolvedOptions {
  if (cli.mode) options.mode = cli.mode;
  if (cli.offset !== undefined) {
    const n = Number(cli.offset);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`--offset must be a non-negative number, got: ${cli.offset}`);
    }
    options.offset = n;
  }
  if (cli.noSemi) options.semicolon = false;
  if (cli.noComma) options.comma = false;
  return options;
}

async function formatOne(
  file: string,
  options: ResolvedOptions,
  cwd: string,
): Promise<FormatOutcome> {
  const resolved = applyOverrides(options, file, cwd);
  const ext = path.extname(file);
  const input = await fs.readFile(file, 'utf8');
  const output = format(input, resolved, ext, getPlugin(ext));
  return { output, changed: output !== input };
}

async function runInit(cwd: string): Promise<void> {
  const writeIfMissing = async (p: string, body: string) => {
    try {
      await fs.access(p);
      consola.warn(`${path.basename(p)} already exists, skipping.`);
    } catch {
      await fs.writeFile(p, body, 'utf8');
      consola.success(`Created ${pc.cyan(path.relative(cwd, p))}`);
    }
  };
  await writeIfMissing(path.join(cwd, '.indentierrc.json'), DEFAULT_RC);
  await writeIfMissing(path.join(cwd, '.indentierignore'), DEFAULT_IGNORE);
}

async function runCheck(files: string[], options: ResolvedOptions, cwd: string): Promise<number> {
  const unformatted: string[] = [];
  for (const file of files) {
    const { changed } = await formatOne(file, options, cwd);
    if (changed) unformatted.push(file);
  }
  if (unformatted.length === 0) {
    consola.success('All matched files use indentier code style.');
    return 0;
  }
  consola.warn(`Code style issues found in ${unformatted.length} file(s):`);
  for (const f of unformatted) console.log(pc.yellow(path.relative(cwd, f)));
  return 1;
}

async function runWrite(files: string[], options: ResolvedOptions, cwd: string): Promise<number> {
  let written = 0;
  for (const file of files) {
    const { output, changed } = await formatOne(file, options, cwd);
    const rel = path.relative(cwd, file);
    if (changed) {
      await fs.writeFile(file, output, 'utf8');
      console.log(`${pc.green(rel)} ${pc.dim('(written)')}`);
      written++;
    } else {
      console.log(`${pc.dim(rel)} ${pc.dim('(unchanged)')}`);
    }
  }
  consola.success(`Done. ${written} file(s) changed.`);
  return 0;
}

async function runStdout(files: string[], options: ResolvedOptions, cwd: string): Promise<number> {
  for (const file of files) {
    const { output } = await formatOne(file, options, cwd);
    process.stdout.write(output);
    if (!output.endsWith('\n')) process.stdout.write('\n');
  }
  return 0;
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name('indentier')
    .description(
      "A silly formatter that hides braces, semicolons and commas in the right margin — letting curly-brace languages pretend they're Python or Ruby.",
    )
    .argument('[paths...]', 'Files or glob patterns to format')
    .option('-w, --write', 'Format files in place')
    .option('-c, --check', 'Check whether files are formatted (exits 1 if not)')
    .option('--init', 'Create .indentierrc.json and .indentierignore')
    .option('--mode <mode>', 'Override mode (default | ruby)')
    .option('--offset <number>', 'Override the offset (spaces between body end and symbols)')
    .option('--no-semi', 'Do not move semicolons')
    .option('--no-comma', 'Do not move trailing commas')
    .helpOption('-h, --help', 'Display help');

  program.parse(process.argv);
  const opts = program.opts<CliOptions>();
  const paths = program.args;
  const cwd = process.cwd();

  if (opts.init) {
    await runInit(cwd);
    return;
  }

  if (paths.length === 0) {
    program.outputHelp();
    process.exitCode = 1;
    return;
  }

  const { options } = await loadConfig(cwd);
  applyCliOverrides(options, opts);

  if (options.plugins?.length) {
    await loadPlugins(options.plugins);
  }

  const files = await expandPaths(paths, cwd);
  if (files.length === 0) {
    consola.warn('No matching files found.');
    process.exitCode = 1;
    return;
  }

  try {
    if (opts.check) {
      process.exitCode = await runCheck(files, options, cwd);
    } else if (opts.write) {
      process.exitCode = await runWrite(files, options, cwd);
    } else {
      process.exitCode = await runStdout(files, options, cwd);
    }
  } catch (err) {
    consola.error(err);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  consola.error(err);
  process.exit(1);
});
