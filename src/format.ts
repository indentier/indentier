import type { ResolvedOptions, IndentierPlugin } from './types.ts';
import { defaultDeclarationTemplate, isRubyCompatible } from './language.ts';

interface ParsedLine {
  indent: number;
  leadingClose: string;
  body: string;
  trailing: string;
  blank: boolean;
}

interface RenderLine {
  indent: number;
  body: string;
  trailing: string;
}

interface StackFrame {
  indent: number;
  isBlock: boolean;
}

const LEADING_CLOSE_RE = /^(\}+)/;
const CONTINUATION_RE = /^\s*(?:else|catch|finally|while)\b/;
const CLOSING_PAREN_RE = /^\s*[)\]]/;
const BLOCK_KEYWORD_RE =
  /\b(?:function|class|interface|enum|namespace|declare|type|if|else|while|for|do|try|catch|finally|switch)\b/;

/**
 * Heuristic: does the trailing `{` on a line open a code block (eligible for
 * `end` injection), or an object/type literal?
 */
function isBlockOpener(body: string): boolean {
  if (/=>\s*$/.test(body)) return true;
  if (BLOCK_KEYWORD_RE.test(body)) return true;
  // Bare assignment, object property value, or `return { ... }` are all literals
  if (/(?<![=!<>])=\s*$/.test(body)) return false;
  if (/:\s*$/.test(body)) return false;
  if (/\breturn\s*$/.test(body)) return false;
  return true;
}

function countChar(s: string, ch: string): number {
  let n = 0;
  for (const c of s) if (c === ch) n++;
  return n;
}

// --- parsing ---

function countIndent(s: string, tabWidth: number): { spaces: number; rest: string } {
  let i = 0;
  let spaces = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') spaces++;
    else if (c === '\t') spaces += tabWidth - (spaces % tabWidth);
    else break;
    i++;
  }
  return { spaces, rest: s.slice(i) };
}

function trailingTokenClass(opts: ResolvedOptions): string {
  return (opts.brackets ? '\\{\\}' : '') + (opts.semicolon ? ';' : '') + (opts.comma ? ',' : '');
}

function parseLine(raw: string, opts: ResolvedOptions): ParsedLine {
  const trimmed = raw.replace(/\s+$/, '');
  if (!trimmed) return { indent: 0, leadingClose: '', body: '', trailing: '', blank: true };

  const { spaces, rest } = countIndent(trimmed, opts.tabWidth);

  const leadMatch = opts.brackets ? rest.match(LEADING_CLOSE_RE) : null;
  const leadingClose = leadMatch?.[1] ?? '';
  let body = leadingClose ? rest.slice(leadingClose.length).replace(/^\s+/, '') : rest;

  const cls = trailingTokenClass(opts);
  const trailMatch = cls ? body.match(new RegExp(`[${cls}]+$`)) : null;
  const trailing = trailMatch?.[0] ?? '';
  if (trailing) body = body.slice(0, -trailing.length).replace(/\s+$/, '');

  return { indent: spaces, leadingClose, body, trailing, blank: false };
}

// --- merge pure-symbol lines into the preceding content line ---

function mergeSymbols(parsed: ParsedLine[]): RenderLine[] {
  const out: RenderLine[] = [];
  let lastContent = -1;

  for (const p of parsed) {
    if (p.blank) {
      out.push({ indent: 0, body: '', trailing: '' });
      continue;
    }
    if (!p.body) {
      const symbols = p.leadingClose + p.trailing;
      if (lastContent >= 0) {
        out[lastContent]!.trailing += symbols;
      } else {
        out.push({ indent: 0, body: '', trailing: symbols });
        lastContent = out.length - 1;
      }
      continue;
    }
    if (p.leadingClose && lastContent >= 0) {
      out[lastContent]!.trailing += p.leadingClose;
    }
    out.push({ indent: p.indent, body: p.body, trailing: p.trailing });
    lastContent = out.length - 1;
  }
  return out;
}

// --- ruby-mode passes ---

function findNextContent(lines: RenderLine[], from: number): RenderLine | undefined {
  for (let j = from; j < lines.length; j++) {
    if (lines[j]!.body.length > 0) return lines[j];
  }
  return undefined;
}

