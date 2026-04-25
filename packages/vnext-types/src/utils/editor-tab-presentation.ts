/**
 * Ortak sekme başlığı + ikon anahtarı: web SPA (`EditorTabBar`),
 * designer-ui (`EditorTabLabel`) ve VS Code extension host (`WebviewPanel`)
 * aynı kuralları kullanır.
 */

/** Dosya rozeti / `VnextComponentType` ile hizalı tek discriminant. */
export type VnextComponentTabKind =
  | 'workflow'
  | 'task'
  | 'schema'
  | 'view'
  | 'function'
  | 'extension'
  | 'config';

/** Web rotasında workflow için kullanılan segment (`/flow/...`). */
export type SpaComponentEditorTabRouteKind =
  | 'flow'
  | 'task'
  | 'schema'
  | 'view'
  | 'function'
  | 'extension';

export function componentTabKindFromSpaRoute(kind: SpaComponentEditorTabRouteKind): VnextComponentTabKind {
  return kind === 'flow' ? 'workflow' : kind;
}

/** Extension `file-router` / `DesignerOpenEditorMessage.kind` zaten `workflow` kullanır. */
export function componentTabKindFromExtensionRoute(kind: VnextComponentTabKind): VnextComponentTabKind {
  return kind;
}

/**
 * İsimde `-` varsa tireye göre bölünür; her parçanın ilk harfi büyük, kalanı küçük harf olur;
 * parçalar arasında tire yok, boşluk ile birleştirilir.
 * Örn. `extension-user-session` → `Extension User Session`. Tire yoksa metin olduğu gibi kalır.
 */
export function formatHyphenatedTabTitle(text: string): string {
  if (!text.includes('-')) {
    return text;
  }
  return text
    .split('-')
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');
}

/**
 * vNext component editör sekmesinde gösterilecek başlık (`.json` yok).
 * `componentBaseName` tercih edilir; yoksa `storedTitleWithJson` kırpılır.
 */
export function getVnextComponentEditorTabDisplayTitle(
  componentBaseName: string,
  options?: { storedTitleWithJson?: string },
): string {
  const n = componentBaseName?.trim();
  let raw: string;
  if (n) {
    raw = n;
  } else {
    const stored = options?.storedTitleWithJson?.trim();
    if (stored?.toLowerCase().endsWith('.json')) {
      raw = stored.slice(0, -'.json'.length);
    } else {
      raw = stored ?? '';
    }
  }
  if (raw.toLowerCase() === 'vnext.config.json' || raw.toLowerCase() === 'vnext.config') {
    return 'vNext Config';
  }
  return formatHyphenatedTabTitle(raw);
}

/** `media/component-tab-icons/` altındaki birleşik SVG dosya adı. */
export function getVnextComponentTabIconFileName(kind: VnextComponentTabKind): string {
  return `${kind}.svg`;
}
