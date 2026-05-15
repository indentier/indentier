import { describe, expect, it } from 'vitest';
import { format } from '../src/format.ts';
import { resolveOptions } from '../src/defaults.ts';
import type { IndentierPlugin } from '../src/types.ts';

// ---------------------------------------------------------------------------
// Inline plugin fixtures (mirror what the real @indentier/plugin-* packages do)
// ---------------------------------------------------------------------------

const phpPlugin: IndentierPlugin = {
  extensions: ['.php'],
  rubyCompatible: true,
  declarationTemplate: '$end=null;',
  getEndStatement: (v) => (v.startsWith('$') ? v : `$${v}`),
  declarationInsertIndex: (lines) => {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]!.body.trimStart().startsWith('<?')) return i + 1;
    }
    return 0;
  },
};

const goPlugin: IndentierPlugin = {
  extensions: ['.go'],
  rubyCompatible: true,
  declarationTemplate: 'var end any=nil',
  getEndStatement: (v) => `_ = ${v}`,
  declarationInsertIndex: (lines) => {
    for (let i = 0; i < lines.length; i++) {
      if (/^(?:func|var|const|type)\b/.test(lines[i]!.body)) return i;
    }
    return lines.length;
  },
};

const rustPlugin: IndentierPlugin = {
  extensions: ['.rs'],
  rubyCompatible: true,
  declarationTemplate: 'const end:()=();',
};

const javaPlugin: IndentierPlugin = {
  extensions: ['.java'],
  rubyCompatible: false,
  declarationTemplate: null,
};

const csPlugin: IndentierPlugin = {
  extensions: ['.cs'],
  rubyCompatible: false,
  declarationTemplate: null,
};

const cssPlugin: IndentierPlugin = {
  extensions: ['.css', '.scss', '.less'],
  rubyCompatible: false,
  declarationTemplate: null,
};

describe('format / default mode', () => {
  it('hides opening brace in the right margin', () => {
    const input = 'function foo() {\n  return 1;\n}\n';
    const out = format(input, resolveOptions({ minColumn: 40, offset: 4 }));
    expect(out.split('\n')[0]).toMatch(/^function foo\(\) {2,}\{$/);
  });

  it('moves trailing semicolons of top-level statements', () => {
    const input = 'sayHello(1);\nsayHello(2);\n';
    const out = format(input, resolveOptions({ minColumn: 30, offset: 4 }));
    const lines = out.split('\n');
    expect(lines[0]).toMatch(/sayHello\(1\) +;$/);
    expect(lines[1]).toMatch(/sayHello\(2\) +;$/);
  });

  it('moves semicolons to the right margin even when a closing brace follows', () => {
    const input = '  console.log("x");\n}\n';
    const out = format(input, resolveOptions({ minColumn: 30, offset: 4 }));
    const first = out.split('\n')[0]!;
    expect(first).toMatch(/console\.log\("x"\) +;}$/);
  });

  it('merges leading closing brace with previous content line', () => {
    const input = 'function f() {\n  if (a) {\n    foo();\n  } else {\n    bar();\n  }\n}\n';
    const out = format(input, resolveOptions({ minColumn: 60, offset: 4 }));
    const lines = out.split('\n').filter((l) => l.length > 0);
    expect(lines[2]!).toMatch(/foo\(\) +;}$/);
    expect(lines[3]!).toMatch(/^\s+else +{$/);
  });

  it('moves trailing commas in multiline objects', () => {
    const input = 'const o = {\n  a: 1,\n  b: 2\n};\n';
    const out = format(input, resolveOptions({ minColumn: 30, offset: 4 }));
    const lines = out.split('\n');
    expect(lines[1]!).toMatch(/a: 1 +,$/);
  });

  it('does not move commas inside single-line arrays', () => {
    const input = 'const a = [1,2,3];\n';
    const out = format(input, resolveOptions({ minColumn: 30, offset: 4 }));
    expect(out.split('\n')[0]!).toMatch(/\[1,2,3\]/);
  });

  it('preserves blank lines', () => {
    const input = 'foo();\n\nbar();\n';
    const out = format(input, resolveOptions({ minColumn: 30, offset: 4 }));
    const lines = out.split('\n');
    expect(lines[1]).toBe('');
  });

  it('respects useTabs for body indentation but uses spaces for right padding', () => {
    const input = 'function f() {\n  return 1;\n}\n';
    const out = format(input, resolveOptions({ minColumn: 40, offset: 4, useTabs: true }));
    const body = out.split('\n')[1]!;
    expect(body.startsWith('\t')).toBe(true);
    expect(body.trimEnd().endsWith('}')).toBe(true);
    const afterBody = body.slice(body.indexOf(';') + 1);
    expect(afterBody.includes('\t')).toBe(false);
  });

  it('honours minColumn even when content is short', () => {
    const input = 'a();\n';
    const out = format(input, resolveOptions({ minColumn: 50, offset: 0 }));
    const line = out.split('\n')[0]!;
    const semiIdx = line.indexOf(';');
    expect(semiIdx).toBeGreaterThanOrEqual(50 - 1);
  });

  it('does not move semicolons when semicolon option is false', () => {
    const input = 'foo();\nbar();\n';
    const out = format(input, resolveOptions({ semicolon: false, minColumn: 30, offset: 4 }));
    expect(out.split('\n')[0]!).toBe('foo();');
  });

  it('does not move braces when brackets option is false', () => {
    const input = 'function f() {\n  return 1;\n}\n';
    const out = format(
      input,
      resolveOptions({
        brackets: false,
        semicolon: false,
        minColumn: 30,
        offset: 4,
      }),
    );
    expect(out.split('\n')[0]!).toBe('function f() {');
  });

  it('idempotency: formatting twice gives the same result', () => {
    const input = 'function foo() {\n  if (a) {\n    bar();\n  }\n}\n';
    const opts = resolveOptions({ minColumn: 60, offset: 8 });
    const once = format(input, opts);
    const twice = format(once, opts);
    expect(twice).toBe(once);
  });
});

