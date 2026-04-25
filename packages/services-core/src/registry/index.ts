export {
  buildMethodRegistry,
  type MethodHandler,
  type MethodId,
  type MethodRegistry,
  type ServiceRegistry,
} from './method-registry.js'
export { dispatchMethod, type DispatchOptions } from './dispatch.js'
export {
  assertCapabilityAllowed,
  methodCapability,
  type CallerContext,
  type MethodCapability,
} from './policy.js'
