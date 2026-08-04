import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

import { patchViewDisplaySchema } from '../../src/services/validate/view-display-schema-patch.js'

const require_ = createRequire(import.meta.url)

interface SchemaModule {
  getSchema(type: string): Record<string, unknown> | null
}

/**
 * The real installed `@burgan-tech/vnext-schema` view schema.
 *
 * Deliberately not a hand-written fixture: the whole point of the patch is that
 * it works against the package actually on disk. A fixture would keep passing
 * after a dependency bump silently changed the shape it is compensating for.
 */
function installedViewSchema(): Record<string, unknown> {
  const mod = require_('@burgan-tech/vnext-schema') as SchemaModule
  const schema = mod.getSchema('view')
  if (!schema) throw new Error('view schema not found in @burgan-tech/vnext-schema')
  return schema
}

function compile(schema: Record<string, unknown>) {
  const ajv = new Ajv({ strict: false, allErrors: true })
  addFormats(ajv as never)
  return ajv.compile(schema)
}

function viewWith(display: unknown): Record<string, unknown> {
  return {
    key: 'customer-form',
    version: '1.0.0',
    domain: 'core',
    flow: 'sys-views',
    flowVersion: '1.0.0',
    tags: ['customer-form'],
    attributes: { type: 1, content: '{}', display },
  }
}

/** The post-#128 shape, for the "already migrated" case. */
const NEW_SHAPE_VIEW_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    attributes: {
      type: 'object',
      properties: {
        display: { oneOf: [{ $ref: '#/definitions/sdiDisplay' }] },
      },
    },
  },
  definitions: {
    sdiDisplay: { type: 'string' },
  },
}

describe('patchViewDisplaySchema', () => {
  it('only touches the view schema', () => {
    const schema = installedViewSchema()
    expect(patchViewDisplaySchema('task', schema)).toBe(schema)
    expect(patchViewDisplaySchema('workflow', schema)).toBe(schema)
  })

  it('patches the installed schema, which still has the old string-only display', () => {
    const schema = installedViewSchema()
    const patched = patchViewDisplaySchema('view', schema)

    expect(patched).not.toBe(schema)
    expect((patched.definitions as Record<string, unknown>).sdiDisplay).toBeDefined()
    expect((patched.definitions as Record<string, unknown>).mdiDisplay).toBeDefined()
    expect((patched.definitions as Record<string, unknown>).displayModes).toBeDefined()
  })

  it('does not mutate its input', () => {
    // The schema object belongs to the cached schema module and is shared across
    // every version key, so mutating it would leak the patch into schemas it was
    // never meant to touch.
    const schema = installedViewSchema()
    const before = JSON.stringify(schema)
    patchViewDisplaySchema('view', schema)
    expect(JSON.stringify(schema)).toBe(before)
  })

  it('leaves an already-migrated schema untouched, so it self-retires', () => {
    // Once a published package carries #128 this is the live path, and the patch
    // must become a no-op rather than re-writing a newer shape.
    expect(patchViewDisplaySchema('view', NEW_SHAPE_VIEW_SCHEMA)).toBe(NEW_SHAPE_VIEW_SCHEMA)
  })

  it('leaves an unrecognised shape untouched', () => {
    const odd = { type: 'object', properties: {} }
    expect(patchViewDisplaySchema('view', odd)).toBe(odd)
  })

  it('preserves unrelated parts of the schema', () => {
    const schema = installedViewSchema()
    const patched = patchViewDisplaySchema('view', schema)
    const attrs = (patched.properties as Record<string, Record<string, unknown>>).attributes
    // `content` / `type` / the allOf conditionals must survive, or a newer
    // published schema's unrelated view changes would be silently reverted.
    expect(Object.keys(attrs.properties as object)).toEqual(
      Object.keys(
        (
          (schema.properties as Record<string, Record<string, unknown>>).attributes
            .properties as object
        ),
      ),
    )
    expect(attrs.allOf).toBe(
      (schema.properties as Record<string, Record<string, unknown>>).attributes.allOf,
    )
  })
})

describe('the patched schema, compiled by AJV', () => {
  const validate = compile(patchViewDisplaySchema('view', installedViewSchema()))

  it.each([
    ['the legacy bare string', 'popup'],
    ['both modes', { sdi: 'popup', mdi: 'drawer' }],
    ['MDI only', { mdi: 'full-page' }],
  ])('accepts %s', (_label, display) => {
    expect(validate(viewWith(display))).toBe(true)
  })

  it.each([
    ['an empty object (schema requires at least one mode)', {}],
    ['an unknown sdi value', { sdi: 'nope' }],
    ['an unknown mdi value', { mdi: 'nope' }],
    ['an unknown extra property', { sdi: 'popup', platform: 'web' }],
  ])('rejects %s', (_label, display) => {
    expect(validate(viewWith(display))).toBe(false)
  })

  const SHARED_VOCABULARY = [
    'full-page',
    'popup',
    'bottom-sheet',
    'top-sheet',
    'drawer',
    'inline',
  ] as const

  it.each(SHARED_VOCABULARY)('accepts %s in the sdi slot', (value) => {
    expect(validate(viewWith({ sdi: value }))).toBe(true)
  })

  it.each(SHARED_VOCABULARY)('accepts %s in the mdi slot too', (value) => {
    // The point of the shared vocabulary: mdi takes the same values as sdi, so
    // neither slot can accept something the other rejects.
    expect(validate(viewWith({ mdi: value }))).toBe(true)
  })

  it.each(['tab', 'window', 'split'])('rejects the superseded MDI-only value %s', (value) => {
    expect(validate(viewWith({ mdi: value }))).toBe(false)
  })
})

describe('the unpatched installed schema', () => {
  // Pins the reason the patch exists. When this starts failing, the package has
  // published #128 and the patch (and this suite) can be deleted.
  const validate = compile(installedViewSchema())

  it('still accepts the legacy string', () => {
    expect(validate(viewWith('popup'))).toBe(true)
  })

  it('rejects the per-mode object form', () => {
    expect(validate(viewWith({ sdi: 'popup', mdi: 'drawer' }))).toBe(false)
  })
})
