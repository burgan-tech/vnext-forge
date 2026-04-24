import * as fs from 'node:fs/promises';

import * as vscode from 'vscode';

import type { VnextWorkspaceRoot } from './workspace-detector.js';

/**
 * material-icon-theme + vNext entegrasyonu.
 *
 * Sorun: Kullanici Material Icon Theme kullanirken bizim TUM dosyalari override eden
 * ozel bir File Icon Theme tanimlamak istemiyoruz; ama vNext bilesen klasorleri ile
 * `vnext.config.json` icin Material'in kendi ikon kutuphanesinden secilmis ikonlar
 * gostermek istiyoruz.
 *
 * material-icon-theme YALNIZCA User Settings okur (workspace settings yok sayilir,
 * bkz. material-extensions/vscode-material-icon-theme#493). Bu nedenle:
 *  - `material-icon-theme.folders.associations`
 *  - `material-icon-theme.files.associations`
 * ayarlari User Settings'e yazilir; bu User'in TUM projelerinde ayni isimli klasorler
 * (Workflows / Tasks / ...) icin override yaratir. Bu beklenen ve kabul edilen davranis.
 *
 * Geri alabilmek icin extension koyduklarini ayri bir izleme listesinde (User Settings:
 * `vnextForge.materialAssociations.managed`) tutar; remove komutu yalniz bizim
 * koyduklarimizi siler, kullanicinin elle ekledigini bozmaz.
 */

/** PKief Material Icon Theme; Cursor/VS Code'da `workbench.iconTheme` degeri. */
const MATERIAL_ICON_THEME_ID = 'material-icon-theme';

/** Bazi varyantlar / fork'lar farkli id kullanabilir; association uygulamak icin genisletilebilir. */
const MATERIAL_COMPATIBLE_ICON_THEME_IDS = new Set<string>([
  MATERIAL_ICON_THEME_ID,
  'eq-material-theme-icons',
]);
const FOLDER_ASSOC_KEY = 'material-icon-theme.folders.associations';
const FILE_ASSOC_KEY = 'material-icon-theme.files.associations';
const MANAGED_TRACKING_KEY = 'vnextForge.materialAssociations.managed';

/**
 * Klasor adi bazli sabit eslemeler. material-icon-theme'in dahili `folder-XXX` ikonlarini
 * kullanir (folder- oneki dusurulur). Sabit Workflows/Tasks/... isimleri vnext.config.json'dan
 * `paths.*` cozulerek tamamlanir; bu sabitler sadece varsayilan layout adlari icin onerilen
 * ikon haritasidir.
 */
const FOLDER_ICON_BY_TYPE = {
  workflows: 'pipe',
  tasks: 'job',
  schemas: 'database',
  views: 'views',
  functions: 'functions',
  extensions: 'plugin',
  componentsRoot: 'project',
} as const;

const VNEXT_CONFIG_FILE_ICON = 'settings';

type AssocMap = Record<string, string>;
type ManagedSnapshot = {
  folders: string[];
  files: string[];
};

export interface ResolvedConfig {
  rootPath: string;
  componentsRootName?: string;
  folderNameByType: Partial<Record<keyof typeof FOLDER_ICON_BY_TYPE, string>>;
}

/** Material Icon Theme aktif degilse no-op. */
export async function applyMaterialIconAssociationsIfApplicable(
  configs: readonly ResolvedConfig[],
): Promise<void> {
  if (!isMaterialIconThemeActive()) return;
  await mutateAssociations((current) => mergeAssociations(current, configs));
}

/** Bizim eklediklerimizi User Settings'ten siler; kullanici eklemelerini bozmaz. */
export async function removeMaterialIconAssociations(): Promise<void> {
  await mutateAssociations((current) => {
    const next: AssocMap = { ...current.folders };
    for (const key of current.managed.folders) delete next[key];

    const nextFiles: AssocMap = { ...current.files };
    for (const key of current.managed.files) delete nextFiles[key];

    return {
      folders: next,
      files: nextFiles,
      managed: { folders: [], files: [] },
    };
  });
}

function isMaterialIconThemeActive(): boolean {
  const id = vscode.workspace.getConfiguration('workbench').get<string>('iconTheme') ?? '';
  return MATERIAL_COMPATIBLE_ICON_THEME_IDS.has(id);
}

interface CurrentState {
  folders: AssocMap;
  files: AssocMap;
  managed: ManagedSnapshot;
}

interface NextState {
  folders: AssocMap;
  files: AssocMap;
  managed: ManagedSnapshot;
}

