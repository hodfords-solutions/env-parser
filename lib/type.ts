import { z } from 'zod';
import { ZodResult } from './parser';

export type ErrorResult = {
    key: string;
    message: string;
};

type primitive = string | number | boolean | undefined | null;

export type DeepReadonlyArray<T> = readonly DeepReadonly<T>[];

export type DeepReadonly<T> = T extends primitive
    ? T
    : T extends (infer U)[]
      ? DeepReadonlyArray<U>
      : DeepReadonlyObject<T>;

export type ParsedSchema<T extends Schemas> = T extends any
    ? {
          [K in keyof T]: T[K] extends SimpleSchema<infer TOut>
              ? TOut
              : T[K] extends Schemas
                ? T[K] extends NestedSchema
                    ? ParsedSchema<T[K]>
                    : never
                : never;
      }
    : never;

export type DeepReadonlyObject<T> = {
    readonly [P in keyof T]: DeepReadonly<T[P]>;
};

export type Schemas = Record<string, SimpleSchema | NestedSchema>;

export type SimpleSchema<TOut = any, TIn = any> = z.ZodType<TOut, z.ZodTypeDef, TIn>;

export type NestedSchema<TOut = any, TIn = any> = {
    [key: string]: SimpleSchema<TOut, TIn>;
};

export type EnvSchema = {
    [key: string]: string;
};

export function assertNever(value: never): never {
    throw new Error(`Unhandled type: ${JSON.stringify(value)}`);
}

export type SafeParsedSchema<T> = {
    [key: string]: ZodResult<any> | SafeParsedSchema<T>;
};
