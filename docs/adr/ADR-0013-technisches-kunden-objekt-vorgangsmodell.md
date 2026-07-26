# ADR-0013: Technisches Kunden-, Objekt- und Vorgangsmodell

**Status:** Angenommen (verbindlich, Zielarchitektur) — **noch nicht implementiert**  
**Datum:** 2026-07-26  
**Bezug:** [`docs/fachkonzept/10-technisches-kunden-und-objektmodell.md`](../fachkonzept/10-technisches-kunden-und-objektmodell.md), ADR-0007, ADR-0008

---

## Kontext

ADR-0007 und Fachkonzept 03 definieren fachliche Regeln (Kundenakte, MFH, Mieterwechsel, keine Adress-Identität). ADR-0008 regelt automatische Zuordnung. Im Ist-System existieren:

- **`organizations`** — Mandanten (SaaS-Kunden von KMU Flow AI) mit eigenen Adressfeldern
- **`angebote.organization_id`** — Plattform-Angebote **an** Mandanten (Phase B ✅)
- **`customers`** — in Dokumentation als operative CRM-Kunden referenziert, ohne vollständiges Schema in Repo-Migrationen

Es fehlt ein **technisches Zielmodell** für Endkunden, Adressen, Gebäude, Einheiten und Vorgänge — getrennt von Mandanten-Stammdaten.

---

## Entscheidung

Die operative Domäne wird in **getrennten Entitäten** modelliert, mandantenscharf (`mandant_id` → `organizations.id`):

| Entität | Rolle |
| --- | --- |
| **`kunden`** | Rechtlicher/fachlicher Geschäftspartner des Handwerks (Endkunde) — **ohne** Gebäudedaten |
| **`adressen`** | Normalisierte Standortangabe; **mandantenbezogen** (`mandant_id`); **keine** automatische Kundenverknüpfung — ADR-0015 |
| **`gebaeude`** | Objekt an Adresse; **1:n** pro Adresse möglich; technische Daten; überdauert Mieterwechsel — ADR-0015 |
| **`einheiten`** | Optional (EFH) / verpflichtend (MFH, Gewerbe-Hallen); Wohnung oder Gemeinschaftsbereich |
| **`kunden_objekt_beziehungen`** | Explizite Rolle, Gültigkeit, Bestätigung — **n:m** Kunde ↔ Objekt/Einheit |
| **`vorgaenge`** | Anfrage, Besichtigung, Angebot, Projekt, Rechnung — **ein** Objektkontext, mehrere Beteiligte |
| **`vorgang_beteiligte`** | Rollen: Anfragender, Auftraggeber, Rechnungsempfänger, … |

**`organizations` bleibt Mandant** — nicht für Endkunden-Objektdaten verwenden.

**Bestehende Plattform-`angebote`** behalten `organization_id` (Mandantenbezug) bis eine **separate** operative Angebotsverknüpfung über `vorgaenge` eingeführt wird.

Automatische Zuordnung folgt ADR-0008 (Zwei-Merkmale-Regel, MFH-Eindeutigkeit, Neuanlage bei Unsicherheit).

**Adressen und Gebäude (O2/O3):** [`ADR-0015`](./ADR-0015-mandantenbezogene-adressen-und-mehrere-gebaeude.md) — `adressen` 1:n `gebaeude`; mandantenbezogene Adressen.

**Objektgrundlagen (V1):** [`ADR-0016`](./ADR-0016-operative-objektgrundlagen-rls-archivierung.md) — Gebäudearten, Einheiten, Archivierung, RLS-Grundmodell, Adressnormalisierung.

---

## Alternativen ( verworfen )

| Alternative | Grund der Ablehnung |
| --- | --- |
| Endkunden in `organizations` abbilden | Vermischt SaaS-Mandant und Handwerks-Endkunde; bricht Multi-Tenant-Semantik |
| Adresse als Primärschlüssel für Kunde | ADR-0007; Mieterwechsel, MFH |
| Vorgänge nur an Kunde hängen | Objektkontext fehlt; gleiche Adresse verschiedener Kunden |
| Ein monolithisches „Objekt“ mit Kundenname | Keine Trennung technisch vs. personenbezogen |
| Sofortige Migration aller `angebote` auf Endkunden-FK | Plattform-Angebote sind fachlich andere Domäne (Phase B Ist) |

