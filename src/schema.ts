import { parseDelimitedText } from './parser.js';
import { stringifyDelimitedText } from './stringify.js';

import {
    DelimitedTextValidationError,
    validateDelimiter,
    validateHeaders,
    validateRows,
} from './validation.js';

import type {
    DelimitedTextColumnDefinition,
    DelimitedTextOutputOptions,
    DelimitedTextPrimitive,
    DelimitedTextRow,
    DelimitedTextSchemaOptions,
    DelimitedTextValidationIssue,
    DelimitedTextValidationResult,
    ParsedDelimitedTextCell,
    ParsedDelimitedTextRow,
} from './types.js';

export class DelimitedTextSchema<
    T extends object,
    AllowPartial extends boolean = false,
    MappedKeys extends keyof T = never,
> {
    private readonly columns: DelimitedTextColumnDefinition<T>[];
    private readonly options: DelimitedTextSchemaOptions;

    constructor(
        columns: readonly DelimitedTextColumnDefinition<T>[],
        options: DelimitedTextSchemaOptions,
    ) {
        validateDelimiter(options.delimiter);

        if (columns.length === 0) {
            throw new Error(
                'A schema must contain at least one column',
            );
        }

        const headers = columns.map(column => column.header);

        if (new Set(headers).size !== headers.length) {
            throw new Error('Schema contains duplicate headers');
        }

        const keys = columns.flatMap(column =>
            column.key === undefined ? [] : [column.key],
        );

        if (new Set(keys).size !== keys.length) {
            throw new Error(
                'Schema contains duplicate property mappings',
            );
        }

        this.columns = columns.map(column => ({ ...column }));
        this.options = { ...options };
    }

    getHeaders(): string[] {
        return this.columns.map(column => column.header);
    }

    getRowValues(row: Partial<T>): DelimitedTextPrimitive[] {
        return this.columns.map(column => column.getValue(row));
    }

    toFile(
        rows: readonly DelimitedTextRow<T, AllowPartial>[],
        options: DelimitedTextOutputOptions<T> = {},
    ): string {
        const originalColumns = this.columns.map(
            ({ header, getValue }) => ({ header, getValue }),
        );

        const columns =
            options.transformColumns?.(originalColumns) ??
            originalColumns;

        return stringifyDelimitedText(
            [
                columns.map(column => column.header),
                ...rows.map(row =>
                    columns.map(column => column.getValue(row)),
                ),
            ],
            {
                delimiter: this.options.delimiter,
                quoteAllFields: Boolean(
                    this.options.requireQuotedFields ||
                    options.quoteAllFields,
                ),
            },
        );
    }

    validate(data: string): DelimitedTextValidationResult {
        const { issues } = this.inspect(data);

        return {
            valid: issues.length === 0,
            issues,
        };
    }

    parse(data: string): ParsedDelimitedTextRow<T, MappedKeys>[] {
        const { rows, issues } = this.inspect(data);

        if (issues.length > 0) {
            throw new DelimitedTextValidationError(issues);
        }

        const [headerRow, ...dataRows] = rows;

        if (!headerRow) {
            return [];
        }

        const definitions = new Map(
            this.columns.map(column => [column.header, column]),
        );

        return dataRows.map(cells => {
            const result: ParsedDelimitedTextRow<T> = {};

            headerRow.forEach((header, index) => {
                const key = definitions.get(header.value)?.key;
                const cell = cells[index];

                if (key !== undefined && cell) {
                    Object.defineProperty(result, key, {
                        value: cell.value,
                        enumerable: true,
                        writable: true,
                        configurable: true,
                    });
                }
            });

            // Validated headers and row lengths guarantee every mapped key.
            return result as ParsedDelimitedTextRow<T, MappedKeys>;
        });
    }

    private inspect(data: string): {
        rows: ParsedDelimitedTextCell[][];
        issues: DelimitedTextValidationIssue[];
    } {
        let rows: ParsedDelimitedTextCell[][];

        try {
            rows = parseDelimitedText(data, this.options);
        } catch (error) {
            if (error instanceof DelimitedTextValidationError) {
                return {
                    rows: [],
                    issues: error.issues,
                };
            }

            throw error;
        }

        const headers = rows[0]?.map(cell => cell.value) ?? [];

        const headerIssues = validateHeaders(
            headers,
            this.getHeaders(),
            this.options.enforceHeaderOrder,
        );

        if (headerIssues.length > 0) {
            return {
                rows,
                issues: headerIssues,
            };
        }

        return {
            rows,
            issues: validateRows(
                rows.slice(1),
                headers,
                this.columns,
            ),
        };
    }
}