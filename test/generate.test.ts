import { describe, it, expect, afterEach, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const TEST_ROOT_DIR = path.join(process.cwd(), "test-temp");

let testCounter = 1;

/**
 * Create test directories for each test run.
 * Each test will have its own subdirectory to avoid conflicts, e.g.,
 * when importing generated files, which are automatically cached.
 */
function createTestDirectories() {
  const testSubDir = path.join(
    TEST_ROOT_DIR,
    `test-${testCounter.toString().padStart(2, "0")}`
  );
  testCounter++;
  const srcSchemasDir = path.join(testSubDir, "src-schemas");
  const actorDir = path.join(testSubDir, ".actor");
  const generatedDir = path.join(testSubDir, "src", "generated");
  const dirArgs = `--src-input ${path.join(srcSchemasDir, "input.json")} \
  --src-dataset ${path.join(srcSchemasDir, "dataset-item.json")} \
  --input-schema ${path.join(actorDir, "input_schema.json")} \
  --dataset-schema ${path.join(actorDir, "dataset_schema.json")} \
  --output-ts-dir ${generatedDir}`;
  fs.mkdirSync(srcSchemasDir, { recursive: true });
  fs.mkdirSync(actorDir, { recursive: true });
  return { srcSchemasDir, actorDir, generatedDir, dirArgs };
}

const MOCK_ACTOR_DATASET_SCHEMA = {
  fields: {},
};

const MOCK_INPUT_SCHEMA = {
  type: "object",
  title: "Input",
  schemaVersion: 1,
  properties: {
    startUrls: {
      type: "array",
      title: "Start URLs",
      description: "List of URLs to scrape",
      default: [],
      editor: "requestListSources",
      items: {
        type: "object",
        properties: {
          url: { type: "string" },
        },
      },
    },
    maxPages: {
      type: "integer",
      title: "Maximum pages",
      description: "Maximum number of pages to scrape",
      default: 10,
      minimum: 1,
      maximum: 1000,
    },
    proxy: {
      type: "object",
      title: "Proxy configuration",
      description: "Proxy settings",
      default: { useApifyProxy: true },
      properties: {
        useApifyProxy: { type: "boolean", default: true },
      },
    },
    debugMode: {
      type: "boolean",
      title: "Debug mode",
      description: "Enable debug logging",
      default: false,
    },
    searchTerm: {
      type: "string",
      title: "Search term",
      description: "Term to search for",
      default: "",
      minLength: 1,
      maxLength: 100,
    },
  },
  required: ["startUrls"],
};

const MOCK_DATASET_SCHEMA = {
  type: "object",
  title: "Dataset Item",
  properties: {
    title: {
      type: "string",
      title: "Title",
      description: "Page title",
    },
    url: {
      type: "string",
      title: "URL",
      description: "Page URL",
    },
    text: {
      type: "string",
      title: "Text content",
      description: "Extracted text",
    },
    timestamp: {
      type: "string",
      title: "Timestamp",
      description: "When the data was scraped",
    },
  },
  required: ["title", "url"],
};

function writeActorDatasetSchema(actorDir: string) {
  fs.writeFileSync(
    path.join(actorDir, "dataset_schema.json"),
    JSON.stringify(MOCK_ACTOR_DATASET_SCHEMA, null, 2)
  );
}

function writeSourceInputSchema(srcSchemasDir: string, schema: object) {
  fs.writeFileSync(
    path.join(srcSchemasDir, "input.json"),
    JSON.stringify(schema, null, 2)
  );
}

function writeSourceDatasetSchema(srcSchemasDir: string, schema: object) {
  fs.writeFileSync(
    path.join(srcSchemasDir, "dataset-item.json"),
    JSON.stringify(schema, null, 2)
  );
}

describe("generate.ts script", () => {
  beforeAll(() => {
    execSync("npm run build", { stdio: "pipe" });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_ROOT_DIR)) {
      fs.rmSync(TEST_ROOT_DIR, { recursive: true, force: true });
    }
  });

  it("should generate all outputs by default", () => {
    const { srcSchemasDir, actorDir, generatedDir, dirArgs } =
      createTestDirectories();
    writeActorDatasetSchema(actorDir);
    writeSourceInputSchema(srcSchemasDir, MOCK_INPUT_SCHEMA);
    writeSourceDatasetSchema(srcSchemasDir, MOCK_DATASET_SCHEMA);

    // Run the script with custom paths
    const result = execSync(`npx apify-generate ${dirArgs}`, {
      encoding: "utf8",
      cwd: process.cwd(),
    });

    expect(result).toContain("Generation completed successfully");

    // Check that JSON schemas were generated
    expect(fs.existsSync(path.join(actorDir, "input_schema.json"))).toBe(true);
    expect(fs.existsSync(path.join(actorDir, "dataset_schema.json"))).toBe(
      true
    );

    // Check that TypeScript files were generated
    expect(fs.existsSync(path.join(generatedDir, "input.ts"))).toBe(true);
    expect(fs.existsSync(path.join(generatedDir, "dataset.ts"))).toBe(true);
    expect(fs.existsSync(path.join(generatedDir, "input-utils.ts"))).toBe(
      true
    );

    // Verify the generated input schema content
    const generatedInputSchema = JSON.parse(
      fs.readFileSync(path.join(actorDir, "input_schema.json"), "utf8")
    );
    expect(generatedInputSchema.type).toBe("object");
    expect(generatedInputSchema.properties.startUrls).toBeDefined();
    expect(generatedInputSchema.properties.maxPages).toBeDefined();

    // Verify the generated dataset schema content
    const generatedDatasetSchema = JSON.parse(
      fs.readFileSync(path.join(actorDir, "dataset_schema.json"), "utf8")
    );
    expect(generatedDatasetSchema.fields).toBeDefined();
    expect(generatedDatasetSchema.fields.title).toBeDefined();

    // Verify TypeScript files contain expected content
    const inputTsContent = fs.readFileSync(
      path.join(generatedDir, "input.ts"),
      "utf8"
    );
    expect(inputTsContent).toContain("export interface Input");

    const datasetTsContent = fs.readFileSync(
      path.join(generatedDir, "dataset.ts"),
      "utf8"
    );
    expect(datasetTsContent).toContain("export interface DatasetItem");

    const inputDefaultsContent = fs.readFileSync(
      path.join(generatedDir, "input-utils.ts"),
      "utf8"
    );
    expect(inputDefaultsContent).toContain("getInputWithDefaultValues");
    expect(inputDefaultsContent).toContain("startUrls");
  });

  it("should generate only JSON schemas when specified", () => {
    const { srcSchemasDir, actorDir, generatedDir, dirArgs } =
      createTestDirectories();
    writeActorDatasetSchema(actorDir);
    writeSourceInputSchema(srcSchemasDir, MOCK_INPUT_SCHEMA);
    writeSourceDatasetSchema(srcSchemasDir, MOCK_DATASET_SCHEMA);

    const result = execSync(
      `npx apify-generate \
      --output json-schemas \
      ${dirArgs}`,
      { encoding: "utf8", cwd: process.cwd() }
    );

    expect(result).toContain("Generating JSON schemas");
    expect(result).not.toContain("Generating TypeScript types");
    expect(result).not.toContain("Generating input with defaults");

    // Check that only JSON schemas were generated
    expect(fs.existsSync(path.join(actorDir, "input_schema.json"))).toBe(true);
    expect(fs.existsSync(path.join(actorDir, "dataset_schema.json"))).toBe(
      true
    );
    expect(fs.existsSync(path.join(generatedDir, "input.ts"))).toBe(false);
    expect(fs.existsSync(path.join(generatedDir, "dataset.ts"))).toBe(false);
    expect(fs.existsSync(path.join(generatedDir, "input-utils.ts"))).toBe(
      false
    );
  });

  it("should generate only TypeScript types when specified", () => {
    const { srcSchemasDir, actorDir, generatedDir, dirArgs } =
      createTestDirectories();
    writeActorDatasetSchema(actorDir);
    writeSourceInputSchema(srcSchemasDir, MOCK_INPUT_SCHEMA);
    writeSourceDatasetSchema(srcSchemasDir, MOCK_DATASET_SCHEMA);

    const result = execSync(
      `npx apify-generate \
      --output ts-types \
      ${dirArgs} \
      --include-input-utils=false`,
      { encoding: "utf8", cwd: process.cwd() }
    );

    expect(result).toContain("Generating TypeScript types");
    expect(result).not.toContain("Generating JSON schemas");
    expect(result).not.toContain("Generating input with defaults");

    // Check that only TypeScript files were generated
    expect(fs.existsSync(path.join(generatedDir, "input.ts"))).toBe(true);
    expect(fs.existsSync(path.join(generatedDir, "dataset.ts"))).toBe(true);

    // These files should not be generated, but the existing mock dataset_schema.json will still exist
    expect(fs.existsSync(path.join(actorDir, "input_schema.json"))).toBe(
      false
    );
    // The dataset_schema.json file exists from beforeEach but should not have been modified
    const datasetSchema = JSON.parse(
      fs.readFileSync(path.join(actorDir, "dataset_schema.json"), "utf8")
    );
    expect(datasetSchema.fields).toEqual({}); // Should still be empty from mock

    expect(fs.existsSync(path.join(generatedDir, "input-utils.ts"))).toBe(
      false
    );
  });

  it("should generate only input-related files when input is specified", () => {
    const { srcSchemasDir, actorDir, generatedDir, dirArgs } =
      createTestDirectories();
    writeActorDatasetSchema(actorDir);
    writeSourceInputSchema(srcSchemasDir, MOCK_INPUT_SCHEMA);
    writeSourceDatasetSchema(srcSchemasDir, MOCK_DATASET_SCHEMA);

    const result = execSync(
      `npx apify-generate \
      --input input \
      ${dirArgs}`,
      { encoding: "utf8", cwd: process.cwd() }
    );

    expect(result).toContain("Generation completed successfully");

    // Check that only input-related files were generated
    expect(fs.existsSync(path.join(actorDir, "input_schema.json"))).toBe(true);
    expect(fs.existsSync(path.join(generatedDir, "input.ts"))).toBe(true);
    expect(fs.existsSync(path.join(generatedDir, "input-utils.ts"))).toBe(
      true
    );

    // Dataset files should not be generated
    expect(fs.existsSync(path.join(generatedDir, "dataset.ts"))).toBe(false);

    // Dataset schema should exist but not be modified (original mock file)
    const datasetSchema = JSON.parse(
      fs.readFileSync(path.join(actorDir, "dataset_schema.json"), "utf8")
    );
    expect(datasetSchema.fields).toEqual({});
  });

  it("should generate only dataset-related files when dataset is specified", () => {
    const { srcSchemasDir, actorDir, generatedDir, dirArgs } =
      createTestDirectories();
    writeActorDatasetSchema(actorDir);
    writeSourceInputSchema(srcSchemasDir, MOCK_INPUT_SCHEMA);
    writeSourceDatasetSchema(srcSchemasDir, MOCK_DATASET_SCHEMA);

    const result = execSync(
      `npx apify-generate \
      --input dataset \
      --output json-schemas \
      --output ts-types \
      ${dirArgs}`,
      { encoding: "utf8", cwd: process.cwd() }
    );

    expect(result).toContain("Generation completed successfully");

    // Check that only dataset-related files were generated
    expect(fs.existsSync(path.join(actorDir, "dataset_schema.json"))).toBe(
      true
    );
    expect(fs.existsSync(path.join(generatedDir, "dataset.ts"))).toBe(true);

    // Input files should not be generated
    expect(fs.existsSync(path.join(actorDir, "input_schema.json"))).toBe(
      false
    );
    expect(fs.existsSync(path.join(generatedDir, "input.ts"))).toBe(false);
    expect(fs.existsSync(path.join(generatedDir, "input-utils.ts"))).toBe(
      false
    );
  });

  it("should handle missing source files gracefully", () => {
    const { srcSchemasDir, actorDir, generatedDir, dirArgs } =
      createTestDirectories();
    writeActorDatasetSchema(actorDir);
    writeSourceInputSchema(srcSchemasDir, MOCK_INPUT_SCHEMA);
    writeSourceDatasetSchema(srcSchemasDir, MOCK_DATASET_SCHEMA);

    expect(() => {
      execSync(
        `npx apify-generate \
        --src-input ${path.join(srcSchemasDir, "nonexistent.json")} \
        --src-dataset ${path.join(srcSchemasDir, "dataset-item.json")} \
        --input-schema ${path.join(actorDir, "input_schema.json")} \
        --dataset-schema ${path.join(actorDir, "dataset_schema.json")} \
        --output-ts-dir ${generatedDir}`,
        { encoding: "utf8", cwd: process.cwd() }
      );
    }).toThrow();
  });

  it("should filter input schema properties correctly", () => {
    const { srcSchemasDir, actorDir, generatedDir, dirArgs } =
      createTestDirectories();
    writeActorDatasetSchema(actorDir);
    writeSourceInputSchema(srcSchemasDir, MOCK_INPUT_SCHEMA);
    writeSourceDatasetSchema(srcSchemasDir, MOCK_DATASET_SCHEMA);

    execSync(
      `npx apify-generate \
      --input input \
      --output json-schemas \
      ${dirArgs}`,
      { encoding: "utf8", cwd: process.cwd() }
    );

    const generatedSchema = JSON.parse(
      fs.readFileSync(path.join(actorDir, "input_schema.json"), "utf8")
    );

    // Check that valid properties are preserved
    expect(generatedSchema.properties.startUrls.editor).toBe(
      "requestListSources"
    );
    expect(generatedSchema.properties.maxPages.minimum).toBe(1);
    expect(generatedSchema.properties.maxPages.maximum).toBe(1000);
    expect(generatedSchema.properties.searchTerm.minLength).toBe(1);
    expect(generatedSchema.properties.searchTerm.maxLength).toBe(100);

    // Check that defaults are preserved
    expect(generatedSchema.properties.startUrls.default).toEqual([]);
    expect(generatedSchema.properties.maxPages.default).toBe(10);
    expect(generatedSchema.properties.debugMode.default).toBe(false);

    // Check that not allowed properties are removed
    expect(MOCK_INPUT_SCHEMA.properties.startUrls.items).toBeDefined();
    expect(generatedSchema.properties.startUrls.items).not.toBeDefined();
  });

  it("should generate an input-defaults function that assigns default values to missing parameters", async () => {
    const inputSchema = {
      type: "object",
      title: "Input",
      schemaVersion: 1,
      properties: {
        field1: {
          type: "string",
        },
        field2: {
          type: "number",
          default: 42,
        },
        field3: {
          type: "boolean",
          default: true,
        },
      },
      required: ["field1", "field2"],
    };

    const { srcSchemasDir, actorDir, generatedDir, dirArgs } =
      createTestDirectories();
    writeActorDatasetSchema(actorDir);
    writeSourceInputSchema(srcSchemasDir, inputSchema);

    execSync(
      `npx apify-generate \
        --input input \
        --output ts-types \
        ${dirArgs}`,
      { encoding: "utf8", cwd: process.cwd() }
    );

    const { getInputWithDefaultValues } = await import(
      // The date query parameter is used to override cache and force re-import
      path.join(generatedDir, `input-utils.ts?t=${Date.now()}`)
    );

    expect(typeof getInputWithDefaultValues).toBe("function");
    expect(getInputWithDefaultValues({ field1: "test" })).toEqual({
      field1: "test",
      field2: 42, // default value
      field3: true, // default value
    });
    expect(getInputWithDefaultValues({ field1: "test", field2: 100 })).toEqual({
      field1: "test",
      field2: 100, // provided value overrides default
      field3: true, // default value
    });
    expect(getInputWithDefaultValues).toThrow(/^Input is required/);
  });

  it("should generate an input-defaults function that allows me not to provide any input, if possible", async () => {
    const inputSchema = {
      type: "object",
      title: "Input",
      schemaVersion: 1,
      properties: {
        field1: {
          type: "string",
          default: "default value",
        },
        field2: {
          type: "number",
          default: 42,
        },
      },
      required: ["field1"],
    };

    const { srcSchemasDir, actorDir, generatedDir, dirArgs } =
      createTestDirectories();
    writeActorDatasetSchema(actorDir);
    writeSourceInputSchema(srcSchemasDir, inputSchema);

    execSync(
      `npx apify-generate \
        --input input \
        --output ts-types \
        ${dirArgs}`,
      { encoding: "utf8", cwd: process.cwd() }
    );

    const { getInputWithDefaultValues } = await import(
      // The date query parameter is used to override cache and force re-import
      path.join(generatedDir, `input-utils.ts?t=${Date.now()}`)
    );

    expect(getInputWithDefaultValues()).toEqual({
      field1: "default value", // default value
      field2: 42, // default value
    });
  });

  it("should generate some input utils that export default values and required fields without default", async () => {
    const inputSchema = {
      type: "object",
      title: "Input",
      schemaVersion: 1,
      properties: {
        field1: {
          type: "string",
          default: "default value",
        },
        field2: {
          type: "number",
          default: 42,
        },
        field3: {
          type: "boolean",
        },
      },
      required: ["field1", "field3"],
    };

    const { srcSchemasDir, actorDir, generatedDir, dirArgs } =
      createTestDirectories();
    writeActorDatasetSchema(actorDir);
    writeSourceInputSchema(srcSchemasDir, inputSchema);

    execSync(
      `npx apify-generate \
        --input input \
        --output ts-types \
        ${dirArgs}`,
      { encoding: "utf8", cwd: process.cwd() }
    );

    const { DEFAULT_INPUT_VALUES, REQUIRED_INPUT_FIELDS_WITHOUT_DEFAULT } =
      await import(
        // The date query parameter is used to override cache and force re-import
        path.join(generatedDir, `input-utils.ts?t=${Date.now()}`)
      );

    expect(DEFAULT_INPUT_VALUES).toEqual({
      field1: "default value",
      field2: 42,
    });
    expect(REQUIRED_INPUT_FIELDS_WITHOUT_DEFAULT).toEqual(["field3"]);
  });

  it("should merge additional input schema when --add-input is specified", () => {
    const baseInputSchema = {
      type: "object",
      title: "Input",
      schemaVersion: 1,
      properties: {
        baseField: {
          type: "string",
          title: "Base Field",
          default: "base value",
        },
        sharedField: {
          type: "integer",
          title: "Shared Field",
          default: 10,
        },
      },
      required: ["baseField"],
    };

    const additionalInputSchema = {
      type: "object",
      properties: {
        additionalField: {
          type: "boolean",
          title: "Additional Field",
          default: true,
        },
        sharedField: {
          type: "integer",
          title: "Overridden Shared Field",
          default: 42,
          minimum: 1,
        },
      },
      required: ["additionalField"],
    };

    const { srcSchemasDir, actorDir, generatedDir, dirArgs } =
      createTestDirectories();
    writeActorDatasetSchema(actorDir);
    writeSourceInputSchema(srcSchemasDir, baseInputSchema);
    writeSourceDatasetSchema(srcSchemasDir, MOCK_DATASET_SCHEMA);

    // Create additional input schema file
    const additionalInputPath = path.join(srcSchemasDir, "additional-input.json");
    fs.writeFileSync(additionalInputPath, JSON.stringify(additionalInputSchema, null, 2));

    execSync(
      `npx apify-generate \
        --input input \
        --output json-schemas \
        --add-input ${additionalInputPath} \
        ${dirArgs}`,
      { encoding: "utf8", cwd: process.cwd() }
    );

    const generatedSchema = JSON.parse(
      fs.readFileSync(path.join(actorDir, "input_schema.json"), "utf8")
    );

    // Check that base properties are preserved
    expect(generatedSchema.properties.baseField).toEqual({
      type: "string",
      title: "Base Field",
      default: "base value",
    });

    // Check that additional properties are added
    expect(generatedSchema.properties.additionalField).toEqual({
      type: "boolean",
      title: "Additional Field",
      default: true,
    });

    // Check that shared properties are overridden by additional schema
    expect(generatedSchema.properties.sharedField).toEqual({
      type: "integer",
      title: "Overridden Shared Field",
      default: 42,
      minimum: 1,
    });

    // Check that required fields are merged
    expect(generatedSchema.required).toEqual(["baseField", "additionalField"]);
  });

  it("should merge additional dataset schema when --add-dataset is specified", () => {
    const baseDatasetSchema = {
      type: "object",
      title: "Dataset Item",
      properties: {
        title: {
          type: "string",
          title: "Title",
          description: "Page title",
        },
        url: {
          type: "string",
          title: "URL",
          description: "Page URL",
        },
        extractedAt: {
          type: "string",
          title: "Extraction Time",
          description: "When data was extracted",
        },
      },
      required: ["title", "url"],
    };

    const additionalDatasetSchema = {
      type: "object",
      properties: {
        metadata: {
          type: "object",
          title: "Metadata",
          description: "Additional metadata",
          properties: {
            source: { type: "string" },
          },
        },
        extractedAt: {
          type: "string",
          title: "Enhanced Extraction Time",
          description: "Enhanced timestamp with timezone",
          format: "date-time",
        },
      },
      required: ["metadata"],
    };

    const { srcSchemasDir, actorDir, generatedDir, dirArgs } =
      createTestDirectories();
    writeActorDatasetSchema(actorDir);
    writeSourceInputSchema(srcSchemasDir, MOCK_INPUT_SCHEMA);
    writeSourceDatasetSchema(srcSchemasDir, baseDatasetSchema);

    // Create additional dataset schema file
    const additionalDatasetPath = path.join(srcSchemasDir, "additional-dataset.json");
    fs.writeFileSync(additionalDatasetPath, JSON.stringify(additionalDatasetSchema, null, 2));

    execSync(
      `npx apify-generate \
        --input dataset \
        --output json-schemas \
        --add-dataset ${additionalDatasetPath} \
        ${dirArgs}`,
      { encoding: "utf8", cwd: process.cwd() }
    );

    const generatedSchema = JSON.parse(
      fs.readFileSync(path.join(actorDir, "dataset_schema.json"), "utf8")
    );

    // Check that base properties are preserved
    expect(generatedSchema.fields.properties.title).toEqual({
      type: "string",
      title: "Title",
      description: "Page title",
    });
    expect(generatedSchema.fields.properties.url).toEqual({
      type: "string",
      title: "URL",
      description: "Page URL",
    });

    // Check that additional properties are added
    expect(generatedSchema.fields.properties.metadata).toEqual({
      type: "object",
      title: "Metadata",
      description: "Additional metadata",
      properties: {
        source: { type: "string" },
      },
    });

    // Check that shared properties are overridden by additional schema
    expect(generatedSchema.fields.properties.extractedAt).toEqual({
      type: "string",
      title: "Enhanced Extraction Time",
      description: "Enhanced timestamp with timezone",
      format: "date-time",
    });

    // Check that required fields are merged  
    expect(generatedSchema.fields.required).toEqual(["title", "url", "metadata"]);
  });

  it("should merge both additional input and dataset schemas when both are specified", () => {
    const additionalInputSchema = {
      type: "object",
      properties: {
        additionalInputField: {
          type: "array",
          title: "Additional Input Field",
          editor: "select",
          items: { type: "string" },
        },
      },
    };

    const additionalDatasetSchema = {
      type: "object",
      properties: {
        additionalDatasetField: {
          type: "integer",
          title: "Additional Dataset Field",
        },
      },
    };

    const { srcSchemasDir, actorDir, generatedDir, dirArgs } =
      createTestDirectories();
    writeActorDatasetSchema(actorDir);
    writeSourceInputSchema(srcSchemasDir, MOCK_INPUT_SCHEMA);
    writeSourceDatasetSchema(srcSchemasDir, MOCK_DATASET_SCHEMA);

    // Create additional schema files
    const additionalInputPath = path.join(srcSchemasDir, "additional-input.json");
    const additionalDatasetPath = path.join(srcSchemasDir, "additional-dataset.json");
    fs.writeFileSync(additionalInputPath, JSON.stringify(additionalInputSchema, null, 2));
    fs.writeFileSync(additionalDatasetPath, JSON.stringify(additionalDatasetSchema, null, 2));

    execSync(
      `npx apify-generate \
        --output json-schemas \
        --add-input ${additionalInputPath} \
        --add-dataset ${additionalDatasetPath} \
        ${dirArgs}`,
      { encoding: "utf8", cwd: process.cwd() }
    );

    // Check input schema
    const generatedInputSchema = JSON.parse(
      fs.readFileSync(path.join(actorDir, "input_schema.json"), "utf8")
    );
    expect(generatedInputSchema.properties.startUrls).toBeDefined(); // from base
    expect(generatedInputSchema.properties.additionalInputField).toEqual({
      type: "array",
      title: "Additional Input Field",
      editor: "select",
      items: { type: "string" },
    });

    // Check dataset schema
    const generatedDatasetSchema = JSON.parse(
      fs.readFileSync(path.join(actorDir, "dataset_schema.json"), "utf8")
    );
    expect(generatedDatasetSchema.fields.properties.title).toBeDefined(); // from base
    expect(generatedDatasetSchema.fields.properties.additionalDatasetField).toEqual({
      type: "integer",
      title: "Additional Dataset Field",
    });
  });

  it("should ignore non-existent additional schema files gracefully", () => {
    const { srcSchemasDir, actorDir, generatedDir, dirArgs } =
      createTestDirectories();
    writeActorDatasetSchema(actorDir);
    writeSourceInputSchema(srcSchemasDir, MOCK_INPUT_SCHEMA);
    writeSourceDatasetSchema(srcSchemasDir, MOCK_DATASET_SCHEMA);

    const nonExistentInputPath = path.join(srcSchemasDir, "nonexistent-input.json");
    const nonExistentDatasetPath = path.join(srcSchemasDir, "nonexistent-dataset.json");

    // Should not throw an error and should generate schemas without additional merging
    const result = execSync(
      `npx apify-generate \
        --output json-schemas \
        --add-input ${nonExistentInputPath} \
        --add-dataset ${nonExistentDatasetPath} \
        ${dirArgs}`,
      { encoding: "utf8", cwd: process.cwd() }
    );

    expect(result).toContain("Generation completed successfully");

    // Check that base schemas were generated normally
    const generatedInputSchema = JSON.parse(
      fs.readFileSync(path.join(actorDir, "input_schema.json"), "utf8")
    );
    expect(generatedInputSchema.properties.startUrls).toBeDefined();
    expect(generatedInputSchema.properties.maxPages).toBeDefined();

    const generatedDatasetSchema = JSON.parse(
      fs.readFileSync(path.join(actorDir, "dataset_schema.json"), "utf8")
    );
    expect(generatedDatasetSchema.fields.properties.title).toBeDefined();
    expect(generatedDatasetSchema.fields.properties.url).toBeDefined();
  });

  it("should generate TypeScript types with merged additional schemas", async () => {
    const additionalInputSchema = {
      type: "object",
      properties: {
        extraConfig: {
          type: "object",
          title: "Extra Configuration",
          properties: {
            enabled: { type: "boolean", default: false },
            value: { type: "string" },
          },
          required: ["enabled"],
        },
      },
    };

    const { srcSchemasDir, actorDir, generatedDir, dirArgs } =
      createTestDirectories();
    writeActorDatasetSchema(actorDir);
    writeSourceInputSchema(srcSchemasDir, MOCK_INPUT_SCHEMA);

    // Create additional input schema file
    const additionalInputPath = path.join(srcSchemasDir, "additional-input.json");
    fs.writeFileSync(additionalInputPath, JSON.stringify(additionalInputSchema, null, 2));

    execSync(
      `npx apify-generate \
        --input input \
        --output ts-types \
        --add-input ${additionalInputPath} \
        ${dirArgs}`,
      { encoding: "utf8", cwd: process.cwd() }
    );

    // Check that TypeScript files were generated
    expect(fs.existsSync(path.join(generatedDir, "input.ts"))).toBe(true);
    expect(fs.existsSync(path.join(generatedDir, "input-utils.ts"))).toBe(true);

    // Verify TypeScript file contains the merged schema
    const inputTsContent = fs.readFileSync(
      path.join(generatedDir, "input.ts"),
      "utf8"
    );
    expect(inputTsContent).toContain("startUrls"); // from base schema
    expect(inputTsContent).toContain("extraConfig"); // from additional schema

    // Check input utilities work with merged schema
    const { getInputWithDefaultValues } = await import(
      path.join(generatedDir, `input-utils.ts?t=${Date.now()}`)
    );

    const result = getInputWithDefaultValues({
      startUrls: ["https://example.com"],
    });

    expect(result.startUrls).toEqual(["https://example.com"]);
    expect(result.maxPages).toBe(10); // default from base schema
    // Note: extraConfig may not have defaults applied since it's an object without a default value
    // The individual properties within extraConfig would need their own defaults
  });
});
