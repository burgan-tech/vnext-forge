# monitoring-ui — Project Context

Çalışma dizini: `/Users/UST951/Burgan/monitoring-ui/vnext-forge`
Uygulama: `apps/monitoring/` — `@vnext-forge-studio/monitoring`
Dev server: `corepack pnpm --filter @vnext-forge-studio/monitoring dev` → port **3100**

---

## Dizin Yapısı Notu

`monitoring-ui/` (root) iki farklı amaca hizmet eder:

- **`monitoring-ui/` (root)**: Geliştirme dönemine ait docs dosyaları, yapay zeka yönlendirmeleri (CLAUDE.md, `docs/` vb.) ve genel proje notları burada yaşar. Bu dizinin kendisi bir git reposu değildir.
- **`monitoring-ui/vnext-forge/`**: Asıl git reposunu barındıran dizindir. Tüm uygulama kodu burada geliştirilir.

Uygulama son aşamalara yaklaştığında root'taki docs ve yönlendirme dosyaları `vnext-forge/` içine taşınacaktır. Şu an bu ayrım bilinçli olarak korunmaktadır.

---

## Mimari Kararlar

### Klasör Yapısı: Vertical Slice

`app / modules / pages / shared` katman modeli benimsenmiştir.

- `modules/` altında her monitoring özelliği kendi dilimi (slice) olarak yaşar
- Dilimler birbirini import etmez; paylaşılan şeyler `shared/` altına taşınır
- `pages/` sadece route entry ve composition içerir, iş mantığı `modules/` içindedir
- `shared/` dar tutulur; genel altyapı (api, config, lib) burada yaşar

### designer-ui Entegrasyonu: Seçici Import

`DesignerUiProvider` **kullanılmaz** — forge-özgü bağımlılıklar içeriyor (LSP capabilities, Monaco loader, forge ApiTransport). Bunun yerine:

- UI primitifleri: `@vnext-forge-studio/designer-ui/ui` subpath'inden direkt import
- Hooks: `@vnext-forge-studio/designer-ui/hooks`
- Tema: `DocumentThemeSync` tek başına mount edilir
- Bildirim: `registerNotificationSink` + sonner (`app/notifications/SonnerProvider.tsx`)
- Stiller: `@vnext-forge-studio/designer-ui/styles.css` `index.css`'ten import edilir
- **Component İkonları**: vNext component türleri (workflow, task, function, extension, schema, view) için ikonlar `@vnext-forge-studio/designer-ui/assets/icons/component-badges/` içinden alınmalıdır. UI'da component type gösterilirken lucide-react yerine bu resmi ikonlar kullanılır. Detay: `packages/designer-ui/src/modules/component-icons/` altında hazır mapping (`FILE_BADGE_SVG`) vardır.

### API İstemcisi: MonitoringHttpClient

`ApiTransport` interface'i **benimsenmez** — forge method registry'ye (`getMethodHttpSpec`) bağlı, monitoring API'leri için uygun değil.

Bunun yerine `shared/api/api-client.ts`'de endpoint-tabanlı `MonitoringHttpClient` kullanılır:
- `get(path, params)` / `post(path, body)` → `Promise<ApiResponse<T>>`
- `ApiResponse<T>` envelope'u `@vnext-forge-studio/app-contracts`'tan alınır
- Base URL: `VITE_MONITORING_API_BASE_URL` (default: `http://localhost:4203`)
- Her istekte `X-Trace-Id` + `traceparent` header'ı inject edilir (`trace-headers.ts`)

### Config Singleton

`import.meta.env` sadece `shared/config/config.ts` içinde okunur. Uygulamanın geri kalanı her zaman `import { config } from '@monitoring/shared/config/config'` üzerinden erişir.

### Loglama

