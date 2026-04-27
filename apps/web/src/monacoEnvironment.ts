/// <reference types="vite/client" />
/**
 * Monaco ESM workers (Vite `?worker`). Must load before any `@monaco-editor/react` import
 * so `getWorker` runs when Monaco loads language services.
 * @see https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-esm.md
 */
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

const g = globalThis as typeof globalThis & {
  MonacoEnvironment?: { getWorker: (id: string, label: string) => Worker };
};

g.MonacoEnvironment = {
  getWorker(_id, label) {
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
        // csharp, plaintext, and other built-ins use the default editor worker
        return new EditorWorker();
    }
  },
};
