import { stateTypeStyle } from './transitionKindStyles';

interface ProgressStepperProps {
  currentStep: number;
  totalSteps: number;
  currentStateName?: string;
  /** R21: engine-declared state lifecycle (initial / intermediate /
   *  finish / subflow / wizard). Rendered as a small coloured chip
   *  next to the state name. Unknown values are hidden. */
  stateType?: string;
}

export function ProgressStepper({ currentStep, totalSteps, currentStateName, stateType }: ProgressStepperProps) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i);
  const typeStyle = stateTypeStyle(stateType);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1" role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={totalSteps}>
        {steps.map((i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-sm transition-colors ${
              i < currentStep
                ? 'bg-[var(--vscode-progressBar-background)]'
                : i === currentStep
                  ? 'bg-[var(--vscode-progressBar-background)] opacity-60'
                  : 'bg-[var(--vscode-editorWidget-border)]'
            }`}
          />
        ))}
      </div>
      {currentStateName && (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-text">
          <span className="font-medium text-foreground">▶ {currentStateName}</span>
          {typeStyle && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${typeStyle.className}`}
              title={typeStyle.description}
            >
              {typeStyle.label}
            </span>
          )}
          <span>— Step {currentStep} of {totalSteps}</span>
        </p>
      )}
    </div>
  );
}
