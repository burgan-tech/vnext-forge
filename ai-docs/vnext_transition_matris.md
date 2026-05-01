## Workflow Transition Tipleri ve Kullanılabilir Alanlar Matrisi

### Trigger Type Referansı

| Kod | Tip | Açıklama |
|-----|-----|----------|
| 0 | Manual | Kullanıcı tetiklemeli |
| 1 | Auto | Otomatik tetiklemeli |
| 2 | Scheduled | Zamanlayıcı tetiklemeli |
| 3 | Event | Olay tetiklemeli |

---

### 1. State Transition (`transition`) - triggerType'a Gore Alan Matrisi

State icindeki `transitions[]` dizisinde kullanilan transition. **4 farkli triggerType** destekler ve her biri icin farkli alanlar aktif olur:

| Alan | Manual (0) | Auto (1) | Auto Default (1+kind:10) | Scheduled (2) | Event (3) |
|------|:----------:|:--------:|:------------------------:|:--------------:|:---------:|
| **key** | **Zorunlu** | **Zorunlu** | **Zorunlu** | **Zorunlu** | **Zorunlu** |
| **target** | **Zorunlu** | **Zorunlu** | **Zorunlu** | **Zorunlu** | **Zorunlu** |
| **versionStrategy** | **Zorunlu** | **Zorunlu** | **Zorunlu** | **Zorunlu** | **Zorunlu** |
| **triggerType** | **Zorunlu** (=0) | **Zorunlu** (=1) | **Zorunlu** (=1) | **Zorunlu** (=2) | **Zorunlu** (=3) |
| **labels** | **Zorunlu** | **Zorunlu** | **Zorunlu** | **Zorunlu** | **Zorunlu** |
| triggerKind | Opsiyonel | Opsiyonel | **Zorunlu** (=10) | Opsiyonel | Opsiyonel |
| schema | Opsiyonel / null | **null** | **null** | **null** | Opsiyonel / null |
| view | Opsiyonel / null | **null** | **null** | **null** | **null** |
| rule | **null** | **Zorunlu** | Opsiyonel / null | **null** | **null** |
| timer | **null** | **null** | **null** | **Zorunlu** | **null** |
| mapping | Opsiyonel / null | **null** | **null** | **null** | Opsiyonel / null |
| onExecutionTasks | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel |
| roles | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel |
| from | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel |
| _comment | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel |

**Notlar:**
- **null** = alan null olmali veya verilmemeli (schema tarafindan yasaklanmis)
- Auto (1) icin `rule` zorunludur (routing logic icin)
- Auto Default (1 + triggerKind:10) icin `rule` opsiyoneldir (default auto path)
- Scheduled (2) icin `timer` zorunludur
- `view` yalnizca Manual (0) tipinde kullanilabilir

---

### 2. Shared Transition (`sharedTransition`) - triggerType'a Gore Alan Matrisi

Birden fazla state'de gecerli olan paylasilmis transition. State transition ile neredeyse ayni kurallara sahip, ek olarak `availableIn` alani vardir:

| Alan | Manual (0) | Auto (1) | Auto Default (1+kind:10) | Scheduled (2) | Event (3) |
|------|:----------:|:--------:|:------------------------:|:--------------:|:---------:|
| **key** | **Zorunlu** | **Zorunlu** | **Zorunlu** | **Zorunlu** | **Zorunlu** |
| **target** | **Zorunlu** | **Zorunlu** | **Zorunlu** | **Zorunlu** | **Zorunlu** |
| **versionStrategy** | **Zorunlu** | **Zorunlu** | **Zorunlu** | **Zorunlu** | **Zorunlu** |
| **triggerType** | **Zorunlu** (=0) | **Zorunlu** (=1) | **Zorunlu** (=1) | **Zorunlu** (=2) | **Zorunlu** (=3) |
| **labels** | **Zorunlu** | **Zorunlu** | **Zorunlu** | **Zorunlu** | **Zorunlu** |
| triggerKind | Opsiyonel | Opsiyonel | **Zorunlu** (=10) | Opsiyonel | Opsiyonel |
| **availableIn** | **Zorunlu** | **null** | **null** | **null** | **null** |
| schema | Opsiyonel / null | **null** | **null** | **null** | Opsiyonel / null |
| view | Opsiyonel / null | **null** | **null** | **null** | **null** |
| rule | **null** | **Zorunlu** | Opsiyonel / null | **null** | **null** |
| timer | **null** | **null** | **null** | **Zorunlu** | **null** |
| mapping | Opsiyonel / null | **null** | **null** | **null** | Opsiyonel / null |
| onExecutionTasks | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel |
| roles | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel |
| from | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel |
| _comment | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel |

**Onemli fark:** `availableIn` yalnizca Manual (0) tipinde **zorunlu**dur ve hangi state'lerde bu transition'in gecerli olacagini belirtir. Diger trigger tiplerinde `null` olmalidir.

---

### 3. Start Transition (`startTransition`)

Workflow'u baslatan transition. **Yalnizca Manual (triggerType: 0)** destekler:

