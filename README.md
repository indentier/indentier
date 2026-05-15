<div align="center">

  <img src="./icon.png" width="256" height="256" alt="Indentier">

# Indentier

</div>

[![npm version](https://img.shields.io/npm/v/indentier.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/indentier)
[![npm downloads](https://img.shields.io/npm/dm/indentier.svg?color=cb3837&logo=npm)](https://www.npmjs.com/package/indentier)
[![CI](https://github.com/indentier/indentier/actions/workflows/ci.yml/badge.svg)](https://github.com/indentier/indentier/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/node/v/indentier.svg?logo=node.js)](https://nodejs.org)
[![Types](https://img.shields.io/npm/types/indentier.svg?logo=typescript)](#)

> A silly formatter that hides `{`, `}`, `;`, and trailing `,` in the right margin — letting curly-brace languages pretend they're Python or Ruby.

日本語版: [README-ja.md](./README-ja.md)

## Before / After

<!-- prettier-ignore -->
```js
function sayHello(content) {
  if (!content) {
    console.log("...");
  } else if (typeof content !== "string") {
    console.log(":rage:");
  } else {
    console.log(content);
  }
}
```

<!-- prettier-ignore -->
```js
// default mode
function sayHello(content)                                                      {
  if (!content)                                                                 {
    console.log("...")                                                          ;}
  else if (typeof content !== "string")                                         {
    console.log(":rage:")                                                       ;}
  else                                                                          {
    console.log(content)                                                        ;}}
```

<!-- prettier-ignore -->
```js
// ruby mode
                                                                                let end=null;
function sayHello(content)                                                      {
  if (!content)                                                                 {
    console.log("...")                                                          ;}
  else if (typeof content !== "string")                                         {
    console.log(":rage:")                                                       ;}
  else                                                                          {
    console.log(content)                                                        ;}}
  end
end
```

## Install

```sh
npm i -D indentier
```

Requires **Node.js 22+**.

## Usage

```sh
npx indentier --init                    # scaffold .indentierrc.json and .indentierignore
npx indentier src/index.ts              # print to stdout
npx indentier --write "src/**/*.ts"     # format in place
npx indentier --check "src/**/*.ts"     # exit 1 if any file would change
```

CLI options:

```
-w, --write        Format files in place
-c, --check        Exit 1 if any file would change
--init             Create .indentierrc.json and .indentierignore
--mode <mode>      Override mode (default | ruby)
--offset <number>  Override the offset
--no-semi          Do not move semicolons
--no-comma         Do not move trailing commas
```

## Modes

<!-- prettier-ignore -->
| Mode | What it does |
|-|-|
| `default` | Pushes every symbol to the right margin. Source semantics untouched. |
| `ruby` | `default` plus a synthetic `end` after each closing brace; `let end=null;` is injected right after the first `{` so the file still runs. |

## Configuration

Indentier is `cosmiconfig`-powered and auto-discovers:

- `package.json` (`"indentier"` field)
- `.indentierrc.{json,yaml,yml,js,cjs,mjs,ts,cts,mts}`
- `indentier.config.{js,cjs,mjs,ts,cts,mts}`

```jsonc
// .indentierrc.json
{
  "mode": "default",
  "tabWidth": 2,
  "useTabs": false,
  "offset": 20,
  "minColumn": 80,
  "brackets": true,
  "semicolon": true,
  "comma": true,
  "ruby": { "variableName": "end", "injectDeclaration": true, "smartEnd": true },
  "plugins": []
}
```

<!-- prettier-ignore -->
| Key | Type | Default | Description |
|-|-|-|-|
| `mode` | `"default" \| "ruby"` | `"default"` | Formatting mode |
| `tabWidth` | `number` | `2` | Indent width for normalization |
| `useTabs` | `boolean` | `false` | Body uses tabs (right padding stays spaces) |
| `offset` | `number` | `20` | Columns appended after the longest body |
| `minColumn` | `number` | `80` | Minimum column for floated symbols |
| `brackets` | `boolean` | `true` | Move `{` and `}` |
| `semicolon` | `boolean` | `true` | Move `;` |
| `comma` | `boolean` | `true` | Move trailing `,` (multi-line) |
| `ruby.variableName` | `string` | `"end"` | Synthetic terminator identifier |
| `ruby.injectDeclaration` | `boolean` | `true` | Inject a variable declaration right after the first `{` |
| `ruby.smartEnd` | `boolean` | `true` | Skip `end` before `else` / `catch` / `finally` / `while` |
| `overrides` | `Override[]` | `[]` | Per-glob option overrides |
| `plugins` | `string[]` | `[]` | Plugin package names to load (see [indentier.github.io/plugins](https://indentier.github.io/plugins/)) |

### `.indentierignore`

`.gitignore`-compatible globs. No paths are ignored implicitly — create the file (or run `indentier --init`) to exclude `node_modules`, build outputs, etc.

## Plugins

The core package handles **JavaScript, TypeScript, and the JSON family** (`.json`, `.jsonc`, `.json5`) natively. For other languages, install a plugin:

```sh
npm i -D @indentier/plugin-rust @indentier/plugin-go
```

```jsonc
// .indentierrc.json
{
  "plugins": ["@indentier/plugin-rust", "@indentier/plugin-go"]
}
```

For the full list of supported languages and plugins, see **[indentier.github.io/plugins](https://indentier.github.io/plugins/)**.

## API

```ts
import { format, loadConfig } from 'indentier'

const { options } = await loadConfig()
const output = format(source, options)
```

CJS also works: `const { format } = require('indentier')`.

To load plugins programmatically:

```ts
import { format, loadPlugins, getPlugin } from 'indentier'
import path from 'node:path'

await loadPlugins(['@indentier/plugin-rust'])
const plugin = getPlugin('.rs')
const output = format(source, options, '.rs', plugin)
```

## Supported languages

JS/TS and the JSON family (`.json`, `.jsonc`, `.json5`) are built in. For other languages see **[indentier.github.io/plugins](https://indentier.github.io/plugins/)** for the full list and plugin packages.

<!-- prettier-ignore -->
```json
{
  "name": "demo",
  "version": "1.0.0",
  "tags": ["one", "two", "three"],
  "nested": {
    "a": 1,
    "b": 2
  }
}
```

<!-- prettier-ignore -->
```json
                                                                                {
  "name": "demo"                                                                ,
  "version": "1.0.0"                                                            ,
  "tags": ["one", "two", "three"]                                               ,
  "nested":                                                                     {
    "a": 1                                                                      ,
    "b": 2                                                                      }}
```

Parsing is heuristic and regex-based — Indentier deliberately avoids ASTs to stay fast and language-agnostic.

## License

[MIT](./LICENSE) © otoneko. See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup.
