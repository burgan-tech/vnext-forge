# Scope Filter Enum Values — Spec ile Mevcut API Çelişkisi

**Tarih:** 2026-06-19
**Kategori:** correctness
**İlgili Dosya(lar):** `apps/monitoring/src/pages/DefinitionsPage.tsx`

## Durum

`scope` filter parametresi için iki farklı değer seti mevcut:

1. **Mevcut API response** (CLAUDE.md ve `mapToDefinitionListItem`): `D`, `F`, `I` → mapped to `Domain`, `Flow`, `Instance`
2. **Backend design spec örneği**: `scope=global`, `scope=domain` gibi değerler kullanılmış

`DefinitionsPage.tsx`'te `scope` seçenekleri şu an `D`, `F`, `I` olarak ayarlandı — blob'da saklanan değerler bunlar olduğu için `MatchBlobString` ile exact match'in çalışması bekleniyor.

## Şüphe / Risk

Eğer blob'da scope `"Domain"`, `"Flow"`, `"Instance"` (tam isim) veya `"global"`, `"domain"` gibi farklı değerlerle saklanıyorsa, `D`/`F`/`I` göndermek hiçbir sonuç döndürmez (sessiz failure — 400 değil, boş liste).

## Beklenen Onay

Backend ekibinden: `sys-functions` ve `sys-extensions` bloblarında `scope` field'ı hangi değerle saklanıyor? `D`, `F`, `I` mi, yoksa tam isim mi?

## Çözüm (doldurulunca kapatılır)

_Açık_
