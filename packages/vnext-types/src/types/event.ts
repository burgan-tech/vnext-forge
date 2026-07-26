import type { MappingCode } from './mapping';

/**
 * Declares how an inbound external event is mapped before it acts on a workflow.
 * Present at workflow level (attributes.event, action=start) and transition level
 * (transition.event, action=transition; required when triggerType is Event).
 */
export interface Event {
  /** Mapping script (implements IEventMapping) turning the raw payload into InstanceKey + Body. */
  mapping: MappingCode;
}
