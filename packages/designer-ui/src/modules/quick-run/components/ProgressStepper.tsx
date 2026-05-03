interface ProgressStepperProps {
  currentStep: number;
  totalSteps: number;
  currentStateName?: string;
}

export function ProgressStepper({ currentStep, totalSteps, currentStateName }: ProgressStepperProps) {
  const steps = Array.from({ length: totalSteps }, (_, i) => i);

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
        <p className="text-xs text-[var(--vscode-descriptionForeground)]">
          <span className="font-medium text-[var(--vscode-foreground)]">▶ {currentStateName}</span>
          {' '}— Step {currentStep} of {totalSteps}
        </p>
      )}
    </div>
  );
}
