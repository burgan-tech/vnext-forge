export interface WorkflowTemplateSummary {
  id: string
  name: string
  type: string
  description: string
}

export const workflowTemplateCatalog: readonly WorkflowTemplateSummary[] = [
  {
    id: 'basic-flow',
    name: 'Basic Flow',
    type: 'F',
    description: 'Simple workflow: initial -> processing -> completed/error',
  },
  {
    id: 'subflow',
    name: 'SubFlow',
    type: 'S',
    description: 'Reusable sub-workflow with parameter passing',
  },
  {
    id: 'subprocess',
    name: 'SubProcess',
    type: 'P',
    description: 'Independent parallel process',
  },
  {
    id: 'approval-flow',
    name: 'Approval Flow',
    type: 'F',
    description: 'Approval: pending -> approve/reject + timeout',
  },
  {
    id: 'saga-flow',
    name: 'Saga/Compensation',
    type: 'F',
    description: 'Compensation pattern with rollback',
  },
  {
    id: 'event-driven',
    name: 'Event-Driven Flow',
    type: 'F',
    description: 'PubSub event-based workflow',
  },
  {
    id: 'scheduled-flow',
    name: 'Scheduled/Timer Flow',
    type: 'F',
    description: 'Timer-based workflow (expire, timeout)',
  },
  {
    id: 'wizard-flow',
    name: 'Wizard Flow',
    type: 'F',
    description: 'Step-by-step wizard with stateType=5',
  },
  {
    id: 'cdc-worker',
    name: 'CDC Worker',
    type: 'F',
    description: 'Background data synchronization',
  },
  {
    id: 'multi-factor-auth',
    name: 'Multi-Factor Auth',
    type: 'F',
    description: 'Multi-factor authentication flow',
  },
  {
    id: 'crud-state-machine',
    name: 'CRUD State Machine',
    type: 'F',
    description: 'draft -> active -> passive lifecycle',
  },
  {
    id: 'transaction-flow',
    name: 'Transaction Flow',
    type: 'F',
    description: 'Authorization -> Capture pattern',
  },
] as const