| Alan | Durum |
|------|-------|
| **key** | **Zorunlu** |
| **target** | **Zorunlu** (Initial state'e isaret etmeli) |
| **triggerType** | **Zorunlu** (sabit = 0, sadece manual) |
| **versionStrategy** | **Zorunlu** |
| **labels** | **Zorunlu** (min 1 item) |
| schema | Opsiyonel / null |
| mapping | Opsiyonel / null |
| onExecutionTasks | Opsiyonel |
| roles | Opsiyonel |

**Desteklenmeyen alanlar:** view, rule, timer, from, availableIn, triggerKind (`additionalProperties: false`)

---

### 4. Cancel Transition (`cancelTransition`)

Workflow'u iptal eden transition. **Yalnizca Manual (triggerType: 0)** destekler:

| Alan | Durum |
|------|-------|
| **key** | **Zorunlu** |
| **target** | **Zorunlu** (hedef state veya `$self`) |
| **triggerType** | **Zorunlu** (sabit = 0, sadece manual) |
| **versionStrategy** | **Zorunlu** |
| **labels** | **Zorunlu** |
| schema | Opsiyonel / null |
| view | Opsiyonel / null |
| mapping | Opsiyonel / null |
| onExecutionTasks | Opsiyonel |
| roles | Opsiyonel |
| availableIn | Opsiyonel |
| from | Opsiyonel |
| _comment | Opsiyonel |

---

### 5. Exit Transition (`exitTransition`)

Workflow'dan cikis transition'i. **Yalnizca Manual (triggerType: 0)** destekler:

| Alan | Durum |
|------|-------|
| **key** | **Zorunlu** |
| **target** | **Zorunlu** (hedef state veya `$self`) |
| **triggerType** | **Zorunlu** (sabit = 0, sadece manual) |
| **versionStrategy** | **Zorunlu** |
| **labels** | **Zorunlu** |
| schema | Opsiyonel / null |
| view | Opsiyonel / null |
| mapping | Opsiyonel / null |
| onExecutionTasks | Opsiyonel |
| roles | Opsiyonel |
| availableIn | Opsiyonel |
| from | Opsiyonel |
| _comment | Opsiyonel |

---

### 6. UpdateData Transition (`updateDataTransition`)

Veriyi guncellemek icin kullanilan transition. **Yalnizca Manual (triggerType: 0)** destekler ve **target daima `$self`** olmalidir:

| Alan | Durum |
|------|-------|
| **key** | **Zorunlu** |
| **target** | **Zorunlu** (sabit = `$self`) |
| **triggerType** | **Zorunlu** (sabit = 0, sadece manual) |
| **versionStrategy** | **Zorunlu** |
| **labels** | **Zorunlu** |
| schema | Opsiyonel / null |
| view | Opsiyonel / null |
| mapping | Opsiyonel / null |
| onExecutionTasks | Opsiyonel |
| roles | Opsiyonel |
| availableIn | Opsiyonel |
| from | Opsiyonel |
| _comment | Opsiyonel |

---

### Ozet Karsilastirma Matrisi (Tum Transition Tipleri)

| Ozellik | State Transition | Shared Transition | Start | Cancel | Exit | UpdateData |
|---------|:----------------:|:-----------------:|:-----:|:------:|:----:|:----------:|
| triggerType 0 (Manual) | Yes | Yes | **Tek** | **Tek** | **Tek** | **Tek** |
| triggerType 1 (Auto) | Yes | Yes | - | - | - | - |
| triggerType 2 (Scheduled) | Yes | Yes | - | - | - | - |
| triggerType 3 (Event) | Yes | Yes | - | - | - | - |
| target: herhangi state | Yes | Yes | Yes | Yes | Yes | - |
| target: `$self` | Yes | Yes | - | Yes | Yes | **Tek** |
| availableIn | - | Yes (manual'de zorunlu) | - | Opsiyonel | Opsiyonel | Opsiyonel |
| view | Manual'de | Manual'de | - | Opsiyonel | Opsiyonel | Opsiyonel |
| rule | Auto'da zorunlu | Auto'da zorunlu | - | - | - | - |
| timer | Scheduled'da zorunlu | Scheduled'da zorunlu | - | - | - | - |
| schema | Manual/Event | Manual/Event | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel |
| mapping | Manual/Event | Manual/Event | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel |
| onExecutionTasks | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel |
| roles | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel | Opsiyonel |
| additionalProperties | Serbest | Serbest | **false** | **false** | **false** | **false** |

**Temel kurallar:**
- `startTransition`, `cancel`, `exit`, `updateData` **yalnizca manual (0)** trigger destekler
- `updateData`'nin target'i **daima `$self`** olmalidir
- `startTransition` en kisitli yapiya sahiptir (view, rule, timer, from, availableIn yok - `additionalProperties: false`)
- State ve Shared transition'lar tum 4 trigger tipini destekler ve triggerType'a gore conditional kurallar devreye girer
- Shared transition'da manual tipinde `availableIn` **zorunludur**