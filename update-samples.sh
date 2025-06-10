#!/usr/bin/env bash

npx apify-generate --src-input samples/src-schemas/input.json \
  --src-dataset samples/src-schemas/dataset-item.json \
  --input-schema samples/.actor/input_schema.json \
  --dataset-schema samples/.actor/dataset_schema.json \
  --output-ts-dir samples/src/generated

npx apify-generate --src-input samples/src-schemas/input.json \
  --src-dataset samples/src-schemas/dataset-item.json \
  --add-input samples/add-schemas/input.json \
  --add-dataset samples/add-schemas/dataset-item.json \
  --input-schema samples/.actor-merged/input_schema.json \
  --dataset-schema samples/.actor-merged/dataset_schema.json \
  --output-ts-dir samples/src/merged

npx apify-generate --src-input samples/src-schemas/input.json \
  --src-dataset samples/src-schemas/dataset-item.json \
  --add-input samples/add-schemas/input.json \
  --add-dataset samples/add-schemas/dataset-item.json \
  --deep-merge \
  --input-schema samples/.actor-deep-merged/input_schema.json \
  --dataset-schema samples/.actor-deep-merged/dataset_schema.json \
  --output-ts-dir samples/src/deep-merged