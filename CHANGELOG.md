# Changelog

## 1.1.0

## Added

- `DEFAULT_INPUT_VALUES` and `REQUIRED_INPUT_FIELDS_WITHOUT_DEFAULT` are exported by `input-utils.ts`.

## Fixed

- The generated `input-utils.ts` is more friendly with formatters.

## Changed

- The example input in the README's quickstart was simplified.

## 1.0.0

## Added

- Script `apify-generate` to generate both JSON schema and TypeScript files.
- Unit and integration tests.
- Pre-commit hook that run the tests.
- Some samples to test the script.

## Changed

- The README now documents only the new command `apify-generate`.

## Deprecated

- Scripts `generate-apify-schemas` and `generate-apify-types`.