describe('format / ruby mode', () => {
  it('injects a declaration as the first line', () => {
    const input = 'function f() {\n  return 1;\n}\n';
    const out = format(input, resolveOptions({ mode: 'ruby', minColumn: 60, offset: 4 }));
    expect(out.split('\n')[0]!.trimStart()).toBe('let end=null;');
  });

  it('appends end keywords for closed blocks', () => {
    const input = 'function f() {\n  return 1;\n}\n';
    const out = format(input, resolveOptions({ mode: 'ruby', minColumn: 60, offset: 4 }));
    const lines = out.split('\n').filter((l) => l.trim().length > 0);
    expect(lines.at(-1)!.trim()).toBe('end');
  });

  it('does not emit end between if/else (smartEnd)', () => {
    const input = 'function f() {\n  if (a) {\n    x();\n  } else {\n    y();\n  }\n}\n';
    const out = format(input, resolveOptions({ mode: 'ruby', minColumn: 80, offset: 8 }));
    const endLines = out.split('\n').filter((l) => l.trim() === 'end');
    expect(endLines.length).toBe(2);
  });

  it('uses a custom variableName', () => {
    const input = 'function f() {\n  return 1;\n}\n';
    const out = format(
      input,
      resolveOptions({
        mode: 'ruby',
        ruby: { variableName: 'fin' },
        minColumn: 60,
        offset: 4,
      }),
    );
    expect(out).toContain('let fin=null;');
    expect(out.split('\n').some((l) => l.trim() === 'fin')).toBe(true);
  });

  it('does not inject declaration when injectDeclaration is false', () => {
    const input = 'function f() {\n  return 1;\n}\n';
    const out = format(
      input,
      resolveOptions({
        mode: 'ruby',
        ruby: { injectDeclaration: false },
        minColumn: 60,
        offset: 4,
      }),
    );
    expect(out).not.toContain('let end=null;');
  });

  it('does not inject end inside interface body', () => {
    const input = 'interface User {\n  name: string;\n}\n';
    const out = format(input, resolveOptions({ mode: 'ruby', minColumn: 60, offset: 4 }));
    // end is injected after the closing } of interface (like Ruby class/module)
    const endLines = out.split('\n').filter((l) => l.trim() === 'end');
    expect(endLines.length).toBe(1);
  });

  it('declaration is on line 1 even when file starts with interface', () => {
    const input = 'interface User {\n  name: string;\n}\nfunction f() {\n  return 1;\n}\n';
    const out = format(input, resolveOptions({ mode: 'ruby', minColumn: 60, offset: 4 }));
    expect(out.split('\n')[0]!.trimStart()).toBe('let end=null;');
  });

  it('does not inject end after object literal items in an array', () => {
    const input = 'const a = [\n  { x: 1 },\n  { x: 2 },\n];\n';
    const out = format(input, resolveOptions({ mode: 'ruby', minColumn: 60, offset: 4 }));
    expect(out.split('\n').filter((l) => l.trim() === 'end')).toHaveLength(0);
  });

  it('does not inject end after a multiline object literal assignment', () => {
    const input = 'const obj = {\n  a: 1,\n  b: 2,\n};\n';
    const out = format(input, resolveOptions({ mode: 'ruby', minColumn: 60, offset: 4 }));
    expect(out.split('\n').filter((l) => l.trim() === 'end')).toHaveLength(0);
  });

  it('does not inject declaration or end for CSS files (via plugin)', () => {
    const input = '.foo {\n  color: red;\n}\n';
    const out = format(
      input,
      resolveOptions({ mode: 'ruby', minColumn: 60, offset: 4 }),
      '.css',
      cssPlugin,
    );
    expect(out).not.toContain('null');
    expect(out.split('\n').some((l) => l.trim() === 'end')).toBe(false);
  });

  it('does not inject declaration or end for CSS files without any plugin (no ruby compat)', () => {
    const input = '.foo {\n  color: red;\n}\n';
    // No plugin registered for .css → core JS_TS_EXTS doesn't include .css → ruby skipped
    const out = format(input, resolveOptions({ mode: 'ruby', minColumn: 60, offset: 4 }), '.css');
    expect(out).not.toContain('null');
    expect(out.split('\n').some((l) => l.trim() === 'end')).toBe(false);
  });

  it('injects PHP-style declaration for PHP files (via plugin)', () => {
    const input = '<?php\nfunction f() {\n  return 1;\n}\n';
    const out = format(
      input,
      resolveOptions({ mode: 'ruby', minColumn: 60, offset: 4 }),
      '.php',
      phpPlugin,
    );
    expect(out).toContain('$end=null;');
    const lines = out.split('\n');
    expect(lines[0]!.trim()).toBe('<?php');
    expect(lines.some((l) => l.trim() === '$end')).toBe(true);
  });

  it('uses $end statement in PHP files (via plugin)', () => {
    const input = '<?php\nfunction f() {\n  return 1;\n}\n';
    const out = format(
      input,
      resolveOptions({ mode: 'ruby', minColumn: 60, offset: 4 }),
      '.php',
      phpPlugin,
    );
    expect(out.split('\n').some((l) => l.trim() === '$end')).toBe(true);
    expect(out.split('\n').some((l) => l.trim() === 'end')).toBe(false);
  });

  it('does not inject declaration or end for Java files (via plugin)', () => {
    const input = 'public class Foo {\n  void bar() {\n    System.out.println("hi");\n  }\n}\n';
    const out = format(
      input,
      resolveOptions({ mode: 'ruby', minColumn: 60, offset: 4 }),
      '.java',
      javaPlugin,
    );
    expect(out).not.toContain('null');
    expect(out.split('\n').some((l) => l.trim() === 'end')).toBe(false);
  });

  it('does not inject declaration or end for C# files (via plugin)', () => {
    const input = 'class Foo {\n  void Bar() {\n    Console.WriteLine("hi");\n  }\n}\n';
    const out = format(
      input,
      resolveOptions({ mode: 'ruby', minColumn: 60, offset: 4 }),
      '.cs',
      csPlugin,
    );
    expect(out).not.toContain('null');
    expect(out.split('\n').some((l) => l.trim() === 'end')).toBe(false);
  });

  it('uses const declaration and end statement for Rust files (via plugin)', () => {
    const input = 'fn main() {\n  println!("hello");\n}\n';
    const out = format(
      input,
      resolveOptions({ mode: 'ruby', minColumn: 60, offset: 4 }),
      '.rs',
      rustPlugin,
    );
    expect(out).toContain('const end:()=();');
    expect(out.split('\n').some((l) => l.trim() === 'end')).toBe(true);
  });

  it('uses _ = end statement and inserts declaration before first func for Go (via plugin)', () => {
    const input = 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("hello")\n}\n';
    const out = format(
      input,
      resolveOptions({ mode: 'ruby', minColumn: 60, offset: 4 }),
      '.go',
      goPlugin,
    );
    expect(out).toContain('var end any=nil');
    expect(out.split('\n').some((l) => l.trim() === '_ = end')).toBe(true);
    const lines = out.split('\n');
    expect(lines[0]!.trim()).toBe('package main');
  });

  it('substitutes custom variableName into language default template', () => {
    const input = '<?php\nfunction f() {\n  return 1;\n}\n';
    const out = format(
      input,
      resolveOptions({
        mode: 'ruby',
        ruby: { variableName: 'fin' },
        minColumn: 60,
        offset: 4,
      }),
      '.php',
      phpPlugin,
    );
    expect(out).toContain('$fin=null;');
  });
});
