import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { type ApifySchema, sumSchemas, parseSchemas } from "../src/schemas.js";
import fs from "node:fs";
import path from "node:path";

const TEST_ROOT_DIR = path.join(process.cwd(), "test-temp-schema");

describe("sumSchemas", () => {
  it("should merge properties from both schemas", () => {
    const baseSchema: ApifySchema = {
      type: "object",
      properties: {
        field1: { type: "string" },
        field2: { type: "number" },
      },
    };

    const additionalSchema: ApifySchema = {
      type: "object",
      properties: {
        field3: { type: "boolean" },
        field4: { type: "array" },
      },
    };

    const result = sumSchemas(baseSchema, additionalSchema);

    expect(result.properties).toEqual({
      field1: { type: "string" },
      field2: { type: "number" },
      field3: { type: "boolean" },
      field4: { type: "array" },
    });
  });

  it("should overwrite base schema properties with additional schema properties when they have the same key", () => {
    const baseSchema: ApifySchema = {
      type: "object",
      properties: {
        field1: { type: "string", title: "Base Field 1" },
        field2: { type: "number" },
      },
    };

    const additionalSchema: ApifySchema = {
      type: "object",
      properties: {
        field1: {
          type: "string",
          title: "Additional Field 1",
          default: "test",
        },
        field3: { type: "boolean" },
      },
    };

    const result = sumSchemas(baseSchema, additionalSchema);

    expect(result.properties?.field1).toEqual({
      type: "string",
      title: "Additional Field 1",
      default: "test",
    });
    expect(result.properties?.field2).toEqual({ type: "number" });
    expect(result.properties?.field3).toEqual({ type: "boolean" });
  });

  it("should merge required fields from both schemas without duplicates", () => {
    const baseSchema: ApifySchema = {
      type: "object",
      properties: {},
      required: ["field1", "field2"],
    };

    const additionalSchema: ApifySchema = {
      type: "object",
      properties: {},
      required: ["field2", "field3"],
    };

    const result = sumSchemas(baseSchema, additionalSchema);

    expect(result.required).toEqual(["field1", "field2", "field3"]);
  });

  it("should use additional schema required fields when base schema has no required fields", () => {
    const baseSchema: ApifySchema = {
      type: "object",
      properties: {},
    };

    const additionalSchema: ApifySchema = {
      type: "object",
      properties: {},
      required: ["field1", "field2"],
    };

    const result = sumSchemas(baseSchema, additionalSchema);

    expect(result.required).toEqual(["field1", "field2"]);
  });

  it("should preserve base schema required fields when additional schema has no required fields", () => {
    const baseSchema: ApifySchema = {
      type: "object",
      properties: {},
      required: ["field1", "field2"],
    };

    const additionalSchema: ApifySchema = {
      type: "object",
      properties: {},
    };

    const result = sumSchemas(baseSchema, additionalSchema);

    expect(result.required).toEqual(["field1", "field2"]);
  });

  it("should preserve other schema properties from base schema", () => {
    const baseSchema: ApifySchema = {
      type: "object",
      title: "Base Schema",
      description: "Base description",
      schemaVersion: 1,
      properties: {
        field1: { type: "string" },
      },
    };

    const additionalSchema: ApifySchema = {
      type: "object",
      properties: {
        field2: { type: "number" },
      },
    };

    const result = sumSchemas(baseSchema, additionalSchema);

    expect(result.title).toBe("Base Schema");
    expect(result.description).toBe("Base description");
    expect(result.schemaVersion).toBe(1);
    expect(result.properties).toEqual({
      field1: { type: "string" },
      field2: { type: "number" },
    });
  });

  it("should create a new schema object without modifying the original schemas", () => {
    const baseSchema: ApifySchema = {
      type: "object",
      properties: {
        field1: { type: "string" },
      },
      required: ["field1"],
    };

    const additionalSchema: ApifySchema = {
      type: "object",
      properties: {
        field2: { type: "number" },
      },
      required: ["field2"],
    };

    const originalBaseProperties = { ...baseSchema.properties };
    const originalBaseRequired = [...(baseSchema.required || [])];
    const originalAdditionalProperties = { ...additionalSchema.properties };
    const originalAdditionalRequired = [...(additionalSchema.required || [])];

    const result = sumSchemas(baseSchema, additionalSchema);

    // Verify original schemas are unchanged
    expect(baseSchema.properties).toEqual(originalBaseProperties);
    expect(baseSchema.required).toEqual(originalBaseRequired);
    expect(additionalSchema.properties).toEqual(originalAdditionalProperties);
    expect(additionalSchema.required).toEqual(originalAdditionalRequired);

    // Verify result is a new object
    expect(result).not.toBe(baseSchema);
    expect(result.properties).not.toBe(baseSchema.properties);
  });

  it("should override the title and the description if they exist in the additional schema", () => {
    const baseSchema: ApifySchema = {
      type: "object",
      title: "Base Schema",
      description: "Base description",
      properties: {
        field1: { type: "string" },
      },
    };

    const additionalSchema: ApifySchema = {
      type: "object",
      title: "Additional Schema",
      description: "Additional description",
      properties: {
        field2: { type: "number" },
      },
    };

    const result = sumSchemas(baseSchema, additionalSchema);

    expect(result.title).toBe("Additional Schema");
    expect(result.description).toBe("Additional description");
    expect(result.properties).toEqual({
      field1: { type: "string" },
      field2: { type: "number" },
    });
  });

  it("should sort properties by their position, if defined, with properties without position at the end", () => {
    const baseSchema: ApifySchema = {
      type: "object",
      properties: {
        field1: { type: "string", position: 2 },
        field2: { type: "number" }, // this will be sorted to the end
        field3: { type: "boolean", position: 3 },
      },
    };

    const additionalSchema: ApifySchema = {
      type: "object",
      properties: {
        field3: { type: "boolean", position: 1 }, // the position will be overridden
        field4: { type: "boolean", position: 2 }, // this will be sorted just after field1
      },
    };

    const result = sumSchemas(baseSchema, additionalSchema);

    expect(Object.keys(result.properties)).toEqual([
      "field3",
      "field1",
      "field4",
      "field2",
    ]);
  });
});

