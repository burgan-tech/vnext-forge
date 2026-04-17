import { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/Card';
import { JsonCodeField } from '../../../ui/JsonCodeField';
import { Button } from '../../../ui/Button';
import { Alert, AlertDescription, AlertTitle } from '../../../ui/Alert';
import { usePayloadValidator } from '../usePayloadValidator';

interface ValidatePayloadCardProps {
  schema: Record<string, unknown>;
}

export function ValidatePayloadCard({ schema }: ValidatePayloadCardProps) {
  const [payloadText, setPayloadText] = useState('{}');
  const { state, validate, reset } = usePayloadValidator(schema);

  function handleValidate() {
    validate(payloadText);
  }

  function handlePayloadChange(value: string) {
    setPayloadText(value);
    if (state.status !== 'idle') {
      reset();
    }
  }

  return (
    <Card variant="default" className="gap-3">
      <CardHeader className="border-border border-b">
        <CardTitle className="text-base">Validate Payload</CardTitle>
        <CardDescription className="text-xs">
          Test a sample JSON payload against the defined schema.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-4 sm:px-6">
        <JsonCodeField value={payloadText} onChange={handlePayloadChange} height={200} />
        <Button variant="secondary" size="sm" onClick={handleValidate}>
          Validate
        </Button>

        {state.status === 'valid' && (
          <Alert variant="success">
            <CheckCircle />
            <AlertTitle>Valid</AlertTitle>
            <AlertDescription>Payload is valid against the schema.</AlertDescription>
          </Alert>
        )}

        {state.status === 'json-error' && (
          <Alert variant="destructive">
            <XCircle />
            <AlertTitle>Invalid JSON</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}

        {state.status === 'schema-error' && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Schema Error</AlertTitle>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        )}

        {state.status === 'invalid' && (
          <Alert variant="destructive">
            <XCircle />
            <AlertTitle>
              {state.errors.length === 1
                ? '1 validation error'
                : `${state.errors.length} validation errors`}
            </AlertTitle>
            <AlertDescription>
              <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto">
                {state.errors.map((err, i) => (
                  <li key={i} className="font-mono text-xs">
                    <span className="text-white/70">[{err.path}]</span>{' '}
                    <span>{err.message}</span>
                    <span className="text-white/50 ml-1">({err.keyword})</span>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
