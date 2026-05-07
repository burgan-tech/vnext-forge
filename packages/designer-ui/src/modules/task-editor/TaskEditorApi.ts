import { failureFromError, success, type ApiResponse } from '@vnext-forge-studio/app-contracts';
import {
  loadComponentFile,
  type ComponentFileDocument,
} from '../../modules/save-component/SaveComponentApi';
import { toVnextError } from '../../lib/error/vNextErrorHelpers';

interface LoadTaskEditorParams {
  filePath: string;
}

export async function loadTaskEditor({
  filePath,
}: LoadTaskEditorParams): Promise<ApiResponse<ComponentFileDocument>> {
  try {
    const result = await loadComponentFile({
      filePath,
      errorMessage: 'Task could not be loaded.',
    });

    if (!result.success) {
      return result;
    }

    return success(result.data);
  } catch (value) {
    return failureFromError(toVnextError(value, 'Task could not be loaded.'));
  }
}
