# delimited-schema

Define reusable schemas to create, parse and validate delimited text files.

Supports CSV, TSV and other single-character delimiters, with header
mapping, defaults, formatting, value validation and generation overrides.

## Installation

```bash
pnpm add @jc68124/delimited-schema
```

## Usage

```ts
import { createDelimitedTextSchema } from '@jc68124/delimited-schema';

interface Product {
    name: string;
    quantity: number;
}

const products = createDelimitedTextSchema<Product>()
    .addKeyColumn('name', {
        header: 'Product Name',
        validate: value =>
            value.trim() === '' ? 'A name is required' : undefined,
    })
    .addKeyColumn('quantity', {
        header: 'Quantity',
        validate: value =>
            /^\d+$/.test(value)
                ? undefined
                : 'Expected a non-negative whole number',
    })
    .build({
        delimiter: ',',
        enforceHeaderOrder: true,
    });

// Create a file.
const text = products.toFile([
    { name: 'Widget', quantity: 10 },
]);

// Validate an existing file without throwing for invalid content.
const result = products.validate(text);

if (!result.valid) {
    console.log(result.issues);
}

// Parse a file, throwing DelimitedTextValidationError if invalid.
const rows = products.parse(text);
// [{ name: 'Widget', quantity: '10' }]
```

Parsed values remain strings. Only properties mapped with `addKeyColumn`
appear in parsed rows, so the returned property types are optional strings.

Validation callbacks return an error message for invalid values or
`undefined` for valid values.

## Schema options

- `delimiter`: required single-character separator, such as `,`, `\t` or `|`.
- `enforceHeaderOrder`: require headers in schema order.
- `requireQuotedFields`: require every field, including headers, to be
  quoted; generation also quotes every field.
- `allowPartialRows`: allow incomplete objects during generation.

Headers must match the schema, and every data row must contain the same
number of fields as the header row.

## Generation overrides

Use `transformColumns` to remove, reorder, rename or add columns, or replace
their value functions. This is useful for generating deliberately invalid
files for tests.

```ts
const invalidText = products.toFile(
    [{ name: 'Widget', quantity: 10 }],
    {
        transformColumns: columns =>
            columns.filter(column => column.header !== 'Quantity'),
    },
);

products.validate(invalidText).valid; // false
```

Generation does not run schema validations. Call `validate()` or `parse()`
to check the resulting content.

Pass `quoteAllFields: true` to `toFile()` to quote every field for that call.

The library works with strings. Read and write files using your runtime
or testing framework.

## Development

Requires Node.js 24 or newer and the pnpm version pinned in `package.json`.

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Add a changeset for changes intended for release:

```bash
pnpm changeset
```

## License

ISC