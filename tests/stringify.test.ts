import { describe, expect, it } from 'vitest';
import { stringifyDelimitedText } from '../src/stringify.js';

describe('stringifyDelimitedText', () => {
    it('joins fields and uses CRLF between rows', () => {
        expect(
            stringifyDelimitedText(
                [
                    ['Name', 'Quantity'],
                    ['Widget', 10],
                ],
                { delimiter: ',' },
            ),
        ).toBe('Name,Quantity\r\nWidget,10');
    });

    it.each([',', '\t', '|', ';'])(
        'quotes values containing delimiter %j',
        delimiter => {
            expect(
                stringifyDelimitedText(
                    [[`a${delimiter}b`, 'c']],
                    { delimiter },
                ),
            ).toBe(`"a${delimiter}b"${delimiter}c`);
        },
    );

    it('escapes embedded quotes', () => {
        expect(
            stringifyDelimitedText(
                [['He said "hello"']],
                { delimiter: ',' },
            ),
        ).toBe('"He said ""hello"""');
    });

    it('quotes multiline values without changing their line endings', () => {
        expect(
            stringifyDelimitedText(
                [['a\r\nb\nc']],
                { delimiter: ',' },
            ),
        ).toBe('"a\r\nb\nc"');
    });

    it('writes null, undefined and empty strings as quoted empty fields', () => {
        expect(
            stringifyDelimitedText(
                [[null, undefined, '']],
                { delimiter: ',' },
            ),
        ).toBe('"","",""');
    });

    it('preserves zero and false', () => {
        expect(
            stringifyDelimitedText(
                [[0, false, true]],
                { delimiter: ',' },
            ),
        ).toBe('0,false,true');
    });

    it('formats dates as ISO strings', () => {
        expect(
            stringifyDelimitedText(
                [[new Date('2026-01-02T03:04:05Z')]],
                { delimiter: ',' },
            ),
        ).toBe('2026-01-02T03:04:05.000Z');
    });

    it('can quote every field', () => {
        expect(
            stringifyDelimitedText(
                [['Name', 10, false]],
                {
                    delimiter: ',',
                    quoteAllFields: true,
                },
            ),
        ).toBe('"Name","10","false"');
    });

    it('quotes a BOM inside a value so it is not stripped as a file BOM', () => {
        expect(
            stringifyDelimitedText(
                [['\uFEFFvalue']],
                { delimiter: ',' },
            ),
        ).toBe('"\uFEFFvalue"');
    });

    it('returns empty text when there are no rows', () => {
        expect(
            stringifyDelimitedText([], { delimiter: ',' }),
        ).toBe('');
    });

    it.each(['', '||', '"', '\n', '\r', '\uFEFF'])(
        'rejects invalid delimiter %j',
        delimiter => {
            expect(() =>
                stringifyDelimitedText([['a']], { delimiter }),
            ).toThrow(/Delimiter/);
        },
    );
});