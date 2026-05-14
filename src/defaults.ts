import type { ResolvedOptions, UserOptions } from './types.ts';

export const DEFAULT_OPTIONS: ResolvedOptions = {
  mode: 'default',
  tabWidth: 2,
  useTabs: false,
  offset: 20,
  minColumn: 80,
  brackets: true,
  semicolon: true,
  comma: true,
  ruby: {
    variableName: 'end',
    injectDeclaration: true,
    smartEnd: true,
  },
  overrides: [],
  plugins: [],
};

export function resolveOptions(user: UserOptions | undefined): ResolvedOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...user,
    ruby: { ...DEFAULT_OPTIONS.ruby, ...user?.ruby },
    overrides: user?.overrides ?? [...DEFAULT_OPTIONS.overrides],
    plugins: user?.plugins ?? [...DEFAULT_OPTIONS.plugins],
  };
}
