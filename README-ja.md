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

> `{` `}` `;` `,` を右端に隠して、波括弧言語に Python や Ruby のフリをさせる、ふざけたフォーマッター。

English: [README.md](./README.md)

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
// default モード
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
// ruby モード
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

## インストール

```sh
npm i -D indentier
```

**Node.js 22 以降** が必要です。

## 使い方

```sh
npx indentier --init                    # .indentierrc.json と .indentierignore を作成
npx indentier src/index.ts              # stdout に出力
npx indentier --write "src/**/*.ts"     # 上書き
npx indentier --check "src/**/*.ts"     # 差分があれば exit 1
```

CLI オプション:

```
-w, --write        ファイルを上書き保存
-c, --check        差分があれば exit 1
--init             .indentierrc.json と .indentierignore を作成
--mode <mode>      モードを上書き (default | ruby)
--offset <number>  オフセット幅を上書き
--no-semi          セミコロンの移動を無効化
--no-comma         行末カンマの移動を無効化
```

## モード

<!-- prettier-ignore -->
| モード | 動作 |
|-|-|
| `default` | 記号をすべて右端へ追いやるだけ。意味的には何も変えない |
| `ruby` | `default` に加え、閉じ波括弧の後ろに擬似 `end` を生やす。最初の `{` の直後に `let end=null;` を仕込むことで、コード自体は動いたまま |

## 設定

Indentier は `cosmiconfig` ベースで以下を自動探索します:

- `package.json` の `"indentier"` フィールド
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
| キー | 型 | デフォルト | 効果 |
|-|-|-|-|
| `mode` | `"default" \| "ruby"` | `"default"` | フォーマットモード |
| `tabWidth` | `number` | `2` | 正規化時のインデント幅 |
| `useTabs` | `boolean` | `false` | 本文インデントをタブで構成（右パディングはスペース） |
| `offset` | `number` | `20` | 最長行末から記号配置までの余白 |
| `minColumn` | `number` | `80` | 記号を配置する最低カラム |
| `brackets` | `boolean` | `true` | `{` `}` を右端に隠す |
| `semicolon` | `boolean` | `true` | `;` を右端に隠す |
| `comma` | `boolean` | `true` | 行末の `,` を右端に隠す（マルチライン時のみ） |
| `ruby.variableName` | `string` | `"end"` | 擬似終端識別子 |
| `ruby.injectDeclaration` | `boolean` | `true` | 最初の `{` の直後に変数宣言を注入 |
| `ruby.smartEnd` | `boolean` | `true` | `else` / `catch` / `finally` / `while` の前で `end` 挿入を抑制 |
| `overrides` | `Override[]` | `[]` | glob 単位の設定上書き |
| `plugins` | `string[]` | `[]` | 読み込むプラグインパッケージ名 ([indentier.github.io/plugins](https://indentier.github.io/plugins/) 参照) |

### `.indentierignore`

`.gitignore` 互換のグロブ構文。**暗黙的な除外は無し** — `node_modules` やビルド成果物を除外したいなら自分でファイルを置くか `indentier --init` で雛形を作成。

## プラグイン

コアパッケージは **JavaScript / TypeScript / JSON 系** (`.json`, `.jsonc`, `.json5`) をネイティブにサポートします。  
他の言語に対応させるには、対応するプラグインをインストールして設定に追記してください:

```sh
npm i -D @indentier/plugin-rust @indentier/plugin-go
```

```jsonc
// .indentierrc.json
{
  "plugins": ["@indentier/plugin-rust", "@indentier/plugin-go"]
}
```

対応言語の全一覧は **[indentier.github.io/plugins](https://indentier.github.io/plugins/)** を参照してください。

## API

```ts
import { format, loadConfig } from 'indentier'

const { options } = await loadConfig()
const output = format(source, options)
```

CJS も利用可能: `const { format } = require('indentier')`。

プラグインをコードから読み込む場合:

```ts
import { format, loadPlugins, getPlugin } from 'indentier'

await loadPlugins(['@indentier/plugin-rust'])
const plugin = getPlugin('.rs')
const output = format(source, options, '.rs', plugin)
```

## 対応言語

JS/TS と JSON 系 (`.json`, `.jsonc`, `.json5`) はコアに内蔵。その他の言語は **[indentier.github.io/plugins](https://indentier.github.io/plugins/)** で全一覧とプラグインパッケージを確認できます。

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

正規表現ベースのヒューリスティック処理を採用しており、AST を使わないため軽量・言語非依存です。

## ライセンス

[MIT](./LICENSE) © otoneko. 開発参加方法は [CONTRIBUTING-ja.md](./CONTRIBUTING-ja.md) を参照。