function injectRubyEnds(
  lines: RenderLine[],
  opts: ResolvedOptions,
  plugin: IndentierPlugin | undefined,
): RenderLine[] {
  const { variableName, smartEnd } = opts.ruby;
  const endBody = plugin?.getEndStatement?.(variableName) ?? variableName;
  const stack: StackFrame[] = [];
  const out: RenderLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    out.push(line);
    if (!line.body && !line.trailing) continue;

    // Body braces are always inline (object/expression literals), never block openers.
    for (const c of line.body) {
      if (c === '{') stack.push({ indent: line.indent, isBlock: false });
      else if (c === '}') stack.pop();
    }

    const trailing = line.trailing;
    const closes = countChar(trailing, '}');
    const blockOpener = isBlockOpener(line.body);

    const next = findNextContent(lines, i + 1);
    const isContinuation =
      smartEnd && !!next && (CONTINUATION_RE.test(next.body) || CLOSING_PAREN_RE.test(next.body));
    // Idempotency: an already-injected `end` line that follows must not be
    // duplicated. It may now carry relocated closing braces in its trailing,
    // so match on the body alone rather than requiring an empty trailing.
    const nextIsEnd = !!next && next.body === endBody;

    // Walk the trailing symbols in source order, relocating closing braces so
    // that each injected `end` lands *inside* the block it closes. When several
    // closes pile onto one line (e.g. `;}}` from `  }` + `});`), emitting every
    // `end` after the whole trailing would push the inner `end` past the outer
    // `}` — outside its block, which is a syntax error after `=> {…})`. Instead
    // the brace that closes a block stays put, its `end` follows, and any later
    // brace rides along on that `end` line so the nesting stays valid.
    line.trailing = '';
    let sink: RenderLine = line;
    let closeIdx = 0;
    for (const ch of trailing) {
      if (ch === '}') {
        sink.trailing += ch;
        const frame = stack.pop() ?? { indent: line.indent, isBlock: false };
        const lastClose = closeIdx === closes - 1;
        closeIdx++;
        const skip = (smartEnd && lastClose && isContinuation) || nextIsEnd;
        if (frame.isBlock && !skip) {
          sink = { indent: frame.indent, body: endBody, trailing: '' };
          out.push(sink);
        }
      } else {
        // Openers and separators stay on the originating content line; only a
        // closing brace may migrate onto a following `end`.
        line.trailing += ch;
        if (ch === '{') stack.push({ indent: line.indent, isBlock: blockOpener });
      }
    }
  }

  // Flush remaining open blocks (defensive — well-formed input pops cleanly)
  while (stack.length > 0) {
    const frame = stack.pop()!;
    if (frame.isBlock) out.push({ indent: frame.indent, body: endBody, trailing: '' });
  }
  return out;
}

/**
 * Indentation-based `end` injection (offside rule) for brace-less languages
 * such as CoffeeScript.
 *
 * A block is detected purely from indentation: a content line opens a block when
 * the next content line is more deeply indented. The block closes at the first
 * later content line whose indent is shallower-or-equal, and an `end` is emitted
 * at the opener's indent just before that line. Bracket/array literals (whose
 * line ends with an exiled `{`/`[`) are skipped — they are closed by a brace,
 * not by a dedent.
 *
 * Idempotency: an already-injected `end` line closes its block without emitting a
 * second one, and continuation keywords (`else`/`catch`/…) at the block's own
 * indent re-open rather than terminate it — mirroring brace-mode `smartEnd`.
 */
