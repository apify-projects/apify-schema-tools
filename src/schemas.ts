import { JSONSchema4 } from "json-schema";
import fs from "node:fs";
import { Schema } from "node:inspector/promises";

type SchemaProperty = JSONSchema4 & {
  position?: number;
};

type OrderedSchemaProperty = SchemaProperty & { position: number };

function isOrderedSchemaProperty(
  property: SchemaProperty
): property is SchemaProperty & { position: number } {
  return typeof property.position === "number";
}

export interface ObjectSchema extends JSONSchema4 {
  type: "object";
  properties?: Record<string, SchemaProperty>;
  required?: string[];
}

function isObjectSchema(schema: JSONSchema4): schema is ObjectSchema {
  return schema.type === "object";
}

interface ArraySchema extends JSONSchema4 {
  type: "array";
}

function isArraySchema(schema: JSONSchema4): schema is ArraySchema {
  return schema.type === "array";
}

function mergeProperties(
  baseProperty: SchemaProperty,
  additionalProperty: SchemaProperty,
  deep: boolean
): SchemaProperty {
  if (!deep) {
    // If not deep merging, we just take the additional property
    return additionalProperty;
  }
  if (isObjectSchema(baseProperty) && isObjectSchema(additionalProperty)) {
    return mergeObjectSchemas(baseProperty, additionalProperty, deep);
  }
  if (isArraySchema(baseProperty) && isArraySchema(additionalProperty)) {
    return mergeArraySchemas(baseProperty, additionalProperty, deep);
  }
  // If the property is not an object or array, we just take the additional property
  return additionalProperty;
}

function mergeObjectSchemas(
  baseSchema: ObjectSchema,
  additionalSchema: ObjectSchema,
  deep: boolean = true,
): ObjectSchema {
  const baseProperties = baseSchema.properties || {};
  const additionalProperties = additionalSchema.properties || {};

  const propertiesWithPosition: [string, OrderedSchemaProperty][] = [];
  const propertiesWithoutPosition: [string, SchemaProperty][] = [];

  function addProperty(key: string, property: SchemaProperty) {
    if (isOrderedSchemaProperty(property)) {
      propertiesWithPosition.push([key, property]);
    } else {
      propertiesWithoutPosition.push([key, property]);
    }
  }

  for (const [key, baseProperty] of Object.entries(baseProperties)) {
    if (key in additionalProperties) {
      const additionalProperty = additionalProperties[key];
      addProperty(key, mergeProperties(baseProperty, additionalProperty, deep));
    } else {
      addProperty(key, baseProperty);
    }
  }

  // Add properties that only exist in additional schema
  for (const [key, additionalProperty] of Object.entries(additionalProperties)) {
    if (!(key in baseProperties)) {
      addProperty(key, additionalProperty);
    }
  }

  propertiesWithPosition.sort((a, b) => {
    return a[1].position - b[1].position;
  });

  return {
    ...baseSchema,
    ...additionalSchema,
    properties: {
      ...Object.fromEntries(propertiesWithPosition),
      ...Object.fromEntries(propertiesWithoutPosition),
    },
    required: Array.from(
      new Set([
        ...(baseSchema.required || []),
        ...(additionalSchema.required || []),
      ])
    ),
  };
}

function mergeArraySchemas(
  baseSchema: ArraySchema,
  additionalSchema: ArraySchema,
  deep: boolean,
): ArraySchema {
  const baseItems = baseSchema.items;
  const additionalItems = additionalSchema.items;

  if (baseItems && !Array.isArray(baseItems) && additionalItems && !Array.isArray(additionalItems)) {
    return {
      ...baseSchema,
      ...additionalSchema,
      items: mergeProperties(baseItems, additionalItems, deep),
    };
  }

  return {
    ...baseSchema,
    ...additionalSchema,
  };
}

export interface ParseSchemaProps {
  inputSrc?: string;
  datasetSrc?: string;
  addInputSrc?: string;
  addDatasetSrc?: string;
  deepMerge: boolean;
}

export function parseSchemas(props: ParseSchemaProps) {
  const { inputSrc, datasetSrc, addInputSrc, addDatasetSrc, deepMerge } = props;

  if (!inputSrc && !datasetSrc) {
    throw new Error(
      "Specify at least one schema source file to parse: inputSrc or datasetSrc"
    );
  }

  if (inputSrc && !fs.existsSync(inputSrc)) {
    throw new Error(`Input schema source file not found: ${inputSrc}`);
  }
  let inputSchema = inputSrc
    ? (JSON.parse(fs.readFileSync(inputSrc).toString()) as ObjectSchema)
    : undefined;

  if (datasetSrc && !fs.existsSync(datasetSrc)) {
    throw new Error(`Dataset schema source file not found: ${datasetSrc}`);
  }
  let datasetSchema = datasetSrc
    ? (JSON.parse(fs.readFileSync(datasetSrc).toString()) as ObjectSchema)
    : undefined;

  if (inputSchema && addInputSrc && fs.existsSync(addInputSrc)) {
    const addInputSchema = JSON.parse(
      fs.readFileSync(addInputSrc).toString()
    ) as ObjectSchema;
    inputSchema = mergeObjectSchemas(inputSchema, addInputSchema, deepMerge);
  }

  if (datasetSchema && addDatasetSrc && fs.existsSync(addDatasetSrc)) {
    const addDatasetSchema = JSON.parse(
      fs.readFileSync(addDatasetSrc).toString()
    ) as ObjectSchema;
    datasetSchema = mergeObjectSchemas(datasetSchema, addDatasetSchema, deepMerge);
  }

  return { inputSchema, datasetSchema };
}
