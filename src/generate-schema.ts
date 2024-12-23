#!/usr/bin/env node

import fs from "fs";

import { DEFAULT_SOURCE_FOLDER, filterValidInputSchemaProperties, parseCliArgs, parseSchemaFiles } from "./index.js";

const {
  input: doInput,
  dataset: doDataset,
  "input-src": inputSourceFile = `${DEFAULT_SOURCE_FOLDER}/input.json`,
  "dataset-src": datasetSourceFile =
    `${DEFAULT_SOURCE_FOLDER}/dataset-item.json`,
  "input-schema": inputSchemaFile = ".actor/input_schema.json",
  "dataset-schema": datasetSchemaFile = ".actor/dataset_schema.json",
} = parseCliArgs<{
  "input-schema"?: string;
  "dataset-schema"?: string;
}>();

const { inputSchema, datasetSchema } = parseSchemaFiles(
  doInput ? inputSourceFile : undefined,
  doDataset ? datasetSourceFile : undefined,
);

if (inputSchema) {
  fs.writeFileSync(
    inputSchemaFile,
    JSON.stringify(filterValidInputSchemaProperties(inputSchema), null, 4),
  );
}
if (datasetSchema) {
  const actorDatasetSchema = JSON.parse(
    fs.readFileSync(datasetSchemaFile).toString(),
  );
  actorDatasetSchema.fields = datasetSchema;
  fs.writeFileSync(
    datasetSchemaFile,
    JSON.stringify(actorDatasetSchema, null, 4),
  );
}
