# Third-party notices

The root [MIT License](./LICENSE) applies to NXC-authored code, including the
CLI/core, GUI source, Nix expressions, scripts, and documentation, except for
files or portions identified as third-party material below. It does not
relicense external services, datasets, application icons, trademarks, or
dependencies.

This document records the sources and checks known to this repository. It is
not a blanket permission to redistribute third-party material and is not legal
advice. For a release, review the notices generated for the exact package and
the rights relevant to the included assets.

## AppStream data

NXC pins
[snowfallorg/nixos-appstream-data](https://github.com/snowfallorg/nixos-appstream-data)
to revision `df1a03d7d838026f3c70ca18b1d8867f605ed51c` in `flake.lock`.
The GUI package references its `appstream-data-all` output, which combines
the free and unfree metadata outputs. The upstream README states that metadata
and icons follow the `metadata_license` specified in each metainfo record;
the upstream repository's MIT license applies to its code, not automatically
to each metadata record or icon.

During the Nix GUI package build, NXC generates
`share/licenses/nxc-app/appstream-metadata-licenses.tsv` by parsing the exact
pinned output. The inventory records the catalog file, component ID, and
`metadata_license` value, and marks missing declarations as `UNDECLARED`.
This makes the license declarations inspectable; it is not a blanket approval
to redistribute every record. Records with missing or restrictive terms and
any required attribution still need review before release.

- [Pinned upstream source](https://github.com/snowfallorg/nixos-appstream-data/tree/df1a03d7d838026f3c70ca18b1d8867f605ed51c)
- [Upstream license explanation](https://github.com/snowfallorg/nixos-appstream-data/blob/df1a03d7d838026f3c70ca18b1d8867f605ed51c/README.md)

## Arch Linux pkgstats recommendation statistics

`frontend/public/data/recommendations.json` is a derived snapshot made by
`frontend/scripts/update-recommendations.mjs` from the public
[Arch Linux pkgstats API](https://pkgstats.archlinux.de/api/doc). The
`.github/workflows/update-recommendations.yml` workflow refreshes and commits
that file. The JSON identifies the source, source URL, observation period, and
the time its recommendation values last changed (the generator intentionally preserves this timestamp when a refresh produces identical content). The GUI now displays and links the
source and displays the statistics period alongside the content-generation
date.

The API documentation inspected for this audit describes the read-only
statistics API and its response fields, but does not specify an explicit
redistribution license for the statistics payload. The upstream server
repository's source-code license does not establish the license for API
responses. NXC's MIT license does not grant additional rights to these
statistics. Therefore **the redistribution terms for the snapshot remain
unconfirmed**. Source attribution and period display improve transparency but
do not themselves establish permission to redistribute. This item needs
confirmation from the data provider or a documented decision to use a source
whose redistribution terms are explicit.

Until that confirmation or decision is recorded, this audit does not mark the
pkgstats snapshot as cleared for distribution. The data, scheduled update
workflow, and recommendation feature are retained; this change does not remove
or silently disable them.

- [pkgstats API documentation](https://pkgstats.archlinux.de/api/doc)
- [pkgstats server source repository](https://github.com/archlinux-de/pkgstats.archlinux.de)

## Runtime Iconify icons

The GUI requests icons at runtime through Iconify and restricts requests to the
`logos` and `simple-icons` collections. The collection's declared license
and any per-icon metadata should be checked for the particular icon used.
Simple Icons explicitly warns that its project-wide CC0 license does not imply
that every individual icon is CC0; per-icon license data may differ or be
missing. Copyright licenses also do not grant trademark rights or override
brand guidelines.

The application does not copy these runtime SVG responses into the Nix package.
They are fetched from the external service while the app is running, so this
notice documents the runtime source rather than claiming that every icon is
cleared for redistribution.

- [Iconify icon-set license index](https://github.com/iconify/icon-sets/blob/master/collections.md)
- [Simple Icons license](https://github.com/simple-icons/simple-icons/blob/develop/LICENSE.md)
- [Simple Icons disclaimer and per-icon guidance](https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md)

## Geist Variable font

The GUI imports `@fontsource-variable/geist`, whose font software uses the
SIL Open Font License 1.1. The OFL text is included at
`frontend/public/licenses/OFL-1.1.txt` and is copied into the GUI package at
`share/licenses/nxc-app/OFL-1.1.txt`.

- [Pinned @fontsource-variable/geist 5.3.0 package and license metadata](https://www.npmjs.com/package/%40fontsource-variable/geist/v/5.3.0)
- [Geist upstream source and license](https://github.com/vercel/geist-font/blob/main/LICENSE.txt)
- [SIL Open Font License 1.1](https://openfontlicense.org)

## NXC LOUNGE application icon and remaining source assets

- `frontend/src-tauri/icons/nxc-app.svg` is the source used by
  `pnpm icons:generate` to create the PNG, ICO, and ICNS application-icon
  variants. The repository history records that the SVG was added by the
  project maintainer, but the repository does not independently establish its
  original artwork source or an express license declaration. Confirming that
  the maintainer has the necessary rights remains a release check; this
  document does not automatically apply NXC's MIT license to the artwork.
- `frontend/src/assets/hero.png`, `react.svg`, and `vite.svg` are legacy
  source-tree assets with no imports/references found in the current frontend
  source. Because they are not imported into the Vite build, they are not
  expected in the GUI package output. Their original source/license is not
  established by the repository history, so do not treat them as MIT-licensed
  third-party art.
- `frontend/public/icons.svg` was an unreferenced public SVG sprite. No use of
  its symbol IDs was found in the current frontend source, so it is removed
  from the package source rather than copied into the public build output.
- `frontend/public/favicon.svg` is not present in the current repository; it
  is not an asset in the audited source or distribution.

## Dependency license reports included with the GUI package

The Nix GUI package installs its legal notices and generated inventories under
`share/licenses/nxc-app/`:

- `LICENSE` — NXC's own MIT license text.
- `THIRD_PARTY_NOTICES.md` — this source/rights inventory.
- `OFL-1.1.txt` — the font license text.
- `frontend-licenses.md` — generated during the Vite production build from
  the packages represented in emitted JavaScript chunks and direct CSS imports.
  It includes the package's declared license, any top-level license text files
  found, and explicit `UNDECLARED` / `NONE FOUND` indicators where metadata
  or texts are missing.
- `rust-dependency-licenses.html` — generated by cargo-about from the
  `frontend/src-tauri/Cargo.lock` dependency graph for the GUI's Linux target.
- `appstream-metadata-licenses.tsv` — generated from the exact pinned
  AppStream output as described above.

The generated reports are inventories, not legal opinions. A missing license
field/text, a surprising license expression, an AppStream record with
`UNDECLARED`, or a missing notice is a release-review item. The Rust report
uses the lockfile and an offline license scan; it does not rely on a remote
license database. The JavaScript report is derived from the actual Vite bundle
and direct stylesheet imports, so dependency changes update the inventory on
the next build.

The pkgstats response-data terms and the original artwork rights for the
NXC LOUNGE icon remain unresolved external/maintainer confirmations. Do not
mark this Issue complete until those points are resolved or an explicit,
documented release decision is made.
