import type { MappingCode } from './mapping';
import type { MappingBlock } from './state';

/**
 * Declares how an inbound external event is mapped before it acts on a workflow.
 * Present at workflow level (attributes.event, action=start) and transition level
 * (transition.event, action=transition; required when triggerType is Event).
 */
export interface Event {
  /**
   * Mapping script (implements IEventMapping) turning the raw payload into InstanceKey + Body.
   * Mutually exclusive with `input` (publish rejects both).
   */
  mapping?: MappingCode;
  /**
   * Declarative event mapping (runtime vnext#1227): builds `{ key, attributes }` from the event payload
   * (`input`), `now`, `context` and `headers` — no `data`, `instance` or `user`. Not with `mapping`.
   */
  input?: MappingBlock;
}
