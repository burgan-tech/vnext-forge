/**
 * Public barrel for the shared schema-driven form module.
 *
 * Hosts (TransitionDialog, NewRunDialog, future component metadata
 * editors) consume `SchemaForm` directly. Field extensions plug into the
 * registry via `registerFieldExtension`. The mini validator is exported
 * as `validateAgainstSchema` for hosts that want to surface errors next
 * to a custom submit button.
 */
export { SchemaForm, defaultValueForSchema } from './SchemaForm';
export type { SchemaFormProps } from './SchemaForm';

export { SchemaField } from './SchemaField';

export {
  registerFieldExtension,
  clearFieldExtensions,
  getFieldExtensions,
  findMatchingExtension,
  decorateLabel,
  localizationStubExtension,
  remoteServiceStubExtension,
} from './fieldRegistry';
export type {
  FieldExtension,
  FieldExtensionRenderArgs,
  FieldExtensionDecorateArgs,
} from './fieldRegistry';

export { validateAgainstSchema } from './validateSchema';

export type {
  FieldErrorMap,
  JsonSchemaProperty,
  JsonSchemaRoot,
  JsonSchemaPrimitiveType,
  JsonSchemaStringFormat,
  JsonSchemaOneOfConst,
  SchemaFieldContext,
} from './types';
