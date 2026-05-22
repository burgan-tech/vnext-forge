import { type ComponentType } from 'react';

import { type JsonPointer } from '../../../model/jsonPointer';
import { XBindingCard } from './XBindingCard';
import { XConditionalCard } from './XConditionalCard';
import { XEncryptionCard } from './XEncryptionCard';
import { XEnumCard } from './XEnumCard';
import { XErrorMessagesCard } from './XErrorMessagesCard';
import { XLabelsCard } from './XLabelsCard';
import { XLookupCard } from './XLookupCard';
import { XLovCard } from './XLovCard';
import { XValidationCard } from './XValidationCard';

export interface VNextCardEntry {
  xKey: string;
  component: ComponentType<{ pointer: JsonPointer }>;
}

/**
 * Ordered list of vNext (`x-*`) editor cards rendered by `VNextTab`. The
 * ordering is intentional and groups cards by role:
 *  1. Identity / presentation  (`x-labels`, `x-enum`, `x-errorMessages`)
 *  2. Behavior                  (`x-conditional`)
 *  3. Data sourcing             (`x-lov`, `x-lookup`)
 *  4. Wiring                    (`x-binding`)
 *  5. Operational metadata      (`x-encryption`, `x-validation`)
 */
export const VNEXT_CARD_REGISTRY: readonly VNextCardEntry[] = [
  { xKey: 'x-labels', component: XLabelsCard },
  { xKey: 'x-enum', component: XEnumCard },
  { xKey: 'x-errorMessages', component: XErrorMessagesCard },
  { xKey: 'x-conditional', component: XConditionalCard },
  { xKey: 'x-lov', component: XLovCard },
  { xKey: 'x-lookup', component: XLookupCard },
  { xKey: 'x-binding', component: XBindingCard },
  { xKey: 'x-encryption', component: XEncryptionCard },
  { xKey: 'x-validation', component: XValidationCard },
];
