# Changelog

## 1.3.0

### Added

- The option `--deep-merge` allows to keep object and array definitions from both the base and the additional schemas.

### Fixed

- The generated `input-utils.ts` file now avoids TypeScript errors in some occasions.

## 1.2.0

### Added

- The `--add-input` and `--add-dataset` options allow to merge a second input or dataset schema into the source one.

## 1.1.1

### Fixed

- The generated `getInputWithDefaultValues` also assumes that the input can be null.

## 1.1.0

### Added

- `DEFAULT_INPUT_VALUES` and `REQUIRED_INPUT_FIELDS_WITHOUT_DEFAULT` are exported by `input-utils.ts`.

### Fixed

- The generated `input-utils.ts` is more friendly with formatters.

### Changed

- The example input in the README's quickstart was simplified.

## 1.0.0

### Added

- Script `apify-generate` to generate both JSON schema and TypeScript files.
- Unit and integration tests.
- Pre-commit hook that run the tests.
- Some samples to test the script.

### Changed

- The README now documents only the new command `apify-generate`.

### Deprecated

- Scripts `generate-apify-schemas` and `generate-apify-types`.
