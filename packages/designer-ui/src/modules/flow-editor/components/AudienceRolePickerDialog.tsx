import { useEffect, useMemo, useState } from 'react';
import {
  collectWorkflowLanguages,
  collectWorkflowRoles,
  createComponentResolver,
} from '@vnext-forge-studio/doc-gen';
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
import { collectComponents } from '../OpenApiPreviewApi';

interface AudienceRolePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowJson: unknown;
  /** Active project id; used to resolve same-domain subflow references when scanning roles. */
  projectId: string | undefined;
  onGenerate: (filter: { roles: string[]; language: string }) => void;
}

export function AudienceRolePickerDialog({
  open,
  onOpenChange,
  workflowJson,
  projectId,
  onGenerate,
}: AudienceRolePickerDialogProps) {
  // Load same-domain subflow components so roles from the entire subflow chain
  // are included in the picker. Cross-domain subflows are skipped by the
  // resolver (they wouldn't be in this workspace anyway).
  const [subflowComponents, setSubflowComponents] = useState<unknown[]>([]);

  useEffect(() => {
    if (!open || !projectId) {
      setSubflowComponents([]);
      return;
    }
    let cancelled = false;
    void collectComponents(projectId, ['workflows']).then((comps) => {
      if (!cancelled) setSubflowComponents(comps);
    });
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  const resolveComponent = useMemo(
    () => (subflowComponents.length > 0 ? createComponentResolver(subflowComponents) : undefined),
    [subflowComponents],
  );

  // Memoize scans so they only re-run when workflowJson or resolver changes,
  // not on every parent re-render.
  const roles = useMemo(
    () => collectWorkflowRoles(workflowJson, resolveComponent),
    [workflowJson, resolveComponent],
  );

  // Always include 'en' as a guaranteed fallback so the language field is never
  // hidden and the caller always receives a value the user could see.
  const languages = useMemo(() => {
    const collected = collectWorkflowLanguages(workflowJson, resolveComponent);
    return collected.length > 0 ? collected : ['en'];
  }, [workflowJson, resolveComponent]);

  const defaultLanguage = languages.includes('en') ? 'en' : languages[0];

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [language, setLanguage] = useState<string>(defaultLanguage);

  // Reset selections whenever the dialog opens.
  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setPrevOpen(true);
    setSelectedRoles([]);
    setLanguage(defaultLanguage);
  } else if (!open && prevOpen) {
    setPrevOpen(false);
  }

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