`console.*` yerine `createLogger('monitoring/ModuleName')` kullanılır (`@vnext-forge-studio/designer-ui` barrel'ından). `config.ts` başlangıç uyarısı tek istisnadır.

### Dil Politikası

Tüm UI metinleri ve kod yorumları İngilizce olmalıdır (`vnext-forge` proje politikası).

---

## Git Politikası

Git commit'lerini **kullanıcı kendisi yapar**. Claude hiçbir zaman `git commit`, `git push` veya benzeri git yazma komutları çalıştırmamalıdır. Bir phase veya anlamlı bir çalışma birimi tamamlandığında kullanıcıya "commit yapmak için iyi bir nokta olabilir" şeklinde öneri sunulabilir, ancak commit işlemi asla otomatik yapılmamalıdır.

---

## Component Response Structure (Definitions API)

Tüm component türleri (`sys-flows`, `sys-tasks`, `sys-functions`, `sys-mappings`, `sys-extensions`, `sys-schemas`, `sys-views`) aşağıdaki **ortak field'ları** taşırlar:

```json
{
  "key": "component-id",
  "flow": "sys-flows",
  "flowVersion": "1.0.0",
  "domain": "banking",
  "version": "1.0.0",
  "tags": ["banking", "account", "onboarding"],
  "_comment": "Component description"
}
```

Component bazında **ek field'lar** (Definitions sayfasında gösterilecek):
- **Workflow** (`sys-flows`): `labels[]`, `type` (F/C/S/P)
- **Task** (`sys-tasks`): `type` (1-16 → DaprHttpEndpoint, HttpTask, ScriptTask, …)
- **Function** (`sys-functions`): `scope` (D/F/I → Domain/Flow/Instance), `labels[]`
- **Mapping** (`sys-mappings`): `name`
- **Extension** (`sys-extensions`): `type`, `scope` (D/F/I), `labels[]`
- **Schema** (`sys-schemas`): `type`, `labels[]`
- **View** (`sys-views`): `type` (1-6 → JSON, HTML, Markdown, Deeplink, Http, URN), `display`, `renderer`, `labels[]`

### Type & Scope Mappings

**Task Types** (`sys-tasks`): 1→DaprHttpEndpoint, 2→DaprBinding, 3→DaprService, 4→DaprPubSub, 5→HumanTask, 6→HttpTask, 7→ScriptTask, 8→ConditionTask, 9→TimerTask, 10→NotificationTask, 11→StartFlowTask, 12→TriggerTransitionTask, 13→GetInstanceDataTask, 14→SubProcessTask, 15→GetInstancesTask, 16→SoapTask

**View Types** (`sys-views`): 1→JSON, 2→HTML, 3→Markdown, 4→Deeplink, 5→Http, 6→URN

**Scope** (`sys-functions`, `sys-extensions`): D→Domain, F→Flow, I→Instance

---

## Monitor API — Pagination

Tüm liste endpoint'leri aynı zarfı döner:

```json
{
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "hasNext": true
  },
  "items": [ ... ]
}
```

### Kurallar

- `pagination` her zaman gelmez. `groupBy` parametresiyle aggregation yapıldığında `pagination` field'ı response'ta hiç bulunmaz — `null` değil, tamamen yoktur.
- `hasNext` ile "sonraki sayfa var mı" öğrenilir. Toplam kayıt sayısı (`totalCount`) dönmez.
- `page` 1-tabanlıdır (ilk sayfa = 1).
- `pageSize` gönderilen `?pageSize=` değerinin aynısıdır; son sayfada `items` sayısı `pageSize`'dan az olabilir.

### Query Parametreleri

| Parametre | Default | Max |
|-----------|---------|-----|
| `page` | 1 | 1000 |
| `pageSize` | 10 | 100 |

### "Sonraki Sayfa" Akışı

```
hasNext == true  →  page + 1 ile tekrar çağır
hasNext == false →  son sayfadasın
```

---

## Paket Yöneticisi

`pnpm` binary PATH'te yok — `corepack pnpm` ile çalıştırılır:
```bash
corepack pnpm --filter @vnext-forge-studio/monitoring dev
corepack pnpm install
```

---

## Correctness & Security Log (`docs/ask-correctness/`)

Onayı şüpheli, kesinliği sorgulanabilir veya güvenlik riski taşıyan her durum `docs/ask-correctness/` klasörü altına not alınır.

### Ne zaman not alınır?

- Doğruluğundan emin olunmayan kararlar (API davranışı, edge case, veri yorumu)
- Güvenlik açığı doğurabilecek implementasyonlar (XSS, injection, auth bypass, veri sızıntısı)
- Varsayıma dayalı yapılan geliştirmeler (backend dokümanı eksik, spec belirsiz)
- Gelecekte sorun yaratabilecek teknik borçlar

### Dosya Adlandırma

```
docs/ask-correctness/YYYY-MM-DD-konu-ozeti.md
```

Örnek: `docs/ask-correctness/2026-06-18-pagination-null-vs-missing.md`

### Dosya Şablonu

```markdown
# [Konu Başlığı]

**Tarih:** YYYY-MM-DD
**Kategori:** correctness | security | assumption | tech-debt
**İlgili Dosya(lar):** `path/to/file.ts`

## Durum

[Ne yapıldı / ne gözlemlendi]

## Şüphe / Risk

[Neden onaylanması gerekiyor, potansiyel sorun nedir]

## Beklenen Onay

[Kimden / ne tür bir yanıt bekleniyor]

## Çözüm (doldurulunca kapatılır)

[Onaylandı / reddedildi / değiştirildi — ne yapıldı]
```

### Kural

Claude bir implementasyon sırasında yukarıdaki kategorilerden biriyle karşılaşırsa, ilgili dosyayı oluşturur ve kullanıcıya bildirir. Dosya kapatılmadan (Çözüm bölümü doldurulmadan) konu açık sayılır.
