/**
 * @file dto-to-schema.util.ts
 * @description Automatically converts a NestJS DTO class with class-validator decorators into an MCP JSON Schema.
 */

import { targetConstructorToSchema } from 'class-validator-jsonschema';

export function dtoToInputSchema(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  dtoClass: Function,
  extraProperties: Record<string, unknown> = {},
): Record<string, unknown> {
  const generated = targetConstructorToSchema(dtoClass);

  const properties = {
    ...(generated.properties || {}),
    ...extraProperties,
  };

  const required = generated.required || [];

  return {
    type: 'object',
    properties,
    required,
  };
}
