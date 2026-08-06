import { ShieldAlert } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '../../../ui/Alert';

export interface FunctionRunAuthzBannerProps {
  status: number;
}

/**
 * `/info` and invoke share one `IFunctionAccessPolicy` in the runtime, so a
 * 401/403 on either means the same denial. Called out separately from other
 * 4xx responses so the user does not go looking for a bug in the function
 * itself — see `isAuthorizationFailure` for exactly which statuses this
 * covers (404 is deliberately excluded: it means "no sys-functions
 * component for this key", a routing problem, not a permissions one).
 */
export function FunctionRunAuthzBanner({ status }: FunctionRunAuthzBannerProps) {
  return (
    <Alert variant="warning" className="py-2">
      <ShieldAlert aria-hidden />
      <AlertTitle>You are not allowed to run this function ({status})</AlertTitle>
      <AlertDescription>
        The runtime refused with the current credentials. Check the function&apos;s{' '}
        <code className="font-mono text-[10px]">roles</code> and the auth headers in Headers —
        discovery and execution are gated by the same access policy, so this is a permissions
        problem, not a broken function.
      </AlertDescription>
    </Alert>
  );
}
