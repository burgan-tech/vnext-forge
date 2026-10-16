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
import { XIndexedCard } from './XIndexedCard';
import { XLabelsCard } from './XLabelsCard';
import { XLookupCard } from './XLookupCard';
import { XLovCard } from './XLovCard';
import { XMaskingCard } from './XMaskingCard';
import { XRolesCard } from './XRolesCard';
import { XSortableCard } from './XSortableCard';
import { XValidationCard } from './XValidationCard';
import { XComputedCard } from './XComputedCard';
import { XStorageCard } from './XStorageCard';
import {
  XGroupCard,
  XHelpTextCard,
  XOrderCard,
  XPlaceholderCard,
  XUiHintCard,
  XUiNoteCard,
} from './ViewHintCards';

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
 *  5. Tabular display / indexing (`x-filterOperators`, `x-sortable`, `x-displayFormat`, `x-indexed`)
 *  6. Field protection + metadata (`x-masking`, `x-encryption`, `x-validation`)
 *  7. Data-vocab context wiring (`x-context-source`, `x-context-target`)
 *  8. Stored-data shape (`x-storage`, `x-computed`) — vnext-schema 0.0.56
 *  9. Form presentation (`x-order`, view hints) — vnext-schema 0.0.56
 * Which cards show for a schema role is decided by `VNextTab` (schemaRoles).
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
  { xKey: 'x-indexed', component: XIndexedCard, scope: 'property' },
  // Runtime 0.0.99: field-level transforms, property pointers only.
  { xKey: 'x-masking', component: XMaskingCard, scope: 'property' },
  { xKey: 'x-encryption', component: XEncryptionCard, scope: 'any' },
  { xKey: 'x-validation', component: XValidationCard, scope: 'any' },
  { xKey: 'x-context-source', component: XContextSourceCard, scope: 'property' },
  { xKey: 'x-context-target', component: XContextTargetCard, scope: 'root' },
  // vnext-schema 0.0.56 / runtime 0.0.100: master-only data shape.
  { xKey: 'x-storage', component: XStorageCard, scope: 'property' },
  { xKey: 'x-computed', component: XComputedCard, scope: 'property' },
  // vnext-schema 0.0.56: form presentation hints, every role.
  { xKey: 'x-order', component: XOrderCard, scope: 'property' },
  { xKey: 'x-group', component: XGroupCard, scope: 'property' },
  { xKey: 'x-helpText', component: XHelpTextCard, scope: 'property' },
  { xKey: 'x-placeholder', component: XPlaceholderCard, scope: 'property' },
  { xKey: 'x-uiHint', component: XUiHintCard, scope: 'property' },
  { xKey: 'x-uiNote', component: XUiNoteCard, scope: 'property' },
];
