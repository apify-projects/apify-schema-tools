#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { compile } from "json-schema-to-typescript";
import {
  DEFAULT_SOURCE_FOLDER,
  parseCliArgs,
  parseSchemaFiles,
} from "./index.js";

const JSON_TO_TS_COMPILE_OPTIONS = {
  additionalProperties: false,
};

const {
  input: doInput,
  dataset: doDataset,
  "input-src": inputSourceFile = `${DEFAULT_SOURCE_FOLDER}/input.json`,
  "dataset-src": datasetSourceFile =
    `${DEFAULT_SOURCE_FOLDER}/dataset-item.json`,
  "input-type": inputTypeFile = "src/generated/input.ts",
  "dataset-type": datasetTypeFile = "src/generated/dataset.ts",
} = parseCliArgs<{
  "input-type"?: string;
  "dataset-type"?: string;
}>();

const { inputSchema, datasetSchema } = parseSchemaFiles(
  doInput ? inputSourceFile : undefined,
  doDataset ? datasetSourceFile : undefined,
);

if (inputSchema) {
  fs.mkdirSync(path.dirname(inputTypeFile), { recursive: true });
  fs.writeFileSync(
    inputTypeFile,
    await compile(
      { ...inputSchema, title: "Input" },
      "input_schema",
      JSON_TO_TS_COMPILE_OPTIONS,
    ),
  );
}
if (datasetSchema) {
  fs.mkdirSync(path.dirname(datasetTypeFile), { recursive: true });
  fs.writeFileSync(
    datasetTypeFile,
    await compile(
      { ...datasetSchema, title: "DatasetItem" },
      "dataset_schema",
      JSON_TO_TS_COMPILE_OPTIONS,
    ),
  );
}
