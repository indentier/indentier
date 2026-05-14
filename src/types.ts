export type Mode = 'default' | 'ruby';

/**
 * Minimal line shape exposed to plugins (read-only).
 * Plugins must not depend on internal RenderLine fields beyond `body`.
 */
export interface PluginLine {
  readonly body: string;
}

/**
 * Language plugin interface.
 * A plugin registers one or more file extensions and can customise
 * ruby-mode behaviour for those languages.
 *
 * @example
 * ```ts
 * import type { IndentierPlugin } from 'indentier'
 * const plugin: IndentierPlugin = {
 *   extensions: ['.rs'],
 *   rubyCompatible: true,
 *   declarationTemplate: 'const end:()=();',
 * }
 * export default plugin
 * ```
 */
export interface IndentierPlugin {
  /** Lowercase file extensions handled by this plugin (e.g. `['.rs']`). */
  extensions: string[];
  /**
   * Whether ruby mode produces syntactically valid code for this language.
   * Defaults to `true`. Set to `false` for languages where bare `end;` is invalid.
   */
  rubyCompatible?: boolean;
  /**
   * Default declaration template.
   * Use the literal string `'end'` as a placeholder for the variable name.
   * `null` = skip declaration entirely.
   * `undefined` = use indentier's built-in default (`let end=null;`).
   */
  declarationTemplate?: string | null;
  /**
   * Override the end-keyword body inserted for each closed block.
   * @param variableName The configured ruby `variableName` (default `'end'`).
   */
  getEndStatement?: (variableName: string) => string;
  /**
   * Return the index (0-based) at which to splice the declaration line
   * into the already-processed lines array.
   * @param lines Read-only view of lines after `injectRubyEnds`.
   */
  declarationInsertIndex?: (lines: readonly PluginLine[]) => number;
}

export interface RubyOptions {
  variableName: string;
  injectDeclaration: boolean;
  smartEnd: boolean;
  declarationTemplate?: string;
}

export interface Override {
  files: string | string[];
  options: Partial<IndentierOptions>;
}

export interface IndentierOptions {
  mode: Mode;
  tabWidth: number;
  useTabs: boolean;
  offset: number;
  minColumn: number;
  brackets: boolean;
  semicolon: boolean;
  comma: boolean;
  ruby: RubyOptions;
  overrides: Override[];
  /** npm package names of indentier plugins to load (e.g. `['@indentier/plugin-rust']`). */
  plugins: string[];
}

export type UserOptions = Partial<Omit<IndentierOptions, 'ruby'> & { ruby: Partial<RubyOptions> }>;

export interface ResolvedOptions extends IndentierOptions {
  ruby: RubyOptions;
}
