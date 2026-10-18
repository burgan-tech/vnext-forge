import type { PseudoViewDelegate } from '@burgan-tech/pseudo-ui';

/**
 * Every delegate method the surface passes straight through to the host's
 * delegate (everything except `onAction`, which the surface wraps with its
 * own banner/pending state). Methods are forwarded one by one, so a delegate
 * method added to the SDK must be added here too or it never reaches it.
 */
export function forwardDelegateMethods(
  baseDelegate: PseudoViewDelegate,
): Omit<PseudoViewDelegate, 'onAction'> {
  return {
    requestData: (...args) => baseDelegate.requestData(...args),
    loadComponent: (...args) => baseDelegate.loadComponent(...args),
    readFile: baseDelegate.readFile ? (...args) => baseDelegate.readFile!(...args) : undefined,
    loadSubInstances: baseDelegate.loadSubInstances
      ? (...args) => baseDelegate.loadSubInstances!(...args)
      : undefined,
    onLog: baseDelegate.onLog ? (...args) => baseDelegate.onLog!(...args) : undefined,
    onValidationRequest: baseDelegate.onValidationRequest
      ? (...args) => baseDelegate.onValidationRequest!(...args)
      : undefined,
    // R11: SDK designer-mode callbacks. Without these the canvas would land
    // on the noop default and feel "frozen".
    onNodeSelect: baseDelegate.onNodeSelect
      ? (...args) => baseDelegate.onNodeSelect!(...args)
      : undefined,
    onNodeHover: baseDelegate.onNodeHover
      ? (...args) => baseDelegate.onNodeHover!(...args)
      : undefined,
    onNodeDelete: baseDelegate.onNodeDelete
      ? (...args) => baseDelegate.onNodeDelete!(...args)
      : undefined,
    onNodeMove: baseDelegate.onNodeMove
      ? (...args) => baseDelegate.onNodeMove!(...args)
      : undefined,
    onNodeDropFromPalette: baseDelegate.onNodeDropFromPalette
      ? (...args) => baseDelegate.onNodeDropFromPalette!(...args)
      : undefined,
  };
}
