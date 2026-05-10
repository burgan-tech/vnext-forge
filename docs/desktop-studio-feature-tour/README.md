# vNext Forge — Desktop Studio Sprint 2 Özellik Turu

> **Sürüm:** `feat/desktop-studio` — Sprint 2 ("Foundation Productivity")
> **Hedef kitle:** vnext-forge-studio'yu daily driver olarak kullanacak Burgan Tech vNext geliştiricileri.
> **Durum:** Tüm 7 madde uygulanmış, smoke test edilmiş, _commit edilmemiş_ (working tree).

Bu rehber, Sprint 2'de eklenen 7 üretkenlik özelliğinin **ne işe yaradığını, nasıl açıldığını ve nasıl kullanıldığını** birebir örneklerle gösterir. Çalıştığı doğrulanmış senaryoları içerir; ekran görüntüleri smoke test sırasında alınmıştır.

> **Ekran görüntülerini eklerken**: bu klasörün altındaki `screenshots/` dizinine PNG'leri koyup aşağıdaki referans isimlerini kullan. Markdown'da `![alt](./screenshots/<name>.png)` ile gömülü çıkar. Şu an metinde belirtilen yerlere kullanıcı kendi capture'larını koyabilir.

---

## İçindekiler

1. [Smart Search — Cmd+P (Quick Switcher)](#1-smart-search--cmdp-quick-switcher)
2. [Smart Search — Cmd+Shift+F (Project-Wide Content Search)](#2-smart-search--cmdshiftf-project-wide-content-search)
3. [Snippets Library — Cmd+Shift+S](#3-snippets-library--cmdshifts)
4. [Workspace Sessions](#4-workspace-sessions)
5. [Integrated Terminal — Cmd+J](#5-integrated-terminal--cmdj)
6. [Pre-Commit Hooks — StatusBar chip](#6-pre-commit-hooks--statusbar-chip)
7. [Test Data Generators — Cmd+Shift+G](#7-test-data-generators--cmdshiftg)

Sonunda: [Tüm shortcut tablosu](#shortcut-tablosu) ve [bilinen bug'lar](#bilinen-buglar--takip-eden-issuelar).

---

## 1. Smart Search — Cmd+P (Quick Switcher)

**Tagline:** Aktif projedeki her vNext entry'sine (workflow + her state + her transition + task + schema + view + function + extension) tek bir palette'tan **fuzzy match** ile gitme.

### Ne işe yarar?

VS Code'daki "Go to Anything" mantığının vNext-aware'i. Tek tuş kombinasyonuyla aklındaki workflow / state / task / schema / view / function / extension'a anında atlarsın — sidebar'da klasör tıklamadan, dosya adını hatırlamadan.

### Nasıl açarım?

| Yol | Tuş kombinasyonu / Aksiyon |
|---|---|
| Klavye (cross-platform) | **`Cmd + P`** (macOS) / **`Ctrl + P`** (Win/Linux) |
| Native menü | **Go → Go to Anything…** |

### Örnek kullanım

1. `Cmd + P` bas.
2. "Building index…" 200-700 ms sürer (büyük projede), sonra entry listesi açılır.
3. Yazmaya başla — fuzzy match sıralı sonuçları getirir. Her sonuçta tip rozetleri:
   - **WF** workflow / **ST** state / **TX** transition
   - **TASK** / **SCHEMA** / **VIEW** / **FN** / **EXT**
4. ↑↓ ile gez, **`Enter`** seçer (editor açılır), **`Esc`** kapatır.

### Veri nereye yazılır?

Yazılmaz. İlk açılışta sunucu `quickswitcher/buildIndex` ile bütün entry'leri tarar, sonuç **bellekte cache'lenir** — aynı proje için ikinci açılış anlık.

---

## 2. Smart Search — Cmd+Shift+F (Project-Wide Content Search)

**Tagline:** Projedeki tüm dosyalarda regex / substring içerik araması.

### Ne işe yarar?

VS Code'daki "Find in Files" karşılığı. Yazdığın string projedeki herhangi bir dosyada geçiyor mu? Cmd+Shift+F bir saniyede söyler.

### Nasıl açarım?

| Yol | Tuş kombinasyonu / Aksiyon |
|---|---|
| Klavye | **`Cmd + Shift + F`** / **`Ctrl + Shift + F`** |
| Native menü | **Edit → Find in Files…** |

> **Not:** Electron'da DevTools açıkken Chromium "Search across sources"u çalabiliyor. Bunun için **native menü accelerator'u** kullanıldı; menüdeki "Find in Files…" girişi DevTools'dan önce kazanır.

### Örnek kullanım

1. `Cmd + Shift + F`.
2. Sidebar otomatik **Search** view'una geçer, input focus alır.
3. Aramayı yaz, sonuçlar gelir; tıklayınca dosyaya navigate olur.

---

## 3. Snippets Library — Cmd+Shift+S

**Tagline:** Dosya tabanlı tekrar kullanılabilir snippet kütüphanesi — kişisel + proje (team-shared) iki scope.

### Ne işe yarar?

Sık kullandığın C# script kalıpları, validation pattern'leri, mapper template'leri… kayıtlı bir kütüphane. Cmd+Shift+S → fuzzy ile bul → clipboard'a kopyala (ya da editöre paste).

### Nasıl açarım?

| Yol | Tuş kombinasyonu / Aksiyon |
|---|---|
| Klavye | **`Cmd + Shift + S`** / **`Ctrl + Shift + S`** |
| Native menü | **Edit → Insert Snippet…** |
| Sidebar | **Activity Bar → Code² ikonu** (snippets paneli) |

### Örnek snippet

```json
{
  "name": "HTTP error handler",
  "prefix": "httperr",
  "language": "csx",
  "description": "Logs and rethrows as VnextForgeError",
  "body": [
    "try {",
    "  ${1:// call}",
    "} catch (ex) {",
    "  LogError(\"$2\", ex.Message);",
    "}"
  ],
  "tags": ["error", "http"]
}
```

### Veri nereye yazılır?

| Scope | Konum |
|---|---|
| **Personal** | `~/.vnext-studio/snippets/<id>.json` (sadece sen) |
| **Project** | `<project>/.vnextstudio/snippets/<id>.json` (Git'le takım paylaşır) |

> **Not:** Project snippet'leri kasten Git'e gider — takım arkadaşların commit'inde hazır gelir. Workspace session farklı (per-developer).

### Sidebar paneli (snippet kütüphanesi yönetimi)

Activity Bar'daki Code² ikonuna tıkla → soldaki sidebar'da **PROJECT** ve **PERSONAL** bölümleri:

> _Screenshot:_ `./screenshots/snippets-sidebar-empty.png` — boş kütüphane görünümü (PROJECT (0) / PERSONAL (0)). Henüz snippet eklenmediğinde bu boş hâli görürsün.

Her bölümde **+** butonu yeni snippet yaratır, hover edildiğinde her satırda Copy / Edit / Reveal in Finder / Delete butonları çıkar.

---

## 4. Workspace Sessions

**Tagline:** Uygulamayı kapatıp açtığında **açık tab'ların, sidebar genişliğin, aktif sekmen** aynen geri gelir.

### Ne işe yarar?

VS Code'daki "Restore Workspace" davranışı, vNext'e özel. 3 tab açıkken çıkış yaptın → yarın aç → 3 tab geri gelmiş, sidebar 440px'de, son baktığın sekme aktif.

### Nasıl tetiklenir?

Otomatik — açıkça yapacağın bir şey yok:

- **Persist:** Editor / sidebar değişiminden 1 saniye sonra debounce ile diske yazılır.
- **Restore:** Proje açılır açılmaz `sessions/get` çağırılır, dönen state uygulanır.
- **Quit-time flush:** `beforeunload`'da son bir sync save (debounce'tan kalan ≤ 1 saniyeyi de kurtarır).

### Veri nereye yazılır?

`<project>/.vnextstudio/session.json`

```json
{
  "version": 1,
  "editor": {
    "open": [
      { "id": "morph-idm:component:task:user-login:auth-code-generator",
        "kind": "component", "title": "auth-code-generator.json",
        "componentKind": "task", "group": "user-login", "name": "auth-code-generator" },
      { "id": "morph-idm:component:flow:approval-matrix:approval-1.0.0", "...": "..." }
    ],
    "activeTabId": "morph-idm:component:schema:approval-matrix:approval-matrix-master-1.0.0"
  },
  "sidebar": { "view": "project", "open": true, "width": 440 },
  "runtime": { "activeConnectionId": null },
  "palette": {},
  "lastSavedAt": "2026-05-08T08:40:54.358Z"
}
```

### `.gitignore` otomasyonu (önemli)

`session.json` **per-developer** state — Git'e gitmemeli. Save sırasında otomatik olarak `<project>/.vnextstudio/.gitignore` dosyası yazılır:

```text
# vnext-forge-studio managed — keeps per-developer state out of git
session.json
```

Snippets kasten dahil değil — onlar takım paylaşılır.

> Daha önce session.json'u commit ettiysen: `git rm --cached <project>/.vnextstudio/session.json` ile track'i bırakıp tekrar commit at. Bundan sonra `.gitignore` izleyecek.

### Bilinen ufak nokta

İlk açılışta sidebar **width** restore (Zustand store'a yazılıyor) görsel olarak hemen yansımıyor — `react-resizable-panels` ilk render'da default'tan başlıyor. Tab'lar + sidebar view düzgün geliyor. Ayrı task ile takip ediliyor.

---

## 5. Integrated Terminal — Cmd+J

**Tagline:** VS Code tarzı alt-panel terminali — gerçek PTY (zsh / bash / pwsh), ANSI renkleri, çok sekme, drag-resize.

### Ne işe yarar?

Workflow / task üzerinde çalışırken `git status`, `npm test`, `ls`, vs. için pencere değiştirmek yerine doğrudan IDE içinde komut çalıştır. **Aynı pencere, aynı project root cwd, aynı shell config.**

### Nasıl açarım?

| Yol | Tuş kombinasyonu / Aksiyon |
|---|---|
| Klavye (önerilen) | **`Cmd + J`** / **`Ctrl + J`** |
| Backtick varyantı | **`Ctrl + \``** (US klavye) — Türkçe Q'da backtick dead-key olduğu için J fallback'i tercih edilir |
| Native menü | **View → Toggle Terminal** |

### Örnek kullanım

1. **Cmd + J** → alt panel açılır, otomatik bir terminal sekmesi spawn olur (proje root'unda).
2. Komutla yaz:

   ```text
   burgan@127 morph-idm-master % pwd
   /Users/burgan/Documents/Projects/morph-idm-master
   burgan@127 morph-idm-master % ls
   Auhorization.md   build.js          omnisharp.json   package-lock.json
   …
   burgan@127 morph-idm-master % echo "merhaba vnext"
   merhaba vnext
   ```

3. **+ butonu** sağ üstte → 2. terminal sekmesi açılır (farklı komutu paralel koşturmak için).
4. **Tab'ın üstünde çift-tık** → inline rename (Enter commit / Esc cancel).
5. **Panelin üst kenarını yukarı sürükle** → yükseklik değişir (160-800px arası).
6. **▾ butonu** veya tekrar `Cmd + J` → paneli gizler. Sekmeler hayatta kalır, scrollback korunur.

### Sekme arası geçiş

Tab'a tıkla → o sekme gösterilir, diğerleri `display: none` ile gizlenir (ama xterm DOM'u + scrollback **canlı kalır**). Geri tıklarsan ne yazdığın aynen yerinde.

### Veri nereye yazılır?

Yazılmaz — terminal session'ları in-memory. Ama tab listesini **Workspace Sessions schema'sına v2 olarak ekleme** roadmap'te.

> _Screenshot:_ `./screenshots/terminal-pwd.png` — açık paneli gösteren capture (Terminal 1 yeşil status dot + alt panel siyah arka plan, `pwd` çıktısı).

---

## 6. Pre-Commit Hooks — StatusBar chip

**Tagline:** `git commit` çalıştırıldığında staged vNext component JSON'larını `vnext-schema`'ya karşı doğrula. Bozuk dosya varsa commit **engellenir**.

### Ne işe yarar?

Bozuk JSON / eksik required field / yanlış type → review sırasında fark ediliyor. Bu hook ile `git commit` aşamasında yakalanıyor — bozuk workflow main'e hiç gitmiyor.

### Mimari (özet)

```
~/.vnext-studio/server.json      ← desktop app her başladığında {host, port, pid, startedAt} yazar
                                   her kapanışta (SIGINT/SIGTERM) sahibi olduğunu doğrulayıp siler

<project>/.git/hooks/pre-commit  ← StatusBar chip "Install" deyince yazılır
                                   POSIX sh, `# vnext-forge-studio managed pre-commit hook v1` markerlı
                                   git diff --cached → curl loopback → schema validate → exit 0/1
```

### Nasıl açarım?

| Yol | Aksiyon |
|---|---|
| StatusBar chip | Sağ alttaki **"Hooks: …"** chip'ine tıkla → popover'dan Install / Uninstall / Reinstall seç |

Chip durumları:

| Durum | İkon + renk | Anlamı |
|---|---|---|
| `not-a-git-repo` | gri `GitBranch` | `<project>/.git` yok — `git init` lazım |
| `not-installed` | gri `GitBranch` "Hooks: off" | Tıklayıp Install et |
| `installed` (up-to-date) | yeşil `ShieldCheck` "Hooks: on" | Aktif |
| `installed` (outdated) | sarı `ShieldAlert` "Hooks: outdated" | Reinstall ile yeni template'i yaz |
| `foreign` | kırmızı `ShieldOff` "Hooks: foreign" | Başka tool (husky vs.) hook'u sahipleniyor — Force Remove veya manuel müdahale |

### Örnek kullanım — gerçek smoke test

**1. Chip'ten install:**

```text
StatusBar → "Hooks: off" tıkla → "Install pre-commit hook" → 1 sn → "Hooks: on" yeşil
```

`<project>/.git/hooks/pre-commit` yazılır:

```bash
#!/usr/bin/env sh
# vnext-forge-studio managed pre-commit hook v1
# Generated by vnext-forge-studio. Edit by hand at your own risk — the
# desktop app's "Reinstall" action overwrites this file when its template
# version changes. To keep your edits, change the marker above.

set -e

PROJECT_ID="messaging-gateway"
DISCOVERY_FILE="${HOME}/.vnext-studio/server.json"
…
```

**2. Bozuk workflow ile commit denemesi:**

```bash
$ cd vnext-messaging-gateway
$ git add vnext-messaging-gateway/Workflows/email/testmail.json
$ git commit -m "test bozuk workflow"
vnext-forge-studio: 1 file(s) failed pre-commit validation:
  ✘ vnext-messaging-gateway/Workflows/email/testmail.json  (workflow)
      (root): must have required property "key"
      (root): must have required property "flow"
      (root): must have required property "domain"
      (root): must have required property "version"
$  ← commit reddedildi
```

**3. Düzelt → tekrar commit → geçer:**

```bash
$ # eksik field'leri ekle
$ git add vnext-messaging-gateway/Workflows/email/testmail.json
$ git commit -m "fixed"
vnext-forge-studio: 1 component file(s) validated successfully.
[release-v1.0 a1b2c3d] fixed
$
```

**4. App kapalıyken commit:**

```bash
$ # vnext-forge-studio kapalı
$ git commit -m "rush job"
[vnext-forge-studio] server.json not found — desktop app likely not running. Skipping pre-commit validation.
[release-v1.0 d4e5f6g] rush job
$  ← commit geçer (bilerek; offline'da blok atmıyoruz)
```

### Native CLI dependency

Hook script'inin çalışması için kullanıcı makinesinde gereken araçlar (hepsi macOS / Linux / Git-for-Windows'da hazır):

- POSIX `sh`
- `git`
- `curl`
- `python3` (JSON parse + ANSI renderer için)

### Detect edilenler

```text
✓ JSON parse hatası      → "JSON parse error: Unexpected token …" satırı
✓ Schema violation       → "must have required property X" / "must be string" vs.
✓ Wrong component type   → path classifier yanlış klasör yapısı için skip
✓ Stale discovery file   → PID kill -0 başarısızsa skipping notice
```

---

## 7. Test Data Generators — Cmd+Shift+G

**Tagline:** Aktif projenin Schema component'lerinden **schema-uyumlu rastgele JSON instance** üret. Faker-driven; kopyala / yeniden üret.

### Ne işe yarar?

Bir workflow'u veya task'ı test ederken giriş payload'ı elle yazıyorduk. Bu generator, Schema component'in `attributes.schema`'sını okuyup gerçekçi bir instance üretir — `email: "eve981@sample.io"`, `citizenshipNo: "91913143655"`, `cc: "9oUjuzpj"` gibi. Faker, alan adına bakıp uygun tip dağıtıyor.

### Nasıl açarım?

| Yol | Tuş kombinasyonu / Aksiyon |
|---|---|
| Klavye | **`Cmd + Shift + G`** / **`Ctrl + Shift + G`** |
| Native menü | **Edit → Generate Test Data…** |

### Overlay arayüzü

```
┌─ 🧪 Generate Test Data — Pick a Schema component → faker-driven instance. ──────┐
│                                                                                   │
│ ┌─ Schemas ─────────────┐ ┌─ ✨ Generated instance — Copy or Regenerate. 🔄 📋 ─┐│
│ │ Filter schemas…       │ │ {                                                    ││
│ │                       │ │   "email": "eve981@sample.io",                      ││
│ │ email / email-request │ │   "sender": "Burgan",                               ││
│ │ /Users/.../vnext-...  │ │   "from": "CEizpjEeyV",                             ││
│ │                       │ │   "subject": "",                                    ││
│ │ fast / fast-sms-req…  │ │   "content": null,                                  ││
│ │ otp / otp-request     │ │   "template": "OH",                                 ││
│ │ otp / otp-response    │ │   "templateParams": {},                             ││
│ │ push / push-request   │ │   "cc": "9oUjuzpj",                                 ││
│ │ shared / blacklist-…  │ │   "ccList": [ "", "1o9Sys", "75Q4Z5h" ],            ││
│ │ shared / phone        │ │   "bccList": null,                                  ││
│ │ …                     │ │   "checkIsVerified": false,                         ││
│ │                       │ │   "instantReminder": false,                         ││
│ │                       │ │   …                                                  ││
│ │                       │ │ }                                                    ││
│ └───────────────────────┘ │ source: …/Schemas/email/email-request.json           │
│                           └──────────────────────────────────────────────────────┘
└───────────────────────────────────────────────────────────────────────────────────┘
```

> _Screenshot:_ `./screenshots/test-data-generator.png` — gerçek generation sonucu. Sol panelde mesaj gateway'in schema component listesi (email-request, fast-sms-request, otp-request/response, push-request, blacklist-check-request, phone-registry, vs.), sağ panelde otomatik üretilmiş JSON.

### Örnek üretilmiş instance (gerçek smoke test'ten)

`vnext-messaging-gateway / email / email-request` schema'sı seçildiğinde:

```json
{
  "email": "eve981@sample.io",
  "sender": "Burgan",
  "from": "CEizpjEeyV",
  "subject": "",
  "content": null,
  "template": "OH",
  "templateParams": {},
  "cc": "9oUjuzpj",
  "bcc": null,
  "ccList": [
    "",
    "1o9Sys",
    "75Q4Z5h"
  ],
  "bccList": null,
  "attachments": null,
  "customerNo": null,
  "citizenshipNo": "91913143655",
  "tags": null,
  "checkIsVerified": false,
  "instantReminder": false
}
```

Bu instance'ı:
- **📋 Copy** ile clipboard'a al → Postman'e yapıştır → Workflow'u tetikle.
- **🔄 Regenerate** ile aynı schema'dan yeni rastgele instance üret (her tıklamada farklı seed).

### Iki entry point

Backend iki method sağlıyor; UI sadece ikincisini kullanıyor şu an:

| Method | Ne yapar |
|---|---|
| `test-data/generate({ schema, options? })` | Generic — ham JSON Schema'yı verirsin, instance dönüyor. Cli / CI için. |
| `test-data/generateForSchemaComponent({ projectId, group, name, options? })` | Project-aware — `Schemas/<group>/<name>.json` dosyasını okuyup `attributes.schema`'sını çıkarıp generic'e veriyor. UI bunu çağırıyor. |

### Options

```ts
{
  // Aynı seed → aynı output (golden fixture için faydalı).
  seed?: number | string;

  // false yaparsan optional alanlar 50% olasılıkla atlanır (sparse instance).
  // Default true: tam instance görürsün.
  alwaysFakeOptionals?: boolean;
}
```

### Şu an out-of-scope

- **Top-level schema component'lerinin desteği** (Schemas/headers-1.0.0.json gibi grup klasörü olmayan dosyalar). Şu an UI yalnız `Schemas/<group>/<name>.json` 2-segment yapısını listeler. Top-level olanlar için "Paste a schema" mod'u sonraki iterasyonda eklenecek.
- **Workflow start payload üretimi** — workflow'un `startTransition.schema` referansını çözüp schema component'e gitmek; sonra ondan instance üretmek. Bir tık daha yakın olabilir; deferred follow-up.
- **Editor'a doğrudan insert** — şu an Copy ile clipboard üstünden geçiyor; Monaco'ya direkt insert sonraki adım.

---

## Shortcut tablosu

| Aksiyon | macOS | Windows / Linux | Native menü |
|---|---|---|---|
| Quick Switcher | `Cmd + P` | `Ctrl + P` | Go → Go to Anything… |
| Find in Files | `Cmd + Shift + F` | `Ctrl + Shift + F` | Edit → Find in Files… |
| Insert Snippet | `Cmd + Shift + S` | `Ctrl + Shift + S` | Edit → Insert Snippet… |
| Toggle Terminal | `Cmd + J` (veya `Ctrl + \``) | `Ctrl + J` (veya `Ctrl + \``) | View → Toggle Terminal |
| Generate Test Data | `Cmd + Shift + G` | `Ctrl + Shift + G` | Edit → Generate Test Data… |

---

## Veri yerleşimi tablosu

| Ne | Konum | Git'e gider mi? |
|---|---|---|
| Personal snippets | `~/.vnext-studio/snippets/<id>.json` | Hayır (kullanıcı home'u) |
| Project snippets | `<project>/.vnextstudio/snippets/<id>.json` | **Evet** (kasten — takım paylaşır) |
| Workspace session | `<project>/.vnextstudio/session.json` | **Hayır** (auto-`.gitignore`'a eklenir) |
| Discovery file | `~/.vnext-studio/server.json` | Hayır |
| Pre-commit hook | `<project>/.git/hooks/pre-commit` | `.git/` zaten ignored |
| `.vnextstudio/.gitignore` | `<project>/.vnextstudio/.gitignore` | **Evet** (managed marker'lı, takım paylaşır) |

---

## Bilinen bug'lar / takip eden issue'lar

| Konu | Açıklama | Durum |
|---|---|---|
| Sidebar width restore | Session restore Zustand store'a yazıyor ama `react-resizable-panels` defaultLayout memo ilk render'da default kullanıyor. Tab'lar + view düzgün, sadece görsel width snap'lemiyor. | Spawned task — imperative `groupRef.setLayout(...)` ile çözülecek |
| `node-pty` spawn-helper +x bit kaybı | pnpm bazen `node_modules/.pnpm/node-pty/.../prebuilds/<plat>/spawn-helper` dosyasının execute bit'ini düşürüyor; ilk `pty.spawn()` `posix_spawnp failed.` atıyor. Manual `chmod +x` çözer. | Spawned task — root postinstall script ile her install'da yeniden chmod |
| Top-level workflow → blank screen | `Workflows/<file>.json` (group klasörü olmayan) tıklanınca eski sürümde React Router miss + boş ekran. | **Çözüldü** — catch-all route ile "Editor not available" paneli artık görünüyor |
| Workflow start payload generator | Schema component → instance var, ama bir workflow'un start state'inin schema'sını çözüp doğrudan instance üretme yok. | Sonraki iterasyon için yedekte |

---

## Smoke test özeti — bu sürümde doğrulanmış

| Madde | Doğrulanmış senaryo |
|---|---|
| Quick Switcher | morph-idm projesinde Cmd+P → 700ms index → fuzzy çalıştı, ↵ FlowEditorPage'i açtı |
| Cmd+Shift+F | Sidebar Search panel focus, results render |
| Snippets | sidebar list, `+ new` modal, save → disk write, picker fuzzy, copy-clipboard |
| Workspace Sessions | 3 tab + sidebar 440px → quit → relaunch → tabs + activeTabId restore. `.gitignore` auto-write |
| Integrated Terminal | Cmd+J açtı, `pwd` doğru cwd, `ls` ANSI renkli, + ile 2. tab, drag-resize |
| Pre-Commit Hooks | Bozuk testmail.json → commit blocked, 4 schema hatası kırmızıyla yazıldı (`must have required property "key"/flow/domain/version`) |
| Test Data Generators | `email-request` schema → faker JSON (`eve981@sample.io`, `citizenshipNo: "91913143655"`) |

---

## Geliştirici notları

Bu özellikler `feat/desktop-studio` branch'inde **commit edilmeden** working tree'de duruyor. Commit'i kullanıcı kendisi atar (proje hard rule'u: ben hiç git commit / push çalıştırmıyorum). Commit-ready snapshot için:

```bash
git status                            # 50+ dosya görmen normal
git diff --stat main..HEAD            # şu anda boş — değişiklikler henüz commit'lenmedi
ls docs/plans/                        # detaylı slice-by-slice progress doc:
                                      # desktop-studio-sprint-1.1-progress.md
                                      # desktop-studio-sprint-2-progress.md
```

Detaylı her özelliğin **mimari kararları** ve **bug-fix tarihçesi** için `docs/plans/desktop-studio-sprint-2-progress.md` dosyasına bak.
