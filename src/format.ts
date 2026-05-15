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

    const closes = countChar(line.trailing, '}');
    const opens = countChar(line.trailing, '{');

    const next = findNextContent(lines, i + 1);
    const isContinuation =
      smartEnd && !!next && (CONTINUATION_RE.test(next.body) || CLOSING_PAREN_RE.test(next.body));
    // Idempotency: existing `end` lines in input should not be duplicated.
    const nextIsEnd = !!next && next.body === endBody && !next.trailing;

    for (let c = 0; c < closes; c++) {
      const frame = stack.pop() ?? { indent: line.indent, isBlock: false };
      if (!frame.isBlock) continue;
      if (smartEnd && c === closes - 1 && isContinuation) continue;
      if (nextIsEnd) continue;
      out.push({ indent: frame.indent, body: endBody, trailing: '' });
    }
    for (let o = 0; o < opens; o++) {
      stack.push({ indent: line.indent, isBlock: isBlockOpener(line.body) });
    }
  }

  // Flush remaining open blocks (defensive — well-formed input pops cleanly)
  while (stack.length > 0) {
    const frame = stack.pop()!;
    if (frame.isBlock) out.push({ indent: frame.indent, body: endBody, trailing: '' });
  }
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

  // Idempotency: if any existing line already reconstructs to the template,
  // re-normalise it to a body-less trailing line for stable rendering.
  const existingIdx = lines.findIndex((l) => `${l.body}${l.trailing}` === tpl);
  if (existingIdx >= 0) {
    lines[existingIdx] = { indent: 0, body: '', trailing: tpl };
    return lines;
  }

  const idx = plugin?.declarationInsertIndex?.(lines) ?? 0;
  lines.splice(idx, 0, { indent: 0, body: '', trailing: tpl });
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
    lines = injectRubyDeclaration(injectRubyEnds(lines, opts, plugin), opts, ext, plugin);
  }

  const col = targetColumn(lines, opts);
  return lines.map((l) => renderLine(l, col, opts)).join('\n');
}
