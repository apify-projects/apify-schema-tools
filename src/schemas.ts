import { JSONSchema } from "json-schema-to-typescript";
import { JSONSchema4 } from "json-schema";
import fs from "node:fs";

type SchemaProperty = JSONSchema4 & {
  position?: number;
}

type SchemaPropertyWithPosition = SchemaProperty & { position: number };

function isSchemaPropertyWithPosition(
  property: SchemaProperty
): property is SchemaProperty & { position: number } {
  return typeof property.position === "number";
}

export interface ApifySchema extends JSONSchema {
  title?: string;
  properties: Record<string, SchemaProperty>;
  required?: string[];
}

/**
 * Merges two JSON schemas by combining their properties, required fields, and definitions.
 * If a property exists in both schemas, the one from the additional schema will overwrite the base schema.
 * The type of both schemas is expected to be `object`, with the `properties` entry defined.
 * 
 * If properties have the `position` field, it will be used to sort the properties in the resulting schema.
 * Properties without the `position` field will be sorted to the end.
 *
 * @param baseSchema - The base JSON schema to merge into.
 * @param additionalSchema - The additional JSON schema to merge with the base schema.
 * @returns A new JSON schema that is the result of merging the two schemas.
 */
export function sumSchemas(
  baseSchema: ApifySchema,
  additionalSchema: ApifySchema
): ApifySchema {
  const result: ApifySchema = { ...baseSchema };

  const propertiesWithPosition: [string, SchemaPropertyWithPosition][] = [];
  const propertiesWithoutPosition: Record<string, SchemaProperty> = {};

  const mergedProperties = {
    ...baseSchema.properties,
    ...additionalSchema.properties,
  }

  for (const [key, value] of Object.entries(mergedProperties)) {
    if (isSchemaPropertyWithPosition(value)) {
      propertiesWithPosition.push([key, value]);
    } else {
      propertiesWithoutPosition[key] = value;
    }
  }

  propertiesWithPosition.sort((a, b) => {
    return a[1].position - b[1].position;
  })

  result.properties = {
    ...Object.fromEntries(propertiesWithPosition),
    ...propertiesWithoutPosition,
  };

  // Merge required fields
  if (baseSchema.required && additionalSchema.required) {
    result.required = Array.from(
      new Set([...baseSchema.required, ...additionalSchema.required])
    );
  } else if (additionalSchema.required) {
    result.required = [...additionalSchema.required];
  }

  // Overwrite title if it exists in the additional schema
  if (additionalSchema.title) {
    result.title = additionalSchema.title;
  }

  // Overwrite description if it exists in the additional schema
  if (additionalSchema.description) {
    result.description = additionalSchema.description;
  }

  return result;
}

export interface ParseSchemaProps {
  inputSrc?: string;
  datasetSrc?: string;
  addInputSrc?: string;
  addDatasetSrc?: string;
}

export function parseSchemas(props: ParseSchemaProps) {
  const { inputSrc, datasetSrc, addInputSrc, addDatasetSrc } = props;

  if (!inputSrc && !datasetSrc) {
    throw new Error(
      "Specify at least one schema source file to parse: inputSrc or datasetSrc"
    );
  }

  if (inputSrc && !fs.existsSync(inputSrc)) {
    throw new Error(`Input schema source file not found: ${inputSrc}`);
  }
  let inputSchema = inputSrc
    ? (JSON.parse(fs.readFileSync(inputSrc).toString()) as ApifySchema)
    : undefined;

  if (datasetSrc && !fs.existsSync(datasetSrc)) {
    throw new Error(`Dataset schema source file not found: ${datasetSrc}`);
  }
  let datasetSchema = datasetSrc
    ? (JSON.parse(fs.readFileSync(datasetSrc).toString()) as ApifySchema)
    : undefined;

  if (inputSchema && addInputSrc && fs.existsSync(addInputSrc)) {
    const addInputSchema = JSON.parse(
      fs.readFileSync(addInputSrc).toString()
    ) as ApifySchema;
    inputSchema = sumSchemas(inputSchema, addInputSchema);
  }

  if (datasetSchema && addDatasetSrc && fs.existsSync(addDatasetSrc)) {
    const addDatasetSchema = JSON.parse(
      fs.readFileSync(addDatasetSrc).toString()
    ) as ApifySchema;
    datasetSchema = sumSchemas(datasetSchema, addDatasetSchema);
  }

  return { inputSchema, datasetSchema };
}
