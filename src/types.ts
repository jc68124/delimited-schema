export type DelimitedTextPrimitive =
    | string
    | number
    | boolean
    | null
    | undefined
    | Date;

export type ParsedDelimitedTextRow<T extends object> = {
    [K in keyof T]?: string;
};

export type DelimitedTextRow<T, AllowPartial extends boolean> =
    AllowPartial extends true ? Partial<T> : T;

export interface DelimitedTextCellContext {
    row: number;
    column: number;
    header: string;
}

export type DelimitedTextValueValidator = (
    value: string,
    context: DelimitedTextCellContext,
) => string | undefined;

export interface DelimitedTextOutputColumn<T extends object> {
    header: string;
    getValue: (row: Partial<T>) => DelimitedTextPrimitive;
}

export interface DelimitedTextColumnDefinition<T extends object>
    extends DelimitedTextOutputColumn<T> {
    key?: keyof T;
    validate?: DelimitedTextValueValidator;
}

export interface DelimitedTextKeyColumnOptions<
    T extends object,
    K extends keyof T,
> {
    header?: string;
    defaultValue?: T[K];
    format?: (
        value: NonNullable<T[K]>,
        row: Partial<T>,
    ) => DelimitedTextPrimitive;
    validate?: DelimitedTextValueValidator;
}

export interface DelimitedTextParseOptions {
    delimiter: string;
    requireQuotedFields?: boolean;
}

export interface DelimitedTextSchemaOptions
    extends DelimitedTextParseOptions {
    enforceHeaderOrder?: boolean;
}

export interface DelimitedTextStringifyOptions {
    delimiter: string;
    quoteAllFields?: boolean;
}

export interface DelimitedTextOutputOptions<T extends object> {
    quoteAllFields?: boolean;
    transformColumns?: (
        columns: DelimitedTextOutputColumn<T>[],
    ) => DelimitedTextOutputColumn<T>[];
}

export interface ParsedDelimitedTextCell {
    value: string;
    quoted: boolean;
}

export interface DelimitedTextValidationIssue {
    code: 'syntax' | 'headers' | 'row-length' | 'value';
    message: string;
    row?: number;
    column?: number;
    header?: string;
}

export interface DelimitedTextValidationResult {
    valid: boolean;
    issues: DelimitedTextValidationIssue[];
}