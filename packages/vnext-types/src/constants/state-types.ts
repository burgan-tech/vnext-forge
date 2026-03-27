export enum StateType {
  Initial = 1,
  Intermediate = 2,
  Final = 3,
  SubFlow = 4,
  Wizard = 5,
}

export enum StateSubType {
  None = 0,
  Success = 1,
  Error = 2,
  Terminated = 3,
  Suspended = 4,
  Busy = 5,
  Human = 6,
}
