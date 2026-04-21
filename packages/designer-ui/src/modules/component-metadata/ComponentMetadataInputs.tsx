import * as React from 'react';

import { cn } from '../../lib/utils/cn';
import { Input, type InputProps } from '../../ui/Input';

/** vNext metadata alanlarında (key, version, domain, flow) ortak Input yüksekliği ve font. */
export const METADATA_INPUT_CLASS = 'w-full';
export const METADATA_INPUT_TEXT_CLASS = 'font-mono text-xs';

export type ComponentMetadataTextInputProps = InputProps;

export const MetadataEditableTextInput = React.forwardRef<
  HTMLInputElement,
  ComponentMetadataTextInputProps
>(function MetadataEditableTextInput({ className, inputClassName, ...props }, ref) {
  return (
    <Input
      ref={ref}
      type="text"
      {...props}
      className={cn(METADATA_INPUT_CLASS, className)}
      inputClassName={cn(METADATA_INPUT_TEXT_CLASS, inputClassName)}
    />
  );
});

/** Projeyle gelen sabit domain/flow — Extension ile aynı: muted + readOnly. */
export const MetadataLockedTextInput = React.forwardRef<
  HTMLInputElement,
  ComponentMetadataTextInputProps
>(function MetadataLockedTextInput({ className, inputClassName, ...props }, ref) {
  return (
    <Input
      ref={ref}
      type="text"
      {...props}
      variant="muted"
      readOnly
      className={cn(METADATA_INPUT_CLASS, className)}
      inputClassName={cn(METADATA_INPUT_TEXT_CLASS, inputClassName)}
    />
  );
});
