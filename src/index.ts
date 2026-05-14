export { format } from './format.ts';
export { loadConfig, applyOverrides } from './config.ts';
export { loadIgnore, isIgnored } from './ignore.ts';
export { isSupported } from './language.ts';
export { DEFAULT_OPTIONS, resolveOptions } from './defaults.ts';
export { registerPlugin, getPlugin, isPluginExt, loadPlugins, clearPlugins } from './plugin.ts';
export type {
  Mode,
  RubyOptions,
  Override,
  IndentierOptions,
  UserOptions,
  ResolvedOptions,
  IndentierPlugin,
  PluginLine,
} from './types.ts';
