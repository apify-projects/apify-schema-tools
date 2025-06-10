import fs from "fs";
import parseArgs from "minimist";
import { compile, JSONSchema } from "json-schema-to-typescript";
import { InputParam, parseGeneratedInputParams } from "./parser.js";
import { ObjectSchema } from "./schemas.js";

export const DEFAULT_SOURCE_FOLDER = "src-schemas";

export function parseCliArgs<ExtraArgs = {}>() {
  const args = parseArgs<
    {
      input?: boolean;
      dataset?: boolean;
      "input-src"?: string;
      "dataset-src"?: string;
    } & ExtraArgs
  >(process.argv.slice(2));

  if (!args.input && !args.dataset) {
    throw new Error(
      "Specify at least one schema to parse using CLI options: --input, --dataset"
    );
  }

  return args;
}

export function parseSchemaFiles(inputSrc?: string, datasetSrc?: string) {
  if (inputSrc && !fs.existsSync(inputSrc)) {
    throw new Error(`Input schema source file not found: ${inputSrc}`);
  }
  const inputSchema = inputSrc
    ? (JSON.parse(fs.readFileSync(inputSrc).toString()) as ObjectSchema)
    : undefined;

  if (datasetSrc && !fs.existsSync(datasetSrc)) {
    throw new Error(`Dataset schema source file not found: ${datasetSrc}`);
  }
  const datasetSchema = datasetSrc
    ? (JSON.parse(fs.readFileSync(datasetSrc).toString()) as ObjectSchema)
    : undefined;

  return { inputSchema, datasetSchema };
}

const VALID_INPUT_ROOT_KEYS = [
  "title",
  "description",
  "type",
  "schemaVersion",
  "properties",
  "required",
];

const VALID_INPUT_PROPERTY_KEYS = [
  "type",
  "title",
  "description",
  "default",
  "prefill",
  "example",
  "sectionCaption",
  "sectionDescription",
];

export function filterValidInputSchemaProperties(schema: JSONSchema) {
  const result: JSONSchema = {};
  for (const [key, value] of Object.entries(schema)) {
    if (!VALID_INPUT_ROOT_KEYS.includes(key)) {
      continue;
    }
    if (key !== "properties") {
      result[key] = value;
      continue;
    }
    result[key] = {};
    for (const [property, specs] of Object.entries(schema[key] as JSONSchema)) {
      const filteredSpecs: JSONSchema = {};
      const type = specs.type;
      if (!type) {
        throw new Error("Property's type is required in the input schema");
      }
      switch (type) {
        case "string":
          for (const [specsKey, specsValue] of Object.entries(specs)) {
            if (
              [
                ...VALID_INPUT_PROPERTY_KEYS,
                "editor",
                "pattern",
                "minLength",
                "maxLength",
                "enum",
                "enumTitles",
                "nullable",
                "isSecret",
                "dateType",
                "resourceType",
              ].includes(specsKey)
            ) {
              filteredSpecs[specsKey] = specsValue;
            }
          }
          break;
        case "boolean":
          for (const [specsKey, specsValue] of Object.entries(specs)) {
            if (
              [
                ...VALID_INPUT_PROPERTY_KEYS,
                "editor",
                "groupCaption",
                "groupDescription",
                "nullable",
              ].includes(specsKey)
            ) {
              filteredSpecs[specsKey] = specsValue;
            }
          }
          break;
        case "integer":
          for (const [specsKey, specsValue] of Object.entries(specs)) {
            if (
              [
                ...VALID_INPUT_PROPERTY_KEYS,
                "editor",
                "maximum",
                "minimum",
                "unit",
                "nullable",
              ].includes(specsKey)
            ) {
              filteredSpecs[specsKey] = specsValue;
            }
          }
          break;
        case "object":
          for (const [specsKey, specsValue] of Object.entries(specs)) {
            if (
              [
                ...VALID_INPUT_PROPERTY_KEYS,
                "editor",
                "patternKey",
                "patternValue",
                "maxProperties",
                "minProperties",
                "nullable",
              ].includes(specsKey)
            ) {
              filteredSpecs[specsKey] = specsValue;
            }
          }
          break;
        case "array":
          for (const [specsKey, specsValue] of Object.entries(specs)) {
            if (
              [
                ...VALID_INPUT_PROPERTY_KEYS,
                "editor",
                "placeholderKey",
                "placeholderValue",
                "patternKey",
                "patternValue",
                "maxItems",
                "minItems",
                "uniqueItems",
                "nullable",
                "resourceType",
              ].includes(specsKey) ||
              (specsKey === "items" && specs.editor === "select")
            ) {
              filteredSpecs[specsKey] = specsValue;
            }
          }
          break;
        default:
          throw new Error(`Invalid property type: ${type}`);
      }
      result[key][property] = filteredSpecs;
    }
  }
  return result;
}

export async function generateInputDefaultsFileContent(
  inputSchema: ObjectSchema
) {
  const defaultValues: Record<string, any> = {};

  for (const [property, definition] of Object.entries(inputSchema.properties ?? {})) {
    if ("default" in definition) {
      defaultValues[property] = definition.default;
    }
  }
  const generatedSchema = await compile(
    { ...inputSchema, title: "Input" },
    "input_schema",
    {
      additionalProperties: false,
    }
  );

  const params = parseGeneratedInputParams(generatedSchema);
  const optionalParamsWithDefaults: InputParam[] = [];
  const requiredParamsWithoutDefaults: InputParam[] = [];
  for (const param of params) {
    if (param.optional && param.key in defaultValues) {
      optionalParamsWithDefaults.push(param);
    } else if (!param.optional && !(param.key in defaultValues)) {
      requiredParamsWithoutDefaults.push(param);
    }
  }

  const paramTypesToImport = optionalParamsWithDefaults
    .map((param) => param.type)
    .filter((type) => type[0] === type[0].toUpperCase());

  return `\
/**
 * This file was automatically generated by apify-schema-tools.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run json-schema-to-typescript to regenerate this file.
 */

import { Actor } from 'apify';
import type { Input, ${paramTypesToImport.join(", ")} } from './input.js';

export const DEFAULT_INPUT_VALUES = ${JSON.stringify(defaultValues, null, 4)};

export const REQUIRED_INPUT_FIELDS_WITHOUT_DEFAULT = [${requiredParamsWithoutDefaults
    .map(({ key }) => `"${key}"`)
    .join(", ")}];

export type InputWithDefaults = Input & {
${optionalParamsWithDefaults
  .map((param) => `  ${param.key}: ${param.type};`)
  .join("\n")}
};

export function getInputWithDefaultValues(input?: Input | null): InputWithDefaults {
    if (Actor.isAtHome()) {
        // The platform is supposed to fill in the default values
        return input! as InputWithDefaults;
    }
    if (!input) {
        ${
          requiredParamsWithoutDefaults.length > 0
            ? `throw new Error('Input is required, because the following fields are required: ' + REQUIRED_INPUT_FIELDS_WITHOUT_DEFAULT.join(', '));`
            : "input = {} as Input;"
        }
    }
    return {
        ...DEFAULT_INPUT_VALUES,
        ...input,
    };
}
`;
}
