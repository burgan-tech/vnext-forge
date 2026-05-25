# Forge ↔ pseudo-ui Action Model Entegrasyonu

> **Hedef konuşmacı:** Forge (VS Code extension + desktop app) implementer
> **SDK sürümü:** `@burgantech/pseudo-ui` `0.2.0+` (action vocabulary patch)
> **İlgili dosyalar:** `engine/actionVocabulary.ts`, `engine/componentMeta.ts`, `engine/types.ts` (ActionDescriptor, CardNode, SnackbarNode, NavigationDrawerNode, MenuNode)

## Changelog

- **v0.2.1**:
  - `CardNode.action` (preferred) eklendi, `onTap` deprecated alias olarak korundu.
  - `SnackbarNode`, `NavigationDrawerNode`, `NavigationDrawerItem`, `MenuNode`, `MenuItem` interfaces eklendi (önceden `any` ile okunuyordu).
  - `componentMeta.itemActionCapability` field'ı NavigationDrawer ve Menu için: per-item action picker gating.
  - `actionCapability.preferredField` + `aliasFields` field alias dokümantasyonu için.
- **v0.2.0**: `STANDARD_ACTIONS`, `ActionDescriptor.validate`, `componentMeta.actionCapability`, `reset` action.

---

## 1. Bağlam ve değişen şey

SDK action verb'lerini **opaque dispatch identifier** olarak görür. Üç verb (`submit`, `select`, `reset`) reserved — geri kalan her şey (workflow transition, navigation, custom URN, vs.) host'un domain'i. SDK'nın bilmediği, bilmemesi gereken konular.

Bu çerçevede Forge iki rol üstlenir:

1. **View tasarımcısı (canvas)** — action picker'da SDK reserved + Forge domain action'larını birlikte sunmak
2. **Runtime preview** — `delegate.onAction` içinde URN'leri kendi dispatcher'larıyla resolve etmek

Yeni: her `ActionDescriptor`'da `validate?: boolean` flag var. Workflow transition gibi domain dispatch'leri "submit gibi davranır" yapmak için bu flag setlenir. SDK efektif kuralı: `validate ?? (verb === 'submit')`.

---

## 2. SDK kontratı özeti

### Reserved verbs

```ts
import { STANDARD_ACTIONS, isReservedAction, shouldValidateAction } from '@burgantech/pseudo-ui'

STANDARD_ACTIONS // { submit, select, reset } — full ActionSpec for each
isReservedAction('submit')         // true
isReservedAction('transition')     // false → host domain
shouldValidateAction({ action: 'dispatch', validate: true })  // true
```

### Action capability meta

```ts
import { getComponentMeta } from '@burgantech/pseudo-ui'

getComponentMeta('Button')?.actionCapability
// { field: 'action', reservedActions: ['submit','reset'], acceptsDispatch: true, acceptsValidateFlag: true }

getComponentMeta('Card')?.actionCapability
// { field: 'action', preferredField: 'action', aliasFields: ['onTap'],
//   reservedActions: ['select'], acceptsDispatch: true, acceptsValidateFlag: false }

getComponentMeta('TextField')?.actionCapability    // undefined — input, action taşımıyor

// Per-item action containers (NavigationDrawer, Menu)
getComponentMeta('NavigationDrawer')?.itemActionCapability
// { itemsField: 'items', field: 'action',
//   reservedActions: ['select'], acceptsDispatch: true, acceptsValidateFlag: false }
```

**Card prop alias**: SDK hem `action` (preferred) hem de `onTap` (legacy) okur. ViewDesigner yazarken yeni view'lar için `action` üret, eski view'larda `onTap` görürsen koru.

---

## 3. View tasarımcısı (canvas) entegrasyonu

### 3.1 Action picker UI

Seçili node tipinin `actionCapability`'sini oku, üç bölümlü dropdown göster:

```
┌─ Action ─────────────────────────────────┐
│  ── SDK reserved (UI behaviour) ──       │
│   • Submit (validates form)              │  ← reservedActions['submit']
│   • Reset                                │  ← reservedActions['reset']
│                                          │
│  ── Workflow ─────────────────────────── │
│   • Transition: next-step                │  ← Forge'un workflow catalog'u
│   • Transition: review                   │
│                                          │
│  ── Navigation ──────────────────────────│
│   • Open route: /accounts/:id            │  ← Forge'un router catalog'u
│                                          │
│  ── Custom URN ──────────────────────────│
│   [ urn:tenant:____________________ ]    │  ← serbest giriş
└──────────────────────────────────────────┘
```

