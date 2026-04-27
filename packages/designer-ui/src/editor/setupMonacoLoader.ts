import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

let initialized = false;

/**
 * Wire `@monaco-editor/react` to the bundled `monaco-editor` module instead of
 * the default jsDelivr CDN, and register per-language web workers via Vite's
 * `?worker` import. Required under restrictive CSPs (VS Code webview) where
 * the CDN load and CDN-backed `importScripts` calls are blocked, and also
 * needed for the SPA so character measurements happen against assets that
 * are guaranteed to be loaded with the bundle.
 *
 * Idempotent — safe to call from every shell entry. Must run BEFORE the first
 * `<MonacoEditor>` mounts.
 */
export function setupMonacoLoader(): void {
  if (initialized) return;
  initialized = true;

  globalThis.MonacoEnvironment = {
    getWorker(_workerId: string, label: string): Worker {
      switch (label) {
        case 'json':
          return new JsonWorker();
        case 'css':
        case 'scss':
        case 'less':
          return new CssWorker();
        case 'html':
        case 'handlebars':
        case 'razor':
          return new HtmlWorker();
        case 'typescript':
        case 'javascript':
          return new TsWorker();
        default:
          return new EditorWorker();
      }
    },
  };

  loader.config({ monaco });
}
