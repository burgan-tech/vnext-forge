# vNext v0.0.100 / vnext-schema 0.0.56 — Forge uyum analizi ve planı

Kaynaklar: release blog (`vnext-docs/blog/2026-10-15-v0-0-100.md`), milestone 60 (12 PR: #1075–#1095),
vnext-schema PR #157 (= #151 history, #152 x-storage, #154 runtime alignment, #156 role vocabularies),
runtime `origin/master` (f06961ec). `v0.0.56` npm'de yayında.

## 1. Değişiklik özeti ve Forge'daki durum

| Konu | v0.0.100 / 0.0.56 | Forge bugün | Boşluk |
|---|---|---|---|
| Paket pini | 0.0.56 | `^0.0.55` (4 package.json) | Bump gerekli — `^` 0.0.x'te genişlemez |
| Role vocabularies | `schema-definition` artık unpkg `$id` ile `record/input/component-vocab`'e `$ref` veriyor; `addVocabularies(ajv)` zorunlu | `validate.service.ts` vocab yüklemiyor; Monaco `JsonSchemaSetup.ts` da | **Bump sonrası schema validasyonu derlenmez** (kritik) |
| `attributes.type` | opsiyonel enum `"" \| master \| transition \| component \| function`; legacy değer paket tarafından **reddedilir** | Serbest metin, öneriler `master/schema/view/headers`; şablonlar `type:'schema'` ve `'workflow'` yazıyor | Yeni oluşturulan schema'lar anında invalid olur |
| Rol bazlı annotation kısıtı | `propertyNames` ile rol dışı `x-*` reddi (matris aşağıda) | Kartlar rolden bağımsız; tek kural `x-indexed` → master | Rol-farkındalıklı kart registry + diagnostik |
| `x-filterOperators` | yeni enum (`neq,gte,lte,contains,startsWith,…,isNull,includes`); runtime eski/case varyantları publish'te reddeder | Kart zaten yeni yazımları kullanıyor, legacy alias normalize ediyor, **bilinmeyenleri koruyor** | Bilinmeyen/legacy değerler hata olarak işaretlenmeli + quick-fix |
| `x-encryption` | `source: runtime\|client`; client: `key, algorithm, into, encoding, nonce, envelope` | Sadece runtime şekli (`type`, `params`, `roles`…) | Kartın iki modlu olması |
| `x-lov` | `source` **veya** `items` (`$instance.`/`$form.`), `imageField`, `filter[].value` dizi, `param:op` | `source` zorunlu varsayımı | Kart güncellemesi |
| `x-errorMessages` / `condition.operator` | yeni anahtarlar / `greaterThanOrEquals, lessThanOrEquals, startsWith, endsWith` | Eski listeler | Liste güncellemesi |
| **Yeni:** `x-storage` | `{binding}`; sadece master, `type:object`, tek dizi seviyesi, `content` deklare edilemez | Yok | Yeni kart + yerleşim kuralları |
| **Yeni:** `x-computed` | `evaluatedBy`, `cases[{when, join\|arithmetic}]`, `fallback`, `whenAbsent`; runtime kuralları (root/items değil, `required` değil, `x-indexed/x-filterOperators/x-sortable/x-storage/x-roles/x-masking/at-rest x-encryption` ile birlikte değil) | Yok | Yeni kart + eligibility |
| **Yeni:** `x-order`, `x-helpText`, `x-placeholder`, `x-uiHint`, `x-uiNote`, `x-group` | tüm rollerde | Yok (RawJsonFallback'e düşer) | Basit kartlar |
| `attributes.history` | workflow kökünde `none\|full` (default full); `none` ise çok sayıda yapısal kural | Yok | Workflow metadata alanı + canlı kural denetimi |
| `file` sistem fonksiyonu | upload: transition/start JSON body'sinde base64 (`{name,mimeType,size,content}`); download: `GET\|HEAD …/instances/{id}/functions/file?file=<guid>` (binary) | QuickRun yalnız JSON/string; proxy `response.text()`; dosya widget'ı yok | Upload widget + binary-safe download |
| `history:none` instance davranışı | `/transitions`, `/functions/tasks` boş; çalışırken data `null` | Monitor `getHistory` başarısızlığını fatal sayıyor, history-only graph boş | Boş durum / banner |
| Diğer | #1085 SubFlow transition proxy (409/400 senkron), #1095 Kafka topic `vnext.{domain}.{env}.*`, #1079 data history | — | Mesaj/hint iyileştirmeleri |

### Rol matrisi (0.0.56 paketi)

| Annotation | master | transition / function | component | type yok |
|---|---|---|---|---|
| Temel + view hint'leri (`x-labels, x-enum, x-errorMessages, x-conditional, x-lookup, x-lov, x-validation, x-displayFormat, x-order, x-helpText, x-placeholder, x-uiHint, x-uiNote, x-group`) | ✓ | ✓ | ✓ | ✓ |
| `x-roles, x-masking, x-encryption(runtime), x-storage, x-filterOperators, x-sortable, x-computed, x-context-target` | ✓ | ✗ | ✗ | ✓ |
| `x-indexed` | ✓ | ✗ | ✗ | ✗ |
| `x-encryption(client)` | ✓* | ✓ | ✗ | ✓ |
| `x-context-source` | ✗ | ✓ | ✗ | ✓ |
| `x-binding` | ✗ | ✗ | ✓ | ✓ |

\* runtime işlemez. Ayrıca runtime, `x-roles/x-masking/x-encryption/x-storage/x-computed`'u **yalnızca workflow'un `attributes.schema`'sının gösterdiği master** üzerinde uygular.

## 2. Plan (fazlar)

Her faz ayrı commit/PR olabilir; F0 diğer her şeyin ön koşulu.

### F0 — Altyapı: schema 0.0.56 bump (ön koşul, küçük ama kritik)
1. `@burgan-tech/vnext-schema` → `^0.0.56` (services-core, designer-ui, extension, server); `apps/desktop` `*` kontrol.
2. `validate.service.ts`: hem bundled hem per-version cache yolunda `addVocabularies(ajv)` çağır; eski sürümlerde export yoksa sessiz geç (feature detect). Tarball cache'inde `vocabularies/*.json` dosyalarının da çıkarıldığını doğrula (`schema-cache.service.ts`).
3. Monaco `JsonSchemaSetup.ts`: vocab şemalarını `$id` URI'leriyle `schemas[]`'e ekle (fileMatch'siz), aksi halde `$ref`'ler çözülmez.
4. `SCHEMA_0_0_56` feature sabiti (`SchemaFeatureHint`/`useSchemaFeature`); `vnext-workspace-defaults.ts` sabitleri (0.0.33 bayat) → 0.0.100 / 0.0.56.
5. Testler: services-core validate fixture'ları (role'lü/role'süz schema, legacy type reddi).

### F1 — Schema rolleri (type: master / transition / component / function)
1. `SchemaTypeField` → serbest metin yerine select: `(none) / master / transition / component / function`; legacy değer varsa uyarı + "role'e dönüştür" aksiyonu. `schemaTypeVersionHint.ts` ≥0.0.56 dalı.
2. **Şablon hatası**: `vnextComponentTemplates.ts:77` (`'schema'`) ve `createNewComponentTemplates.ts:27` (`'workflow'`) → bağlama göre rol: workflow master schema'sı → `master`, transition schema → `transition`, function inputSchema → `function`, view dataSchema → `component`, genel → boş.
3. **Rol çıkarımı** (workspace taraması): bir schema'nın nereden referanslandığına bakarak önerilen rol (docs `components/schema.md` tablosu). Workflow/function referansları güçlü kanıttır; view `dataSchema` referansı zayıftır (view'lar master/transition şemalarını da render eder) ve yalnızca başka referans yoksa `component` önerir. Çakışan güçlü roller veya hiç referans yok → type kaldırılır. Diagnostic kodları `component.schemaLegacyType` (error) / `component.schemaRoleMismatch` (warning); extension'da tek dosya quick-fix + "Fix Legacy Schema Types" komutu (onaylı toplu düzeltme), designer'da `vnext/schemas/inferRole` ile "Use <role>" önerisi. vnext-example üzerinde: 40 legacy schema'nın 36'sı için rol önerildi.
4. **Rol farkındalıklı kart registry**: `vnextCardRegistry` entry'lerine `roles` alanı; VNext sekmesi rol dışı kartları gizler/devre dışı bırakır; mevcut rol dışı anahtar varsa kırmızı banner + "kaldır" aksiyonu. `indexEligibility` mevcut master kuralını bu modele taşı.
5. Canvas tarafı: transition/function schema'sı master rolündeyse (veya tersi) panelde uyarı (ör. `WorkflowSchemaSection`).

### F2 — Annotation güncellemeleri ve yeni kartlar
1. Güncellenecek kartlar:
   - `XFilterOperatorsCard`: bilinmeyen/legacy değerleri **hata** olarak göster, "runtime yazımına çevir" quick-fix (runtime publish'te reddediyor).
   - `XEncryptionCard`: `source` seçici; client modu (`key, algorithm, into, encoding, nonce, envelope`), runtime modunda bunları gizle; input rolünde sadece client.
   - `XLovCard`: `source` ⟷ `items` (ifade `$instance.` / `$form.`), `imageField`, filter value çoklu değer, `param:op`.
   - `XErrorMessagesCard`: yeni constraint anahtarları; `XConditionalCard`: 4 yeni operatör.
2. Yeni kartlar:
   - `XStorageCard` (master, property): binding seçimi (serbest + öneri `vnext-blob-local`); enable'da node'u `type: object` + `name/mimeType/size` iskeletine çevirme önerisi; `storageEligibility.ts` (root/`$defs`/combinator/iç içe dizi/iç içe file node yasak, `content` deklare edilemez).
   - `XComputedCard` (master, property): `evaluatedBy`, case listesi (`when` → mevcut condition editörü yeniden kullanılır; `join` alanları + ayraç; `arithmetic` op + ≥2 alan), `fallback`, `whenAbsent`; `computedEligibility.ts` runtime kurallarını aynalar (`required` dışı, yasak birliktelikler, sibling alan seçici, zincirleme yok).
   - `XOrderCard` + view-hints kartları (`x-helpText`, `x-placeholder` localized; `x-uiHint`, `x-uiNote`, `x-group` string) — tek generic "View hints" kartı olarak gruplanabilir.
3. `RECOGNIZED_VNEXT_KEYWORDS` güncelle; `x-persistance` / `x-encrypt` görülürse "her rolde reddedilir" uyarısı.
4. Property ağacında rozetler: 📎 storage, ƒ computed (IndexBadge benzeri).
5. QuickRun schema-form: `x-order` sıralaması ve `description` yoksa `x-helpText` gösterimi. Computed alanlar QuickRun formlarında görünmez (formlar transition/start şemalarından üretilir; paket bu rollerde `x-computed`'ı reddeder), bu yüzden salt-okur render gerekmedi.

**F2 durumu (2026-10-15):** tamamlandı. Ek bulgular: `x-errorMessages` kartı vocabulary'nin reddettiği `type` anahtarını öneriyordu (kaldırıldı, mevcutlar işaretleniyor); filter listesi array değerleri sessizce siliyordu (artık liste literal'i destekleniyor); `x-conditional` operatörleri zaten günceldi; `x-persistance` / `x-encrypt` rolden bağımsız işaretleniyor.

### F3 — `history: none`
1. `vnext-types` workflow attributes'a `history?: 'none' | 'full'`; `WorkflowMetadataPanel`'de select (≥0.0.56 gate).
2. Canlı kural denetimi (`historyNoneRules.ts`): timeout/cancel/exit/updateData null, sharedTransitions boş, ≥1 Finish state, Wizard / subType 4-5-6 yok, `interaction.longPoll` yok, tüm transition'lar `triggerType: 1`, `subFlow.overrides.timeout` null, Finish olmayan her state'te ≥1 transition, **her state'ten Finish'e erişilebilirlik** (runtime-only kural — graph üzerinde hesaplanır), SubFlow (`S`) child'ı da `none` olmalı (workspace referansı çözümlenerek). Canvas'ta ilgili node/edge rozetleri + Problems.
3. UI kısıtları: `none` iken shared transition ekleme, timeout/cancel/exit editörleri, manual trigger seçimi devre dışı + açıklama.
4. Monitor / QuickRun: boş `/transitions` ve `/functions/tasks` normal kabul; `getHistory` hatası level'ı düşürmesin; workflow tanımında `history: none` ise "History disabled for this workflow — transitions and task journal are not recorded; data is written at finish" banner'ı; çalışırken `data: null` için boş durum; retry 409 `Instance:100045` ve incident `Instance:100046` mesaj eşlemesi.

**F3 durumu (2026-10-15):** tamamlandı. Kurallar `vnext-types/utils/history-mode.ts`'te (paket AJV'si ile çapraz test edildi); SubFlow child kontrolü metadata panelinde asenkron uyarı; Monitor'da transition listesi hatası artık level'ı düşürmüyor (`historyError`); QuickRun ve Monitor'a `history: none` boş durumları; `Instance:100044–100050` için açıklamalar `RuntimeErrorBanner`'da. Canvas bağlam menüsündeki tetikleyici/state tipi seçenekleri kısıtlanmadı — lint bulgusu olarak işaretleniyor.

### F4 — QuickRunner'da `x-storage` / `file` fonksiyonu
Upload için multipart **gerekmiyor** (base64 JSON body), download için binary-safe proxy gerekiyor.
1. **Dosya alanı tespiti**: transition/start schema'sında annotation yok; workflow'un master schema'sındaki `x-storage` yolları çözülüp transition payload yollarıyla eşlenir. Ek olarak `{name,mimeType,size,content}` şekline uyan nesneler heuristik olarak da dosya alanı sayılır.
2. **`FileField` widget** (`schema-form/fieldRegistry.registerFieldExtension`): dosya seç / sürükle-bırak → base64; boyut uyarısı (~7.5 MiB, 10 MiB Kestrel → 413); mevcut handle varsa "keep (echo `{file}`) / replace / clear" seçimi; start'ta echo yasağı (400) önlenir.
3. **pseudo-ui**: view'larda dosya bileşeni pseudo-ui 0.4.0'da yok → kısa vadede schema-form fallback; uzun vadede pseudo-ui'a FileUpload bileşeni talebi (ayrı repo).
4. **Handle gösterimi**: instance data / Data tab / History diff'te handle nesneleri (`component, file, name, mimeType, size, eTag, owner`) chip olarak: isim, boyut, mime + Preview / Download.
5. **Binary download**: `NetworkAdapter`'a `arrayBuffer()`; yeni method `quickrun/downloadFile` (registry + `METHOD_HTTP_METADATA` + server route + fixture, `rpc-method-policy`) → `owner.domain/flow/instance` + `file` ile `GET …/functions/file`; sonuç base64 + headers. Extension: `showSaveDialog` ile kaydet veya geçici dosyaya yazıp VS Code'da aç; web: Blob indirme. Görsel/PDF için inline önizleme (CSP sandbox başlığına saygı).
6. Hata eşleme: `Instance:100047–100050`, 403 (queryRoles), 404 (x-roles gizli).
7. Function Run ekranı: `file` sistem fonksiyonunu listede göster, `file` query param formu + binary yanıt panosu.

**F4 durumu (2026-10-16):** 1–6 tamamlandı. Dosya alanları master şemanın `x-storage` yollarından (ve `name`+`content` şeklinden) bulunuyor; transition/start formlarında FileUploadField (base64, ~7.5 MiB sınırı, keep/replace/clear). İndirme: network adapter'larına `arrayBuffer`, proxy'ye dahili `binary` modu, `quickrun/downloadFile` (handle'daki `owner` instance'ı üzerinden `functions/file`). QuickRun ve Monitor Data sekmelerinde dosya listesi + Open / Save as; extension'da `host:open-bytes` (geçici kopya + `vscode.open`) ve `host:save-bytes` (kaydet diyaloğu), web'de Blob (aktif içerik türleri sekmede açılmaz, indirilir). QuickRun ve Monitor webview'larına `postMessageToHost` kaydı eklendi. **Yapılmadı:** madde 7 (Function Run'da `file` sistem fonksiyonu formu); pseudo-ui view'larında dosya yükleme (karar 5 gereği) — TransitionDialog'da açıklama notu var.

### F5 — Küçük iyileştirmeler
- `DaprPubSubTask.topic` için Kafka prefix ipucu (`vnext.{domain}.{env}.`), #1095.
- SubFlow transition proxy (#1085): QuickRun'da leaf'ten dönen 400/403/409 ve `InstanceBusy` mesajlarının düzgün gösterilmesi.
- `file` adlı custom function oluşturulursa "reserved system function" uyarısı.
- Docs/usage-guide güncellemesi.

## 3. Kararlar (2026-10-15)
1. **Legacy `attributes.type` migrasyonu** → diagnostik + kullanıcı onaylı quick-fix (tekli ve toplu). Rol, referans kullanımından önerilir; onaysız dosya yazımı yok. (F1.3)
2. **Paket vs runtime farkı** → Forge paketi takip eder: `x-computed` transition/function/component şemalarında hata. (F1.4, F2.2)
3. **Client-side x-computed önizlemesi** → ilk sürümde kapsam dışı. QuickRun formunda computed alanlar salt-okur + "computed" rozeti; değer instance datasından gelir. (F2.5 daraltıldı)
4. **Download UX (extension)** → ikisi birden: "Open" (geçici dosya, VS Code'da önizleme) + "Save as…" (kaydet diyaloğu). Web: Blob indirme. (F4.5)
5. **pseudo-ui FileUpload** → pseudo-ui desteği beklenir. View ile render edilen transition/start formlarında dosya yükleme yapılmaz (açıklayıcı uyarı gösterilir); dosya widget'ı yalnızca view'ı olmayan, schema-form ile render edilen formlarda çalışır. pseudo-ui'a schema-form fallback'i yazılmaz. (F4.3)
6. **Sıralama** → F0 → F1 → F2; F3 ve F4 bağımsız paralel yürüyebilir.
