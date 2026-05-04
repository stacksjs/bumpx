# Changelog
[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.2.5...v0.2.6)

### 🚀 Features

- **version-bump**: --only-changed-since pulls in transitive dependents ([545e92a](https://github.com/stacksjs/bumpx/commit/545e92a)) _(by Chris <chrisbreuer93@gmail.com>)_

### 🐛 Bug Fixes

- align docs config with @stacksjs/bunpress schema ([5004804](https://github.com/stacksjs/bumpx/commit/5004804)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **ts**: exclude docs/ from typecheck (bunpress not a dep) ([1d57c43](https://github.com/stacksjs/bumpx/commit/1d57c43)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- add setup-bun to publish-commit job ([5f56e92](https://github.com/stacksjs/bumpx/commit/5f56e92)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_

### 🤖 Continuous Integration

- drop redundant setup-bun (pantry installs bun via deps.yaml) ([f2be1e8](https://github.com/stacksjs/bumpx/commit/f2be1e8)) _(by glennmichael123 <gtorregosa@gmail.com>)_

### 🧹 Chores

- release v0.2.6 ([1a60b7a](https://github.com/stacksjs/bumpx/commit/1a60b7a)) _(by Chris <chrisbreuer93@gmail.com>)_
- refresh bun.lock and apply pickier --fix ([1dcd6bf](https://github.com/stacksjs/bumpx/commit/1dcd6bf)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- refresh bun.lock ([5c78e5e](https://github.com/stacksjs/bumpx/commit/5c78e5e)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- refresh bun.lock ([0c89c2b](https://github.com/stacksjs/bumpx/commit/0c89c2b)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- lint:fix ([a87190e](https://github.com/stacksjs/bumpx/commit/a87190e)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- refresh bun.lock to pick up latest pickier ([f26d473](https://github.com/stacksjs/bumpx/commit/f26d473)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- fresh install to pick up dtsx 0.9.14 and bunfig 0.15.9 ([286f792](https://github.com/stacksjs/bumpx/commit/286f792)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_

### Contributors

- _Chris <chrisbreuer93@gmail.com>_
- _chrisbreuer <chrisbreuer93@gmail.com>_
- _glennmichael123 <gtorregosa@gmail.com>_

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.2.4...v0.2.5)

## 🚀 Features

- **recursive**: --only-changed-since to skip unchanged leaf packages ([805146c](https://github.com/stacksjs/bumpx/commit/805146c)) _(by Chris <chrisbreuer93@gmail.com>)_

### 🐛 Bug Fixes

- chain pantry publish:commit calls for single-arg CLI ([8af054b](https://github.com/stacksjs/bumpx/commit/8af054b)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_

### 🧹 Chores

- release v0.2.5 ([583ca76](https://github.com/stacksjs/bumpx/commit/583ca76)) _(by Chris <chrisbreuer93@gmail.com>)_
- add more docs ([85d71e7](https://github.com/stacksjs/bumpx/commit/85d71e7)) _(by Chris <chrisbreuer93@gmail.com>)_
- fresh install to pick up pickier 0.1.21 ([04b26bf](https://github.com/stacksjs/bumpx/commit/04b26bf)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- fix lint errors ([dd1af77](https://github.com/stacksjs/bumpx/commit/dd1af77)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- auto-fix lint errors ([129dce3](https://github.com/stacksjs/bumpx/commit/129dce3)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- include md in pickier lint extensions ([02e905a](https://github.com/stacksjs/bumpx/commit/02e905a)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- update vscode config ([bb10b99](https://github.com/stacksjs/bumpx/commit/bb10b99)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- update dependencies ([8e6fa86](https://github.com/stacksjs/bumpx/commit/8e6fa86)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- repo cleanup and modernization ([333b90e](https://github.com/stacksjs/bumpx/commit/333b90e)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- repo cleanup and modernization ([0a40ac1](https://github.com/stacksjs/bumpx/commit/0a40ac1)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- remove @stacksjs/docs ([64272e4](https://github.com/stacksjs/bumpx/commit/64272e4)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- remove redundant docs/.vitepress ([e9d5fe0](https://github.com/stacksjs/bumpx/commit/e9d5fe0)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- remove .zed and .cursor folders ([3074f15](https://github.com/stacksjs/bumpx/commit/3074f15)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- use Pantry action for publish-commit and add job dependencies ([138ccf1](https://github.com/stacksjs/bumpx/commit/138ccf1)) _(by Chris <chrisbreuer93@gmail.com>)_
- remove file ignores from pickier config ([ec99c35](https://github.com/stacksjs/bumpx/commit/ec99c35)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- add CLAUDE.md and CHANGELOG.md to pickier ignores ([4699180](https://github.com/stacksjs/bumpx/commit/4699180)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- remove .pickierignore ([a2c7d1d](https://github.com/stacksjs/bumpx/commit/a2c7d1d)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- update better-dx to ^0.2.7 ([c8fb485](https://github.com/stacksjs/bumpx/commit/c8fb485)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- enrich CLAUDE.md with detailed project context from README ([3424961](https://github.com/stacksjs/bumpx/commit/3424961)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- enrich CLAUDE.md with detailed project context from README ([76853cf](https://github.com/stacksjs/bumpx/commit/76853cf)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- update CLAUDE.md with project context and crosswind details ([dd62ef7](https://github.com/stacksjs/bumpx/commit/dd62ef7)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- add proper claude code guidelines ([2a01d87](https://github.com/stacksjs/bumpx/commit/2a01d87)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- use pantry monorepo action instead of pantry-setup ([3a64b32](https://github.com/stacksjs/bumpx/commit/3a64b32)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- ignore claude config in linter ([80dbcd9](https://github.com/stacksjs/bumpx/commit/80dbcd9)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- add claude code guidelines ([998216b](https://github.com/stacksjs/bumpx/commit/998216b)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- wip ([2bd5766](https://github.com/stacksjs/bumpx/commit/2bd5766)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- wip ([de3b4a5](https://github.com/stacksjs/bumpx/commit/de3b4a5)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- wip ([7c3011f](https://github.com/stacksjs/bumpx/commit/7c3011f)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- wip ([7e6ce47](https://github.com/stacksjs/bumpx/commit/7e6ce47)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- wip ([99f17fa](https://github.com/stacksjs/bumpx/commit/99f17fa)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- wip ([807af3d](https://github.com/stacksjs/bumpx/commit/807af3d)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- wip ([b7b7e16](https://github.com/stacksjs/bumpx/commit/b7b7e16)) _(by chrisbreuer <chrisbreuer93@gmail.com>)_
- wip ([7a6927e](https://github.com/stacksjs/bumpx/commit/7a6927e)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- wip ([f160557](https://github.com/stacksjs/bumpx/commit/f160557)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- wip ([84cf35f](https://github.com/stacksjs/bumpx/commit/84cf35f)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- wip ([8fb07f5](https://github.com/stacksjs/bumpx/commit/8fb07f5)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- wip ([be16d00](https://github.com/stacksjs/bumpx/commit/be16d00)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- wip ([aaf4b3d](https://github.com/stacksjs/bumpx/commit/aaf4b3d)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- wip ([bcde243](https://github.com/stacksjs/bumpx/commit/bcde243)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- wip ([45b85d4](https://github.com/stacksjs/bumpx/commit/45b85d4)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- wip ([7c1b6d8](https://github.com/stacksjs/bumpx/commit/7c1b6d8)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- wip ([af0e242](https://github.com/stacksjs/bumpx/commit/af0e242)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- wip ([fe013a4](https://github.com/stacksjs/bumpx/commit/fe013a4)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- wip ([da9f5e7](https://github.com/stacksjs/bumpx/commit/da9f5e7)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **deps**: update dependency buddy-bot to ^0.9.12 (#32) ([fe964af](https://github.com/stacksjs/bumpx/commit/fe964af)) _(by [renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>](https://github.com/renovate[bot]))_ ([#32](https://github.com/stacksjs/bumpx/issues/32), [#32](https://github.com/stacksjs/bumpx/issues/32))
- **deps**: update actions/checkout action to v6 (#34) ([97276b6](https://github.com/stacksjs/bumpx/commit/97276b6)) _(by [renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>](https://github.com/renovate[bot]))_ ([#34](https://github.com/stacksjs/bumpx/issues/34), [#34](https://github.com/stacksjs/bumpx/issues/34))
- wip ([496e92e](https://github.com/stacksjs/bumpx/commit/496e92e)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **deps**: update all non-major dependencies (#30) ([69f48e0](https://github.com/stacksjs/bumpx/commit/69f48e0)) _(by [renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>](https://github.com/renovate[bot]))_ ([#30](https://github.com/stacksjs/bumpx/issues/30), [#30](https://github.com/stacksjs/bumpx/issues/30))

### Contributors

- _Chris <chrisbreuer93@gmail.com>_
- _[renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>](https://github.com/renovate[bot])_
- _chrisbreuer <chrisbreuer93@gmail.com>_
- _glennmichael123 <gtorregosa@gmail.com>_

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.2.3...v0.2.4)

## 🧹 Chores

- release v0.2.4 ([da03db6](https://github.com/stacksjs/bumpx/commit/da03db6)) _(by Chris <chrisbreuer93@gmail.com>)_
- wip ([e25538e](https://github.com/stacksjs/bumpx/commit/e25538e)) _(by Chris <chrisbreuer93@gmail.com>)_

## Contributors

- _Chris <chrisbreuer93@gmail.com>_

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.2.2...v0.2.3)

## 🚀 Features

- add pantry and zig support ([65e8d27](https://github.com/stacksjs/bumpx/commit/65e8d27)) _(by Chris <chrisbreuer93@gmail.com>)_

## 🧹 Chores

- release v0.2.3 ([120a843](https://github.com/stacksjs/bumpx/commit/120a843)) _(by Chris <chrisbreuer93@gmail.com>)_
- wip ([fa14352](https://github.com/stacksjs/bumpx/commit/fa14352)) _(by Chris <chrisbreuer93@gmail.com>)_
- wip ([5ae2414](https://github.com/stacksjs/bumpx/commit/5ae2414)) _(by Chris <chrisbreuer93@gmail.com>)_
- wip ([70540f6](https://github.com/stacksjs/bumpx/commit/70540f6)) _(by Chris <chrisbreuer93@gmail.com>)_
- wip ([aa859ed](https://github.com/stacksjs/bumpx/commit/aa859ed)) _(by Chris <chrisbreuer93@gmail.com>)_
- wip ([4e5fbb0](https://github.com/stacksjs/bumpx/commit/4e5fbb0)) _(by Chris <chrisbreuer93@gmail.com>)_
- **deps**: update all non-major dependencies (#29) ([b2e9201](https://github.com/stacksjs/bumpx/commit/b2e9201)) _(by Chris <chrisbreuer93@gmail.com>)_ ([#29](https://github.com/stacksjs/bumpx/issues/29), [#29](https://github.com/stacksjs/bumpx/issues/29))
- wip ([48f405f](https://github.com/stacksjs/bumpx/commit/48f405f)) _(by Chris <chrisbreuer93@gmail.com>)_
- wip ([04dd970](https://github.com/stacksjs/bumpx/commit/04dd970)) _(by Chris <chrisbreuer93@gmail.com>)_
- wip ([53d4903](https://github.com/stacksjs/bumpx/commit/53d4903)) _(by Chris <chrisbreuer93@gmail.com>)_
- wip ([3fe2c27](https://github.com/stacksjs/bumpx/commit/3fe2c27)) _(by Chris <chrisbreuer93@gmail.com>)_
- wip ([781d648](https://github.com/stacksjs/bumpx/commit/781d648)) _(by Chris <chrisbreuer93@gmail.com>)_
- wip ([812369e](https://github.com/stacksjs/bumpx/commit/812369e)) _(by Chris <chrisbreuer93@gmail.com>)_
- wip ([d9a5071](https://github.com/stacksjs/bumpx/commit/d9a5071)) _(by Chris <chrisbreuer93@gmail.com>)_
- wip ([a68c7d9](https://github.com/stacksjs/bumpx/commit/a68c7d9)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **deps**: update stacksjs/action-releaser action to v1.2.7 (#26) ([9e4834c](https://github.com/stacksjs/bumpx/commit/9e4834c)) _(by [renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>](https://github.com/renovate[bot]))_ ([#26](https://github.com/stacksjs/bumpx/issues/26), [#26](https://github.com/stacksjs/bumpx/issues/26))
- **deps**: update all non-major dependencies (#25) ([d4669df](https://github.com/stacksjs/bumpx/commit/d4669df)) _(by Chris <chrisbreuer93@gmail.com>)_ ([#25](https://github.com/stacksjs/bumpx/issues/25), [#25](https://github.com/stacksjs/bumpx/issues/25))
- **deps**: update dependency bun-plugin-dtsx to v0.21.17 (#24) ([c469f5f](https://github.com/stacksjs/bumpx/commit/c469f5f)) _(by [renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>](https://github.com/renovate[bot]))_ ([#24](https://github.com/stacksjs/bumpx/issues/24), [#24](https://github.com/stacksjs/bumpx/issues/24))
- wip ([630b159](https://github.com/stacksjs/bumpx/commit/630b159)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **deps**: update dependency @actions/io to v2 (#22) ([ccdca2c](https://github.com/stacksjs/bumpx/commit/ccdca2c)) _(by [renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>](https://github.com/renovate[bot]))_ ([#22](https://github.com/stacksjs/bumpx/issues/22), [#22](https://github.com/stacksjs/bumpx/issues/22))
- **deps**: update all non-major dependencies (#21) ([9b89f4a](https://github.com/stacksjs/bumpx/commit/9b89f4a)) _(by [renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>](https://github.com/renovate[bot]))_ ([#21](https://github.com/stacksjs/bumpx/issues/21), [#21](https://github.com/stacksjs/bumpx/issues/21))
- wip ([de68274](https://github.com/stacksjs/bumpx/commit/de68274)) _(by glennmichael123 <gtorregosa@gmail.com>)_
- **deps**: update all non-major dependencies (#5) ([6ccb3fb](https://github.com/stacksjs/bumpx/commit/6ccb3fb)) _(by [renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>](https://github.com/renovate[bot]))_ ([#5](https://github.com/stacksjs/bumpx/issues/5), [#5](https://github.com/stacksjs/bumpx/issues/5))
- **deps**: update actions/checkout action to v5 (#8) ([be5788e](https://github.com/stacksjs/bumpx/commit/be5788e)) _(by [renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>](https://github.com/renovate[bot]))_ ([#8](https://github.com/stacksjs/bumpx/issues/8), [#8](https://github.com/stacksjs/bumpx/issues/8))
- **deps**: update dependency bunfig to 0.15.0 (#16) ([751433d](https://github.com/stacksjs/bumpx/commit/751433d)) _(by Chris <chrisbreuer93@gmail.com>)_ ([#16](https://github.com/stacksjs/bumpx/issues/16), [#16](https://github.com/stacksjs/bumpx/issues/16))

## Contributors

- _Chris <chrisbreuer93@gmail.com>_
- _[renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>](https://github.com/renovate[bot])_
- _glennmichael123 <gtorregosa@gmail.com>_

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.2.1...v0.2.2)

## 🧹 Chores

- release v0.2.2 ([980a895](https://github.com/stacksjs/bumpx/commit/980a895))
- wip ([d325494](https://github.com/stacksjs/bumpx/commit/d325494))

## Contributors

- glennmichael123 <gtorregosa@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.2.0...v0.2.1)

## 🧹 Chores

- release v0.2.1 ([f8221e9](https://github.com/stacksjs/bumpx/commit/f8221e9))
- lint ([201e14f](https://github.com/stacksjs/bumpx/commit/201e14f))

## Contributors

- Chris <chrisbreuer93@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.86...v0.2.0)

## 🧹 Chores

- release v0.2.0 ([8887909](https://github.com/stacksjs/bumpx/commit/8887909))
- minor improvements ([4d32640](https://github.com/stacksjs/bumpx/commit/4d32640))
- improve recursive mode ([d5c49ab](https://github.com/stacksjs/bumpx/commit/d5c49ab))

## Contributors

- Chris <chrisbreuer93@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.85...v0.1.86)

## 🧹 Chores

- release v0.1.86 ([159d703](https://github.com/stacksjs/bumpx/commit/159d703))
- wip ([f6029b7](https://github.com/stacksjs/bumpx/commit/f6029b7))

## Contributors

- Adelino Ngomacha <adelinob335@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.84...v0.1.85)

## 🐛 Bug Fixes

- update dependencies and fix test type annotations ([985dd43](https://github.com/stacksjs/bumpx/commit/985dd43))
- update changelog display and fix typescript issues ([5647dec](https://github.com/stacksjs/bumpx/commit/5647dec))

## 🧹 Chores

- release v0.1.85 ([97f7b79](https://github.com/stacksjs/bumpx/commit/97f7b79))
- improve verbose mode ([185986a](https://github.com/stacksjs/bumpx/commit/185986a))
- wip ([5db5c56](https://github.com/stacksjs/bumpx/commit/5db5c56))
- wip ([611738f](https://github.com/stacksjs/bumpx/commit/611738f))
- wip ([25b71cf](https://github.com/stacksjs/bumpx/commit/25b71cf))

## Contributors

- Adelino Ngomacha <adelinob335@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.83...v0.1.84)

## 🐛 Bug Fixes

- update tests ([c456739](https://github.com/stacksjs/bumpx/commit/c456739))

## 🧹 Chores

- release v0.1.84 ([0730af9](https://github.com/stacksjs/bumpx/commit/0730af9))

## Contributors

- Adelino Ngomacha <adelinob335@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.82...v0.1.83)

## 🧹 Chores

- release v0.1.83 ([0c14254](https://github.com/stacksjs/bumpx/commit/0c14254))
- add spaces ([e7817ef](https://github.com/stacksjs/bumpx/commit/e7817ef))

## Contributors

- Adelino Ngomacha <adelinob335@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.81...v0.1.82)

## 🧹 Chores

- release v0.1.82 ([bdff108](https://github.com/stacksjs/bumpx/commit/bdff108))
- wip ([abeaddd](https://github.com/stacksjs/bumpx/commit/abeaddd))

## Contributors

- Adelino Ngomacha <adelinob335@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.80...v0.1.81)

## 🧹 Chores

- release v0.1.81 ([8fd4c95](https://github.com/stacksjs/bumpx/commit/8fd4c95))
- lint fix ([debf64d](https://github.com/stacksjs/bumpx/commit/debf64d))

## Contributors

- Adelino Ngomacha <adelinob335@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.79...v0.1.80)

## 🧹 Chores

- release v0.1.80 ([3282a69](https://github.com/stacksjs/bumpx/commit/3282a69))
- remove unused old code ([b4f4874](https://github.com/stacksjs/bumpx/commit/b4f4874))
- wip ([f0d81b6](https://github.com/stacksjs/bumpx/commit/f0d81b6))

## Contributors

- Adelino Ngomacha <adelinob335@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.78...v0.1.79)

## 🧹 Chores

- release v0.1.79 ([383a15d](https://github.com/stacksjs/bumpx/commit/383a15d))
- improve interruptions ([4dfc8f8](https://github.com/stacksjs/bumpx/commit/4dfc8f8))

## Contributors

- Adelino Ngomacha <adelinob335@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.77...v0.1.78)

## 🧹 Chores

- release v0.1.78 ([12c1974](https://github.com/stacksjs/bumpx/commit/12c1974))
- update cloud emoji, because of spacing issues ([8e19768](https://github.com/stacksjs/bumpx/commit/8e19768))

## Contributors

- Adelino Ngomacha <adelinob335@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.76...v0.1.77)

## 🧹 Chores

- release v0.1.77 ([ab998a9](https://github.com/stacksjs/bumpx/commit/ab998a9))
- keep text consistency ([2a427c2](https://github.com/stacksjs/bumpx/commit/2a427c2))

## Contributors

- Adelino Ngomacha <adelinob335@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.75...v0.1.76)

## 🧹 Chores

- release v0.1.76 ([23bfbb9](https://github.com/stacksjs/bumpx/commit/23bfbb9))

## Contributors

- Adelino Ngomacha <adelinob335@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.72...HEAD)

## 🧹 Chores

- release v0.1.73 ([b6ee49c](https://github.com/stacksjs/bumpx/commit/b6ee49c))
- wip ([8d37d32](https://github.com/stacksjs/bumpx/commit/8d37d32))
- release v0.1.72 ([a568d16](https://github.com/stacksjs/bumpx/commit/a568d16))

## Contributors

- Adelino Ngomacha <adelinob335@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.71...v0.1.72)

## 🧹 Chores

- release v0.1.72 ([e054a1b](https://github.com/stacksjs/bumpx/commit/e054a1b))
- fix changelog generation order ([a92c844](https://github.com/stacksjs/bumpx/commit/a92c844))

## Contributors

- Adelino Ngomacha <adelinob335@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.70...HEAD)

## 🧹 Chores

- release v0.1.71 ([cb17685](https://github.com/stacksjs/bumpx/commit/cb17685))
- wip ([17cdf67](https://github.com/stacksjs/bumpx/commit/17cdf67))
- update docs ([1c099c7](https://github.com/stacksjs/bumpx/commit/1c099c7))
- wip ([f1de0b1](https://github.com/stacksjs/bumpx/commit/f1de0b1))
- adjust wording ([d4678eb](https://github.com/stacksjs/bumpx/commit/d4678eb))

## Contributors

- Adelino Ngomacha <adelinob335@gmail.com>
- Chris <chrisbreuer93@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.70...HEAD)

## 🧹 Chores

- wip ([f82830c](https://github.com/stacksjs/bumpx/commit/f82830c))

## Contributors

- Adelino Ngomacha <adelinob335@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.69...HEAD)

## 🧹 Chores

- update tools ([54b8fdf](https://github.com/stacksjs/bumpx/commit/54b8fdf))
- resolve test issues ([8fae920](https://github.com/stacksjs/bumpx/commit/8fae920))
- lint code ([836e5cf](https://github.com/stacksjs/bumpx/commit/836e5cf))
- wip ([1fb5df9](https://github.com/stacksjs/bumpx/commit/1fb5df9))

## Contributors

- Adelino Ngomacha <adelinob335@gmail.com>
- Chris <chrisbreuer93@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.60...HEAD)

## Contributors

- Chris <chrisbreuer93@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.59...HEAD)

## Contributors

- Chris <chrisbreuer93@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.58...HEAD)

## Contributors

- Chris <chrisbreuer93@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.57...HEAD)

## Contributors

- Chris <chrisbreuer93@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.56...HEAD)

## Contributors

- Chris <chrisbreuer93@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.55...HEAD)

## Contributors

- Chris <chrisbreuer93@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.54...HEAD)

## Contributors

- Chris <chrisbreuer93@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.53...HEAD)

## Contributors

- Chris <chrisbreuer93@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.52...HEAD)

## Contributors

- Chris <chrisbreuer93@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.45...HEAD)

## Contributors

- Chris <chrisbreuer93@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.33...HEAD)

## Contributors

- Adelino Ngomacha <adelinob335@gmail.com>
- Chris <chrisbreuer93@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.32...HEAD)

## Contributors

- Adelino Ngomacha <adelinob335@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.31...HEAD)

## Contributors

- Adelino Ngomacha <adelinob335@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.25...v0.1.26)

## Contributors

- Adelino Ngomacha <adelinob335@gmail.com>

[Compare changes](https://github.com/stacksjs/bumpx/compare/v0.1.24...v0.1.25)

## Contributors

- Adelino Ngomacha <adelinob335@gmail.com>
