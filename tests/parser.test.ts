import { describe, expect, it } from 'vitest';
import { parseDelimitedText } from '../src/parser.js';
import { DelimitedTextValidationError } from '../src/index.js';

function values(text: string, delimiter = ','): string[][] {
    return parseDelimitedText(text, { delimiter })
        .map(row => row.map(cell => cell.value));
}

describe('parseDelimitedText', () => {
    it.each([',', '\t', '|', ';'])(
        'supports delimiter %j',
        delimiter => {
            expect(
                values(
                    `Name${delimiter}Quantity\nWidget${delimiter}10`,
                    delimiter,
                ),
            ).toEqual([
                ['Name', 'Quantity'],
                ['Widget', '10'],
            ]);
        },
    );

    it.each(['\n', '\r\n', '\r'])(
        'supports line ending %j',
        newline => {
            expect(values(`a,b${newline}c,d${newline}`))
                .toEqual([['a', 'b'], ['c', 'd']]);
        },
    );

    it('preserves delimiters and escaped quotes inside quoted fields', () => {
        expect(values('"A, B","He said ""hello"""'))
            .toEqual([['A, B', 'He said "hello"']]);
    });

    it('preserves line endings inside multiline fields', () => {
        expect(values('"first\r\nsecond\nthird",x'))
            .toEqual([['first\r\nsecond\nthird', 'x']]);
    });

    it('records whether each field was quoted', () => {
        expect(
            parseDelimitedText('"a",b,""', { delimiter: ',' }),
        ).toEqual([[
            { value: 'a', quoted: true },
            { value: 'b', quoted: false },
            { value: '', quoted: true },
        ]]);
    });

    it('preserves leading, middle and trailing empty fields', () => {
        expect(values(',a,,')).toEqual([['', 'a', '', '']]);
    });

    it('preserves whitespace without trimming', () => {
        expect(values('  a  ," b "'))
            .toEqual([['  a  ', ' b ']]);
    });

    it('removes a leading BOM', () => {
        expect(values('\uFEFFName,Quantity'))
            .toEqual([['Name', 'Quantity']]);
    });

    it.each(['', '\uFEFF'])(
        'returns no rows for empty input %j',
        text => {
            expect(values(text)).toEqual([]);
        },
    );

    it('accepts quoted empty fields when all fields must be quoted', () => {
        expect(
            parseDelimitedText('"a",""', {
                delimiter: ',',
                requireQuotedFields: true,
            }),
        ).toEqual([[
            { value: 'a', quoted: true },
            { value: '', quoted: true },
        ]]);
    });

    it('reports the location of an unquoted field', () => {
        try {
            parseDelimitedText('"a","b"\n"c",d', {
                delimiter: ',',
                requireQuotedFields: true,
            });

            expect.fail('Expected parsing to fail');
        } catch (error) {
            expect(error)
                .toBeInstanceOf(DelimitedTextValidationError);

            expect(
                (error as DelimitedTextValidationError).issues,
            ).toEqual([
                expect.objectContaining({
                    code: 'syntax',
                    row: 2,
                    column: 2,
                }),
            ]);
        }
    });

    it.each(['a"b,c', '"a"b,c', '"unterminated'])(
        'rejects malformed quoting: %j',
        text => {
            expect(() => values(text))
                .toThrow(DelimitedTextValidationError);
        },
    );

    it.each(['', '||', '"', '\n', '\r', '\uFEFF'])(
        'rejects invalid delimiter %j',
        delimiter => {
            expect(() =>
                parseDelimitedText('a', { delimiter }),
            ).toThrow(/Delimiter/);
        },
    );
});