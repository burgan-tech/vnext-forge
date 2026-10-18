/**
 * Forge's English `uiStrings` dictionary for `<PseudoView uiStrings>`.
 *
 * pseudo-ui ships no UI words of its own: a missing entry renders as its
 * own key (`filePicker.choose`). Text is the `en` side of the renderer
 * repo's `samples/ui-strings.json` (commit 98b219a), verbatim. `{…}`
 * placeholders are filled by the SDK with the numbers it actually applied.
 */
export const FORGE_PSEUDO_UI_STRINGS: Readonly<Record<string, string>> = {
  'filePicker.none': 'No file chosen',
  'filePicker.limit': 'Up to {limit}',
  'filePicker.limitMulti': 'Up to {max} files · {limit} each · {total} in total',
  'filePicker.count': '{count} of {max} files · {total} of {limit}',
  'filePicker.clear': 'Remove',
  'filePicker.remove': 'Remove',
  'filePicker.choose': 'Choose file',
  'forEach.loadMore': 'Show more',
  'filePicker.add': 'Add files',
  'filePicker.replace': 'Replace file',
  'filePicker.busy': 'Reading the file…',
  'filePicker.tooLarge': 'That file is too large: {size}. The limit is {limit}. Please choose a smaller file.',
  'filePicker.wrongType': 'That file type is not accepted ({type}). Accepted: {accept}',
  'filePicker.emptyFile': 'That file is empty (0 bytes) — it may not have copied.',
  'filePicker.tooMany': 'You may attach at most {max} files. Remove one to make room for another.',
  'filePicker.tooLargeTotal':
    'Those files are too large together: {total}. The limit is {limit}. Remove one, or choose a smaller file.',
  'filePicker.failed': 'The file could not be read. The field was left empty; you can try again.',
  'filePicker.unavailable': 'File upload is not available in this client.',
};
