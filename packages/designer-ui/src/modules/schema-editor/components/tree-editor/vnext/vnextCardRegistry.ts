import { type ComponentType } from 'react';

import { type JsonPointer } from '../../../model/jsonPointer';
import { XBindingCard } from './XBindingCard';
import { XConditionalCard } from './XConditionalCard';
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

export interface VNextCardEntry {
  xKey: string;
  component: ComponentType<{ pointer: JsonPointer }>;
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
 */
export const VNEXT_CARD_REGISTRY: readonly VNextCardEntry[] = [
  { xKey: 'x-labels', component: XLabelsCard },
  { xKey: 'x-enum', component: XEnumCard },
  { xKey: 'x-errorMessages', component: XErrorMessagesCard },
  { xKey: 'x-conditional', component: XConditionalCard },
  { xKey: 'x-roles', component: XRolesCard },
  { xKey: 'x-lov', component: XLovCard },
  { xKey: 'x-lookup', component: XLookupCard },
  { xKey: 'x-binding', component: XBindingCard },
  { xKey: 'x-filterOperators', component: XFilterOperatorsCard },
  { xKey: 'x-sortable', component: XSortableCard },
  { xKey: 'x-displayFormat', component: XDisplayFormatCard },
  { xKey: 'x-encryption', component: XEncryptionCard },
  { xKey: 'x-validation', component: XValidationCard },
];
