import { type ComponentType } from 'react';

import { type JsonPointer } from '../../../model/jsonPointer';
import { XBindingCard } from './XBindingCard';
import { XConditionalCard } from './XConditionalCard';
import { XContextSourceCard } from './XContextSourceCard';
import { XContextTargetCard } from './XContextTargetCard';
import { XDisplayFormatCard } from './XDisplayFormatCard';
import { XEncryptionCard } from './XEncryptionCard';
import { XEnumCard } from './XEnumCard';
import { XErrorMessagesCard } from './XErrorMessagesCard';
import { XFilterOperatorsCard } from './XFilterOperatorsCard';
import { XLabelsCard } from './XLabelsCard';
import { XLookupCard } from './XLookupCard';
import { XLovCard } from './XLovCard';
import { XRolesCard } from './XRolesCard';
import { XSortableCard } from './XSortableCard';
import { XValidationCard } from './XValidationCard';

/**
 * Where a card is allowed to render, keyed off the selected node's pointer:
 *  - `'property'` — only at a property pointer (not the schema root).
 *  - `'root'`     — only at the schema root pointer.
 *  - `'any'`      — at both. Used for every pre-existing card so this field
 *    introduces zero behavior change: `VNextTab` previously rendered every
 *    registry entry regardless of pointer, so all of today's cards keep
 *    showing at the root exactly as before. Only new cards get a narrower
 *    scope.
 */
export type VNextCardScope = 'property' | 'root' | 'any';

export interface VNextCardEntry {
  xKey: string;
  component: ComponentType<{ pointer: JsonPointer }>;
  scope: VNextCardScope;
}

/**
 * Ordered list of vNext (`x-*`) editor cards rendered by `VNextTab`. The
 * ordering is intentional and groups cards by role:
 *  1. Identity / presentation  (`x-labels`, `x-enum`, `x-errorMessages`)
 *  2. Behavior + access         (`x-conditional`, `x-roles`)
 *  3. Data sourcing             (`x-lov`, `x-lookup`)
 *  4. Wiring                    (`x-binding`)
 *  5. Tabular display           (`x-filterOperators`, `x-sortable`, `x-displayFormat`)
 *  6. Operational metadata      (`x-encryption`, `x-validation`)
 *  7. Data-vocab context wiring (`x-context-source`, `x-context-target`)
 */
export const VNEXT_CARD_REGISTRY: readonly VNextCardEntry[] = [
  { xKey: 'x-labels', component: XLabelsCard, scope: 'any' },
  { xKey: 'x-enum', component: XEnumCard, scope: 'any' },
  { xKey: 'x-errorMessages', component: XErrorMessagesCard, scope: 'any' },
  { xKey: 'x-conditional', component: XConditionalCard, scope: 'any' },
  { xKey: 'x-roles', component: XRolesCard, scope: 'any' },
  { xKey: 'x-lov', component: XLovCard, scope: 'any' },
  { xKey: 'x-lookup', component: XLookupCard, scope: 'any' },
  { xKey: 'x-binding', component: XBindingCard, scope: 'any' },
  { xKey: 'x-filterOperators', component: XFilterOperatorsCard, scope: 'any' },
  { xKey: 'x-sortable', component: XSortableCard, scope: 'any' },
  { xKey: 'x-displayFormat', component: XDisplayFormatCard, scope: 'any' },
  { xKey: 'x-encryption', component: XEncryptionCard, scope: 'any' },
  { xKey: 'x-validation', component: XValidationCard, scope: 'any' },
  { xKey: 'x-context-source', component: XContextSourceCard, scope: 'property' },
  { xKey: 'x-context-target', component: XContextTargetCard, scope: 'root' },
];
