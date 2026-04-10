# apps/web Shadcn Component Kullanım Raporu

Tarih: 2026-04-03

## Kısa Sonuç

- `apps/web` içinde standart bir shadcn kurulumu yok.
- `apps/web/src/components/ui` klasörü bulunmuyor.
- `@/components/ui/*` import'u yok.
- Doğrudan Radix kullanımı yalnızca bir yerde tespit edildi: `apps/web/src/project/ImportDialog.tsx`.
- Buna karşılık proje içinde güçlü biçimde tekrar kullanılan yerel paylaşılan component'ler var. Bunların bir kısmı genel UI katmanına çıkarılmaya uygun.

## 1. Doğrudan shadcn / Radix Kullanımı

### Tespit edilen kullanım

1. `apps/web/src/project/ImportDialog.tsx`
   - `@radix-ui/react-dialog` doğrudan kullanılıyor.
   - Dialog overlay, content, header ve footer yapısı dosya içinde elle stillenmiş.

### Paket düzeyinde mevcut altyapı

`apps/web/package.json` içinde şu Radix paketleri mevcut:

- `@radix-ui/react-context-menu`
- `@radix-ui/react-dialog`
- `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-popover`
- `@radix-ui/react-select`
- `@radix-ui/react-separator`
- `@radix-ui/react-tabs`
- `@radix-ui/react-tooltip`

Ek olarak shadcn ekosisteminde sık görülen bazı bağımlılıklar da mevcut:

- `cmdk`
- `lucide-react`

### Değerlendirme

Altyapı paketleri eklenmiş olsa da repo içinde shadcn’in tipik kullanım şekli olan ortak `ui/*` wrapper katmanı bulunmuyor. Mevcut durum daha çok:

- tekil Radix kullanımı
- proje-içi özel component seti

üzerine kurulu.

## 2. Mevcut Paylaşılan Component'ler

Bu component’ler zaten proje içinde tekrar kullanılıyor ve fiilen ortak katman görevi görüyor.

### Güçlü adaylar

1. `apps/web/src/components/Field.tsx`
   - En yaygın kullanılan form alanı sarmalayıcısı.
   - Label, yardımcı metin ve alan yerleşimi için temel primitive olmaya uygun.

2. `apps/web/src/components/TagEditor.tsx`
   - Birden fazla editörde tekrar kullanılıyor.
   - Genel amaçlı chip/tag input bileşeni olarak ayrıştırılabilir.

3. `apps/web/src/components/JsonCodeField.tsx`
   - Birçok form ve editörde tekrar kullanılıyor.
   - Genel amaçlı “kod/json alanı” primitive’i olmaya uygun.

4. `apps/web/src/components/LabelEditor.tsx`
   - Çoklu dil veya etiket listesi benzeri yapılarda ortak editor olarak kullanılabilir.

5. `apps/web/src/components/KVEditor.tsx`
   - Anahtar/değer listesi düzenleme ihtiyacını karşılıyor.
   - Genel “dictionary editor” primitive’i olabilir.

6. `apps/web/src/components/ComponentEditorLayout.tsx`
   - Farklı editör sayfalarında ortak shell olarak kullanılıyor.
   - Domain dışı, yüksek seviyeli bir page-layout primitive’i sayılabilir.

### Daha domain odaklı ama tekrar kullanılanlar

1. `apps/web/src/components/SchemaReferenceField.tsx`
   - Referans seçme / gösterme kartı mantığı tekrar kullanılabilir.
   - Şu an schema odaklı.

2. `apps/web/src/components/ResourceReferenceField.tsx`
   - Referans tanımlama formu olarak yeniden kullanılabilir.
   - Domain bilgisi içeriyor ama yapısı genelleştirilebilir.

3. `apps/web/src/components/CsxEditorField.tsx`
   - Script alanı açma, özet gösterme, düzenleme akışı sağlıyor.
   - Benzer “external editor trigger” pattern’leri için temel olabilir.

4. `apps/web/src/components/TaskExecutionList.tsx`
5. `apps/web/src/components/TaskExecutionForm.tsx`
   - Ortak kullanım var ama daha çok task execution domain’ine bağlı.

## 3. Kullanım Yoğunluğu Olan Yerel Component'ler

### `Field`

Yaygın kullanım alanları:

- error-boundary
- extension-editor
- view-builder
- task-editor
- timer
- schema-editor
- function-editor

Sonuç:

- Projedeki en güçlü form primitive adayı.
- Eğer shadcn katmanı kurulacaksa `Field` ile beraber `Input`, `Textarea`, `Select`, `Checkbox` benzeri ortak primitive’ler aynı tasarım dili altında toparlanmalı.

### `TagEditor`

Kullanıldığı başlıca yerler:

- `ErrorHandlerForm`
- `ExtensionMetadataForm`
- `ViewEditorPanel`
- `TaskMetadataForm`
- `SchemaMetadataForm`
- `FunctionMetadataForm`

Sonuç:

- Metadata düzenleme akışlarında standart hale gelmiş.
- Genel UI bileşeni olarak ayrıştırılmaya uygun.

### `JsonCodeField`

Kullanıldığı başlıca yerler:

- view editor
- task formları
- schema editor

