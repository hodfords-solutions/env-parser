import { EnvSchema, ErrorResult, SafeParsedSchema } from './type';
import { ZodResult } from './parser';

export function parseError(envVar: EnvSchema, result: SafeParsedSchema<any>): ErrorResult[] {
    const errors = [];
    for (const key in result) {
        const schemaItem = result[key];
        if (schemaItem instanceof ZodResult) {
            if (!schemaItem.isSuccess()) {
                errors.push({ key, message: schemaItem.message() });
            }
        } else {
            const childErrors = parseError(envVar, schemaItem);
            for (const childError of childErrors) {
                errors.push({ key: `${key}_${childError.key}`, message: childError.message });
            }
        }
    }

    return errors;
}

export function throwErrors(errors: ErrorResult[]) {
    const message = '\n' + errors.map((error) => `${error.key}: ${error.message}`).join('\n');
    throw new Error(message);
}
