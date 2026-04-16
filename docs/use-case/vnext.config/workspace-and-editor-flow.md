# vnext.config.json — kullanım senaryoları ve UI akışı

Bu belge, `vnext.config.json` ile ilgili web uygulamasında yapılan davranışların özetidir. Hedef: yapılandırmanın doğrulanması, dosya yönlendirmesi, kod editörü kaydı, status bar ve bileşen şablon (layout) teklifinin tutarlı çalışması.

## 1. Dosya rotası (`FileRouter`)

**Sorun:** `paths.componentsRoot` (ör. `openbanking`) diskteki kök klasörle (ör. `core`) uyuşmadığında, göreli yol `core/Views/...` kalıyordu; yalnızca `Views/` ile başlayan yollar eşleştiği için `resolveFileRoute` `unknown` dönüyor ve özel editör yerine düz kod editörü açılıyordu.

**Çözüm:** `extractResourceRest` / `sliceAfterEmbeddedSegment` ile, kök eşleşmese bile proje göreli yol içinde `Views`, `Tasks`, `Workflows` vb. segment aranıyor. `parseGroupName` için `.json` uzantısı büyük/küçük harf duyarsız; `navigateTo` içinde `group` / `name` için `encodeURIComponent`.

**Dosya:** `apps/web/src/modules/project-workspace/FileRouter.ts`

## 2. Yapılandırma sihirbazı doğrulaması (`CreateVnextConfigDialog`)

**Amaç:** Zorunlu alanlar boşken “Oluştur ve kaydet” ile geçersiz `vnext.config.json` yazılmasın; hatalı alanlar diyalogda görülsün.

**Zorunlu (trim sonrası dolu):**

- Kök: `version`, `description`, `domain`, `runtimeVersion`, `schemaVersion`
- `paths` altındaki tüm alanlar (`componentsRoot`, `tasks`, `views`, …)
- `exports.metadata`: `description`, `maintainer`, `license`; `keywords` en az bir öğe ve boş olmayan kelimeler
- `referenceResolution.allowedHosts`: en az bir hostname (satır listesi sıkıştırıldıktan sonra)

Diğer bölümler (export key listeleri, `dependencies`, bool bayraklar) isteğe bağlı kalabilir.

**Dosyalar:**

- `apps/web/src/modules/project-workspace/vnextWorkspaceConfigWizardValidation.ts` — normalize + Zod şeması
- `apps/web/src/modules/project-workspace/components/CreateVnextConfigDialog.tsx` — canlı doğrulama, uyarı kutusu, alan bazlı hata metni, geçersizken submit devre dışı

## 3. Status bar — yapılandırma uyarıları

- Sunucu `invalid` döndüğünde: `workspace-config-invalid` ile kısa uyarı metni; tıklanınca yeniden kontrol (`recheck`).
- Yapılandırma eksik / henüz oluşturulmamış: “bulunamadı veya henüz oluşturulmadı” benzeri pill.

**Dosya:** `apps/web/src/app/layouts/ui/StatusBar.tsx` (ilgili dallar `useWorkspaceDiagnosticsStore` + `useVnextWorkspaceUiStore` ile)

## 4. Kod editöründe kayıt (`CodeEditorPage`)

**Sorunlar:**

- `writeFile` `ApiResponse` döndürüyor; başarısızlıkta exception yok — yine de `markTabClean` çağrılıyordu.
- Kaynak bazen yalnızca store’daki `activeTab.content`; Monaco modeli bir tick önde olabiliyordu.

**Çözüm:** Kayıtta önce `editorRef.current?.getValue()`, `isFailure` ile API kontrolü, başarıda store senkronu; Monaco `KeyMod`/`KeyCode` için güvenli erişim.

**Dosya:** `apps/web/src/pages/code-editor/CodeEditorPage.tsx`  
**İlgili:** `apps/web/src/modules/code-editor/CodeEditorApi.ts` — yol POSIX normalize

## 5. `vnext.config.json` kaydından sonra workspace senkronu

Kod editöründe **`vnext.config.json`** başarıyla kaydedildiğinde (dosya yolu soneki kontrolü), proje için:

- `syncVnextWorkspaceFromDisk` çağrılır: `getProjectConfigStatus` → `applyProjectConfigStatus`, ardından geçerli config ise `getVnextComponentLayoutStatus` → store’daki `componentLayoutStatus` güncellenir.

Böylece status bar ve şablon pill’leri diskteki güncel yapılandırmaya göre yenilenir.

**Dosyalar:**

- `apps/web/src/modules/project-workspace/syncVnextWorkspaceFromDisk.ts`
- `apps/web/src/modules/project-workspace/hooks/useVnextConfigStatusRecheck.ts` — aynı senkronu “yeniden kontrol” için kullanır
- `apps/web/src/modules/project-workspace/applyProjectConfigStatus.ts` — config geçersiz/eksikken `componentLayoutStatus` temizlenir

## 6. Bileşen şablonu (layout) — status bar teklifi

**Önceki davranış:** Layout API sonrası `applyComponentLayoutSeedOffer` otomatik olarak şablon diyalogunu açıyordu.

**Yeni davranış:**

- Layout sonucu `useVnextWorkspaceUiStore.componentLayoutStatus` içinde tutulur; otomatik diyalog kaldırıldı (`applyComponentLayoutSeedOffer` kaldırıldı).
- **Geçerli vnext** + şablon ihtiyacı (`projectContainsOnlyConfigFile` veya `!layoutComplete`) + kullanıcı henüz “Hayır” dememiş → status bar’da bilgi pill’i: “Şablon klasörleri — oluşturmak ister misiniz?” (Evet / Hayır).
- **Hayır** denmiş ve hâlâ eksik → “Şablonu tamamlayın veya oluşturun” pill’i; tıklanınca reddi sıfırlayıp diyalog açılır.
- Şablon onayından sonra `VnextTemplateSeedDialog` içinde seed + `getVnextComponentLayoutStatus` ile store yenilenir.

**Dosyalar:**

- `apps/web/src/app/store/useVnextWorkspaceUiStore.ts` — `componentLayoutStatus`, `clearTemplatePromptDecline`, …
- `apps/web/src/app/layouts/ui/StatusBar.tsx` — şablon pill’leri; şablon beklerken “Validated” rozeti gizlenir
- `apps/web/src/modules/project-workspace/hooks/useProjectWorkspacePage.ts` — yüklemede yalnızca layout store güncellemesi
- `apps/web/src/modules/project-workspace/components/VnextTemplateSeedDialog.tsx` — seed sonrası layout yenileme

## 7. Sunucu tarafı (bağlam)

- `vnext.config.json` okuma / yazma ve layout durumu: `apps/server` içindeki proje ve workspace slice’ları (ör. `getVnextComponentLayoutStatus`, `writeProjectConfig`, `readConfigStatus`).
- Web’deki sıkı sihirbaz doğrulaması, BFF’deki minimal şema ile tam örtüşmeyebilir; üretim öncesi sunucu tarafında da sıkılaştırma ayrı değerlendirilebilir.

---

*Son güncelleme: bu dosya, vnext.config ile ilgili web tarafı kullanım senaryolarını belgelemek için oluşturulmuştur.*
