import { describe, expect, it } from 'vitest';
import { resolveOptions, DEFAULT_OPTIONS } from '../src/defaults.ts';

describe('resolveOptions', () => {
  it('returns defaults when given undefined', () => {
    const opts = resolveOptions(undefined);
    expect(opts.mode).toBe(DEFAULT_OPTIONS.mode);
    expect(opts.offset).toBe(DEFAULT_OPTIONS.offset);
    expect(opts.ruby.variableName).toBe(DEFAULT_OPTIONS.ruby.variableName);
  });

  it('shallow-merges user options', () => {
    const opts = resolveOptions({ mode: 'ruby', offset: 42 });
    expect(opts.mode).toBe('ruby');
    expect(opts.offset).toBe(42);
    expect(opts.minColumn).toBe(DEFAULT_OPTIONS.minColumn);
  });

  it('deep-merges ruby options', () => {
    const opts = resolveOptions({ ruby: { variableName: 'fin' } });
    expect(opts.ruby.variableName).toBe('fin');
    expect(opts.ruby.injectDeclaration).toBe(DEFAULT_OPTIONS.ruby.injectDeclaration);
    expect(opts.ruby.smartEnd).toBe(DEFAULT_OPTIONS.ruby.smartEnd);
  });

  it('does not mutate the default object', () => {
    const a = resolveOptions({ offset: 99 });
    const b = resolveOptions(undefined);
    expect(a.offset).toBe(99);
    expect(b.offset).toBe(DEFAULT_OPTIONS.offset);
  });
});
