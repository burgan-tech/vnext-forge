# vnext-flow-studio-web

vnext-runtime engine için standalone workflow geliştirme platformu.

## Nedir?

Geliştiricilerin ve iş analistlerinin:
- UI'da domain/proje oluşturmasını
- Flow'ları görsel olarak tasarlamasını
- Mapping, condition, task, schema, view, function, extension düzenlemesini
- İsterse lokal runtime'a bağlanıp test etmesini
- Projeyi vnext yapısında export etmesini (TFS/Git uyumlu)

sağlayan bir web uygulaması.

## Çalışma Modları

- **Standalone**: Sadece tasarım + export (runtime opsiyonel)
- **Connected**: Lokal runtime'a bağlanıp test/monitor

## Proje Yapısı

```
vnext-flow-studio-web/
├── apps/
│   ├── web/          # React frontend (port 3000)
│   └── server/       # BFF server (port 3001)
├── packages/
│   └── vnext-types/  # Paylaşımlı TypeScript tipleri
├── PROGRESS.md       # İlerleme takip dosyası
└── README.md         # Bu dosya
```

## Başlarken

```bash
# Bağımlılıkları yükle
pnpm install

# Geliştirme sunucusu (web + server)
pnpm dev

# Build
pnpm build
```

## Referans Projeler

| Proje | Konum | Açıklama |
|-------|-------|----------|
| vnext-runtime | ../vnext-runtime | Workflow engine |
| vnext-flow-studio | ../vnext-flow-studio | VS Code extension (mevcut) |
| vnext-messaging-gateway | ../vnext-messaging-gateway | Örnek domain projesi |
| morph-idm-master | ../morph-idm-master | Örnek domain projesi (karmaşık) |

## Desteklenen vnext-runtime Bileşenleri

- **Workflow Tipleri**: Flow (F), SubFlow (S), SubProcess (P), Core (C)
- **State Tipleri**: Initial (1), Intermediate (2), Final (3), SubFlow (4), Wizard (5)
- **State SubType**: None, Success, Error, Terminated, Suspended, Busy, Human
- **Transition Tipleri**: Manual (0), Automatic (1), Scheduled (2), Event (3)
- **Task Tipleri**: Http (6), DaprPubSub (4), DaprService (3), DaprBinding (7), Script (5), Start (11), DirectTrigger (12), GetInstanceData (13), SubProcess (14), GetInstances (15), HumanTask
- **Mapping Arayüzleri**: IMapping, IConditionMapping, ITimerMapping, ITransitionMapping, ISubFlowMapping, ISubProcessMapping
- **View Stratejileri**: full-page, popup, bottom-sheet, top-sheet, drawer, inline
- **Extension Tipleri**: Global, GlobalAndRequested, DefinedFlows, DefinedFlowAndRequested
- **Function Scope'ları**: Instance (I), Workflow (F), Domain (D)
- **Error Boundary**: Abort, Retry, Rollback, Ignore, Notify, Log
