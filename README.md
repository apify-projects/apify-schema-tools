# Apify Schema Tools

This is a tool intended for Apify actors developers.

It allows generating JSON schemas and TypeScript types, for input and dataset,
from a single source of truth, with a few extra features.

As a quick example, assume you have a project that looks like this:

```
my-project
├── .actor
│   ├── actor.json
│   ├── dataset_schema.json
│   └── input_schema.json
└── src-schemas
    ├── dataset-item.json <-- source file for dataset
    └── input.json        <-- source file for input
```

After running this script, you will have:

```
my-project
├── .actor
│   ├── actor.json
│   ├── dataset_schema.json <-- updated with the definitions from src-schemas
│   └── input_schema.json   <-- updated with the definitions from src-schemas
├── src
│   └── generated
│       ├── dataset.ts     <-- TypeScript types generated from src-schemas
│       ├── input-utils.ts <-- utilities to fill input default values
│       └── input.ts       <-- TypeScript types generated from src-schemas
└── src-schemas
    ├── dataset-item.json
    └── input.json
```

## Quickstart

These instructions will allow you to quickly get to a point where you can use
the `apify-schema-tools` to generate your schemas and TypeScript types.

Let's assume you are starting from a new project created from an
[Apify template](https://github.com/apify/actor-templates).

1. Install `apify-schema-tools`:

```sh
npm i -D apify-schema-tools
```

Now the command `apify-generate` is installed for the current project.
You can check which options are available:

```console
$ npx apify-generate --help
usage: apify-generate [-h] [-i [{input,dataset} ...]] [-o [{json-schemas,ts-types} ...]] [--src-input SRC_INPUT] [--src-dataset SRC_DATASET] [--add-input ADD_INPUT] [--add-dataset ADD_DATASET] [--input-schema INPUT_SCHEMA]
                      [--dataset-schema DATASET_SCHEMA] [--output-ts-dir OUTPUT_TS_DIR] [--include-input-utils {true,false}]

Generate JSON schemas and TypeScript files for Actor input and output dataset.

optional arguments:
  -h, --help            show this help message and exit
  -i [{input,dataset} ...], --input [{input,dataset} ...]
                        specify which sources to use for generation (default: input,dataset)
  -o [{json-schemas,ts-types} ...], --output [{json-schemas,ts-types} ...]
                        specify what to generate (default: json-schemas,ts-types)
  --src-input SRC_INPUT
                        path to the input schema source file (default: src-schemas/input.json)
  --src-dataset SRC_DATASET
                        path to the dataset schema source file (default: src-schemas/dataset-item.json)
  --add-input ADD_INPUT
                        path to an additional schema to merge into the input schema (default: undefined)
  --add-dataset ADD_DATASET
                        path to an additional schema to merge into the dataset schema (default: undefined)
  --input-schema INPUT_SCHEMA
                        the path of the destination input schema file (default: .actor/input_schema.json)
  --dataset-schema DATASET_SCHEMA
                        the path of the destination dataset schema file (default: .actor/dataset_schema.json)
  --output-ts-dir OUTPUT_TS_DIR
                        path where to save generated TypeScript files (default: src/generated)
  --include-input-utils {true,false}
                        include input utilities in the generated TypeScript files: 'input' input and 'ts-types' output are required (default: true)
```

You can customize the path of all the files involved in the generation.
In this case, we will use the default locations, so the commands will be simpler.

2. Create a `src-schemas` folder:

```sh
mkdir src-schemas
```

3. Create the files `input.json` and `dataset-item.json` inside the `src-schemas`. Here is some example content:

```json
{
  "title": "Input schema for Web Scraper",
  "type": "object",
  "schemaVersion": 1,
  "properties": {
    "startUrls": {
      "type": "array",
      "title": "Start URLs",
      "description": "List of URLs to scrape",
      "default": [],
      "editor": "requestListSources",
      "items": {
        "type": "object",
        "properties": {
          "url": { "type": "string" }
        }
      }
    }
  },
  "required": ["startUrls"]
}
```

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Dataset schema for Web Scraper",
  "type": "object",
  "properties": {
    "title": {
      "type": "string",
      "title": "Title",
      "description": "Page title"
    },
    "url": {
      "type": "string",
      "title": "URL",
      "description": "Page URL"
    },
    "text": {
      "type": "string",
      "title": "Text content",
      "description": "Extracted text"
    },
    "timestamp": {
      "type": "string",
      "title": "Timestamp",
      "description": "When the data was scraped"
    }
  },
  "required": ["title", "url"]
}
```

4. Create the file `.actor/dataset_schema.json` and enter some empty content:

```json
{
    "actorSpecification": 1,
    "fields": {},
    "views": {}
}
```

5. Link the dataset schema in `.actor/actor.json`:

```json
{
    "actorSpecification": 1,
    [...]
    "input": "./input_schema.json",
    "storages": {
        "dataset": "./dataset_schema.json"
    },
    [...]
}
```

6. Add the script to `package.json`:

```json
{
    [...]
    "scripts": {
        [...]
        "generate": "apify-generate"
    }
}
```

7. Generate JSON schemas and TypeScript types from the source schemas:

```sh
npm run generate
```

8. Now, you will be able to use TypeScript types and utilities in your project:

```ts
import { Actor } from 'apify';