async function mutateAssociations(
  reducer: (state: CurrentState) => NextState,
): Promise<void> {
  const cfgFolders = vscode.workspace.getConfiguration();
  const folders = (cfgFolders.get<AssocMap>(FOLDER_ASSOC_KEY) ?? {}) as AssocMap;
  const files = (cfgFolders.get<AssocMap>(FILE_ASSOC_KEY) ?? {}) as AssocMap;
  const managed = (cfgFolders.get<ManagedSnapshot>(MANAGED_TRACKING_KEY) ?? {
    folders: [],
    files: [],
  }) as ManagedSnapshot;

  const next = reducer({ folders, files, managed });

  // Idempotent: degisim yoksa yazma.
  const folderChanged = JSON.stringify(folders) !== JSON.stringify(next.folders);
  const filesChanged = JSON.stringify(files) !== JSON.stringify(next.files);
  const managedChanged = JSON.stringify(managed) !== JSON.stringify(next.managed);

  const target = vscode.ConfigurationTarget.Global;
  if (folderChanged) await cfgFolders.update(FOLDER_ASSOC_KEY, next.folders, target);
  if (filesChanged) await cfgFolders.update(FILE_ASSOC_KEY, next.files, target);
  if (managedChanged) await cfgFolders.update(MANAGED_TRACKING_KEY, next.managed, target);
}

function mergeAssociations(state: CurrentState, configs: readonly ResolvedConfig[]): NextState {
  const folders: AssocMap = { ...state.folders };
  const files: AssocMap = { ...state.files };
  const managedFolders = new Set(state.managed.folders);
  const managedFiles = new Set(state.managed.files);

  // Acik bir set; baska bir vNext root'unda farkli isim varsa hepsini ekleriz.
  const desiredFolders: AssocMap = {};
  for (const cfg of configs) {
    if (cfg.componentsRootName) {
      desiredFolders[cfg.componentsRootName] = FOLDER_ICON_BY_TYPE.componentsRoot;
    }
    for (const [type, name] of Object.entries(cfg.folderNameByType)) {
      if (!name) continue;
      const icon = FOLDER_ICON_BY_TYPE[type as keyof typeof FOLDER_ICON_BY_TYPE];
      if (icon) desiredFolders[name] = icon;
    }
  }

  // Klasor eslemelerini uygula: kullanicinin elle koydugu farkli bir esleme varsa
  // dokunma; yalniz bizim daha once koyduklarimizi veya hic var olmayanlari yaz.
  for (const [folderName, iconKey] of Object.entries(desiredFolders)) {
    const existing = folders[folderName];
    const isOurs = managedFolders.has(folderName);
    if (existing === undefined || isOurs) {
      folders[folderName] = iconKey;
      managedFolders.add(folderName);
    }
    // existing var ve bizim degil -> kullaniciya saygi, atla.
  }

  // vnext.config.json dosyasi
  const fileKey = 'vnext.config.json';
  const existingFile = files[fileKey];
  const isOursFile = managedFiles.has(fileKey);
  if (existingFile === undefined || isOursFile) {
    files[fileKey] = VNEXT_CONFIG_FILE_ICON;
    managedFiles.add(fileKey);
  }

  return {
    folders,
    files,
    managed: {
      folders: [...managedFolders].sort(),
      files: [...managedFiles].sort(),
    },
  };
}

/**
 * Workspace root'larindaki vnext.config.json'lardan klasor isimlerini cozer.
 * `{domainName}` placeholder'i `domain` ile resolve edilir. Cozulemeyen alanlar atlanir.
 */
export async function resolveConfigsForMaterial(
  roots: readonly VnextWorkspaceRoot[],
): Promise<ResolvedConfig[]> {
  const out: ResolvedConfig[] = [];
  for (const root of roots) {
    try {
      const raw = await fs.readFile(root.configPath, 'utf8');
      const cfg = JSON.parse(raw) as {
        domain?: unknown;
        paths?: Partial<Record<string, unknown>>;
      };
      const domain = typeof cfg.domain === 'string' ? cfg.domain : '';
      const subst = (v: unknown): string | undefined => {
        if (typeof v !== 'string' || !v) return undefined;
        const r = v.replace('{domainName}', domain);
        return r.includes('{') ? undefined : r;
      };

      const paths = cfg.paths ?? {};
      const componentsRootRel = subst(paths.componentsRoot);
      const componentsRootName = folderLabelFromConfigPath(componentsRootRel);

      out.push({
        rootPath: root.folderPath,
        componentsRootName,
        folderNameByType: {
          workflows: folderLabelFromConfigPath(subst(paths.workflows)),
          tasks: folderLabelFromConfigPath(subst(paths.tasks)),
          schemas: folderLabelFromConfigPath(subst(paths.schemas)),
          views: folderLabelFromConfigPath(subst(paths.views)),
          functions: folderLabelFromConfigPath(subst(paths.functions)),
          extensions: folderLabelFromConfigPath(subst(paths.extensions)),
        },
      });
    } catch {
      // okunamayan config sessizce atlanir
    }
  }
  return out;
}

/**
 * material-icon-theme `folders.associations` anahtarlari Explorer'daki klasor *adi* ile
 * eslesir (son segment). `core/Workflows` gibi path'ler Material'i bozabilir veya hic
 * eslesmez; basename alinir.
 */
function folderLabelFromConfigPath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\\/g, '/').replace(/\/+$/, '');
  const base = normalized.split('/').filter(Boolean).pop();
  return base && base.length > 0 ? base : undefined;
}
