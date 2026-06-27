import { TriangleAlert } from 'lucide-react'
import {
  Alert,
  AlertTitle,
  AlertDescription,
  AlertAction,
} from '@vnext-forge-studio/designer-ui/ui'

interface LargeRangeAlertProps {
  onSelectWorkflow: () => void
  onUpdateTimeRange: () => void
  onContinue: () => void
}

export function LargeRangeAlert({
  onSelectWorkflow,
  onUpdateTimeRange,
  onContinue,
}: LargeRangeAlertProps) {
  return (
    <Alert variant="warning">
      <TriangleAlert className="h-4 w-4" />
      <AlertTitle>Large time range across all workflows</AlertTitle>
      <AlertDescription>
        You are scanning all workflows over a period longer than 30 days. This may return a large
        number of results and take longer to load.
      </AlertDescription>
      <div className="col-start-2 flex flex-wrap gap-2 pt-1">
        <AlertAction variant="warning" onClick={onSelectWorkflow}>
          Select a workflow
        </AlertAction>
        <AlertAction variant="warning" onClick={onUpdateTimeRange}>
          Update time range
        </AlertAction>
        <AlertAction variant="warning" onClick={onContinue}>
          Continue anyway
        </AlertAction>
      </div>
    </Alert>
  )
}