import type { DatasetItem } from './generated/dataset.ts';
import type { Input } from './generated/input.ts';
import { getInputWithDefaultValues, type InputWithDefaults } from './generated/input-utils.ts';

await Actor.init();

const input: InputWithDefaults = getInputWithDefaultValues(await Actor.getInput<Input>());

[...]

await Actor.pushData<DatasetItem>({
    tile: '...',
    url: '...',
    text: '...',
    timestamp: '...',
});

await Actor.exit();
```

## Extra features

### Keep only allowed properties in Input schema

As an example, when `type` is "array", the property `items` is forbidden if `editor` is different from "select".

### Merge a second schema into the main one

This feature is useful when working in monorepos.
It allows you to define a single common schema across all the actors in the repo,
and to add or override the tile, the description, and some properties, when necessary.

To use it, use the parameters `--add-input` and `--add-dataset`, e.g.:

```sh
npx apify-generate \
  --input input,dataset \
  --output json-schemas,ts-types \
  --src-input ../src-schemas/input.json \
  --src-dataset ../src-schemas/dataset-item.json \
  --add-input src-schemas/input.json \
  --add-dataset src-schemas/dataset-item.json
```

You can also define the order of the properties in the merged schema.
To do so, add a `position` field to the properties. The script will follow these rules:

- Properties without position or with the same position, are sorted in the same order in which they appear in the source
  schemas, with the ones in the additional schema after the ones in the base schema.
- If both properties with and without position exist, the ones without position will appear at the end.
- The position will be overwritten if a property is overwritten.

An example:

```jsonc
# Source input schema
{
  "title": "My input schema",
  "description": "My input properties",
  "properties": {
    "a": { "type": "string", "position": 3 },
    "b": { "type": "string" }, // will be last, because it has no position
    "c": { "type": "string", "position": 1 }
  },
  "required": ["a"]
}
```

```jsonc
# Additional input schema
{
  "description": "My input properties, a bit changed", // will override the description
  "properties": {
    "c": { "type": "boolean", "position": 5 }, // will override also the position
    "d": { "type": "string", "position": 1 } // will be first
  },
  "required": ["c", "d"] // will be merged to the source required parameters
}
```

```jsonc
# Final input schema
{
  "title": "My input schema",
  "description": "My input properties, a bit changed",
  "properties": {
    "d": { "type": "string" },
    "a": { "type": "string" },
    "c": { "type": "boolean" },
    "b": { "type": "string" }
  },
  "required": ["a", "c", "d"]
}
```

## Legacy

The scripts `generate-apify-schema` and `generate-apify-types` were kept for compatibility,
but they may be removed in the future. Their documentation has been removed.

Using `apify-generate`, instead, is recommended.
