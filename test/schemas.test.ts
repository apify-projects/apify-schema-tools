import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { parseSchemas, type ObjectSchema } from "../src/schemas.js";
import fs from "node:fs";
import path from "node:path";

const TEST_ROOT_DIR = path.join(process.cwd(), "test-temp-schemas");

describe("schemas.ts", () => {
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

  const createTestSchema = (name: string, schema: ObjectSchema) => {
    const filePath = path.join(TEST_ROOT_DIR, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(schema, null, 2));
    return filePath;
  };

  describe("parseSchemas", () => {
    it("should parse input and dataset schemas from files", () => {
      const inputSchema: ObjectSchema = {
        type: "object",
        properties: {
          inputField1: { type: "string" },
          inputField2: { type: "number", default: 42 },
        },
        required: ["inputField1"],
      };

      const datasetSchema: ObjectSchema = {
        type: "object",
        properties: {
          datasetField1: { type: "string" },
          datasetField2: { type: "boolean" },
        },
        required: ["datasetField1"],
      };

      const inputSrc = createTestSchema("input", inputSchema);
      const datasetSrc = createTestSchema("dataset", datasetSchema);

      const result = parseSchemas({ inputSrc, datasetSrc, deepMerge: false });

      expect(result.inputSchema).toEqual(inputSchema);
      expect(result.datasetSchema).toEqual(datasetSchema);
    });

    it("should parse only input schema when dataset source is not provided", () => {
      const inputSchema: ObjectSchema = {
        type: "object",
        properties: {
          inputField1: { type: "string" },
        },
      };

      const inputSrc = createTestSchema("input", inputSchema);

      const result = parseSchemas({ inputSrc, deepMerge: false });

      expect(result.inputSchema).toEqual(inputSchema);
      expect(result.datasetSchema).toBeUndefined();
    });

    it("should parse only dataset schema when input source is not provided", () => {
      const datasetSchema: ObjectSchema = {
        type: "object",
        properties: {
          datasetField1: { type: "string" },
        },
      };

      const datasetSrc = createTestSchema("dataset", datasetSchema);

      const result = parseSchemas({ datasetSrc, deepMerge: false });

      expect(result.inputSchema).toBeUndefined();
      expect(result.datasetSchema).toEqual(datasetSchema);
    });

    it("should throw error when neither input nor dataset source is provided", () => {
      expect(() => {
        parseSchemas({ deepMerge: false });
      }).toThrow("Specify at least one schema source file to parse: inputSrc or datasetSrc");
    });

    it("should throw error when input source file doesn't exist", () => {
      const nonExistentFile = path.join(TEST_ROOT_DIR, "nonexistent.json");

      expect(() => {
        parseSchemas({ inputSrc: nonExistentFile, deepMerge: false });
      }).toThrow(`Input schema source file not found: ${nonExistentFile}`);
    });

    it("should throw error when dataset source file doesn't exist", () => {
      const nonExistentFile = path.join(TEST_ROOT_DIR, "nonexistent.json");

      expect(() => {
        parseSchemas({ datasetSrc: nonExistentFile, deepMerge: false });
      }).toThrow(`Dataset schema source file not found: ${nonExistentFile}`);
    });

    it("should ignore additional schema files if they don't exist", () => {
      const inputSchema: ObjectSchema = {
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
        deepMerge: false 
      });

      expect(result.inputSchema).toEqual(inputSchema);
    });
  });

  describe("shallow merge (deepMerge: false)", () => {
    it("should merge additional input schema properties", () => {
      const baseInputSchema: ObjectSchema = {
        type: "object",
        properties: {
          baseField: { type: "string" },
          sharedField: { type: "number", default: 10 },
        },
        required: ["baseField"],
      };

      const additionalInputSchema: ObjectSchema = {
        type: "object",
        properties: {
          additionalField: { type: "boolean" },
          sharedField: { type: "number", default: 42 },
        },
        required: ["additionalField"],
      };

      const inputSrc = createTestSchema("input", baseInputSchema);
      const addInputSrc = createTestSchema("additional-input", additionalInputSchema);

      const result = parseSchemas({ 
        inputSrc, 
        addInputSrc, 
        deepMerge: false 
      });

      expect(result.inputSchema?.properties).toEqual({
        baseField: { type: "string" },
        additionalField: { type: "boolean" },
        sharedField: { type: "number", default: 42 }, // overwritten
      });
      expect(result.inputSchema?.required).toEqual(["baseField", "additionalField"]);
    });

    it("should merge additional dataset schema properties", () => {
      const baseDatasetSchema: ObjectSchema = {
        type: "object",
        properties: {
          baseField: { type: "string" },
          sharedField: { type: "string", description: "base description" },
        },
        required: ["baseField"],
      };

      const additionalDatasetSchema: ObjectSchema = {
        type: "object",
        properties: {
          additionalField: { type: "boolean" },
          sharedField: { type: "string", description: "overridden description" },
        },
        required: ["additionalField"],
      };

      const datasetSrc = createTestSchema("dataset", baseDatasetSchema);
      const addDatasetSrc = createTestSchema("additional-dataset", additionalDatasetSchema);

      const result = parseSchemas({ 
        datasetSrc, 
        addDatasetSrc, 
        deepMerge: false 
      });

      expect(result.datasetSchema?.properties).toEqual({
        baseField: { type: "string" },
        additionalField: { type: "boolean" },
        sharedField: { type: "string", description: "overridden description" },
      });
      expect(result.datasetSchema?.required).toEqual(["baseField", "additionalField"]);
    });

    it("should merge both additional schemas when both are provided", () => {
      const inputSchema: ObjectSchema = {
        type: "object",
        properties: {
          inputBase: { type: "string" },
        },
      };

      const datasetSchema: ObjectSchema = {
        type: "object",
        properties: {
          datasetBase: { type: "string" },
        },
      };

      const additionalInputSchema: ObjectSchema = {
        type: "object",
        properties: {
          inputAdditional: { type: "number" },
        },
      };

      const additionalDatasetSchema: ObjectSchema = {
        type: "object",
        properties: {
          datasetAdditional: { type: "boolean" },
        },
      };

      const inputSrc = createTestSchema("input", inputSchema);
      const datasetSrc = createTestSchema("dataset", datasetSchema);
      const addInputSrc = createTestSchema("additional-input", additionalInputSchema);
      const addDatasetSrc = createTestSchema("additional-dataset", additionalDatasetSchema);

      const result = parseSchemas({ 
        inputSrc, 
        datasetSrc, 
        addInputSrc, 
        addDatasetSrc, 
        deepMerge: false 
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

    it("should handle required fields merging without duplicates", () => {
      const baseSchema: ObjectSchema = {
        type: "object",
        properties: {},
        required: ["field1", "field2"],
      };

      const additionalSchema: ObjectSchema = {
        type: "object",
        properties: {},
        required: ["field2", "field3"],
      };

      const inputSrc = createTestSchema("input", baseSchema);
      const addInputSrc = createTestSchema("additional", additionalSchema);

      const result = parseSchemas({ 
        inputSrc, 
        addInputSrc, 
        deepMerge: false 
      });

      expect(result.inputSchema?.required).toEqual(["field1", "field2", "field3"]);
    });
  });

  describe("property positioning", () => {
    it("should order properties with position numbers first, then properties without position", () => {
      const baseSchema: ObjectSchema = {
        type: "object",
        properties: {
          fieldWithoutPosition1: { type: "string" },
          fieldWithPosition2: { type: "string", position: 2 },
          fieldWithoutPosition2: { type: "string" },
        },
      };

      const additionalSchema: ObjectSchema = {
        type: "object",
        properties: {
          fieldWithPosition1: { type: "string", position: 1 },
          fieldWithPosition3: { type: "string", position: 3 },
          fieldWithoutPosition3: { type: "string" },
        },
      };

      const inputSrc = createTestSchema("input", baseSchema);
      const addInputSrc = createTestSchema("additional", additionalSchema);

      const result = parseSchemas({ 
        inputSrc, 
        addInputSrc, 
        deepMerge: false 
      });

      const propertyKeys = Object.keys(result.inputSchema?.properties || {});
      
      // Properties with position should come first, ordered by position
      expect(propertyKeys.indexOf("fieldWithPosition1")).toBeLessThan(
        propertyKeys.indexOf("fieldWithPosition2")
      );
      expect(propertyKeys.indexOf("fieldWithPosition2")).toBeLessThan(
        propertyKeys.indexOf("fieldWithPosition3")
      );
      
      // Properties without position should come after positioned properties
      expect(propertyKeys.indexOf("fieldWithPosition3")).toBeLessThan(
        propertyKeys.indexOf("fieldWithoutPosition1")
      );
    });

    it("should handle position override when merging properties", () => {
      const baseSchema: ObjectSchema = {
        type: "object",
        properties: {
          sharedField: { type: "string", position: 5 },
          otherField: { type: "string" },
        },
      };

      const additionalSchema: ObjectSchema = {
        type: "object",
        properties: {
          sharedField: { type: "string", position: 1 },
          newField: { type: "string", position: 2 },
        },
      };

      const inputSrc = createTestSchema("input", baseSchema);
      const addInputSrc = createTestSchema("additional", additionalSchema);

      const result = parseSchemas({ 
        inputSrc, 
        addInputSrc, 
        deepMerge: false 
      });

      const propertyKeys = Object.keys(result.inputSchema?.properties || {});
      
      // sharedField should now have position 1 (overridden)
      expect(propertyKeys.indexOf("sharedField")).toBeLessThan(
        propertyKeys.indexOf("newField")
      );
      expect(propertyKeys.indexOf("newField")).toBeLessThan(
        propertyKeys.indexOf("otherField")
      );
    });
  });

  describe("deep merge (deepMerge: true)", () => {
    it("should deeply merge nested object properties", () => {
      const baseSchema: ObjectSchema = {
        type: "object",
        properties: {
          nestedObject: {
            type: "object",
            properties: {
              baseNestedField: { type: "string" },
              sharedNestedField: { type: "number", default: 10 },
            },
            required: ["baseNestedField"],
          },
          simpleField: { type: "string" },
        },
      };

      const additionalSchema: ObjectSchema = {
        type: "object",
        properties: {
          nestedObject: {
            type: "object",
            properties: {
              additionalNestedField: { type: "boolean" },
              sharedNestedField: { type: "number", default: 42 },
            },
            required: ["additionalNestedField"],
          },
          newSimpleField: { type: "string" },
        },
      };

      const inputSrc = createTestSchema("input", baseSchema);
      const addInputSrc = createTestSchema("additional", additionalSchema);

      const result = parseSchemas({ 
        inputSrc, 
        addInputSrc, 
        deepMerge: true 
      });

      const nestedObject = result.inputSchema?.properties?.nestedObject as ObjectSchema;
      
      expect(nestedObject.properties).toEqual({
        baseNestedField: { type: "string" },
        additionalNestedField: { type: "boolean" },
        sharedNestedField: { type: "number", default: 42 },
      });
      expect(nestedObject.required).toEqual(["baseNestedField", "additionalNestedField"]);
      
      expect(result.inputSchema?.properties?.simpleField).toEqual({ type: "string" });
      expect(result.inputSchema?.properties?.newSimpleField).toEqual({ type: "string" });
    });

    it("should deeply merge array item schemas", () => {
      const baseSchema: ObjectSchema = {
        type: "object",
        properties: {
          arrayField: {
            type: "array",
            items: {
              type: "object",
              properties: {
                baseItemField: { type: "string" },
                sharedItemField: { type: "number" },
              },
              required: ["baseItemField"],
            },
          },
        },
      };

      const additionalSchema: ObjectSchema = {
        type: "object",
        properties: {
          arrayField: {
            type: "array",
            items: {
              type: "object",
              properties: {
                additionalItemField: { type: "boolean" },
                sharedItemField: { type: "string" }, // type override
              },
              required: ["additionalItemField"],
            },
          },
        },
      };

      const inputSrc = createTestSchema("input", baseSchema);
      const addInputSrc = createTestSchema("additional", additionalSchema);

      const result = parseSchemas({ 
        inputSrc, 
        addInputSrc, 
        deepMerge: true 
      });

      const arrayField = result.inputSchema?.properties?.arrayField;
      const itemSchema = (arrayField as any)?.items as ObjectSchema;
      
      expect(itemSchema.properties).toEqual({
        baseItemField: { type: "string" },
        additionalItemField: { type: "boolean" },
        sharedItemField: { type: "string" }, // overridden
      });
      expect(itemSchema.required).toEqual(["baseItemField", "additionalItemField"]);
    });

    it("should not deeply merge when deepMerge is false", () => {
      const baseSchema: ObjectSchema = {
        type: "object",
        properties: {
          nestedObject: {
            type: "object",
            properties: {
              baseNestedField: { type: "string" },
            },
            required: ["baseNestedField"],
          },
        },
      };

      const additionalSchema: ObjectSchema = {
        type: "object",
        properties: {
          nestedObject: {
            type: "object",
            properties: {
              additionalNestedField: { type: "boolean" },
            },
            required: ["additionalNestedField"],
          },
        },
      };

      const inputSrc = createTestSchema("input", baseSchema);
      const addInputSrc = createTestSchema("additional", additionalSchema);

      const result = parseSchemas({ 
        inputSrc, 
        addInputSrc, 
        deepMerge: false 
      });

      const nestedObject = result.inputSchema?.properties?.nestedObject as ObjectSchema;
      
      // Should completely replace, not merge
      expect(nestedObject.properties).toEqual({
        additionalNestedField: { type: "boolean" },
      });
      expect(nestedObject.required).toEqual(["additionalNestedField"]);
    });

    it("should handle deeply nested object structures", () => {
      const baseSchema: ObjectSchema = {
        type: "object",
        properties: {
          level1: {
            type: "object",
            properties: {
              level2: {
                type: "object",
                properties: {
                  baseDeepField: { type: "string" },
                  sharedDeepField: { type: "number" },
                },
              },
            },
          },
        },
      };

      const additionalSchema: ObjectSchema = {
        type: "object",
        properties: {
          level1: {
            type: "object",
            properties: {
              level2: {
                type: "object",
                properties: {
                  additionalDeepField: { type: "boolean" },
                  sharedDeepField: { type: "string" },
                },
              },
              newLevel2Field: { type: "string" },
            },
          },
        },
      };

      const inputSrc = createTestSchema("input", baseSchema);
      const addInputSrc = createTestSchema("additional", additionalSchema);

      const result = parseSchemas({ 
        inputSrc, 
        addInputSrc, 
        deepMerge: true 
      });

      const level1 = result.inputSchema?.properties?.level1 as ObjectSchema;
      const level2 = level1.properties?.level2 as ObjectSchema;
      
      expect(level2.properties).toEqual({
        baseDeepField: { type: "string" },
        additionalDeepField: { type: "boolean" },
        sharedDeepField: { type: "string" },
      });
      expect(level1.properties?.newLevel2Field).toEqual({ type: "string" });
    });
  });

  describe("edge cases", () => {
    it("should handle empty schemas", () => {
      const baseSchema: ObjectSchema = {
        type: "object",
      };

      const additionalSchema: ObjectSchema = {
        type: "object",
      };

      const inputSrc = createTestSchema("input", baseSchema);
      const addInputSrc = createTestSchema("additional", additionalSchema);

      const result = parseSchemas({ 
        inputSrc, 
        addInputSrc, 
        deepMerge: false 
      });

      expect(result.inputSchema).toEqual({
        type: "object",
        properties: {},
        required: [],
      });
    });

    it("should handle schemas with no properties", () => {
      const baseSchema: ObjectSchema = {
        type: "object",
        required: ["field1"],
      };

      const additionalSchema: ObjectSchema = {
        type: "object",
        properties: {
          field2: { type: "string" },
        },
      };

      const inputSrc = createTestSchema("input", baseSchema);
      const addInputSrc = createTestSchema("additional", additionalSchema);

      const result = parseSchemas({ 
        inputSrc, 
        addInputSrc, 
        deepMerge: false 
      });

      expect(result.inputSchema?.properties).toEqual({
        field2: { type: "string" },
      });
      expect(result.inputSchema?.required).toEqual(["field1"]);
    });

    it("should preserve other schema properties during merge", () => {
      const baseSchema: ObjectSchema = {
        type: "object",
        title: "Base Schema",
        description: "Base description",
        properties: {
          field1: { type: "string" },
        },
      };

      const additionalSchema: ObjectSchema = {
        type: "object",
        title: "Additional Schema",
        version: "1.0.0",
        properties: {
          field2: { type: "number" },
        },
      };

      const inputSrc = createTestSchema("input", baseSchema);
      const addInputSrc = createTestSchema("additional", additionalSchema);

      const result = parseSchemas({ 
        inputSrc, 
        addInputSrc, 
        deepMerge: false 
      });

      expect(result.inputSchema?.title).toBe("Additional Schema");
      expect(result.inputSchema?.description).toBe("Base description");
      expect((result.inputSchema as any)?.version).toBe("1.0.0");
    });
  });
});