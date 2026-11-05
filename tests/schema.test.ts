import { describe, expect, it, vi } from 'vitest';

import {
    createDelimitedTextSchema,
    DelimitedTextValidationError,
} from '../src/index.js';

import type {
    DelimitedTextOutputOptions,
} from '../src/index.js';

interface Product {
    name: string;
    quantity: number;
}

function productSchema(enforceHeaderOrder = false) {
    return createDelimitedTextSchema<Product>()
        .addKeyColumn('name', {
            header: 'Name',
        })
        .addKeyColumn('quantity', {
            header: 'Quantity',
            validate: value =>
                /^\d+$/.test(value)
                    ? undefined
                    : 'Expected a whole number',
        })
        .build({
            delimiter: ',',
            enforceHeaderOrder,
        });
}

describe('DelimitedTextSchema', () => {
    it('uses one schema to generate, validate and parse a file', () => {
        const schema = productSchema();

        const text = schema.toFile([
            { name: 'A, "B"\nC', quantity: 10 },
        ]);

        expect(schema.validate(text)).toEqual({
            valid: true,
            issues: [],
        });

        expect(schema.parse(text)).toEqual([
            { name: 'A, "B"\nC', quantity: '10' },
        ]);
    });

    it('exposes the configured headers and output values', () => {
        const schema = productSchema();

        expect(schema.getHeaders())
            .toEqual(['Name', 'Quantity']);

        expect(
            schema.getRowValues({ name: 'Widget', quantity: 0 }),
        ).toEqual(['Widget', 0]);
    });

    it('allows a header-only file', () => {
        const schema = productSchema();

        expect(schema.toFile([])).toBe('Name,Quantity');
        expect(schema.parse('Name,Quantity')).toEqual([]);
    });

    it('maps reordered headers correctly when order is not enforced', () => {
        expect(
            productSchema().parse('Quantity,Name\n10,Widget'),
        ).toEqual([
            { name: 'Widget', quantity: '10' },
        ]);
    });

    it('rejects reordered headers when order is enforced', () => {
        expect(
            productSchema(true)
                .validate('Quantity,Name\n10,Widget')
                .valid,
        ).toBe(false);
    });

    it.each([
        ['empty', ''],
        ['missing', 'Name\nWidget'],
        ['unexpected', 'Name,Quantity,Extra\nWidget,10,x'],
        ['duplicate', 'Name,Quantity,Quantity\nWidget,10,20'],
    ])(
        'reports %s headers and rejects parsing them',
        (_label, text) => {
            const schema = productSchema();

            expect(schema.validate(text)).toMatchObject({
                valid: false,
                issues: expect.arrayContaining([
                    expect.objectContaining({
                        code: 'headers',
                    }),
                ]),
            });

            expect(() => schema.parse(text))
                .toThrow(DelimitedTextValidationError);
        },
    );

    it.each(['Widget', 'Widget,10,extra'])(
        'rejects the wrong number of fields: %j',
        row => {
            const schema = productSchema();
            const text = `Name,Quantity\n${row}`;

            expect(schema.validate(text).issues).toContainEqual(
                expect.objectContaining({
                    code: 'row-length',
                    row: 2,
                }),
            );

            expect(() => schema.parse(text))
                .toThrow(DelimitedTextValidationError);
        },
    );

    it('reports every invalid value with row, column and header context', () => {
        const schema = productSchema();
        const text = 'Name,Quantity\nA,bad\nB,also-bad';

        expect(schema.validate(text).issues).toEqual([
            expect.objectContaining({
                code: 'value',
                row: 2,
                column: 2,
                header: 'Quantity',
            }),
            expect.objectContaining({
                code: 'value',
                row: 3,
                column: 2,
                header: 'Quantity',
            }),
        ]);

        expect(() => schema.parse(text))
            .toThrow(DelimitedTextValidationError);
    });

    it('passes the actual file column position to validators', () => {
        const validate = vi.fn(() => undefined);

        const schema = createDelimitedTextSchema<Product>()
            .addKeyColumn('name', {
                header: 'Name',
            })
            .addKeyColumn('quantity', {
                header: 'Quantity',
                validate,
            })
            .build({ delimiter: ',' });

        schema.parse('Quantity,Name\n10,Widget');

        expect(validate).toHaveBeenCalledWith('10', {
            row: 2,
            column: 1,
            header: 'Quantity',
        });
    });

    it('returns syntax issues from validate without throwing', () => {
        const schema = productSchema();

        expect(
            schema.validate('Name,Quantity\n"unterminated,10'),
        ).toMatchObject({
            valid: false,
            issues: [
                expect.objectContaining({
                    code: 'syntax',
                    row: 2,
                    column: 1,
                }),
            ],
        });
    });

    it('does not disguise exceptions thrown by custom validators', () => {
        const error = new Error('Validator bug');

        const schema = createDelimitedTextSchema<{
            value: string;
        }>()
            .addKeyColumn('value', {
                validate: () => {
                    throw error;
                },
            })
            .build({ delimiter: ',' });

        expect(() => schema.validate('value\nx'))
            .toThrow(error);
    });

    it('applies defaults to missing values while preserving zero, false and null', () => {
        const schema = createDelimitedTextSchema<{
            count: number;
            enabled: boolean;
            name: string | null;
        }>()
            .addKeyColumn('count', {
                defaultValue: 5,
            })
            .addKeyColumn('enabled', {
                defaultValue: true,
            })
            .addKeyColumn('name', {
                defaultValue: 'Default',
            })
            .build({
                delimiter: ',',
                allowPartialRows: true,
            });

        expect(
            schema.toFile([
                {},
                { count: 0, enabled: false, name: null },
            ]),
        ).toBe(
            'count,enabled,name\r\n' +
            '5,true,Default\r\n' +
            '0,false,""',
        );
    });

    it('applies formatters during generation without converting parsed text', () => {
        const schema = createDelimitedTextSchema<Product>()
            .addKeyColumn('name')
            .addKeyColumn('quantity', {
                format: value => value.toFixed(2),
            })
            .build({ delimiter: ',' });

        const text = schema.toFile([
            { name: 'Widget', quantity: 10 },
        ]);

        expect(schema.parse(text)).toEqual([
            { name: 'Widget', quantity: '10.00' },
        ]);
    });

    it('validates computed columns without adding unmapped properties to parsed rows', () => {
        const schema = createDelimitedTextSchema<Product>()
            .addKeyColumn('name')
            .addColumn('Source', () => 'test', {
                validate: value =>
                    value === 'test'
                        ? undefined
                        : 'Expected test',
            })
            .build({ delimiter: ',' });

        const text = schema.toFile([
            { name: 'Widget', quantity: 10 },
        ]);

        expect(schema.parse(text)).toEqual([
            { name: 'Widget' },
        ]);

        expect(
            schema.validate('name,Source\nWidget,wrong').valid,
        ).toBe(false);
    });

    it('generates and requires quoted headers and values when configured', () => {
        const schema = createDelimitedTextSchema<{
            value: string;
        }>()
            .addKeyColumn('value')
            .build({
                delimiter: '|',
                requireQuotedFields: true,
            });

        const text = schema.toFile([{ value: '' }]);

        expect(text).toBe('"value"\r\n""');
        expect(schema.parse(text)).toEqual([{ value: '' }]);

        expect(schema.validate('value\nx').valid).toBe(false);
        expect(schema.validate('"value"\nx').valid).toBe(false);
    });

    it('allows quoting all fields for a single generation call', () => {
        expect(
            productSchema().toFile(
                [{ name: 'Widget', quantity: 10 }],
                { quoteAllFields: true },
            ),
        ).toBe('"Name","Quantity"\r\n"Widget","10"');
    });

    it('preserves a single empty value as a data row', () => {
        const schema = createDelimitedTextSchema<{
            value: string;
        }>()
            .addKeyColumn('value')
            .build({ delimiter: ',' });

        expect(
            schema.parse(schema.toFile([{ value: '' }])),
        ).toEqual([{ value: '' }]);
    });

    it('requires a formatter for object values', () => {
        const schema = createDelimitedTextSchema<{
            metadata: { count: number };
        }>()
            .addKeyColumn('metadata')
            .build({ delimiter: ',' });

        expect(() =>
            schema.toFile([{ metadata: { count: 1 } }]),
        ).toThrow(/format function/);
    });

    it('rejects empty schemas, duplicate headers and duplicate property mappings', () => {
        expect(() =>
            createDelimitedTextSchema<Product>()
                .build({ delimiter: ',' }),
        ).toThrow();

        expect(() =>
            createDelimitedTextSchema<Product>()
                .addKeyColumn('name', { header: 'Same' })
                .addKeyColumn('quantity', { header: 'Same' })
                .build({ delimiter: ',' }),
        ).toThrow(/duplicate headers/);

        expect(() =>
            createDelimitedTextSchema<Product>()
                .addKeyColumn('name', { header: 'First' })
                .addKeyColumn('name', { header: 'Second' })
                .build({ delimiter: ',' }),
        ).toThrow(/duplicate property mappings/);
    });

    it('keeps built schemas independent of later builder changes', () => {
        const builder = createDelimitedTextSchema<Product>()
            .addKeyColumn('name');

        const schema = builder.build({ delimiter: ',' });

        builder.addKeyColumn('quantity');

        expect(schema.getHeaders()).toEqual(['name']);
    });
});