describe("parseSchemas", () => {
  beforeEach(() => {
    // Create test directory
    fs.mkdirSync(TEST_ROOT_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_ROOT_DIR)) {
      fs.rmSync(TEST_ROOT_DIR, { recursive: true, force: true });
    }
  });

  const createTestSchema = (name: string, schema: ApifySchema) => {
    const filePath = path.join(TEST_ROOT_DIR, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(schema, null, 2));
    return filePath;
  };

  it("should parse input and dataset schemas from files", () => {
    const inputSchema: ApifySchema = {
      type: "object",
      properties: {
        inputField1: { type: "string" },
        inputField2: { type: "number", default: 42 },
      },
      required: ["inputField1"],
    };

    const datasetSchema: ApifySchema = {
      type: "object",
      properties: {
        datasetField1: { type: "string" },
        datasetField2: { type: "boolean" },
      },
      required: ["datasetField1"],
    };

    const inputSrc = createTestSchema("input", inputSchema);
    const datasetSrc = createTestSchema("dataset", datasetSchema);

    const result = parseSchemas({ inputSrc, datasetSrc });

    expect(result.inputSchema).toEqual(inputSchema);
    expect(result.datasetSchema).toEqual(datasetSchema);
  });

  it("should parse only input schema when dataset source is not provided", () => {
    const inputSchema: ApifySchema = {
      type: "object",
      properties: {
        inputField1: { type: "string" },
      },
    };

    const inputSrc = createTestSchema("input", inputSchema);

    const result = parseSchemas({ inputSrc });

    expect(result.inputSchema).toEqual(inputSchema);
    expect(result.datasetSchema).toBeUndefined();
  });

  it("should parse only dataset schema when input source is not provided", () => {
    const datasetSchema: ApifySchema = {
      type: "object",
      properties: {
        datasetField1: { type: "string" },
      },
    };

    const datasetSrc = createTestSchema("dataset", datasetSchema);

    const result = parseSchemas({ datasetSrc });

    expect(result.inputSchema).toBeUndefined();
    expect(result.datasetSchema).toEqual(datasetSchema);
  });

  it("should merge additional input schema when provided", () => {
    const inputSchema: ApifySchema = {
      type: "object",
      properties: {
        baseField: { type: "string" },
      },
      required: ["baseField"],
    };

    const additionalInputSchema: ApifySchema = {
      type: "object",
      properties: {
        additionalField: { type: "number" },
        baseField: { type: "string", default: "overridden" },
      },
      required: ["additionalField"],
    };

    const inputSrc = createTestSchema("input", inputSchema);
    const addInputSrc = createTestSchema(
      "additional-input",
      additionalInputSchema
    );

    const result = parseSchemas({ inputSrc, addInputSrc });

    expect(result.inputSchema?.properties).toEqual({
      baseField: { type: "string", default: "overridden" },
      additionalField: { type: "number" },
    });
    expect(result.inputSchema?.required).toEqual([
      "baseField",
      "additionalField",
    ]);
  });

  it("should merge additional dataset schema when provided", () => {
    const datasetSchema: ApifySchema = {
      type: "object",
      properties: {
        baseField: { type: "string" },
      },
      required: ["baseField"],
    };

    const additionalDatasetSchema: ApifySchema = {
      type: "object",
      properties: {
        additionalField: { type: "boolean" },
        baseField: { type: "string", description: "overridden description" },
      },
      required: ["additionalField"],
    };

    const datasetSrc = createTestSchema("dataset", datasetSchema);
    const addDatasetSrc = createTestSchema(
      "additional-dataset",
      additionalDatasetSchema
    );

    const result = parseSchemas({ datasetSrc, addDatasetSrc });

    expect(result.datasetSchema?.properties).toEqual({
      baseField: { type: "string", description: "overridden description" },
      additionalField: { type: "boolean" },
    });
    expect(result.datasetSchema?.required).toEqual([
      "baseField",
      "additionalField",
    ]);
  });

  it("should ignore additional schema files if they don't exist", () => {
    const inputSchema: ApifySchema = {
      type: "object",
      properties: {
        inputField: { type: "string" },
      },
    };

    const inputSrc = createTestSchema("input", inputSchema);
    const nonExistentAddInputSrc = path.join(TEST_ROOT_DIR, "nonexistent.json");

    const result = parseSchemas({
      inputSrc,
      addInputSrc: nonExistentAddInputSrc,
    });

    expect(result.inputSchema).toEqual(inputSchema);
  });

  it("should throw error when neither input nor dataset source is provided", () => {
    expect(() => {
      parseSchemas({});
    }).toThrow(
      "Specify at least one schema source file to parse: inputSrc or datasetSrc"
    );
  });

  it("should throw error when input source file doesn't exist", () => {
    const nonExistentFile = path.join(TEST_ROOT_DIR, "nonexistent.json");

    expect(() => {
      parseSchemas({ inputSrc: nonExistentFile });
    }).toThrow(`Input schema source file not found: ${nonExistentFile}`);
  });

  it("should throw error when dataset source file doesn't exist", () => {
    const nonExistentFile = path.join(TEST_ROOT_DIR, "nonexistent.json");

    expect(() => {
      parseSchemas({ datasetSrc: nonExistentFile });
    }).toThrow(`Dataset schema source file not found: ${nonExistentFile}`);
  });

  it("should handle complex schemas with nested properties", () => {
    const inputSchema: ApifySchema = {
      type: "object",
      title: "Complex Input Schema",
      schemaVersion: 1,
      properties: {
        simpleField: { type: "string" },
        objectField: {
          type: "object",
          properties: {
            nestedField: { type: "number" },
          },
        },
        arrayField: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["simpleField"],
    };

    const inputSrc = createTestSchema("complex-input", inputSchema);

    const result = parseSchemas({ inputSrc });

    expect(result.inputSchema).toEqual(inputSchema);
    expect(result.inputSchema?.title).toBe("Complex Input Schema");
    expect(result.inputSchema?.schemaVersion).toBe(1);
  });

  it("should merge both additional schemas when both are provided", () => {
    const inputSchema: ApifySchema = {
      type: "object",
      properties: {
        inputBase: { type: "string" },
      },
    };

    const datasetSchema: ApifySchema = {
      type: "object",
      properties: {
        datasetBase: { type: "string" },
      },
    };

    const additionalInputSchema: ApifySchema = {
      type: "object",
      properties: {
        inputAdditional: { type: "number" },
      },
    };

    const additionalDatasetSchema: ApifySchema = {
      type: "object",
      properties: {
        datasetAdditional: { type: "boolean" },
      },
    };

    const inputSrc = createTestSchema("input", inputSchema);
    const datasetSrc = createTestSchema("dataset", datasetSchema);
    const addInputSrc = createTestSchema(
      "additional-input",
      additionalInputSchema
    );
    const addDatasetSrc = createTestSchema(
      "additional-dataset",
      additionalDatasetSchema
    );

    const result = parseSchemas({
      inputSrc,
      datasetSrc,
      addInputSrc,
      addDatasetSrc,
    });

    expect(result.inputSchema?.properties).toEqual({
      inputBase: { type: "string" },
      inputAdditional: { type: "number" },
    });

    expect(result.datasetSchema?.properties).toEqual({
      datasetBase: { type: "string" },
      datasetAdditional: { type: "boolean" },
    });
  });

  it("should handle empty string as undefined for inputSrc", () => {
    const datasetSchema: ApifySchema = {
      type: "object",
      properties: {
        datasetField: { type: "string" },
      },
    };

    const datasetSrc = createTestSchema("dataset", datasetSchema);

    const result = parseSchemas({ inputSrc: "", datasetSrc });

    expect(result.inputSchema).toBeUndefined();
    expect(result.datasetSchema).toEqual(datasetSchema);
  });

  it("should handle empty string as undefined for datasetSrc", () => {
    const inputSchema: ApifySchema = {
      type: "object",
      properties: {
        inputField: { type: "string" },
      },
    };

    const inputSrc = createTestSchema("input", inputSchema);

    const result = parseSchemas({ inputSrc, datasetSrc: "" });

    expect(result.inputSchema).toEqual(inputSchema);
    expect(result.datasetSchema).toBeUndefined();
  });

  it("should throw error when both sources are empty strings", () => {
    expect(() => {
      parseSchemas({ inputSrc: "", datasetSrc: "" });
    }).toThrow(
      "Specify at least one schema source file to parse: inputSrc or datasetSrc"
    );
  });
});