Sonuç:

- Kod/json editörü ihtiyacının ortak cevabı haline gelmiş.
- Genel editor primitive seti içinde yer almalı.

## 4. Genel UI Component Olmaya Aday Yapılar

Bu bölüm mevcut tekrarları ve lokal helper’ları değerlendirir. Bunlar henüz ortak katmana alınmamış ama alınmaları mantıklı görünüyor.

### A. `apps/web/src/canvas/panels/property-panel/shared.tsx`

Bu dosya en güçlü adaylardan biri. İçinde birçok genel UI pattern’i var:

- `EditableInput`
- `SelectField`
- `Badge`
- `Section`
- `InfoRow`
- `CodePreview`
- `ResourceRef`
- `LabelList`
- `SummaryCard`

Değerlendirme:

- Dosya adı “shared” olsa da kullanım alanı panel scope’u ile sınırlı.
- İçerdiği primitive’lerin önemli bir kısmı gerçek anlamda genel UI layer’a çıkarılabilir.
- Özellikle `Badge`, `Section`, `InfoRow`, `SummaryCard`, `CodePreview` benzeri yapılar farklı ekranlarda tekrar üretilebilir durumda.

### B. `apps/web/src/project/ImportDialog.tsx`

Bu dosya yalnızca Radix dialog kullanmıyor, aynı zamanda proje için potansiyel ortak modal yapısını da taşıyor:

- overlay
- content shell
- title area
- aksiyon footer’ı
- toolbar / arama yerleşimi

Değerlendirme:

- Yeni dialog'lar eklendikçe aynı yapı tekrar yazılabilir.
- Buradan `DialogShell`, `DialogHeader`, `DialogFooter`, `ModalBody` benzeri ortak parçalar çıkarılabilir.

### C. Tekrarlanan form primitive eksikleri

Çok sayıda dosyada benzer class’larla yazılmış:

- `input`
- `select`
- `textarea`
- `button`
- küçük badge/chip yapıları
- section/card kutuları

Değerlendirme:

- Ortak bir `Button`, `Input`, `Textarea`, `Select`, `Card`, `Section`, `Badge` katmanı eksik.
- Bugünkü yapı, stil tekrarını component seviyesinde değil dosya seviyesinde çözüyor.

### D. Yerel `Section` pattern’leri

Özellikle şu bölgelerde section/collapsible/card benzeri yapılar tekrar ediyor:

- `apps/web/src/canvas/panels/property-panel/shared.tsx`
- `apps/web/src/canvas/panels/WorkflowMetadataPanel.tsx`

Değerlendirme:

- Tek bir ortak “panel section” veya “editor section” bileşeni ile sadeleştirilebilir.

## 5. Önerilen Sınıflandırma

Eğer `apps/web` için shadcn benzeri düzenli bir UI katmanı kurulacaksa component’leri şu gruplara ayırmak mantıklı:

### Temel UI primitive’ler

- `Button`
- `Input`
- `Textarea`
- `Select`
- `Dialog`
- `Badge`
- `Card`
- `Separator`
- `Tabs`
- `Tooltip`

### Form ve editor primitive’leri

- `Field`
- `Section`
- `CodePreview`
- `JsonCodeField`
- `KVEditor`
- `TagEditor`
- `LabelEditor`

### Reference / summary pattern’leri

- `SchemaReferenceField`
- `ResourceReferenceField`
- `SummaryCard`
- `InfoRow`

### Sayfa shell’leri

- `ComponentEditorLayout`

## 6. Net Bulgular

1. `apps/web` içinde aktif, standartlaştırılmış bir shadcn component katmanı yok.
2. Radix bağımlılıkları ekli ama pratikte yalnızca `ImportDialog.tsx` içinde doğrudan kullanım tespit edildi.
3. Proje kendi paylaşılan UI/form bileşenlerini üretmiş durumda.
4. `Field`, `TagEditor`, `JsonCodeField`, `KVEditor`, `LabelEditor`, `ComponentEditorLayout` mevcut en güçlü ortaklaştırma adayları.
5. `apps/web/src/canvas/panels/property-panel/shared.tsx` içindeki yapılar ayrı bir ortak UI katmanına çıkarılabilecek en yoğun aday kümesini oluşturuyor.

## 7. Önceliklendirilmiş Aday Liste

En önce ortaklaştırılabilecek yapılar:

1. `Field`
2. `Button` benzeri tekrar eden inline buton stilleri
3. `Input` / `Textarea` / `Select` primitive’leri
4. `Section` / `Card` / `SummaryCard`
5. `Dialog` shell (`ImportDialog` tabanlı)
6. `TagEditor`
7. `KVEditor`
8. `JsonCodeField`

## 8. Sonuç

Bu repo’da soru “hangi shadcn component’leri kullanılıyor?” olduğunda kısa cevap:

- standart shadcn component kullanımı yok
- tekil Radix dialog kullanımı var
- asıl ortak katman proje-içi özel component’lerden oluşuyor

Dolayısıyla bir sonraki mantıklı adım, mevcut tekrar eden primitive’leri `ui` katmanında toplamak ve varsa Radix/shadcn tabanını bu yapıya kontrollü biçimde oturtmak olur.