describe('generation overrides', () => {
    const overrides: {
        name: string;
        transform: NonNullable<
            DelimitedTextOutputOptions<Product>['transformColumns']
        >;
        code: 'headers' | 'value';
    }[] = [
        {
            name: 'remove a required column',
            transform: columns => columns.slice(0, 1),
            code: 'headers',
        },
        {
            name: 'reorder columns',
            transform: columns => [...columns].reverse(),
            code: 'headers',
        },
        {
            name: 'rename a header',
            transform: columns =>
                columns.map(column => ({
                    ...column,
                    header: `Wrong ${column.header}`,
                })),
            code: 'headers',
        },
        {
            name: 'add an unexpected column',
            transform: columns => [
                ...columns,
                {
                    header: 'Extra',
                    getValue: () => 'x',
                },
            ],
            code: 'headers',
        },
        {
            name: 'duplicate a column',
            transform: columns => [
                ...columns,
                ...columns.slice(0, 1),
            ],
            code: 'headers',
        },
        {
            name: 'replace a value function',
            transform: columns =>
                columns.map(column =>
                    column.header === 'Quantity'
                        ? {
                            ...column,
                            getValue: () => 'invalid',
                        }
                        : column,
                ),
            code: 'value',
        },
    ];

    it.each(overrides)(
        'can $name without validating generation',
        ({ transform, code }) => {
            const schema = productSchema(true);

            const text = schema.toFile(
                [{ name: 'Widget', quantity: 10 }],
                { transformColumns: transform },
            );

            expect(schema.validate(text)).toMatchObject({
                valid: false,
                issues: expect.arrayContaining([
                    expect.objectContaining({ code }),
                ]),
            });

            expect(() => schema.parse(text))
                .toThrow(DelimitedTextValidationError);
        },
    );

    it('allows invalid input values without an override', () => {
        const schema = productSchema();

        const text = schema.toFile([
            { name: 'Widget', quantity: -1 },
        ]);

        expect(text).toBe('Name,Quantity\r\nWidget,-1');
        expect(schema.validate(text).valid).toBe(false);
    });

    it('does not mutate the schema when transformed columns are edited', () => {
        const schema = productSchema();

        schema.toFile([], {
            transformColumns: columns => {
                for (const column of columns) {
                    column.header = `Changed ${column.header}`;
                }

                return columns;
            },
        });

        expect(
            schema.toFile([{ name: 'Widget', quantity: 10 }]),
        ).toBe('Name,Quantity\r\nWidget,10');
    });
});