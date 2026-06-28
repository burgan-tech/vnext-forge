import { useEffect, useState } from 'react';
import { collectWorkflowLanguages, collectWorkflowRoles } from '@vnext-forge-studio/doc-gen';
import { Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../ui/Dialog';
import { Button } from '../../../ui/Button';
import { Checkbox } from '../../../ui/Checkbox';
import { Label } from '../../../ui/Label';
import { Select } from '../../../ui/Select';

interface AudienceRolePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowJson: unknown;
  onGenerate: (filter: { roles: string[]; language: string }) => void;
}

export function AudienceRolePickerDialog({
  open,
  onOpenChange,
  workflowJson,
  onGenerate,
}: AudienceRolePickerDialogProps) {
  const [roles, setRoles] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [language, setLanguage] = useState<string>('en');

  useEffect(() => {
    if (!open) return;

    const collectedRoles = collectWorkflowRoles(workflowJson);
    const collectedLanguages = collectWorkflowLanguages(workflowJson);

    setRoles(collectedRoles);
    setLanguages(collectedLanguages);
    setSelectedRoles([]);

    if (collectedLanguages.includes('en')) {
      setLanguage('en');
    } else if (collectedLanguages.length > 0) {
      setLanguage(collectedLanguages[0]);
    } else {
      setLanguage('en');
    }
  }, [open, workflowJson]);

  function handleRoleToggle(role: string, checked: boolean) {
    setSelectedRoles((prev) =>
      checked ? [...prev, role] : prev.filter((r) => r !== role),
    );
  }

  function handleGenerate() {
    onGenerate({ roles: selectedRoles, language });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 p-0">
        <DialogHeader className="border-border shrink-0 border-b px-6 py-4">
          <DialogTitle>Generate OpenAPI</DialogTitle>
          <DialogDescription>
            Select the audience roles and language for the generated specification.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-6 py-4">
          {roles.length === 0 ? (
            <div className="bg-muted text-muted-foreground flex items-start gap-2 rounded-md p-3 text-sm">
              <Info size={16} className="mt-0.5 shrink-0" />
              <span>
                No roles defined in this workflow. The generated spec will include all transitions.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-foreground text-sm font-medium">Roles</p>
              <div className="border-border max-h-60 overflow-y-auto rounded-md border p-3">
                <div className="flex flex-col gap-2">
                  {roles.map((role) => (
                    <div key={role} className="flex items-center gap-2">
                      <Checkbox
                        id={`role-${role}`}
                        checked={selectedRoles.includes(role)}
                        onCheckedChange={(checked) => handleRoleToggle(role, checked === true)}
                      />
                      <Label htmlFor={`role-${role}`} className="cursor-pointer font-normal">
                        {role}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {languages.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="language-select" className="text-sm font-medium">
                Language
              </Label>
              <Select
                id="language-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full">
                {languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="border-border shrink-0 border-t px-6 py-3">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="default" size="sm" onClick={handleGenerate}>
            Generate OpenAPI
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
