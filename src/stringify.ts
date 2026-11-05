import type {
    DelimitedTextPrimitive,
    DelimitedTextStringifyOptions,
} from './types.js';

import { validateDelimiter } from './validation.js';

function escapeValue(
    value: DelimitedTextPrimitive,
    options: DelimitedTextStringifyOptions,
): string {
    const text = value instanceof Date
        ? value.toISOString()
        : String(value ?? '');

    if (
        options.quoteAllFields ||
        text === '' ||
        text.includes(options.delimiter) ||
        /["\r\n\uFEFF]/.test(text)
    ) {
        return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
}

export function stringifyDelimitedText(
    rows: readonly (readonly DelimitedTextPrimitive[])[],
    options: DelimitedTextStringifyOptions,
): string {
    validateDelimiter(options.delimiter);

    return rows
        .map(row =>
            row
                .map(value => escapeValue(value, options))
                .join(options.delimiter),
        )
        .join('\r\n');
}