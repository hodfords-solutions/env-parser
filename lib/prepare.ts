import { z } from 'zod';
import { assertNever } from './type';

type ZodSchemaTypes = z.core.$ZodTypes;
type Preprocessor = (arg: string | undefined) => unknown;

const identity: Preprocessor = (arg) => arg;

const toNumber: Preprocessor = (arg) => {
    if (typeof arg === 'string' && /^-?\d+(\.\d+)?$/.test(arg)) {
        return Number(arg);
    }
    return arg;
};

const toBigInt: Preprocessor = (arg) => {
    if (typeof arg === 'string' && /^-?\d+$/.test(arg)) {
        return BigInt(arg);
    }
    return arg;
};

// env vars that act as flags might be declared in a number of ways,
// including simply `SOME_VALUE=` (with no RHS). the latter convention
// doesn't seem to be in widespread use with node, though. (that's probably
// because it results in the env var being present as the empty string,
// which is falsy.)
//
// this preprocessor is kind of a hedge -- it accepts a few different
// specific values to signify true or false. i can think of two other
// options:
// - coerce any value that's not `undefined` to `true` (or maybe any value
//   that's not `undefined` or `false` or `0`, but again the complexity
//   piles up quickly here).
// - coerce *only* 'true' and 'false' to their respective values. this could
//   be complemented by a custom schema called 'flag' or something else that
//   handles a looser coercion case (for now this is easy for users to do in
//   their own code according to their needs).
//
// for now, this hedge seems to work fine, but it might be worth revisiting.
const toBoolean: Preprocessor = (arg) => {
    if (typeof arg === 'string') {
        const argLower = arg.toLowerCase();

        switch (argLower) {
            case 'true':
            case 'yes':
            case '1':
                return true;
            case 'false':
            case 'no':
            case '0':
                return false;
        }
    }
    return arg;
};

const toJson: Preprocessor = (arg) => {
    // neither `undefined` nor the empty string are valid json.
    if (!arg) return arg;
    // the one circumstance (so far) when i think a preprocessor should be
    // able to throw is if we're coercing to json but it's invalid -- this
    // way the error message will be more informative (rather than just
    // "expected x, got string"). in the future `getPreprocessor` could
    // maybe be refined to return a result type instead, but let's not
    // overengineer things for now.
    return JSON.parse(arg);
};

const toDate: Preprocessor = (arg) => {
    // calling the 0-arity Date constructor makes a new Date with the
    // current time, which definitely isn't what we want here. but calling
    // the 1-arity Date constructor, even with `undefined`, should result in
    // "invalid date" for values that aren't parseable. we filter out
    // `undefined` anyway, though-- it makes typescript happier.
    if (arg == null) return arg;
    return new Date(arg);
};

const toNull: Preprocessor = (arg) => {
    // coerce undefined to null.
    if (arg == null) return null;
    return arg;
};

/**
 * `z.enum()` and native enums share the same zod type, so the values decide
 * whether the raw string has to be coerced to a number.
 */
function getEnumPreprocessor(entries: Record<string, string | number>): Preprocessor {
    const hasNumericValue = Object.values(entries).some((value) => typeof value === 'number');
    return hasNumericValue ? toNumber : identity;
}

/**
 * A literal accepts one or more values of any primitive type, so the raw
 * string is matched against each of them instead of being coerced blindly.
 */
function getLiteralPreprocessor(values: readonly z.core.util.Literal[]): Preprocessor {
    return (arg) => {
        if (arg == null) return arg;

        for (const value of values) {
            if (String(value) === arg) {
                return value;
            }
        }

        return arg;
    };
}

function getOptionalPreprocessor(innerType: z.core.$ZodType): Preprocessor {
    const preprocessor = getPreprocessorByZodType(innerType as ZodSchemaTypes);
    return (arg) => {
        if (arg === undefined) return arg;
        return preprocessor(arg);
    };
}

function getNullablePreprocessor(innerType: z.core.$ZodType): Preprocessor {
    const preprocessor = getPreprocessorByZodType(innerType as ZodSchemaTypes);
    return (arg) => {
        // coerce undefined to null.
        if (arg == null) return null;
        return preprocessor(arg);
    };
}

/**
 * Given a Zod schema, returns a function that tries to convert a string (or
 * undefined!) to a valid input type for the schema.
 * Clone from znv
 */
// eslint-disable-next-line max-lines-per-function
export function getPreprocessorByZodType(schema: ZodSchemaTypes): Preprocessor {
    const def = schema._zod.def;
    const { type } = def;

    switch (type) {
        case 'string':
        case 'undefined':
            return identity;

        case 'enum':
            return getEnumPreprocessor(def.entries);

        case 'number':
            return toNumber;

        case 'bigint':
            return toBigInt;

        case 'boolean':
            return toBoolean;

        case 'array':
        case 'object':
        case 'tuple':
        case 'record':
        case 'intersection':
            return toJson;

        // `.transform()` and `.pipe()` both produce a pipe, so the input side of
        // the pipe is what the raw string has to be coerced to.
        case 'pipe':
            return getPreprocessorByZodType(def.in as ZodSchemaTypes);

        case 'default':
        case 'prefault':
            return getPreprocessorByZodType(def.innerType as ZodSchemaTypes);

        case 'optional':
            return getOptionalPreprocessor(def.innerType);

        case 'nullable':
            return getNullablePreprocessor(def.innerType);

        case 'date':
            return toDate;

        case 'literal':
            return getLiteralPreprocessor(def.values);

        case 'null':
            return toNull;

        // discriminated unions are plain unions in zod 4, so both land here.
        case 'union':
            throw new Error(`Zod type not yet supported: "${type}" (PRs welcome)`);

        case 'any':
        case 'unknown':
        case 'custom':
            throw new Error(
                [
                    `Zod type not supported: ${type}`,
                    'You can use `z.string()` or `z.string().optional()` instead of the above type.',
                    '(Environment variables are already constrained to `string | undefined`.)'
                ].join('\n')
            );

        // some of these types could maybe be supported (if only via the identity
        // function), but don't necessarily represent something meaningful as a
        // top-level schema passed to znv.
        case 'void':
        case 'never':
        case 'lazy':
        case 'function':
        case 'promise':
        case 'map':
        case 'set':
        case 'nan':
        case 'catch':
        case 'nonoptional':
        case 'success':
        case 'readonly':
        case 'symbol':
        case 'file':
        case 'transform':
        case 'template_literal':
            throw new Error(`Zod type not supported: ${type}`);

        default: {
            assertNever(type);
        }
    }
}

/**
 * Given a Zod schema, return the schema wrapped in a preprocessor that tries to
 * convert a string to the schema's input type.
 */
export function getSchemaWithPreprocessor(schema: z.ZodType) {
    return z.preprocess(
        getPreprocessorByZodType(schema as unknown as ZodSchemaTypes) as (arg: unknown) => unknown,
        schema
    );
}