---

## Begründung

1. **Klare Mandantentrennung** — Endkundendaten scoped per `mandant_id`.
2. **Datenschutz** — Personenbezogene Historie an Kunde/Vorgang; technische Daten am Objekt.
3. **MFH und Gewerbe** — Einheiten als first-class entity.
4. **Ist-kompatibel** — `organizations` und Plattform-`angebote` unverändert nutzbar.
5. **Prozesskette** — Vorgang als Anker für Anfrage → Besichtigung → Angebot → Projekt (Fachkonzept).

---

## Konsequenzen

### Positiv

- Einheitliches Modell für Anfrageprozess (ADR-0008) und Kundenakte.
- Mieterwechsel ohne Löschen physischer Einheiten.
- Folgeanfragen und technische Wiederverwendung kontrollierbar.

### Aufwand

- Neue Tabellen und RPCs (später) — **nicht in dieser Entscheidung**.
- Zwei Angebots-Welten dokumentieren und in UI trennen.
- Evolution `customers` → `kunden` falls Tabelle existiert.

### Verboten

- Gebäude-/Wohnungsdaten in `organizations` für Endkunden.
- Auto-Merge von Kunden bei gleicher Adresse.
- Rückwirkende Umdeutung von `angebote.organization_id` als Endkunden-FK.

---

## Datenschutzfolgen

| Folge | Maßnahme im Modell |
| --- | --- |
| Mieter sieht Vorgänger-Daten | Vorgänge an `kunde_id` / Vorgangskontext — keine Adress-Joins für Historie |
| DSGVO Datenminimierung | Keine inferierten Verknüpfungen; explizite Beziehungen |
| Wiederverwendung technischer Daten | Quelle, Alter, Bestätigungspflicht für kritische Übernahme |
| Löschung / Archivierung | Kunde vs. Objekt getrennt — **konkrete Löschpolitik noch offen** |

---

## Migrationsfolgen

| Phase | Auswirkung |
| --- | --- |
| **Jetzt** | Nur Dokumentation — **kein Schema-Change** |
| **M1** | Neue Tabellen parallel; kein Breaking Change |
| **M2** | Operative Features nutzen neues Modell |
| **M3** | Optionale `vorgang_id` an operativen Dokumenten |
| **Bestehende Angebote** | `organization_id` **bleibt**; Snapshots in `angebot_versionen` unverändert gültig |
| **`leistungsmodule`** | Unberührt (Zwischenlösung Plattform-Katalog) |

---

## Nicht Bestandteil dieser Entscheidung

- SQL-DDL, Migrationsskripte, RLS-Policies
- UI Kundenakte, Karten, Geocoding
- Integration WhatsApp/E-Mail-Ingestion
- Operative Angebots-UI vs. Plattform-Admin-Angebote (Phase H)
- Konkrete Benennung aller CHECK-Constraints und Enum-Werte
- Verknüpfung `kunden` ↔ Supabase Auth-Benutzer
- Normalisierungsalgorithmen und RLS-Policy-Texte (siehe ADR-0015 — Übersicht; **ADR-0016** — verbindliches V1-Konzept)

**Analyse Ist-Stand `customers`:** [`docs/fachkonzept/11-analyse-bestehende-endkundenstruktur.md`](../fachkonzept/11-analyse-bestehende-endkundenstruktur.md) — Empfehlung Option B (`kunden` neu); diese ADR bleibt unverändert.

**Domänentrennung Admin/Operativ:** [`docs/adr/ADR-0014-trennung-saas-admin-und-operative-kundenplattform.md`](./ADR-0014-trennung-saas-admin-und-operative-kundenplattform.md)

**Adressen/Gebäude (O2/O3):** [`docs/adr/ADR-0015-mandantenbezogene-adressen-und-mehrere-gebaeude.md`](./ADR-0015-mandantenbezogene-adressen-und-mehrere-gebaeude.md)

**Objektgrundlagen V1:** [`docs/adr/ADR-0016-operative-objektgrundlagen-rls-archivierung.md`](./ADR-0016-operative-objektgrundlagen-rls-archivierung.md)

---
