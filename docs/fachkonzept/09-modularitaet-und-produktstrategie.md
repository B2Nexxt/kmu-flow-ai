# Modularität und Produktstrategie

Fachliche **Modularität** der operativen Plattform und Abgrenzung zu **Vertriebsprodukten** (SaaS-Pakete).

**Status:** Verbindlich (Fachkonzept)  
**Bezug:** [`docs/adr/ADR-0012-modulare-fachprozesse.md`](../adr/ADR-0012-modulare-fachprozesse.md), [`docs/produktarchitektur.md`](../produktarchitektur.md), [`docs/plattformmodule-katalog.md`](../plattformmodule-katalog.md)

---

## Architekturprinzip

```
Gemeinsame Plattform
    ├── Plattformkern (Rollen, Aufgaben, KI, Datenbasis, …)
    └── Autark nutzbare Fachmodule
            └── Kombiniert: durchgängiger Gesamtprozess
```

**Der Kunde (Handwerksbetrieb) entscheidet selbst über den Umfang.**

---

## Mögliche Fachmodule (operativ)

| Fachmodul | Kurzbeschreibung |
| --- | --- |
| Anfrage & CRM | Kundenakte, Anfrageprozess |
| Angebote | Kalkulation, Angebotswesen Endkunde |
| Projekte | Auftrag, Ausführung, Abnahme |
| Personal | Einsatz, Qualifikation |
| Material | Bestellung, Lager, Baustelle |
| Finanzen | Rechnung, Zahlung, Liquidität |
| Dokumente | Ablage, Freigabe |
| Unternehmenssteuerung | KPIs, Standards, Reporting |
| KI-Assistenten | Domänenspezifische Assistenz |
| Integrationen | DATEV, Lieferanten, … |

---

## Plattformdienste (Kern)

Gemeinsame Dienste für alle Fachmodule:

| Dienst |
| --- |
| Rollen und Rechte |
| Aufgaben |
| Kalender |
| Dokumente |
| Kommunikation |
| Workflow Engine |
| KI |
| Benachrichtigungen |
| Gemeinsame Datenbasis |

---

## Verbindliche Regeln

| # | Regel |
| --- | --- |
| 1 | **Fachmodule können einzeln funktionieren** — Minimalnutzung ohne Vollsuite |
| 2 | **Bei Kombination: gleicher Prozess und Datenbestand** — keine erneute Erfassung |
| 3 | **Nachträglich gebuchte Module** verwenden **vorhandene Daten** |
| 4 | **Keine erneute Datenmigration beim Upgrade** |
| 5 | **Kunde darf Teilschritte oder Gesamtplattform nutzen** |
| 6 | **Vermarktung problem- und nutzenorientiert** — nicht technisch by module list |
| 7 | **Technische Module ≠ vertriebliche Produkte/Pakete** — siehe Abgrenzung unten |

---

## Drei Ebenen — Abgrenzung (verbindlich)

| Ebene | Zweck | Dokumentation | Beispiel |
| --- | --- | --- | --- |
| **Fachmodule** | Operative Domänen im Handwerksbetrieb | Dieses Dokument | „Projekte“, „Material“ |
| **Plattformmodule** | Technische Lizenz-Einheiten (Feature-Gates) | [`docs/plattformmodule-katalog.md`](../plattformmodule-katalog.md) | `crm`, `dokumente` |
| **Produkte/Pakete** | Verkauf an Mandanten (SaaS) | [`docs/produktarchitektur.md`](../produktarchitektur.md) | Basispaket, KI-Paket |

Ein **Vertriebsprodukt** (Paket) kann **mehrere Plattformmodule** freischalten; **Fachmodule** sind die fachliche Gliederung **innerhalb** der operativen Plattform nach Lizenzierung.

Mapping Fachmodul ↔ Plattformmodul: **noch nicht verbindlich festgelegt**.

---

## Ist-Zustand

| Aspekt | Status |
| --- | --- |
| Mandanten-Onboarding mit Modul-Checkboxen | ✅ Ist — wird durch Lizenzmodell abgelöst (Ziel) |
| `leistungsmodule` | Zwischenlösung — **abzulösen**, keine neue UI |
| Operative Fachmodule | **Nicht implementiert** |
| Produktkatalog SaaS | Phase 0 fachlich dokumentiert |

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-26 | Erstversion |
