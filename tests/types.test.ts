import { describe, expectTypeOf, it } from 'vitest';

import {
    createDelimitedTextSchema,
} from '../src/index.js';

interface Product {
    name: string;
    quantity: number;
}

describe('public TypeScript API', () => {
    it('accepts complete rows and infers property types in formatters', () => {
        const schema = createDelimitedTextSchema<Product>()
            .addKeyColumn('name')
            .addKeyColumn('quantity', {
                defaultValue: 0,
                format: (value, row) => {
                    expectTypeOf(value)
                        .toEqualTypeOf<number>();

                    expectTypeOf(row)
                        .toEqualTypeOf<Partial<Product>>();

                    return value.toFixed(2);
                },
            })
            .build({ delimiter: ',' });

        expectTypeOf(
            schema.toFile([{ name: 'Widget', quantity: 10 }]),
        ).toEqualTypeOf<string>();
    });

    it('accepts partial generation rows when explicitly enabled', () => {
        const schema = createDelimitedTextSchema<Product>()
            .addKeyColumn('name')
            .addKeyColumn('quantity', {
                defaultValue: 0,
            })
            .build({
                delimiter: ',',
                allowPartialRows: true,
            });

        expectTypeOf(
            schema.toFile([{ name: 'Widget' }, {}]),
        ).toEqualTypeOf<string>();
    });

    it('returns required strings for mapped keys', () => {
        const schema = createDelimitedTextSchema<Product>()
            .addKeyColumn('name')
            .addKeyColumn('quantity')
            .build({ delimiter: ',' });

        type Row = ReturnType<typeof schema.parse>[number];

        expectTypeOf<Row['name']>().toEqualTypeOf<string>();
        expectTypeOf<Row['quantity']>().toEqualTypeOf<string>();
    });

    it('keeps unmapped keys optional', () => {
        const schema = createDelimitedTextSchema<Product>()
            .addKeyColumn('name')
            .addColumn('Source', () => 'test')
            .build({ delimiter: ',' });

        type Row = ReturnType<typeof schema.parse>[number];

        expectTypeOf<Row['name']>().toEqualTypeOf<string>();
        expectTypeOf<Row['quantity']>().toEqualTypeOf<string | undefined>();
    });
});

// These calls are checked by tsc but deliberately never executed.
function checkRejectedTypes(): void {
    const builder = createDelimitedTextSchema<Product>();

    // @ts-expect-error Only properties declared on Product can be mapped.
    builder.addKeyColumn('missing');

    // @ts-expect-error Quantity defaults must be numbers.
    builder.addKeyColumn('quantity', { defaultValue: '10' });

    // @ts-expect-error Quantity formatters receive numbers, not strings.
    builder.addKeyColumn('quantity', { format: (value: string) => value });

    const schema = builder
        .addKeyColumn('name')
        .build({ delimiter: ',' });

    // @ts-expect-error Full generation rows are required by default.
    schema.toFile([{ name: 'Widget' }]);

    // @ts-expect-error Generation values must match their property types.
    schema.toFile([{ name: 'Widget', quantity: '10' }]);

    // @ts-expect-error Parsing returns strings without numeric conversion.
    const quantity: number | undefined = schema.parse('name\nWidget')[0]?.quantity;

    void quantity;
}

void checkRejectedTypes;