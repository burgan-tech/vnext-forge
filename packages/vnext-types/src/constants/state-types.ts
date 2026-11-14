export enum StateType {
  Initial = 1,
  Intermediate = 2,
  Final = 3,
  SubFlow = 4,
  Wizard = 5,
  /** Runs a `sys-agents` component on entry; its decision picks a rule-less automatic transition. Runtime 0.0.105 (experimental). */
  AiAgent = 6,
}

export enum StateSubType {
  None = 0,
  Success = 1,
  Error = 2,
  Terminated = 3,
  Suspended = 4,
  Busy = 5,
  Human = 6,
  Cancelled = 7,
  Timeout = 8
}
