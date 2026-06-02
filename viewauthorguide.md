# Pseudo UI View Author Guide

> **Audience**: View JSON yazanlar — Forge ViewDesigner kullanıcıları, BFF/backend ekipleri, AI co-author skill'i.
> **Goal**: Doğru `view.json` + `schema.json` yapısının kuralları, action vocabulary, expression namespace, yaygın pattern'ler.

Bu döküman view-driven UI'yi tasarlarken karar verilen "nasıl"ları içerir. Component reference değil, **pattern guide**.

---

## 1. Temel mental model

```
Ekran = f(schema, view, data)
```

- **schema.json** = veri kontratı + iş kuralları (alan tipi, validasyon, LOV, conditional, multi-lang label'lar)
- **view.json** = görsel düzenleme (component ağacı, bind hedefleri, action'lar)
- **data** = runtime'da gelir (`formData` kullanıcı dolduracak, `instanceData` BFF'ten zenginleştirme)

İki dosya **bağımsız tasarlanır**: schema'yı backend/analist yazar, view'i UI/UX tasarımcısı yazar. Schema'da tanımlı validation/LOV/lookup view'da **otomatik çalışır** — view author bunları tekrar yazmaz.

---

## 2. Schema authoring — neyi nereye koyarım?

### 2.1 Alan tipi + label

```json
{
  "firstName": {
    "type": "string",
    "minLength": 2,
    "x-labels": { "en": "First name", "tr": "Ad" },
    "x-errorMessages": {
      "required": { "en": "Required", "tr": "Zorunlu" },
      "minLength": { "en": "Too short", "tr": "Çok kısa" }
    }
  }
}
```

- `type` + JSON Schema standart kuralları (minLength/pattern/min/max/format)
- `x-labels` — multi-lang field label (input'larda otomatik gösterilir)
- `x-errorMessages` — validation kuralı bazında özel mesaj (`required`, `minLength`, `pattern`, `min`, `max`, `format`)

### 2.2 Enum dropdown

```json
{
  "currency": {
    "type": "string",
    "enum": ["TRY", "USD", "EUR"],
    "x-enum": {
      "TRY": { "en": "Turkish Lira",  "tr": "Türk Lirası" },
      "USD": { "en": "US Dollar",     "tr": "ABD Doları" },
      "EUR": { "en": "Euro",          "tr": "Euro" }
    }
  }
}
```

Dropdown render'ında SDK otomatik bind eder. View'da sadece: `{ "type": "Dropdown", "bind": "currency" }`.

### 2.3 Uzaktan dropdown (LOV)

```json
{
  "city": {
    "type": "string",
    "x-lov": {
      "source": "urn:amorphie:func:domain:shared:get-cities",
      "valueField": "$.response.data[*].code",
      "displayField": "$.response.data[*].name",
      "filter": [
        { "param": "countryCode", "value": "$form.country", "required": true }
      ]
    }
  }
}
```

- `source`: URN/URL (host resolver'ı çözecek)
- `valueField`, `displayField`: JsonPath (array path + item key)
- `filter[].value`: `$form.x`, `$instance.x`, `$param.x` veya sabit
- `required: true` → param çözülemezse LOV yüklenmez (cascade temizlenir)

Cascade: `country` değişince `city` LOV'u otomatik yenilenir, eski seçim sıfırlanır.

### 2.4 Read-only enrichment (Lookup)

View-level. View JSON'a:

```json
{ "$schema": "...", "dataSchema": "...", "lookups": ["branchDetail"], "view": ... }
```

Schema'da:
```json
{
  "branchCode": {
    "type": "string",
    "x-lookup": {
      "source": "urn:amorphie:func:branch:get-detail",
      "resultField": "$.response.data",
      "filter": [{ "param": "code", "value": "$form.branchCode" }]
    }
  }
}
```

View'da `$lookup.branchDetail.address`, `$lookup.branchDetail.phone` referansları ile okunur — input bind hedefi DEĞİL, sadece gösterim için.

### 2.5 Conditional visibility / enable

```json
{
  "spouseName": {
    "type": "string",
    "x-conditional": {
      "showIf":   { "field": "maritalStatus", "operator": "equals", "value": "married" },
      "enableIf": { "allOf": [
        { "field": "age", "operator": "greaterThan", "value": 18 },
        { "field": "consent", "operator": "equals", "value": true }
      ]}
    }
  }
}
```

Operatörler: `equals`, `notEquals`, `in`, `notIn`, `greaterThan`, `lessThan`, `greaterOrEqual`, `lessOrEqual`, `contains`, `notContains`, `isEmpty`, `isNotEmpty`, `matches` (regex).
Compound: `allOf`, `anyOf`, `not`.

`showIf`/`hideIf` → görünürlük; `enableIf`/`disableIf` → input etkin/pasif.

### 2.6 Custom async validation

```json
{
  "tcNo": {
    "type": "string",
    "pattern": "^[0-9]{11}$",
    "x-validation": {
      "rule": "tckn-checksum",
      "errorMessages": { "tr": "Geçersiz TC", "en": "Invalid TC" }
    }
  }
}
```

`delegate.onValidationRequest(field, value, formData)` async olarak çağrılır, host hata string'i veya `null` döner. Schema-level pattern + length kontrolünden sonra çalışır.

---

## 3. View authoring — node tipleri

### 3.1 Layout

- `Column` (dikey), `Row` (yatay), `Wrap` (taşan satırlar)
- `Grid` (`columns: N`)
- `Stack` (z-eksen üst üste)
- `Center`, `Spacer`, `Expanded` (Row/Column içinde flex)
- `ScrollView`

Hepsi `children: ComponentNode[]` taşır. `gap: 'xs' | 'sm' | 'md' | 'lg' | 'xl'` ile aralık.

### 3.2 Container

- `Card` (variant: elevated/filled/outlined) — `action`/`onTap` ile tıklanabilir
- `Stepper` (`steps[].content`)
- `TabView` (`tabs[].content`)
- `ExpansionPanel`
- `Dialog`, `BottomSheet`, `SideSheet` — `visible: '$ui.xKey'` ile state'e bağlı
- `Tooltip`

### 3.3 Input (her biri `bind` taşır)

- `TextField`, `TextArea`, `SearchField`, `NumberField`
- `Dropdown`, `AutoComplete`, `RadioGroup`, `SegmentedButton`
- `Checkbox`, `Switch`
- `DatePicker`, `TimePicker`
- `Slider`

`bind`: schema property path (örn. `firstName` ya da `address.city`).

### 3.4 Display

- `Text` (`content`, `variant`)
- `Icon` (`name`)
- `Image`, `Avatar`, `Badge`, `Chip`
- `ListTile` (`leading`, `title`, `subtitle`, `trailing`, `onTap`)
- `RichText`
- `Snackbar`
- `ProgressIndicator`, `LoadingIndicator`

### 3.5 Action

- `Button`, `IconButton`, `FAB`

### 3.6 Control flow

- `ForEach` (`source`, `as`, `template`) — array iteration
- `Carousel` — `source` + `template`
- `Component` — nested view by ref (`loadComponent` ile)

---

## 4. Action model — view author cheat sheet

### Hangi node'da hangi prop'a action konur?

| Node | Prop | Tip | Not |
|---|---|---|---|
| `Button`, `IconButton`, `FAB` | `action` (+ opsiyonel `command`) | `string \| ActionDescriptor` | Primary action node'u |
| `Card` | `action` (preferred) / `onTap` (legacy) | `ActionDescriptor \| ActionDescriptor[]` | Tıklanabilir surface |
| `ListTile` | `onTap` | `ActionDescriptor \| ActionDescriptor[]` | Liste satırı |
| `Snackbar` | `action` (inline button) | `ActionDescriptor` | Mesaj barı butonu |
| `NavigationDrawer.items[i]` | `action` | `ActionDescriptor` | Her item kendi action'ı |
| `Menu.items[i]` | `action` | `ActionDescriptor` | Her item kendi action'ı |
| Form input'ları (`TextField` vd.) | — | — | Action yok; `bind` ile formData'ya yazar |

**Üç reserved verb** (SDK içinde özel davranır):

| Verb | Davranış | Validation? |
|---|---|:---:|
| `'submit'` | Validate-then-dispatch | ✅ |
| `'reset'` | formData temizle, host'a `'reset'` event'i | – |
| `{action:'select', bind, value}` | Field/UI state inline set, **host çağrılmaz** | – |

**Geri kalan her şey** = domain dispatch. SDK pas geçer, host (Forge) yorumlar.

### 4.1 Sık kullanılan pattern'ler

#### Form gönderimi
```json
{ "type": "Button", "label": "Submit", "action": "submit", "command": "save-account" }
```

#### Workflow transition (validation gerekli)
```json
{ "type": "Button", "label": "Continue",
  "action": "dispatch",
  "command": "urn:amorphie:wf:account-opening:transition:next-step",
  "validate": true }
```

#### Workflow transition (validation gereksiz — örn. geri)
```json
{ "type": "Button", "label": "Back", "variant": "text",
  "action": "dispatch",
  "command": "urn:amorphie:wf:account-opening:transition:back" }
```

#### Dialog aç (UI state)
```json
{ "type": "Button", "label": "Edit",
  "action": { "action": "select", "bind": "$ui.editDialogOpen", "value": true } }
```

#### Card seçimi (sub-flow başlatıcı)
```json
{ "type": "Card", "variant": "outlined",
  "action": { "action": "dispatch",
              "command": "urn:amorphie:wf:account-opening:transition:select-deposit" },
  "children": [ { "type": "Text", "content": "Vadesiz Mevduat" } ] }
```

> Card hem `action` (önerilen) hem de `onTap` (legacy alias) prop'unu kabul eder; ikisi de varsa `action` kazanır. Yeni view yazarken `action` kullan.

#### NavigationDrawer / Menu per-item action
NavigationDrawer ve Menu **node-level action taşımaz**; her item kendi `action` field'ını taşır:

```json
{ "type": "NavigationDrawer",
  "visible": "$ui.drawerOpen",
  "items": [
    { "label": { "tr": "Hesaplar", "en": "Accounts" }, "icon": "account_balance",
      "action": { "action": "navigate", "command": "urn:forge:nav:/accounts" } },
    { "divider": true },
    { "header": { "tr": "Ayarlar", "en": "Settings" } },
    { "label": { "tr": "Profil", "en": "Profile" }, "icon": "person",
      "action": { "action": "navigate", "command": "urn:forge:nav:/profile" } }
  ]
}
```

Item üç türde olabilir:
- **Tappable**: `{ label, icon?, badge?, action }` — tıklanır, action fires
- **Divider**: `{ divider: true }` — yatay çizgi
- **Header**: `{ header: "..." }` — bölüm başlığı, tıklanmaz

`Menu` aynı pattern'i kullanır (`items: [{ label, icon, action }]`).

#### ListTile navigasyon
```json
{ "type": "ListTile", "title": "Accounts",
  "onTap": { "action": "navigate", "command": "urn:forge:nav:/accounts" } }
```

#### Form reset
```json
{ "type": "Button", "label": "Clear", "variant": "text", "action": "reset" }
```

#### Çoklu action (sırasıyla)
```json
{ "type": "Button", "label": "Save & Close",
  "action": [
    { "action": "submit" },
    { "action": "select", "bind": "$ui.dialogOpen", "value": false }
  ] }
```

### 4.2 `validate` flag — karar matrisi

| Durum | Verb | validate | Sebep |
|---|---|:---:|---|
| Klasik submit | `submit` | (default ✅) | Backend'e tam veri gönderiyoruz |
| Save draft | `submit` | ❌ override | Eksik form kabul edilir |
| WF "Continue" | `dispatch` | ✅ override | Eksik veriyle ileri gidemezsin |
| WF "Back" | `dispatch` | (default ❌) | Geri butonu validation istemez |
| Cancel | `cancel` | (default ❌) | İptal validation istemez |
| Navigation | `navigate` | (default ❌) | Sayfa değişimi validation istemez |
| Reset | `reset` | (n/a) | SDK içinde halledilir |

### 4.3 URN konvansiyonu (önerilen)

```
urn:amorphie:wf:<flow-name>:transition:<state>     # workflow geçiş
urn:amorphie:func:<domain>:<function>              # BFF function
urn:forge:nav:<route>                              # navigation
urn:tenant:<tenant>:<custom>                       # tenant-specific
```

Action picker'da bu prefix'lere göre grupla.

---

## 5. Expression namespace cheat sheet

View JSON'da string değer alanlarında `$...` ile expression yazabilirsin:

| Prefix | Anlam | Örnek |
|---|---|---|
| `$form.x` | formData[x] (mutable, input bind hedefi) | `"content": "$form.firstName"` |
| `$instance.x` | instanceData[x] (read-only) | `"content": "$instance.customerId"` |
| `$param.x` | Nested component'e gelen param | `"content": "$param.size"` |
| `$ui.x` | uiState (transient: dialog visibility, active tab) | `"visible": "$ui.dialogOpen"` |
| `$lov.x` | LOV array'i (yüklü item'lar) | `"content": "$lov.city"` |
| `$lookup.x.y` | Lookup objesi alanı | `"content": "$lookup.branchDetail.address"` |
| `$schema.x.label` | Schema alan label'ı | `"content": "$schema.firstName.label"` |
| `$item` | ForEach iteration value | `"content": "$item.name"` |
| `$context.x` | Custom delegate context | – |

### 5.1 Multi-language content

Tüm `content`, `label`, `title`, `description` alanları **string** veya **multi-lang object** alır:

```json
"content": { "en": "Welcome", "tr": "Hoş geldiniz" }
```

`lang` prop'una göre otomatik seçilir.

---

## 6. ForEach pattern

```json
{
  "type": "ForEach",
  "source": "$form.addresses",
  "as": "addr",
  "template": {
    "type": "Card",
    "children": [
      { "type": "Text", "content": "$item.label" },
      { "type": "TextField", "bind": "addresses[$index].street" }
    ]
  }
}
```

`$item` template scope'unda iteration value. `$index` index. `bind` içinde array path konvansiyonu.

Designer mode'da boş source'larda template **bir kez** render edilir (preview için).

---

## 7. Nested component pattern

```json
{
  "type": "Component",
  "ref": "address-block",
  "bind": { "value": "$form.homeAddress" }
}
```

SDK `delegate.loadComponent('address-block')` çağırır, gelen `{ schema, view }` çiftini render eder. `bind` ile parent → child data flow (child kendi formData'sını parent'ın bir slice'ına bind eder).

Child view'da `$param.value` ile parent'tan gelen veri okunur, `$form.x` ile local input'lar yazılır, parent'a sync edilir.

---

## 8. Yaygın hatalar / antipattern'ler

| ❌ | ✅ | Sebep |
|---|---|---|
| `"action": "transition"` (SDK reserved sanılarak) | `"action": "dispatch", "command": "urn:wf:...", "validate": true` | `transition` SDK için anlamsız; URN ile dispatch |
| `"bind": "$form.firstName"` (input'ta `$form.` prefix) | `"bind": "firstName"` | Input bind'i schema property path; `$form.` sadece expression'larda |
| `validate: true` her butonda | Sadece submit-like akışlarda | Navigation/cancel/back validation istemez |
| Schema'da `enum` ama view'da hardcoded options | Schema'da `enum` + `x-enum`, view'da sadece `{type:'Dropdown', bind:...}` | Tek kaynak — i18n + validasyon ücretsiz |
| Inline `if/else` JSX'i | Schema'da `x-conditional` | Logic veri katmanında olmalı |
| Schema'da pattern, view'da custom regex check | Sadece schema'da | View domain bilmemeli |
| Action her button için aynı | Verb + command ile semantically isimle | Host switch'i kolaylaşır |
| Yeni view'da Card için `onTap` kullanmak | `action` kullan | `onTap` legacy alias; yeni yazarken `action` tercih edilir |
| NavigationDrawer'a tek node-level action | Her item'da kendi `action` | NavigationDrawer item bazlı çalışır |

---

## 9. AI co-author kuralları

Bu guide AI skill'ine eklendiğinde co-author'un takip etmesi gereken sıra:

1. **Önce schema oluştur**: tüm alanlar `type`, `x-labels`, gerekirse `enum`/`x-enum`/`x-lov`/`x-lookup`/`x-conditional`/`x-validation`. Validation rule'ları burada bitir.
2. **Sonra view yaz**: layout (Column/Row/Card/...) → input'lar bind ile → en altta action button(lar).
3. **Action seçerken**: önce reserved (`submit`/`reset`) düşün; gerekiyorsa domain dispatch (`{action: 'dispatch', command: 'urn:...'}`); validate flag'i sadece veriyi backend'e gönderen akışlarda `true`.
4. **`$form` prefix'i input bind'inde kullanma** — sadece expression'larda.
5. **Multi-lang**: her görünür string için `{en, tr, ...}` objesi (sample dil set'i tenant config'inden gelir).
6. **Nested component için `Component` node + `loadComponent` delegate fonksiyonu** — child view'lar `$param.x` ile bind alır.
7. **Tema veya stil zorlama** — SDK'nın CSS variable'larını üstten override etmek dışında inline style yazma. Component ağacı semantically tanımlanır, görünüm tema'dan gelir.

### 9.1 Code review checklist

AI generated view'larda kontrol edilecekler:

- [ ] Her input'un `bind`'i schema'da tanımlı?
- [ ] Schema'da `enum` tanımlıysa view'da hardcoded options yok?
- [ ] Required alanlar `Button.action === 'submit'` butonu ile gönderiliyor?
- [ ] Workflow transition butonlarında `validate: true` (gerekiyorsa)?
- [ ] URN command'leri host'un known registry'sinde?
- [ ] Multi-lang content'ler tüm desteklenen dilleri içeriyor?
- [ ] `$ui.x` state'leri Dialog/Drawer için tanımlı?
- [ ] Conditional kurallar `x-conditional`'da (view'da JS değil)?

---

## 10. Hızlı referans — minimal form

```jsonc
// schema.json
{
  "$id": "demo:contact",
  "type": "object",
  "required": ["name", "email"],
  "properties": {
    "name":  { "type": "string", "minLength": 2, "x-labels": { "tr": "Ad", "en": "Name" } },
    "email": { "type": "string", "format": "email", "x-labels": { "tr": "E-posta", "en": "Email" } },
    "topic": {
      "type": "string",
      "enum": ["billing", "tech", "other"],
      "x-enum": {
        "billing": { "tr": "Faturalama", "en": "Billing" },
        "tech":    { "tr": "Teknik",     "en": "Technical" },
        "other":   { "tr": "Diğer",      "en": "Other" }
      }
    },
    "message": { "type": "string", "maxLength": 500, "x-labels": { "tr": "Mesaj", "en": "Message" } }
  }
}

// view.json
{
  "$schema": "https://amorphie.io/meta/view-vocabulary/1.0",
  "dataSchema": "demo:contact",
  "view": {
    "type": "Column",
    "gap": "md",
    "children": [
      { "type": "Text", "content": { "tr": "İletişim", "en": "Contact us" }, "variant": "headlineMedium" },
      { "type": "TextField", "bind": "name" },
      { "type": "TextField", "bind": "email" },
      { "type": "Dropdown",  "bind": "topic" },
      { "type": "TextArea",  "bind": "message" },
      { "type": "Row", "gap": "sm", "children": [
        { "type": "Button", "label": { "tr": "Temizle", "en": "Reset" }, "variant": "text", "action": "reset" },
        { "type": "Button", "label": { "tr": "Gönder",  "en": "Send"  }, "action": "submit", "command": "submit-contact" }
      ]}
    ]
  }
}
```

Bu form: 4 alan, full validation, multi-lang, reset + submit. Sıfır kod.
