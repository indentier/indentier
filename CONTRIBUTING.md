# Contributing

日本語版: [CONTRIBUTING-ja.md](./CONTRIBUTING-ja.md)

## Setup

```sh
pnpm install
pnpm test
pnpm build
pnpm lint
pnpm typecheck
```

## Playground

`testplay/` is a directory for manual experiments. Drop sample files there and run:

```sh
node dist/cli.mjs testplay/sample.js
node dist/cli.mjs --write testplay
```

## Scripts

<!-- prettier-ignore -->
| Script | Purpose |
|-|-|
| `pnpm dev` | tsdown in watch mode |
| `pnpm build` | Produce ESM + CJS bundles in `dist/` |
| `pnpm test` | Run vitest once |
| `pnpm test:watch` | Run vitest in watch mode |
| `pnpm lint` / `lint:fix` | ESLint |
| `pnpm format` / `format:check` | Prettier |
| `pnpm typecheck` | `tsc --noEmit` |

## Releasing

Releases are cut from the **Release** GitHub Actions workflow. Trigger it manually and enter the version (`x.y.z` or `x.y.z-tag`). The workflow lints / typechecks / tests / builds, commits the version bump, tags, publishes to npm with provenance, and creates a GitHub Release.

Prereleases (any version containing `-`) are published under the `next` dist-tag.

## PRs

PRs welcome — bug fixes, new language support, performance improvements, all good. Please run `pnpm lint` and `pnpm test` before pushing.
