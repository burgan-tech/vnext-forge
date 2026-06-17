import { useState } from 'react';
import { Button } from '@vnext-forge-studio/designer-ui/ui';
import { Copy, Check } from 'lucide-react';

interface RawJsonViewerProps {
  data: unknown;
}

export function RawJsonViewer({ data }: RawJsonViewerProps) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(data, null, 2);

  function handleCopy() {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        className="absolute right-2 top-2 h-7 w-7"
        aria-label="Copy JSON"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
      <pre className="max-h-[600px] overflow-auto rounded-lg border border-border bg-muted/30 p-4 text-xs leading-relaxed font-mono text-foreground">
        {json}
      </pre>
    </div>
  );
}
