import { DelimitedTextSchema } from './schema.js';

import type {
    DelimitedTextColumnDefinition,
    DelimitedTextKeyColumnOptions,
    DelimitedTextPrimitive,
    DelimitedTextSchemaOptions,
    DelimitedTextValueValidator,
} from './types.js';

type BuilderWithKey<
    T extends object,
    MappedKeys extends keyof T,
    K extends keyof T,
> = K extends keyof T
    ? DelimitedTextSchemaBuilder<
        T,
        MappedKeys | ({} extends Record<K, string> ? never : K)
    >
    : never;

export class DelimitedTextSchemaBuilder<
    T extends object,
    MappedKeys extends keyof T = never,
> {
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
    ): BuilderWithKey<T, MappedKeys, K> {
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

        return this as unknown as BuilderWithKey<T, MappedKeys, K>;
    }

    build<AllowPartial extends boolean = false>(
        options: DelimitedTextSchemaOptions & {
            allowPartialRows?: AllowPartial;
        },
    ): DelimitedTextSchema<T, AllowPartial, MappedKeys> {
        return new DelimitedTextSchema<T, AllowPartial, MappedKeys>(
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