# Grundprinzipien — operative Arbeitsplattform

Verbindliche **fachliche Grundsätze** für Aufbau und Entwicklung der operativen Handwerksplattform.

**Status:** Verbindlich (Fachkonzept)  
**Bezug:** [`docs/grundprinzipien.md`](../grundprinzipien.md) (plattformweit), [`docs/fachkonzept/01-philosophie.md`](./01-philosophie.md)

> **Hinweis:** [`docs/grundprinzipien.md`](../grundprinzipien.md) definiert plattformübergreifende Leitplanken (Beratung, Sicherheit, Audit). Dieses Dokument ergänzt sie um **operative Handwerks-spezifische** Grundsätze — ohne sie zu ersetzen.

---

## Denkmodell: Von Problem zu Software

Jede Funktion folgt dieser Kette:

```
Problem
  → Prozess
  → Verantwortung
  → Information
  → Entscheidung
  → Unterstützung
  → Software
```

**Konsequenz:** Software entsteht aus dokumentiertem Prozess und klarer Verantwortung — nicht aus isolierten Features.

---

## Gemeinsame Datenbasis

| Grundsatz | Beschreibung |
| --- | --- |
| **Eine Wahrheitsquelle** | Alle Rollen arbeiten auf derselben fachlichen Datenbasis |
| **Keine Rollen-Silos** | Keine getrennten Datenbestände pro Rolle oder Abteilung |
| **Wiederverwendung** | Einmal erfasste Information fließt in Angebot, Projekt, Material, Rechnung und Dokumentation |

---

## Rollenabhängige Dashboards

Dashboards **priorisieren und filtern** — sie ersetzen keine Geschäftsprozesse.

| Rolle | Fokus (Überblick) |
| --- | --- |
| **Geschäftsführer** | Betriebsstatus, Risiken, Pipeline, Liquidität, Personal, Entscheidungen |
| **Büro** | Anfragen, Termine, Angebote, Rechnungen, Zahlungen, Kommunikation |
| **Bauleiter** | Einsätze, Projektfortschritt, Material, Besichtigungen, Baustellenrisiken |
| **Monteur** | Nächster Einsatz, Aufgabe, Material, Meldungen — bevorzugt ohne separate App |

Details: [`docs/fachkonzept/08-rollenmodell.md`](./08-rollenmodell.md), ADR-0005.

---

## Gemeinsame Fachbereiche

Unabhängig von der Rolle existieren dieselben Fachbereiche:

| Fachbereich | Kurzbeschreibung |
| --- | --- |
| **Vertrieb** | Anfrage → Besichtigung → Angebot |
| **Projekte** | Auftrag, Ausführung, Abnahme |
| **Personal** | Einsatz, Verfügbarkeit, Qualifikation |
| **Finanzen** | Kalkulation, Rechnung, Zahlung |
| **Dokumente** | Verträge, Pläne, Fotos, Nachweise |
| **Administration** | Stammdaten, Einstellungen, Rechte |

---

## Kanäle der Informationsaufnahme

Informationen können über **beliebige Kanäle** eingehen:

| Kanal | Beispiel |
| --- | --- |
| Direkte Eingabe im System | Formular, Tablet |
| Sprache | Diktat auf Baustelle, im Fahrzeug |
| E-Mail | Kundenanfrage, Bauleiter-Weiterleitung |
| SMS / WhatsApp | Monteurmeldung, Kundentermin |
| Fotos | Schaden, Fortschritt, Material |
| Dokumente | PDF, Plan, Rechnung des Lieferanten |

### Verbindliche Regeln

| Regel | Beschreibung |
| --- | --- |
| **Keine Kanalpflicht** | Kein Nutzer muss einen bestimmten Eingabekanal verwenden |
| **Strukturierung nach Eingang** | KI strukturiert und ordnet Informationen **nach** dem Eingang — nicht während starrer Formularpflicht |
| **Prüfbarkeit** | KI-Ergebnisse müssen **prüfbar und bestätigbar** sein |
| **Keine ungeprüfte Übernahme** | Fachlich kritische KI-Ergebnisse werden nicht automatisch übernommen |

Siehe ADR-0006.

---

## Modularität

| Grundsatz | Beschreibung |
| --- | --- |
| **Plattformkern** | Rollen, Rechte, Aufgaben, Kalender, Kommunikation, Workflow, KI, gemeinsame Datenbasis |
| **Fachmodule** | Einzeln lizenzierbare Bereiche (Anfrage, Angebote, Projekte, …) |
| **Autark + durchgängig** | Module sind einzeln nutzbar und bilden kombiniert einen Gesamtprozess |
| **Kundenentscheidung** | Der Betrieb entscheidet, welche Module er nutzt |
| **Erweiterung ohne Migration** | Spätere Module nutzen vorhandene Daten — kein Systemwechsel |

Details: [`docs/fachkonzept/09-modularitaet-und-produktstrategie.md`](./09-modularitaet-und-produktstrategie.md), ADR-0012.

**Abgrenzung:** **Fachmodule** (operative Domäne) ≠ **Plattformmodule** (technische Lizenz-Einheiten, [`docs/produktarchitektur.md`](../produktarchitektur.md)) ≠ **Produkte/Pakete** (Vertrieb an Mandanten).

**Domänentrennung:** SaaS-Administration (`/admin`) und operative Kundenplattform (`/`) teilen **keine Fachtabellen** — nur domänenneutrale Infrastruktur. Siehe [`docs/adr/ADR-0014-trennung-saas-admin-und-operative-kundenplattform.md`](../adr/ADR-0014-trennung-saas-admin-und-operative-kundenplattform.md).

---

## Trennung Admin vs. Operativ (verbindlich)

| Regel | Beschreibung |
| --- | --- |
| **Mandant ≠ Endkunde** | `organizations` ist SaaS-Mandant; `kunden` ist Endkunde des Handwerks |
| **Plattform-Angebot ≠ Endkundenangebot** | `angebote` nur für KMU Flow AI → Mandant |
| **Keine Uminterpretation** | Admin-Tabellen nicht für operative Handwerksdaten wiederverwenden |
| **Mandantenscope** | Operative Daten immer über `mandant_id` → `organizations.id` |
| **Eindeutige Namen** | Operative Tabellen am Namen von Admin-Entitäten unterscheidbar |

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-26 | Erstversion |
| 2026-07-26 | Abschnitt Domänentrennung — Verweis ADR-0014 |