`acceptsDispatch === false` ise "Workflow / Navigation / Custom URN" bölümleri gizlenir. `reservedActions === []` ise "SDK reserved" bölümü gizlenir.

### 3.2 Validate flag UI

`actionCapability.acceptsValidateFlag === true` iken properties panelinde göster:

```
☑ Validate form before dispatch
```

Default değer:
- `submit` seçildiyse: ☑ true (override edilebilir)
- Diğer her şey: ☐ false (override edilebilir)

Yazılan view JSON:
```json
{ "type": "Button", "label": "Continue",
  "action": "dispatch", "command": "urn:wf:next",
  "validate": true }
```

### 3.3 Command field UI

Reserved verb seçildiyse command field opsiyonel (örn. `submit` + `command: 'save-account'` host'a context geçirme). Domain dispatch seçildiyse command **zorunlu** ve URN registry'den seçim yapılır:

```
Verb:    [dispatch ▼]
Command: [ urn:amorphie:wf:account:transition:next ▼ ]
         ↳ Tüm workflow transition URN'leri Forge'un workflow modülünden gelir
☑ Validate form before dispatch
```

### 3.4 Per-item action picker (NavigationDrawer, Menu)

NavigationDrawer ve Menu node'larının kendi action'ı yok — yerine `items: []` dizisindeki her item'ın kendi `action`'ı var. ViewDesigner item satırına tıkladığında **aynı** action picker'ı göstermeli, ama context "item-level":

```ts
const containerMeta = getComponentMeta('NavigationDrawer')
const itemCap = containerMeta?.itemActionCapability
// itemCap.itemsField  → 'items'
// itemCap.reservedActions, acceptsDispatch, acceptsValidateFlag → top-level ile aynı semantic
```

Item ekleme/silme: NavigationDrawer item üç şekilde olabilir:
1. **Tappable row**: `{ label, icon?, action, badge? }` — action picker burada açılır
2. **Divider**: `{ divider: true }` — action yok
3. **Section header**: `{ header: "..." }` — action yok

ViewDesigner UX: NavigationDrawer node seçilince palette'te "Add item / Add divider / Add header" üç buton; "Add item" item'ı array'e ekler ve aksiyon picker'ı açılır.

### 3.5 Forge'un domain catalog'u — nereden gelir?

SDK bunu sağlamaz. Forge kendi modüllerinden besler:

| Catalog | Kaynak | Örnek entry |
|---|---|---|
| Workflow transitions | Workflow engine state machine tanımları | `urn:amorphie:wf:account-opening:transition:next-step` |
| Navigation routes | Forge router config | `urn:forge:nav:/accounts/:id` |
| Integration commands | BFF function registry | `urn:amorphie:func:domain:shared:save-draft` |
| Tenant custom | Tenant config | `urn:tenant-acme:custom:track-button` |

Önerilen interface:

```ts
interface DomainActionCatalog {
  group: string                          // 'Workflow' | 'Navigation' | 'Custom'
  entries: Array<{
    urn: string
    label: string
    description?: string
    defaultValidate?: boolean            // suggest validate flag default
    schemaHint?: { requires?: string[] } // optional: required form fields
  }>
}

// Forge composes catalogs from its own modules
const catalogs: DomainActionCatalog[] = [
  workflowEngine.exportActionCatalog(viewContext),
  router.exportActionCatalog(),
  tenantConfig.customActions,
]
```

ViewDesigner'ın action picker'ı bu catalog'lardan beslenir.

---

## 4. Runtime entegrasyonu (`delegate.onAction`)

### 4.1 Switch şablonu

```ts
const delegate: PseudoViewDelegate = {
  requestData: forge.bff.request,
  loadComponent: forge.componentLoader,

  async onAction(verb, formData, command) {
    // 1. SDK reserved verbs — SDK zaten ön-işlemini yapmış
    if (verb === 'submit') {
      // SDK validation geçti, formData temiz
      return forge.persistDraft(formData)
    }
    if (verb === 'reset') {
      // SDK ctx.formData ve errors'u zaten temizledi
      return forge.refreshInstanceData()
    }
    if (verb === 'select') {
      // SDK içinde halledildi — burada hiç çağrılmaz
      return
    }

    // 2. Domain dispatch — URN registry'den resolve
    if (command?.startsWith('urn:amorphie:wf:')) {
      return forge.workflow.dispatch(command, formData)
    }
    if (command?.startsWith('urn:forge:nav:')) {
      return forge.router.navigate(command.slice('urn:forge:nav:'.length))
    }
    if (command?.startsWith('urn:amorphie:func:')) {
      return forge.bff.invoke(command, formData)
    }

    // 3. Free-form verbs (legacy / conventional)
    if (verb === 'back')   return forge.workflow.previous()
    if (verb === 'cancel') return forge.dialog.close()

    forge.log.warn('Unhandled action', { verb, command })
  },
}
```

### 4.2 Validate flag — runtime'da host'un işi mi?

**Hayır.** SDK validate flag'i descriptor'da gördüğünde `validateAllFields()`'i kendisi çalıştırır ve hata varsa `delegate.onAction`'ı **hiç çağırmaz**. Host validation logic'i `validateField()` ile schema-driven yapılmış. Host tarafının ek bir kontrol yapmasına gerek yok.

Sadece `delegate.onValidationRequest` (field-level async custom validation) ayrı yoldan akar — orada host backend'e değer doğrulatabilir (TC kimlik, IBAN vs.).

### 4.3 İstisna: validate=true ve sunucu-side validation hata dönerse?

SDK client-side validation geçtikten sonra dispatch eder. Sunucu yanıtı başarısız ise host yine de hata göstermeli:

```ts
async onAction(verb, formData, command) {
  try {
    const result = await forge.workflow.dispatch(command, formData)
    return result
  } catch (e) {
    if (e.code === 'VALIDATION_FAILED') {
      forge.toast.error('Sunucu validasyonu başarısız: ' + e.message)
      // Optional: e.fieldErrors'u ctx.errors'a yansıtmak için
      // forge.pseudoView.setErrors(e.fieldErrors)
    }
    throw e
  }
}
```

> Not: SDK şu an `setErrors` public API'si sunmuyor — server-side error projeksiyonu Forge'da local state ile tutulup re-render'la geçilir.

---

## 5. View tasarımcısı için validation hint'leri

### 5.1 Designer'da lint kuralları

ViewDesigner action seçildiğinde basit kontroller:

- `acceptsDispatch === false && verb is not reserved` → ⚠️ "Bu node domain dispatch desteklemiyor"
- `reservedActions === [] && verb in STANDARD_ACTIONS` → ⚠️ "Bu node reserved verb taşımıyor"
- `acceptsValidateFlag === false && validate field set` → ⚠️ "Bu node için validate flag etkili olmaz"
- `verb === 'select' && (!bind || value === undefined)` → ⛔ "select için bind ve value zorunlu"
- Custom URN seçildi ama Forge catalog'unda yok → ⓘ "Bu URN host registry'de tanımlı değil — runtime'da uyarı verebilir"

### 5.2 AI co-author rehberi

`/tmp/view-author-guide.md`'deki guide AI skill'ine eklendiğinde, action önerileri şu prensipleri taşımalı:

1. **Form gönderimi**: `submit` (varsayılan)
2. **Workflow geçişi**: `{action: 'dispatch', command: 'urn:wf:...', validate: true}` (validate gerekirse)
3. **Geri / iptal**: free-form `'back'`/`'cancel'` veya URN-based — domain'e bağlı
4. **Read-only navigation (ListTile tap)**: `{action: 'navigate', command: 'urn:forge:nav:...'}` (validate yok)
5. **State toggle**: `{action: 'select', bind: '$ui.dialogOpen', value: true}`

---

## 6. Geriye uyumluluk

Forge tarafındaki mevcut view JSON'ları (`action: 'transition'`, `action: 'back'` vs.) **kırılmaz**:

- `validate` alanı yoksa SDK önceki davranışı verir (`submit` validate, gerisi no-validate)
- `STANDARD_ACTIONS` ek bir export — mevcut imports etkilenmez
- `componentMeta.actionCapability` opsiyonel — eski palette/lint kuralı yoksa eskisi gibi çalışır
- `reset` daha önce SDK için yoktu — şimdi reserved oldu. Forge bu kelimeyi domain verb olarak kullanıyorsa rename gerekir (büyük olasılıkla kullanmıyor).

---

## 7. Yapılacaklar checklist (Forge tarafı)

- [ ] `STANDARD_ACTIONS`'ı action picker'da reserved bölüme map'le
- [ ] `componentMeta.actionCapability` ile picker gating
- [ ] `acceptsValidateFlag` ile "Validate" checkbox
- [ ] Workflow / Navigation / Custom URN catalog interface'i (Forge modüllerinden çek)
- [ ] `delegate.onAction` switch'inde URN prefix tabanlı dispatch
- [ ] `reset` verb için host davranışı (refresh instance, telemetry, vs.)
- [ ] Lint kuralları (5.1) — opsiyonel ama önerilir
- [ ] Migration notu: domain takımlara `'transition'`'ı `{action: 'dispatch', command: 'urn:wf:...', validate: true}` kalıbına geçmeyi öner (opsiyonel — eski form çalışıyor)

---

## 8. Test checklist (Forge tarafı)

| # | Senaryo | Beklenti |
|---|---|:---:|
| 1 | Button + `submit`, eksik required → click | onAction çağrılmaz, hata gösterilir |
| 2 | Button + `submit`, form geçerli → click | onAction('submit', formData, command?) |
| 3 | Button + `{dispatch, urn:wf:next}` form eksik → click | onAction çağrılır, validation yok |
| 4 | Button + `{dispatch, urn:wf:next, validate:true}` form eksik → click | onAction çağrılmaz, hata gösterilir |
| 5 | Button + `{dispatch, urn:wf:next, validate:true}` form temiz | onAction çağrılır |
| 6 | Button + `reset` | formData temizlenir, onAction('reset', {}, undefined) |
| 7 | ListTile + `{select, $ui.dialogOpen, true}` → tap | uiState güncellenir, delegate çağrılmaz |
| 8 | Card + custom URN dispatch | onAction(verb, formData, urn) |
| 9 | Designer action picker — reservedActions=[] olan node'da reserved gösterilmiyor | UI gating |
| 10 | Designer — acceptsValidateFlag=false olan node'da Validate checkbox gizli | UI gating |
| 11 | Card legacy `onTap` view JSON'ı yüklendiğinde click hâlâ çalışıyor | Backward compat |
| 12 | Card `action` + `onTap` ikisi de set → click → `action` dispatch ediliyor (onTap ignored) | Precedence |
| 13 | NavigationDrawer items[i].action tıklanınca onAction çağrılır | Item-level wiring |
| 14 | Menu items[i].action tıklanınca onAction çağrılır | Item-level wiring |
| 15 | NavigationDrawer divider/header item'lar click handler taşımaz | Type discrimination |

---

## 9. Açık karar noktaları

- **`reset` semantiği**: SDK formData ve errors'u temizler, host'a `'reset'` event'i atar. Forge bu event'te ne yapmalı? (a) instance data refresh, (b) hiçbir şey, (c) telemetri — domain'e göre değişir.
- **URN registry sahipliği**: Workflow URN'leri kim publish ediyor (workflow engine mi, BFF mi)? Forge bu registry'i her view designer açılışında refresh mi eder yoksa cache mi?
- **Server-side validation error projection**: SDK `setErrors` public API'si yok; Forge bunu kendi state'iyle mi tutar yoksa SDK'ya patch mi ister?
- **`back` / `cancel` standartlaşması**: Forge bunları reserved listede mi tutmak ister yoksa serbest free-form mu (önerilen)?

---

## Özet

SDK action verb'lerine **anlam atfetmez** — `submit`/`select`/`reset` dışında. Forge domain action vocabulary'sini kendi modüllerinden besler ve URN-tabanlı dispatch ile resolve eder. `ActionDescriptor.validate` flag'i ile herhangi bir verb "submit gibi" (validate-then-dispatch) yapılabilir. ViewDesigner action picker'ı `componentMeta.actionCapability` üzerinden gate edilir.

Bu çerçeve SDK'yı **workflow-agnostic** tutar; Forge her domain için ayrı katmanlar (workflow, navigation, integration) tutar ve onları action catalog'ları olarak SDK'ya zerk eder.
