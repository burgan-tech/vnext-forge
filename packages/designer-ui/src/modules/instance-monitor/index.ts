export { MonitorShell, type MonitorShellProps } from './components/MonitorShell';
export type { MonitorTarget, OpenComponentTarget, OpenInstanceMonitorTarget } from './types';
export { publishInstanceChange, subscribeInstanceChanges, registerInstanceChangeRelay, type InstanceChangeEvent } from './bus/instanceChangeBus';
