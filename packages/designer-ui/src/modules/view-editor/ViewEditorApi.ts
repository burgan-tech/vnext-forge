import { failureFromError, success, type ApiResponse } from '@vnext-forge/app-contracts';
import {
  loadComponentFile,
  type ComponentFileDocument,
} from '../../modules/save-component/SaveComponentApi';
import { toVnextError } from '../../lib/error/vNextErrorHelpers';

interface LoadViewEditorParams {
  filePath: string;
}

export async function loadViewEditor({
  filePath,
}: LoadViewEditorParams): Promise<ApiResponse<ComponentFileDocument>> {
  try {
    const result = await loadComponentFile({
      filePath,
      errorMessage: 'View could not be loaded.',
    });

    if (!result.success) {
      return result;
    }

    return success(result.data);
  } catch (value) {
    return failureFromError(toVnextError(value, 'View could not be loaded.'));
  }
}
