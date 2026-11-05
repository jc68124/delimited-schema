import type {
    DelimitedTextColumnDefinition,
    DelimitedTextValidationIssue,
    ParsedDelimitedTextCell,
} from './types.js';

export class DelimitedTextValidationError extends Error {
    constructor(
        public readonly issues: DelimitedTextValidationIssue[],
    ) {
        super(issues.map(issue => issue.message).join('\n'));
        this.name = 'DelimitedTextValidationError';
    }
}

export function validateDelimiter(delimiter: string): void {
    if (delimiter.length !== 1 || /["\r\n\uFEFF]/.test(delimiter)) {
        throw new Error(
            'Delimiter must be one character excluding quotes, newlines and BOM',
        );
    }
}

export function validateHeaders(
    headers: readonly string[],
    expectedHeaders: readonly string[],
    enforceOrder = false,
): DelimitedTextValidationIssue[] {
    const issues: DelimitedTextValidationIssue[] = [];
    const seen = new Set<string>();

    headers.forEach((header, index) => {
        if (seen.has(header)) {
            issues.push({
                code: 'headers',
                row: 1,
                column: index + 1,
                header,
                message: `Duplicate header "${header}" at column ${index + 1}`,
            });
        }

        seen.add(header);
    });

    for (const header of expectedHeaders) {
        if (!seen.has(header)) {
            issues.push({
                code: 'headers',
                row: 1,
                header,
                message: `Missing required header "${header}"`,
            });
        }
    }

    headers.forEach((header, index) => {
        if (!expectedHeaders.includes(header)) {
            issues.push({
                code: 'headers',
                row: 1,
                column: index + 1,
                header,
                message: `Unexpected header "${header}"`,
            });
        }
    });

    if (enforceOrder && issues.length === 0) {
        headers.forEach((header, index) => {
            if (header !== expectedHeaders[index]) {
                issues.push({
                    code: 'headers',
                    row: 1,
                    column: index + 1,
                    header,
                    message:
                        `Header ${index + 1} should be ` +
                        `"${expectedHeaders[index]}", received "${header}"`,
                });
            }
        });
    }

    return issues;
}

export function validateRows<T extends object>(
    rows: readonly ParsedDelimitedTextCell[][],
    headers: readonly string[],
    columns: readonly DelimitedTextColumnDefinition<T>[],
): DelimitedTextValidationIssue[] {
    const issues: DelimitedTextValidationIssue[] = [];
    const definitions = new Map(
        columns.map(column => [column.header, column]),
    );

    rows.forEach((cells, index) => {
        const row = index + 2;

        if (cells.length !== headers.length) {
            issues.push({
                code: 'row-length',
                row,
                message:
                    `Row ${row} has ${cells.length} fields; ` +
                    `expected ${headers.length}`,
            });
        }

        headers.forEach((header, columnIndex) => {
            const cell = cells[columnIndex];
            const definition = definitions.get(header);

            if (!cell || !definition?.validate) {
                return;
            }

            const context = {
                row,
                column: columnIndex + 1,
                header,
            };

            const message = definition.validate(cell.value, context);

            if (message !== undefined) {
                issues.push({
                    code: 'value',
                    ...context,
                    message:
                        `Row ${row}, column ${columnIndex + 1} ` +
                        `("${header}"): ${message}`,
                });
            }
        });
    });

    return issues;
}