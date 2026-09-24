import { Badge } from '../../../../../ui/Badge';
import { indexViolationFor, type IndexNodeInfo } from '../../../model/indexEligibility';

interface IndexBadgeProps {
  info: IndexNodeInfo | undefined;
}

/** IDX marker for `x-indexed: true`; red with the reason when the runtime would reject it. */
export function IndexBadge({ info }: IndexBadgeProps) {
  if (info?.indexed !== true) return null;
  const violation = indexViolationFor(info);
  return (
    <Badge
      variant={violation ? 'destructive' : 'success'}
      className="px-1.5 py-0 text-[9px]"
      title={violation ? violation.message : 'Indexed (x-indexed: true)'}>
      IDX
    </Badge>
  );
}
