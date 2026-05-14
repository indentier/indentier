# 貢献ガイド

English: [CONTRIBUTING.md](./CONTRIBUTING.md)

## セットアップ

```sh
pnpm install
pnpm test
pnpm build
pnpm lint
pnpm typecheck
```

## プレイグラウンド

`testplay/` は git 手動テスト用ディレクトリ。サンプルファイルを置いて以下のように試せます:

```sh
node dist/cli.mjs testplay/sample.js
node dist/cli.mjs --write testplay
```

## スクリプト

<!-- prettier-ignore -->
| スクリプト | 用途 |
|-|-|
| `pnpm dev` | tsdown を watch モードで実行 |
| `pnpm build` | `dist/` に ESM と CJS を出力 |
| `pnpm test` | vitest を 1 回実行 |
| `pnpm test:watch` | vitest を watch モードで実行 |
| `pnpm lint` / `lint:fix` | ESLint |
| `pnpm format` / `format:check` | Prettier |
| `pnpm typecheck` | `tsc --noEmit` |

## リリース手順

リリースは **Release** GitHub Actions ワークフローから実行します。手動でワークフローを起動し、バージョンを `x.y.z` または `x.y.z-tag` 形式で入力すると、lint / typecheck / test / build → バージョン bump コミット → タグ作成 → npm に provenance 付きで publish → GitHub Release 作成 までを自動で行います。

`-` を含むバージョン（プレリリース）は npm の `next` dist-tag で公開されます。

## PR

バグ修正・対応言語追加・パフォーマンス改善など歓迎します。push する前に `pnpm lint` と `pnpm test` を実行してください。
