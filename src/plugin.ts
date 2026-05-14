import type { IndentierPlugin } from './types.ts';

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const registry = new Map<string, IndentierPlugin>();

/** Register a plugin, indexing it by each of its declared extensions. */
export function registerPlugin(plugin: IndentierPlugin): void {
  for (const ext of plugin.extensions) {
    registry.set(ext.toLowerCase(), plugin);
  }
}

/** Look up a registered plugin by file extension (e.g. `'.rs'`). */
export function getPlugin(ext: string): IndentierPlugin | undefined {
  return registry.get(ext.toLowerCase());
}

/** Returns `true` if the extension is handled by any registered plugin. */
export function isPluginExt(ext: string): boolean {
  return registry.has(ext.toLowerCase());
}

/** Clear all registered plugins (useful for test isolation). */
export function clearPlugins(): void {
  registry.clear();
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Dynamically import a plugin package and register it.
 * The package must export an `IndentierPlugin` as its default export.
 *
 * @param names npm package names (e.g. `['@indentier/plugin-rust']`)
 */
export async function loadPlugins(names: string[]): Promise<void> {
  for (const name of names) {
    let mod: { default?: IndentierPlugin } & IndentierPlugin;
    try {
      mod = (await import(name)) as typeof mod;
    } catch (err) {
      throw new Error(
        `Failed to load indentier plugin "${name}". ` +
          `Make sure it is installed (e.g. pnpm add ${name}).\n${String(err)}`,
        { cause: err },
      );
    }
    const plugin: IndentierPlugin = (mod.default ?? mod) as IndentierPlugin;
    if (!Array.isArray(plugin?.extensions)) {
      throw new Error(
        `Plugin "${name}" does not export a valid IndentierPlugin object ` +
          `(missing or invalid "extensions" field).`,
      );
    }
    registerPlugin(plugin);
  }
}
