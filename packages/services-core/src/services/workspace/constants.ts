import { DEFAULT_SOLUTION_FILE_NAME } from '@vnext-forge-studio/vnext-types'

/** Default solution file name. Domain-suffixed siblings are `vnext.<domain>.config.json`. */
export const CONFIG_FILE = DEFAULT_SOLUTION_FILE_NAME

export const COMPONENT_DIRS = [
  'Workflows',
  'Schemas',
  'Tasks',
  'Views',
  'Functions',
  'Extensions',
] as const
