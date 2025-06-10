#!/usr/bin/env node
"use strict";

import { ArgumentDefaultsHelpFormatter, ArgumentParser } from "argparse";
import fs from "node:fs";
import {
  filterValidInputSchemaProperties,
  generateInputDefaultsFileContent,
} from "./index.js";
import { compile } from "json-schema-to-typescript";
import { parseSchemas } from "./schemas.js";

const INPUTS = ["input", "dataset"] as const;
const OUTPUTS = ["json-schemas", "ts-types"] as const;

type Input = (typeof INPUTS)[number];
type Output = (typeof OUTPUTS)[number];

const DEFAULT_INPUTS = INPUTS;
const DEFAULT_OUTPUTS = OUTPUTS;

interface Args {
  input: Input[];
  output: Output[];
  src_input: string;
  src_dataset: string;
  add_input?: string;
  add_dataset?: string;
  deep_merge: boolean;
  input_schema: string;
  dataset_schema: string;
  output_ts_dir: string;
  include_input_utils: string;
}

const parser = new ArgumentParser({
  description:
    "Generate JSON schemas and TypeScript files for Actor input and output dataset.",
  formatter_class: ArgumentDefaultsHelpFormatter,
});

parser.add_argument("-i", "--input", {
  help: "specify which sources to use for generation",
  choices: [...INPUTS],
  default: DEFAULT_INPUTS,
  nargs: "*",
});

parser.add_argument("-o", "--output", {
  help: "specify what to generate",
  choices: [...OUTPUTS],
  default: DEFAULT_OUTPUTS,
  nargs: "*",
});

parser.add_argument("--src-input", {
  help: "path to the input schema source file",
  default: "src-schemas/input.json",
});
parser.add_argument("--src-dataset", {
  help: "path to the dataset schema source file",
  default: "src-schemas/dataset-item.json",
});

parser.add_argument("--add-input", {
  help: "path to an additional schema to merge into the input schema",
})
parser.add_argument("--add-dataset", {
  help: "path to an additional schema to merge into the dataset schema",
})
parser.add_argument("--deep-merge", {
  help: "whether to deep merge additional schemas into the main schema",
  action: "store_true",
  default: false,
});

parser.add_argument("--input-schema", {
  help: "the path of the destination input schema file",
  default: ".actor/input_schema.json",
});
parser.add_argument("--dataset-schema", {
  help: "the path of the destination dataset schema file",
  default: ".actor/dataset_schema.json",
});
parser.add_argument("--output-ts-dir", {
  help: "path where to save generated TypeScript files",
  default: "src/generated",
});

parser.add_argument("--include-input-utils", {
  help:
    "include input utilities in the generated TypeScript files:" +
    " 'input' input and 'ts-types' output are required",
  choices: ["true", "false"],
  default: "true",
});

const args: Args = parser.parse_args(process.argv.slice(2));

console.log("Parsed arguments:", args);

const {
  input,
  output,
  src_input,
  src_dataset,
  add_input,
  add_dataset,
  deep_merge,
  input_schema,
  dataset_schema,
  output_ts_dir,
  include_input_utils,
} = args;

const { inputSchema, datasetSchema } = parseSchemas({
  inputSrc: input.includes("input") ? src_input : undefined,
  datasetSrc: input.includes("dataset") ? src_dataset : undefined,
  addInputSrc: add_input,
  addDatasetSrc: add_dataset,
  deepMerge: deep_merge,
});

if (output.includes("json-schemas")) {
  console.log("Generating JSON schemas...");

  if (inputSchema) {
    fs.writeFileSync(
      input_schema,
      JSON.stringify(filterValidInputSchemaProperties(inputSchema), null, 4)
    );
  }

  if (datasetSchema) {
    const actorDatasetSchema = JSON.parse(
      fs.readFileSync(dataset_schema).toString()
    );
    actorDatasetSchema.fields = datasetSchema;
    fs.writeFileSync(
      dataset_schema,
      JSON.stringify(actorDatasetSchema, null, 4)
    );
  }
}

if (output.includes("ts-types")) {
  console.log("Generating TypeScript types...");

  if (inputSchema) {
    fs.mkdirSync(output_ts_dir, { recursive: true });
    fs.writeFileSync(
      `${output_ts_dir}/input.ts`,
      await compile({ ...inputSchema, title: "Input" }, "input_schema", {
        additionalProperties: false,
      })
    );
    if (include_input_utils === "true") {
      console.log("Generating input defaults utilities...");
      fs.writeFileSync(
        `${output_ts_dir}/input-utils.ts`,
        await generateInputDefaultsFileContent(inputSchema)
      );
    }
  }

  if (datasetSchema) {
    fs.mkdirSync(output_ts_dir, { recursive: true });
    fs.writeFileSync(
      `${output_ts_dir}/dataset.ts`,
      await compile(
        { ...datasetSchema, title: "DatasetItem" },
        "dataset_schema",
        { additionalProperties: false }
      )
    );
  }
}

console.log("Generation completed successfully.");
