import {
  DropdownSelect,
  DropdownSelectContent,
  DropdownSelectItem,
  DropdownSelectTrigger,
  DropdownSelectValue,
} from '@vnext-forge-studio/designer-ui/ui';

interface VersionPickerProps {
  currentVersion: string;
  versions: string[];
  onChange?: (version: string) => void;
  disabled?: boolean;
}

export function VersionPicker({ currentVersion, versions, onChange, disabled }: VersionPickerProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Version</span>
      <DropdownSelect value={currentVersion} onValueChange={onChange} disabled={disabled || versions.length <= 1}>
        <DropdownSelectTrigger className="h-7 w-28 text-xs">
          <DropdownSelectValue />
        </DropdownSelectTrigger>
        <DropdownSelectContent>
          {versions.map((v) => (
            <DropdownSelectItem key={v} value={v} className="text-xs font-mono">
              {v}
            </DropdownSelectItem>
          ))}
        </DropdownSelectContent>
      </DropdownSelect>
    </div>
  );
}
