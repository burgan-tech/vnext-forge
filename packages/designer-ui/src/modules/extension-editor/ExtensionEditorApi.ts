import { failureFromError, success, type ApiResponse } from '@vnext-forge/app-contracts';
import {
  loadComponentFile,
  type ComponentFileDocument,
} from '../../modules/save-component/SaveComponentApi';
import { toVnextError } from '../../lib/error/vNextErrorHelpers';
import { extensionEditorDocumentSchema } from './ExtensionEditorSchema';

interface LoadExtensionEditorParams {
  filePath: string;
}

export async function loadExtensionEditor({
  filePath,
}: LoadExtensionEditorParams): Promise<ApiResponse<ComponentFileDocument>> {
  try {
    const result = await loadComponentFile({
      filePath,
      errorMessage: 'Extension could not be loaded.',
      parse: (content) => extensionEditorDocumentSchema.parse(content),
    });

    if (!result.success) {
      return result;
    }

    return success(result.data);
  } catch (value) {
    return failureFromError(toVnextError(value, 'Extension could not be loaded.'));
  }
}
