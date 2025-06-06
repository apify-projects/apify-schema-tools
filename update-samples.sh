#!/usr/bin/env bash

npx apify-generate --src-input samples/src-schemas/input.json \
  --src-dataset samples/src-schemas/dataset-item.json \
  --input-schema samples/.actor/input_schema.json \
  --dataset-schema samples/.actor/dataset_schema.json \
  --output-ts-dir samples/src/generated