function injectIndentationEnds(
  lines: RenderLine[],
  opts: ResolvedOptions,
  plugin: IndentierPlugin | undefined,
  declTemplate: string | null,
): RenderLine[] {
  const { variableName, smartEnd } = opts.ruby;
  const endBody = plugin?.getEndStatement?.(variableName) ?? variableName;
  const out: RenderLine[] = [];
  const stack: number[] = []; // indents of open block openers

  // An already-injected declaration is rendered body-less in the right margin,
  // but on a second pass it re-parses as a content line at a huge (column)
  // indent. Excluding it keeps the offside rule from mistaking the preceding
  // line for a block opener — see the idempotency note above.
  const isDeclaration = (line: RenderLine): boolean =>
    declTemplate !== null && line.body + line.trailing === declTemplate;

  const nextContentIndent = (from: number): number | null => {
    for (let j = from; j < lines.length; j++) {
      const l = lines[j]!;
      if (l.body.length > 0 && !isDeclaration(l)) return l.indent;
    }
    return null;
  };

  // Insert the emitted `end` lines directly after the block body, *above* any
  // trailing blank lines already in `out`. Appending them as-is would leave a
  // blank between the code and its `end` (e.g. a blank before the next
  // statement), which reads unnaturally.
  const insertEnds = (ends: RenderLine[]): void => {
    if (ends.length === 0) return;
    let at = out.length;
    while (at > 0 && !out[at - 1]!.body && !out[at - 1]!.trailing) at--;
    out.splice(at, 0, ...ends);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.body || isDeclaration(line)) {
      out.push(line);
      continue;
    }

    const cur = line.indent;
    const isEndLine = line.body === endBody;
    const isContinuation = smartEnd && CONTINUATION_RE.test(line.body);

    const ends: RenderLine[] = [];
    while (stack.length > 0 && cur <= stack[stack.length - 1]!) {
      const opener = stack.pop()!;
      // Skip the `end` when this line is itself an already-injected `end`
      // (idempotency) or continues the same block at its own indent.
      const skip = isEndLine || (isContinuation && cur === opener);
      if (!skip) ends.push({ indent: opener, body: endBody, trailing: '' });
    }
    insertEnds(ends);

    out.push(line);

    // A trailing `{`/`[` means the deeper lines belong to a bracket literal,
    // which closes with a brace rather than a dedent — never an `end` block.
    const opensBracketLiteral = /[{[]/.test(line.trailing);
    const next = nextContentIndent(i + 1);
    if (!opensBracketLiteral && next !== null && next > cur) stack.push(cur);
  }

  const tail: RenderLine[] = [];
  while (stack.length > 0) {
    tail.push({ indent: stack.pop()!, body: endBody, trailing: '' });
  }
  insertEnds(tail);
  return out;
}

function resolveDeclarationTemplate(
  opts: ResolvedOptions,
  ext: string,
  plugin: IndentierPlugin | undefined,
): string | null {
  const { declarationTemplate, variableName } = opts.ruby;
  const tpl =
    declarationTemplate !== undefined
      ? declarationTemplate
      : plugin?.declarationTemplate !== undefined
        ? plugin.declarationTemplate
        : defaultDeclarationTemplate(ext);
  return tpl === null ? null : tpl.replace(/\bend\b/, variableName);
}

function injectRubyDeclaration(
  lines: RenderLine[],
  opts: ResolvedOptions,
  ext: string,
  plugin: IndentierPlugin | undefined,
): RenderLine[] {
  if (!opts.ruby.injectDeclaration) return lines;
  const tpl = resolveDeclarationTemplate(opts, ext, plugin);
  if (tpl === null) return lines;

  // Indentation-based languages (e.g. CoffeeScript) treat leading whitespace as
  // syntax, so the declaration must sit at column 0 as a real body line. Brace
  // languages keep it as a right-aligned, body-less trailing line.
  const declLine: RenderLine = plugin?.indentationBased
    ? { indent: 0, body: tpl, trailing: '' }
    : { indent: 0, body: '', trailing: tpl };

  // Idempotency: if any existing line already reconstructs to the template,
  // re-normalise it for stable rendering.
  const existingIdx = lines.findIndex((l) => `${l.body}${l.trailing}` === tpl);
  if (existingIdx >= 0) {
    lines[existingIdx] = declLine;
    return lines;
  }

  const idx = plugin?.declarationInsertIndex?.(lines) ?? 0;
  const blanksAfter = Math.max(0, plugin?.declarationBlankLinesAfter ?? 0);
  const blanks: RenderLine[] = Array.from({ length: blanksAfter }, () => ({
    indent: 0,
    body: '',
    trailing: '',
  }));
  lines.splice(idx, 0, declLine, ...blanks);
  return lines;
}

// --- rendering ---

function renderIndent(spaces: number, opts: ResolvedOptions): string {
  if (!opts.useTabs) return ' '.repeat(spaces);
  return '\t'.repeat(Math.floor(spaces / opts.tabWidth)) + ' '.repeat(spaces % opts.tabWidth);
}

function targetColumn(lines: RenderLine[], opts: ResolvedOptions): number {
  let maxLen = 0;
  for (const line of lines) {
    if (!line.body) continue;
    const w = renderIndent(line.indent, opts).length + line.body.length;
    if (w > maxLen) maxLen = w;
  }
  return Math.max(maxLen + opts.offset, opts.minColumn);
}

function renderLine(line: RenderLine, col: number, opts: ResolvedOptions): string {
  if (!line.body && !line.trailing) return '';
  const indent = renderIndent(line.indent, opts);
  if (!line.body) {
    return ' '.repeat(Math.max(col - indent.length, 0)) + line.trailing;
  }
  const head = indent + line.body;
  if (!line.trailing) return head;
  return head + ' '.repeat(Math.max(col - head.length, 1)) + line.trailing;
}

// --- main entry ---

export function format(
  input: string,
  opts: ResolvedOptions,
  ext: string = '.js',
  plugin?: IndentierPlugin,
): string {
  const parsed = input.split(/\r?\n/).map((l) => parseLine(l, opts));
  let lines = mergeSymbols(parsed);

  const rubyEnabled =
    opts.mode === 'ruby' && (plugin ? (plugin.rubyCompatible ?? true) : isRubyCompatible(ext));
  if (rubyEnabled) {
    const ends = plugin?.indentationBased
      ? injectIndentationEnds(lines, opts, plugin, resolveDeclarationTemplate(opts, ext, plugin))
      : injectRubyEnds(lines, opts, plugin);
    lines = injectRubyDeclaration(ends, opts, ext, plugin);
  }

  const col = targetColumn(lines, opts);
  return lines.map((l) => renderLine(l, col, opts)).join('\n');
}
