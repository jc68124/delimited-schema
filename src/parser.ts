import type {
    DelimitedTextParseOptions,
    ParsedDelimitedTextCell,
} from './types.js';

import {
    DelimitedTextValidationError,
    validateDelimiter,
} from './validation.js';

export function parseDelimitedText(
    data: string,
    options: DelimitedTextParseOptions,
): ParsedDelimitedTextCell[][] {
    validateDelimiter(options.delimiter);

    const input = data.replace(/^\uFEFF/, '');
    const rows: ParsedDelimitedTextCell[][] = [];

    let row: ParsedDelimitedTextCell[] = [];
    let value = '';
    let inQuotes = false;
    let quoted = false;
    let quoteClosed = false;

    const fail = (message: string): never => {
        const rowNumber = rows.length + 1;
        const column = row.length + 1;

        throw new DelimitedTextValidationError([
            {
                code: 'syntax',
                row: rowNumber,
                column,
                message:
                    `${message} at row ${rowNumber}, ` +
                    `column ${column}`,
            },
        ]);
    };

    const pushCell = () => {
        if (options.requireQuotedFields && !quoted) {
            fail('Field must be quoted');
        }

        row.push({ value, quoted });

        value = '';
        quoted = false;
        quoteClosed = false;
    };

    const pushRow = () => {
        pushCell();
        rows.push(row);
        row = [];
    };

    for (let index = 0; index < input.length; index += 1) {
        const character = input.charAt(index);

        if (inQuotes) {
            if (character === '"') {
                if (input[index + 1] === '"') {
                    value += '"';
                    index += 1;
                } else {
                    inQuotes = false;
                    quoteClosed = true;
                }
            } else {
                value += character;
            }

            continue;
        }

        if (character === '"') {
            if (value !== '' || quoteClosed) {
                fail('Unexpected quote');
            }

            inQuotes = true;
            quoted = true;
            continue;
        }

        if (
            quoteClosed &&
            character !== options.delimiter &&
            character !== '\r' &&
            character !== '\n'
        ) {
            fail('Unexpected character after closing quote');
        }

        if (character === options.delimiter) {
            pushCell();
        } else if (character === '\r' || character === '\n') {
            pushRow();

            if (
                character === '\r' &&
                input[index + 1] === '\n'
            ) {
                index += 1;
            }
        } else {
            value += character;
        }
    }

    if (inQuotes) {
        fail('Unterminated quoted field');
    }

    if (value !== '' || quoted || row.length > 0) {
        pushRow();
    }

    return rows;
}