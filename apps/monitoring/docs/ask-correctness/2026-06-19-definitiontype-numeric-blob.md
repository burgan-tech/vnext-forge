# definitionType Filter — Numeric Blob Field ve MatchBlobString Uyumsuzluğu

**Tarih:** 2026-06-19
**Kategori:** correctness
**İlgili Dosya(lar):** `apps/monitoring/src/pages/DefinitionsPage.tsx`

## Durum

`sys-tasks` ve `sys-views` bloblarındaki `type` field'ı frontend'de numeric olarak işleniyor:

```typescript
// mapToDefinitionListItem — definitions-queries.ts
const rawType = item.type;
const numericType = typeof rawType === 'number' ? rawType : parseInt(String(rawType), 10);
```

Bu, blob'da `"type": 1` şeklinde number olarak saklandığına işaret ediyor.

Backend'in yeni `MonitorComponentFilter.Apply` implementasyonundaki `MatchBlobString`:

```csharp
private static bool MatchBlobString(JsonElement blob, string property, string value)
{
    if (!blob.TryGetProperty(property, out var el)) return false;
    if (el.ValueKind != JsonValueKind.String) return false;  // ← number için false döner!
    return string.Equals(el.GetString(), value, StringComparison.OrdinalIgnoreCase);
}
```

Eğer `type` field'ı JSON'da `Number` olarak saklanıyorsa `el.ValueKind != JsonValueKind.String` koşulu `true` olur ve metot `false` döner → `definitionType` filtresi hiçbir zaman eşleşmez.

## Şüphe / Risk

`sys-tasks` için `definitionType=1`, `sys-views` için `definitionType=1` gibi filterlar gönderildiğinde sonuç her zaman boş gelir (sessiz failure — 400 değil, 0 item).

## Beklenen Onay

Backend ekibinden:
1. `sys-tasks` ve `sys-views` blob'larında `type` field'ı JSON Number mı, JSON String mi?
2. Eğer Number ise, `MatchBlobString` yerine `MatchBlobNumber` (veya her ikisini deneyen) bir metot kullanılmalı mı?

## Çözüm (doldurulunca kapatılır)

_Açık_
