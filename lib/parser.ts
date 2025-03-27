import { DeepReadonlyObject, EnvSchema, ParsedSchema, SafeParsedSchema, Schemas } from './type';
import { SafeParseReturnType, z } from 'zod';
import { getSchemaWithPreprocessor } from './prepare';
import { parseError, throwErrors } from './error';

export class ZodResult<T> {
    constructor(public result: SafeParseReturnType<T, any>) {}

    isSuccess(): boolean {
        return this.result.success;
    }

    message(): string {
        return this.result.error.errors[0].message;
    }

    value(): T {
        return this.result.data;
    }
}

export function parse<T extends Schemas>(envVar: EnvSchema, schema: T): DeepReadonlyObject<ParsedSchema<T>> {
    const result = safeParse(envVar, schema);
    const errors = parseError(envVar, result);
    if (errors.length > 0) {
        throwErrors(errors);
    }
    return parseResult(result);
}

function parseResult<T extends Schemas>(results: SafeParsedSchema<T>): ParsedSchema<T> {
    const env = {} as any;
    for (const key in results) {
        const result = results[key];
        if (result instanceof ZodResult) {
            env[key] = result.value();
        } else {
            env[key] = parseResult(result);
        }
    }

    return env;
}

function safeParse<T extends Schemas>(envVar: EnvSchema, schema: T): SafeParsedSchema<T> {
    const result: SafeParsedSchema<T> = {};
    for (const key in schema) {
        const schemaItem = schema[key];
        const envValue = envVar[key];
        if (schemaItem instanceof z.ZodType) {
            result[key] = new ZodResult(getSchemaWithPreprocessor(schemaItem).safeParse(envValue));
        } else {
            result[key] = safeParse(getValueByPrefix(`${key}_`, envVar), schemaItem);
        }
    }

    return result;
}

function getValueByPrefix(prefix: string, env: EnvSchema): EnvSchema {
    const result: EnvSchema = {};
    for (const key in env) {
        if (key.startsWith(prefix)) {
            // remove the prefix
            result[key.slice(prefix.length)] = env[key];
        }
    }

    return result;
}
