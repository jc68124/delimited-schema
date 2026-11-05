import { DelimitedTextSchema } from './schema.js';

import type {
    DelimitedTextColumnDefinition,
    DelimitedTextKeyColumnOptions,
    DelimitedTextPrimitive,
    DelimitedTextSchemaOptions,
    DelimitedTextValueValidator,
} from './types.js';

export class DelimitedTextSchemaBuilder<T extends object> {
    private readonly columns: DelimitedTextColumnDefinition<T>[] = [];

    addColumn(
        header: string,
        getValue: (row: Partial<T>) => DelimitedTextPrimitive,
        options: {
            validate?: DelimitedTextValueValidator;
        } = {},
    ): this {
        this.columns.push({
            header,
            getValue,
            ...options,
        });

        return this;
    }

    addKeyColumn<K extends keyof T>(
        key: K,
        options: DelimitedTextKeyColumnOptions<T, K> = {},
    ): this {
        const column: DelimitedTextColumnDefinition<T> = {
            key,
            header: options.header ?? String(key),
            getValue: row => {
                const value = row[key] === undefined
                    ? options.defaultValue
                    : row[key];

                if (value === null || value === undefined) {
                    return '';
                }

                if (options.format) {
                    return options.format(value, row);
                }

                if (
                    value instanceof Date ||
                    typeof value === 'string' ||
                    typeof value === 'number' ||
                    typeof value === 'boolean'
                ) {
                    return value;
                }

                throw new TypeError(
                    `Column "${options.header ?? String(key)}" ` +
                    'requires a format function',
                );
            },
        };

        if (options.validate) {
            column.validate = options.validate;
        }

        this.columns.push(column);

        return this;
    }

    build<AllowPartial extends boolean = false>(
        options: DelimitedTextSchemaOptions & {
            allowPartialRows?: AllowPartial;
        },
    ): DelimitedTextSchema<T, AllowPartial> {
        return new DelimitedTextSchema<T, AllowPartial>(
            this.columns,
            options,
        );
    }
}

export function createDelimitedTextSchema<
    T extends object,
>(): DelimitedTextSchemaBuilder<T> {
    return new DelimitedTextSchemaBuilder<T>();
}