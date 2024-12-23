import fs from "fs";
import parseArgs from "minimist";
import { JSONSchema } from "json-schema-to-typescript";

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
      "Specify at least one schema to parse using CLI options: --input, --dataset",
    );
  }

  return args;
}

export function parseSchemaFiles(inputSrc?: string, datasetSrc?: string) {
  const inputSchema = inputSrc
    ? JSON.parse(fs.readFileSync(inputSrc).toString()) as JSONSchema
    : undefined;

  const datasetSchema = datasetSrc
    ? JSON.parse(fs.readFileSync(datasetSrc).toString()) as JSONSchema
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
