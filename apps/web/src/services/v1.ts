import { apiClient, asApiV1Client } from '@shared/api';

export const v1 = asApiV1Client(apiClient);
