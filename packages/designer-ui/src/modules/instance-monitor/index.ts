export { MonitorShell, type MonitorShellProps } from './components/MonitorShell';
export type { MonitorTarget, OpenComponentTarget } from './types';
export { publishInstanceChange, subscribeInstanceChanges, registerInstanceChangeRelay, type InstanceChangeEvent } from './bus/instanceChangeBus';
