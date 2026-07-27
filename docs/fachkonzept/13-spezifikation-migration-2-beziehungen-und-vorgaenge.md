# Spezifikation: Migration 2 — Beziehungen und Vorgänge

Technische **Spezifikation** für die zweite operative Datenbank-Migration (Beziehungen und Vorgangskontext). **Noch keine SQL-Datei, keine RPC, keine UI.**

**Status:** Verbindliche Spezifikation — **DDL in Migration `20260717290000_operative_beziehungen_vorgaenge_v1.sql`** — noch nicht auf Supabase ausgeführt  
**Datum:** 2026-07-27 (Blocker finalisiert: 2026-07-27)  
**Bezug:** ADR-0013, ADR-0014, ADR-0015, ADR-0016, **ADR-0017**, [`10-technisches-kunden-und-objektmodell.md`](./10-technisches-kunden-und-objektmodell.md), [`12-spezifikation-migration-1-operative-stammdaten.md`](./12-spezifikation-migration-1-operative-stammdaten.md)

**Voraussetzung:** Migration 1 angewendet und getestet (`kunden`, `adressen`, `gebaeude`, `einheiten`).

---

## Ziel

Migration 2 legt **drei neue Tabellen** für die operative Kundenplattform (`/`) an:

| Tabelle | Zweck |
| --- | --- |
| `kunden_objekt_beziehungen` | Dauerhafte/zeitliche Rollen Kunde ↔ Gebäude/Einheit |
| `vorgaenge` | Zentraler operativer Vorgangskontext |
| `vorgang_beteiligte` | Rollen von Kunden an genau einem Vorgang |

Alle Tabellen sind **mandantenscharf** (`mandant_id` → `organizations.id`).

`vorgaenge` ist **kein Ersatz** für spätere Fachtabellen (Anfrage, Besichtigung, operatives Angebot, Projekt, Rechnung), sondern der **gemeinsame Kontext**, an den diese später angebunden werden.

---

## Nicht-Ziele (Migration 2)

| Ausgeschlossen | Grund |
| --- | --- |
| Änderung an `/admin`-Tabellen | ADR-0014 |
| Operative Angebote, Projekte, Rechnungen, Besichtigungen | Eigene Migrationen / Anbindung später |
| Tabellen `anfragen`, `besichtigungen`, … | Folge-Migrationen |
| Backfill / Migration von `customers` | Separate Entscheidung |
| RLS-Policies für `authenticated` / `anon` | Wie M1 — nach Auth-Sprint |
| Nummern-RPC / Sequenz-Tabellen | Serverlogik später (Empfehlung) |
| Vollständiger Geschäftsprozessstatus für Angebote/Projekte | Domänenspezifische Tabellen später |
| Feingranulare Sichtbarkeit sensibler Vorgänge (Personal, Beschwerde) | Nicht M2 |
| Schema-Änderungen an M1-Tabellen | Siehe Abschnitt **M1-Ergänzungen in M2** |
| Tabelle **Anfrageeingang** / E-Mail-Inbox | **Nicht M2** — spätere Migration (Abschnitt 3) |

---

## Gemeinsame Konventionen

| Aspekt | Spezifikation |
| --- | --- |
| Primary Key | `id uuid NOT NULL DEFAULT gen_random_uuid()` |
| Mandant | `mandant_id uuid NOT NULL` → `organizations.id` **ON DELETE RESTRICT** |
| Zeitstempel | `created_at`, `updated_at` mit `public.set_updated_at()` |
| Hard Delete | **Verboten** nach fachlicher Verwendung — **ON DELETE RESTRICT** |
| RLS | `ENABLE ROW LEVEL SECURITY` — **keine Policies** in M2 (wie M1) |
| Composite-FKs | Child-`mandant_id` muss Parent-`mandant_id` entsprechen |

### M1-Ergänzungen in Migration 2

Migration 2 ergänzt **zwei M1-Tabellen** (keine Änderung an `/admin`):

| Tabelle | Ergänzung | Zweck |
| --- | --- | --- |
| `kunden` | `kundenstatus text NOT NULL DEFAULT 'bestaetigt'` | Vorläufig vs. bestätigt (Abschnitt 3) |
| `kunden` | `UNIQUE (mandant_id, id)` | Composite-FK-Parent |
| `kunden` | CHECK `kundenstatus IN ('vorlaeufig', 'bestaetigt')` | |
| `einheiten` | `UNIQUE (mandant_id, id)` | Composite-FK-Parent |
| `einheiten` | **`UNIQUE (mandant_id, gebaeude_id, id)`** | Composite-FK Einheit↔Gebäude |

| Tabelle | M1-Stand | M2-Aktion |
| --- | --- | --- |
| `adressen` | ✅ `UNIQUE (mandant_id, id)` | — |
| `gebaeude` | ✅ `UNIQUE (mandant_id, id)` | — |
| `kunden` | ❌ nur PK `id` | **`kundenstatus` + UNIQUE (mandant_id, id)`** |
| `einheiten` | ❌ nur PK `id` | **`UNIQUE (mandant_id, id)` + UNIQUE (mandant_id, gebaeude_id, id)`** |

---

## 0. Querschnittsentscheidungen (Blocker final)

### 0.1 Anfrageeingang vs. Vorgang

| Ebene | M2 | Später |
| --- | --- | --- |
| **Anfrageeingang** (Rohe Nachricht, unklare Zuordnung) | **Keine Tabelle** | Eigene Entität (z. B. `anfrage_eingaenge`) — **Migration 3+** |
| **Vorgang** | **Ja** — nur bei ausreichendem Kontext | |

**Unvollständige Nachrichten** („Bitte zurückrufen“, unbekannte Person ohne Adresse, unklare E-Mail) sind **noch kein Vorgang**. Sie bleiben im **Anfrageeingang** ( später ), nicht in `vorgaenge`.

**Vorgang anlegen erst wenn mindestens:**

| Pflicht | Beschreibung |
| --- | --- |
| Kunde | Vorläufig **oder** bestätigt (`kundenstatus`) — **kein** Platzhalter |
| Gebäude | `gebaeude_id` |
| Einheit | Optional; bei MFH-Wohnvorgang serverseitig Pflicht (später) |
| Titel / Anliegen | `titel` nicht leer |

**Nicht in M2:** Telefonische Erstberatung ohne Leistungsort → kein Vorgang; CRM-Notiz / spätere Entität.

### 0.2 Vorläufige Kunden (`kundenstatus`)

**Entscheidung:** `kunden.kundenstatus` in M2 ergänzen — **`aktiv`/`archiviert_am` reicht nicht** (orthogonale Achsen).

| Wert | Bedeutung |
| --- | --- |
| `vorlaeufig` | Angelegt mit echten, aber unvollständigen Daten; Dublettenprüfung **ausstehend** |
| `bestaetigt` | Identität und Stammdaten **bestätigt** (Default für bestehende M1-Kunden nach Migration) |

| Regel | Beschreibung |
| --- | --- |
| **Kein Platzhalter** | Keine erfundenen Kunden („Unbekannt“, „Platzhalter“, „Neuer Kunde“ ohne Bezug) |
| Auto-Anlage `vorlaeufig` | Nur bei **echten** Mindestdaten aus Eingang (Name aus E-Mail, Telefon, erkennbarer Firmenname) — **später** beim Eingangssprint; manuell in M2 erlaubt |
| Mindestdaten | Wie M1: `kundennummer`, `kundentyp`, typabhängige Pflichtfelder, `anzeigename` |
| Bestätigung | `kundenstatus → bestaetigt` nach ADR-0008-Dublettenprüfung / manueller Freigabe |
| Zusammenführung | Separater Prozess (nicht M2) — **kein** Auto-Merge |
| Vorgang | Darf mit `vorlaeufig`em Kunden verknüpft werden (über `vorgang_beteiligte`) |

Bestehende M1-Zeilen: Migration setzt `kundenstatus = 'bestaetigt'`.

### 0.3 Kein `kunde_id` auf `vorgaenge` — Entscheidung (Option B)

| Aspekt | Entscheidung |
| --- | --- |
| `vorgaenge.kunde_id` | **Entfällt** — **nicht** in M2 |
| Source of Truth | **`vorgang_beteiligte`** für alle Rollen inkl. Anfragender, Auftraggeber |
| `hauptkunde_id` | **Nein** — würde Auftraggeber/Anfragender vermischen |
| Query-Komfort | Views / Server-Queries auf `vorgang_beteiligte` mit `ist_hauptbeteiligter` — **keine** zweite Wahrheit |

**Begründung:** Anfragender ≠ Auftraggeber; mehrere Beteiligte; ein Einzelfeld wäre fachlich mehrdeutig.

### 0.4 Abschlusszeitpunkt — `beendet_am`

| Aspekt | Entscheidung **B** |
| --- | --- |
| Feldname | **`beendet_am timestamptz NULL`** (statt `abgeschlossen_am`) |
| `status = abgeschlossen` | → `beendet_am NOT NULL` |
| `status = abgebrochen` | → `beendet_am NOT NULL` (Beendigungszeitpunkt) |
| Sonstige Status | → `beendet_am IS NULL` |
| CHECK | `(status IN ('abgeschlossen','abgebrochen')) = (beendet_am IS NOT NULL)` |

---

## 1. Tabelle `kunden_objekt_beziehungen`

### Zweck

Zeitlich und rollenbezogen dokumentieren, **wie ein Kunde mit einem Gebäude oder einer Einheit verbunden ist** — ohne personenbezogene Vorgangsdaten, ohne automatische Verknüpfung nur wegen Adresse (ADR-0017, ADR-0008).

### Feldspezifikation

| Spalte | Typ | NULL | Default | Beschreibung |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `mandant_id` | `uuid` | NO | — | FK → `organizations.id` |
| `kunde_id` | `uuid` | NO | — | FK → `kunden` (composite) |
| `gebaeude_id` | `uuid` | NO | — | FK → `gebaeude` (composite) |
| `einheit_id` | `uuid` | YES | — | NULL = gesamtes Gebäude |
| `rolle` | `text` | NO | — | Objektrolle V1 — siehe unten |
| `gueltig_ab` | `date` | NO | — | Beginn der Beziehung |
| `gueltig_bis` | `date` | YES | — | NULL = offen / unbefristet aktiv |
| `aktiv` | `boolean` | NO | `true` | Aktuell gültige Beziehungszeile |
| `quelle` | `text` | YES | — | z. B. `manuell`, `import`, `system` |
| `bestaetigt_am` | `timestamptz` | YES | — | Manuelle Bestätigung |
| `notizen` | `text` | YES | — | Intern, **nicht** vorgangsbezogen |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |

**Kein** `archiviert_am` — Beendigung über `gueltig_bis` + `aktiv`.

### Rollen V1 (`rolle`)

| Wert | Bedeutung |
| --- | --- |
| `eigentuemer` | Eigentümer am Gebäude/Einheit |
| `mieter` | Mieter / Nutzer mit Mietverhältnis |
| `hausverwaltung` | Verwaltung beauftragt für Objekt |
| `nutzer` | Nutzungsberechtigung ohne klassische Mieterrolle |
| `sonstiges` | Fallback |

**Explizit ausgeschlossen** (→ `vorgang_beteiligte`): `anfragender`, `auftraggeber`, `ansprechpartner`, `angebotsempfaenger`, `rechnungsempfaenger`, `zahlungspflichtiger`.

### Verbindliche Regeln

| # | Regel |
| --- | --- |
| B1 | Beziehung bezieht sich auf **genau ein** `gebaeude_id` |
| B2 | `einheit_id` NULL = Beziehung zum **gesamten Gebäude** |
| B3 | Ist `einheit_id` gesetzt, erzwingt Composite-FK `(mandant_id, gebaeude_id, einheit_id)` → `einheiten` Konsistenz |
| B4 | **Mieterwechsel:** neue Zeile für neuen Mieter; alte Zeile beenden (`aktiv=false`, `gueltig_bis`); **Einheit nicht archivieren** |
| B5 | **Mehrere Eigentümer** gleichzeitig am selben Objekt **erlaubt** |
| B6 | **Mehrere Mieter/Nutzer** gleichzeitig an derselben Einheit **erlaubt** (Ehepartner, WG, Mitmieter) |
| B7 | **Mehrere aktive Rollen** verschiedener Typen am selben Objekt **erlaubt** (z. B. Eigentümer + HV) |
| B8 | **Keine doppelte** identische aktive Beziehung (gleicher Kunde + Objekt + Rolle) |
| B9 | **Keine** automatische Beziehung nur wegen gleicher Adresse |
| B10 | **Keine** personenbezogenen Vorgangsdaten in dieser Tabelle |
| B11 | Hard Delete nach fachlicher Verwendung **verboten** |

### Mehrere Mieter / Mitnutzer — Entscheidung (verbindlich)

| Aspekt | Regel |
| --- | --- |
| Mieter pro Einheit | **Mehrere gleichzeitig erlaubt** — kein Limit „max. 1 Mieter“ |
| Nutzer (`nutzer`) | Ebenfalls **mehrere gleichzeitig** erlaubt |
| Eigentümer | **Mehrere gleichzeitig** (unverändert) |
| Verboten | **Dieselbe** aktive Beziehung doppelt (gleicher Kunde, gleiches Objekt, gleiche Rolle) |
| Mieterwechsel | Alte Zeile **beenden**, neue Zeile — **nicht** pauschal alten Mieter ersetzen, wenn Mitmieter bleiben |

### Gültigkeit vs. `aktiv` — Entscheidung (final)

| Aspekt | Regel |
| --- | --- |
| **`gueltig_ab` / `gueltig_bis`** | **`date`** — fachlicher Gültigkeitszeitraum (inklusive) |
| **`bestaetigt_am`** | **`timestamptz`** — Audit |
| **`aktiv`** | **Administrativ/fachlich nutzbar** — **nicht widerrufen**; **kein** automatisches Ableiten aus `current_date` |
| **`gueltig_*` vs. `aktiv`** | Zeitraum ≠ Widerruf: geplante Beziehung (`gueltig_ab` in Zukunft) kann `aktiv=true` haben |
| Geplantes Ende | `aktiv=true` mit gesetztem `gueltig_bis` **erlaubt** — „effektiv heute“ per Server/Query |
| Beendigung | `aktiv=false` → **`gueltig_bis NOT NULL`** (Beendigungsdatum) |
| Offene Beziehung | `aktiv=true`, `gueltig_bis IS NULL` **erlaubt** |
| Reaktivierung | **Bevorzugt:** neue Zeile; **Alternativ:** `aktiv=true`, `gueltig_bis=NULL`, ggf. neues `gueltig_ab` — nur wenn UNIQUE es zulässt |
| **Kein** `current_date` in CHECK | CHECKs würden ohne Migration veralten — **Effektivität „heute“** nur in Queries/Server |

**CHECK-Constraints (final):**

| Constraint | Regel |
| --- | --- |
| `gueltig_bis >= gueltig_ab` | wenn `gueltig_bis` gesetzt |
| `aktiv=false → gueltig_bis NOT NULL` | beendete/widerrufene Zeile hat Enddatum |
| **Kein** CHECK | `aktiv=true → gueltig_bis IS NULL` (geplantes Ende zulässig) |

**Effektive Abfrage (App/Server, nicht DB-CHECK):**

```text
aktiv = true
AND gueltig_ab <= :stichtag
AND (gueltig_bis IS NULL OR gueltig_bis >= :stichtag)
```

### Eindeutigkeit aktiver Beziehungen — Entscheidung

**Problem:** PostgreSQL behandelt `NULL` in UNIQUE-Indizes standardmäßig als ** verschieden** — `(…, einheit_id=NULL)` kann mehrfach vorkommen.

**Empfehlung M2: zwei partielle UNIQUE-Indizes** (explizit, ohne `NULLS NOT DISTINCT`-Abhängigkeit):

| Index | Definition |
| --- | --- |
| **UNIQUE partial A** | `(mandant_id, kunde_id, gebaeude_id, einheit_id, rolle) WHERE aktiv = true AND einheit_id IS NOT NULL` |
| **UNIQUE partial B** | `(mandant_id, kunde_id, gebaeude_id, rolle) WHERE aktiv = true AND einheit_id IS NULL` |

Index B verhindert doppelte aktive Beziehungen am **gesamten Gebäude** (`einheit_id` NULL).

**Alternative (PG 15+, Supabase):** ein Index mit `NULLS NOT DISTINCT` auf `(mandant_id, kunde_id, gebaeude_id, einheit_id, rolle) WHERE aktiv = true`. **M2-Empfehlung:** zwei partielle Indizes — klarere Semantik, keine Versionsfrage.

**Entfernt:** frühere Regel „max. ein Mieter pro Einheit“ und zugehöriger UNIQUE auf `(mandant_id, einheit_id)`.

### Überlappungen — Entscheidung

| Szenario | Regel |
| --- | --- |
| Gleicher Kunde + gleiche Rolle + gleiches Objekt | **Keine** zweite aktive Zeile (UNIQUE partial) |
| Verschiedene Kunden, Rolle `mieter`, gleiche Einheit | **Mehrere** gleichzeitig **erlaubt** |
| Verschiedene Rollen, gleicher Kunde | **Mehrere Zeilen** erlaubt |
| Überlappende Datumsperioden, verschiedene Kunden | **Erlaubt** (WG) — kein Exclusion-Constraint in M2 |

### CHECK-Constraints

| Constraint | Regel |
| --- | --- |
| `kunden_objekt_beziehungen_rolle_check` | V1-Rollenset |
| `kunden_objekt_beziehungen_gueltig_check` | `gueltig_bis IS NULL OR gueltig_bis >= gueltig_ab` |
| `kunden_objekt_beziehungen_aktiv_beendet_check` | `aktiv = true OR gueltig_bis IS NOT NULL` |
| Optional-Felder | `quelle`, `notizen`: wenn gesetzt, nicht nur Leerzeichen |

### Foreign Keys und Composite-FK Einheit↔Gebäude (final)

| FK | Definition | ON DELETE |
| --- | --- | --- |
| Mandant | `mandant_id` → `organizations(id)` | RESTRICT |
| Kunde | `(mandant_id, kunde_id)` → `kunden(mandant_id, id)` | RESTRICT |
| Gebäude | `(mandant_id, gebaeude_id)` → `gebaeude(mandant_id, id)` | RESTRICT |
| **Einheit↔Gebäude (composite)** | `(mandant_id, gebaeude_id, einheit_id)` → `einheiten(mandant_id, gebaeude_id, id)` | RESTRICT |

**Parent auf `einheiten` (M2):** `UNIQUE (mandant_id, gebaeude_id, id)`.

**Verhalten bei `einheit_id IS NULL` (PostgreSQL):** In einem **zusammengesetzten FK** gilt: ist **eine** Spalte `NULL`, wird der FK-Check **übersprungen** (Zeile gilt als konform). Daher:

| `einheit_id` | Erzwingende FKs |
| --- | --- |
| **NULL** (gesamtes Gebäude) | nur `(mandant_id, gebaeude_id)` → `gebaeude` |
| **NOT NULL** | `(mandant_id, gebaeude_id, einheit_id)` → `einheiten` — verhindert Gebäude A + Einheit aus Gebäude B, fremden Mandanten, widersprüchlichen Kontext |

**Kein** separater FK `(mandant_id, einheit_id)` → `einheiten(mandant_id, id)` allein — der **3-spaltige** FK ist die Source of Truth für Objektkonsistenz.

### Indizes

| Index | Spalten | Zweck |
| --- | --- | --- |
| B-tree | `(mandant_id, kunde_id)` | Kunde → Objekte |
| B-tree | `(mandant_id, gebaeude_id)` | Gebäude → Kunden |
| B-tree | `(mandant_id, einheit_id)` WHERE `einheit_id IS NOT NULL` | Einheit → Kunden |
| B-tree | `(mandant_id, aktiv)` | Aktive Beziehungen |
| **UNIQUE partial A** | `(mandant_id, kunde_id, gebaeude_id, einheit_id, rolle) WHERE aktiv AND einheit_id IS NOT NULL` | Keine Duplikat-Beziehung (Einheit) |
| **UNIQUE partial B** | `(mandant_id, kunde_id, gebaeude_id, rolle) WHERE aktiv AND einheit_id IS NULL` | Keine Duplikat-Beziehung (Gebäude) |

---

## 2. Tabelle `vorgaenge`

### Zweck

Zentraler **operativer Kontext** vom Eingang einer Anfrage bis zum späteren Abschluss — Anker für Beteiligte, Objektkontext und künftige Fachprozesse.

**Keine God-Table:** schlanke Kernfelder; domänenspezifische Daten kommen in spätere Tabellen mit `vorgang_id`.

### Feldspezifikation

| Spalte | Typ | NULL | Default | Beschreibung |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `mandant_id` | `uuid` | NO | — | FK → `organizations.id` |
| `vorgangsnummer` | `text` | **NO** | — | Mandantenintern eindeutig |
| `vorgangstyp` | `text` | NO | — | V1-Werteset |
| `status` | `text` | NO | `'neu'` | Allgemeiner V1-Lifecycle |
| `gebaeude_id` | `uuid` | NO | — | Objektkontext — Pflicht |
| `einheit_id` | `uuid` | YES | — | NULL = gesamtes Gebäude |
| `parent_vorgang_id` | `uuid` | YES | — | Folge-/Reklamationsbezug |
| `titel` | `text` | NO | — | Kurzbezeichnung |
| `beschreibung` | `text` | YES | — | Freitext |
| `quelle` | `text` | YES | — | z. B. `email`, `telefon`, `portal` |
| `prioritaet` | `text` | NO | `'normal'` | V1: `niedrig`, `normal`, `hoch`, `dringend` |
| `eingegangen_am` | `timestamptz` | NO | `now()` | Eingangszeitpunkt |
| `beendet_am` | `timestamptz` | YES | — | Abschluss **oder** Abbruch |
| `aktiv` | `boolean` | NO | `true` | Nicht archiviert |
| `archiviert_am` | `timestamptz` | YES | — | Soft-Archive |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |

**Kein** `kunde_id`, **kein** `auftraggeber_kunde_id` — Rollen ausschließlich über `vorgang_beteiligte` (ADR-0017, Abschnitt 0.3).

### `vorgangstyp` — Entscheidung V1

**Empfehlung: mehrere Werte**, nicht nur ein generischer Typ.

| Wert | Bedeutung |
| --- | --- |
| `anfrage` | Erstanfrage / Standard |
| `folgeanfrage` | Bezug zu früherem Vorgang (optional `parent_vorgang_id`) |
| `notfall` | Dringender Einsatz |
| `service` | Wiederkehrende Serviceleistung |
| `reklamation` | Beanstandung — oft `parent_vorgang_id` gesetzt |
| `sonstiges` | Fallback |

Kein PostgreSQL-ENUM — text + CHECK.

### `status` — Entscheidung V1

Allgemeiner Lifecycle — **kein** Angebots-/Projekt-Workflow.

| Wert | Bedeutung |
| --- | --- |
| `neu` | Eingegangen, noch nicht bearbeitet |
| `in_klaerung` | Daten/Zuordnung unvollständig |
| `bereit` | Bearbeitbar, Kontext geklärt |
| `in_bearbeitung` | Aktiv in Bearbeitung |
| `wartet_auf_extern` | Externer Input (Kunde, Lieferant, Genehmigung) |
| `abgeschlossen` | Fachlich erledigt |
| `abgebrochen` | Nicht weiterverfolgt |

**CHECK (verbindlich):** `(status IN ('abgeschlossen', 'abgebrochen')) ↔ (beendet_am IS NOT NULL)` — siehe Abschnitt 0.4.

### Objektkontext — Entscheidung

| Aspekt | Regel |
| --- | --- |
| `gebaeude_id` | **NOT NULL** in M2 |
| `einheit_id` | Optional in DB; **serverseitig Pflicht** bei MFH-Wohnungsvorgängen (später) |
| Unbekanntes Objekt | Zuerst `adressen`/`gebaeude`/`einheiten` anlegen, **dann** Vorgang |
| Unvollständige Nachricht ohne Objekt | **Kein Vorgang** — später Anfrageeingang (Abschnitt 0.1) |
| Telefonische Erstberatung **ohne** Leistungsort | **Kein** `vorgaenge` in M2 |
| Reklamation | Neuer Vorgang, `vorgangstyp=reklamation`, `parent_vorgang_id` → Ursprungsvorgang |
| Folgeanfrage | Neuer Vorgang, `parent_vorgang_id` optional, **kein** Auto-Merge |
| Gesamtes Gebäude | `einheit_id` NULL |

### Sonderfälle

| Fall | Modellierung |
| --- | --- |
| MFH-Wohnung | `gebaeude_id` + `einheit_id` |
| EFH | `gebaeude_id`, `einheit_id` NULL |
| Dach/Treppenhaus | `einheit_id` → Gemeinschaftseinheit |
| Reklamation | `parent_vorgang_id`, Objekt aus Parent übernehmen oder bestätigen |

### CHECK-Constraints

| Constraint | Regel |
| --- | --- |
| `vorgaenge_vorgangstyp_check` | V1-Werteset |
| `vorgaenge_status_check` | V1-Werteset |
| `vorgaenge_prioritaet_check` | `niedrig`, `normal`, `hoch`, `dringend` |
| `vorgaenge_titel_not_empty` | `length(trim(titel)) > 0` |
| `vorgaenge_vorgangsnummer_not_empty` | `length(trim(vorgangsnummer)) > 0` |
| `vorgaenge_aktiv_archiviert_check` | wie M1 |
| `vorgaenge_beendet_check` | `(status IN ('abgeschlossen','abgebrochen')) ↔ (beendet_am IS NOT NULL)` |

### Foreign Keys und Composite-FK Einheit↔Gebäude (final)

| FK | Definition | ON DELETE |
| --- | --- | --- |
| Mandant | `mandant_id` → `organizations(id)` | RESTRICT |
| Gebäude | `(mandant_id, gebaeude_id)` → `gebaeude(mandant_id, id)` | RESTRICT |
| **Einheit↔Gebäude** | `(mandant_id, gebaeude_id, einheit_id)` → `einheiten(mandant_id, gebaeude_id, id)` | RESTRICT |
| Parent | `(mandant_id, parent_vorgang_id)` → `vorgaenge(mandant_id, id)` | RESTRICT |
| UNIQUE für Children | `(mandant_id, id)` auf `vorgaenge` | — |

**Nullable `einheit_id` im composite FK:** siehe Abschnitt 1 — bei `NULL` greift nur Gebäude-FK.

### Indizes

| Index | Spalten |
| --- | --- |
| **UNIQUE** | `(mandant_id, vorgangsnummer)` |
| **UNIQUE** | `(mandant_id, id)` |
| B-tree | `(mandant_id, status)` |
| B-tree | `(mandant_id, gebaeude_id)` |
| B-tree | `(mandant_id, parent_vorgang_id)` WHERE `parent_vorgang_id IS NOT NULL` |
| B-tree | `(mandant_id, aktiv)` |
| B-tree | `(mandant_id, eingegangen_am DESC)` |

---

## 3. Tabelle `vorgang_beteiligte`

### Zweck

Personen/Unternehmen (`kunden`) mit **konkreter Rolle** an **genau einem** Vorgang verknüpfen — inkl. abweichendem Anfragenden, Auftraggeber, Rechnungsempfänger (ADR-0017).

### Feldspezifikation

| Spalte | Typ | NULL | Default | Beschreibung |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `mandant_id` | `uuid` | NO | — | FK → `organizations.id` |
| `vorgang_id` | `uuid` | NO | — | FK → `vorgaenge` (composite) |
| `kunde_id` | `uuid` | NO | — | FK → `kunden` (composite) |
| `rolle` | `text` | NO | — | Vorgangsrolle V1 |
| `ist_hauptbeteiligter` | `boolean` | NO | `false` | Max. einer pro Rolle |
| `gueltig_ab` | `timestamptz` | YES | — | Optional — Rollenwechsel im Vorgang |
| `gueltig_bis` | `timestamptz` | YES | — | Optional — historische Rolle |
| `notizen` | `text` | YES | — | Vorgangsbezogen, intern |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |

**Kein** `aktiv` / `archiviert_am` — Historie durch Zeilen erhalten; Beendigung optional über `gueltig_bis`.

### Rollen V1 (`rolle`)

| Wert | Bedeutung |
| --- | --- |
| `anfragender` | Stellt Anfrage / Erstkontakt |
| `auftraggeber` | Beauftragt Leistung |
| `ansprechpartner` | Erreichbar für Rückfragen |
| `angebotsempfaenger` | Empfängt Angebot |
| `rechnungsempfaenger` | Rechnungsadressat |
| `eigentuemer` | Eigentümer **in diesem Vorgang** |
| `mieter` | Mieter **in diesem Vorgang** |
| `hausverwaltung` | HV **in diesem Vorgang** |
| `zahlungspflichtiger` | Zahlt (kann ≠ Rechnungsempfänger) |
| `sonstiges` | Fallback |

### Abgrenzung zu `kunden_objekt_beziehungen`

| Aspekt | Objektbeziehung | Vorgangsbeteiligter |
| --- | --- | --- |
| Zeitachse | Langfristig (Miete, Eigentum) | Ein Vorgang |
| Mieterwechsel | Neue Objektzeile | Alte Vorgänge unverändert |
| Auftraggeber | **Nicht** | **Ja** |
| Auto-Übernahme | — | **Verboten** ohne Bestätigung |
| Eigentümer/Mieter | Dauerrolle am Objekt | Optional **zusätzlich** am Vorgang, wenn fachlich nötig |

### Verbindliche Regeln

| # | Regel |
| --- | --- |
| V1 | Ein Kunde **darf mehrere Rollen** im selben Vorgang haben (mehrere Zeilen) |
| V2 | Verschiedene Kunden **dürfen** dieselbe Rolle **nicht** doppelt identisch — siehe UNIQUE |
| V3 | Pro `(vorgang_id, rolle)` **höchstens ein** `ist_hauptbeteiligter = true` |
| V4 | **Keine** automatische Übernahme aus Folgevorgängen oder Objektbeziehungen |
| V5 | Historische Beteiligte **bleiben** erhalten (kein Hard Delete) |
| V6 | Rollen **bewusst** setzen oder regelbasiert mit Bestätigung vorschlagen |

### UNIQUE-Regeln

| Index | Definition |
| --- | --- |
| **UNIQUE** | `(mandant_id, vorgang_id, kunde_id, rolle)` — keine doppelte identische Rolle für denselben Kunden |
| **UNIQUE partial** | `(mandant_id, vorgang_id, rolle) WHERE ist_hauptbeteiligter = true` — ein Hauptbeteiligter je Rolle |

**Hinweis:** Zwei **verschiedene** Kunden mit Rolle `ansprechpartner` sind **erlaubt** — partial UNIQUE auf Hauptbeteiligter only.

### Foreign Keys

| FK | Definition | ON DELETE |
| --- | --- | --- |
| Mandant | `mandant_id` → `organizations(id)` | RESTRICT |
| Vorgang | `(mandant_id, vorgang_id)` → `vorgaenge(mandant_id, id)` | RESTRICT |
| Kunde | `(mandant_id, kunde_id)` → `kunden(mandant_id, id)` | RESTRICT |

### Indizes

| Index | Spalten |
| --- | --- |
| B-tree | `(mandant_id, vorgang_id)` |
| B-tree | `(mandant_id, kunde_id)` |
| B-tree | `(mandant_id, rolle)` |

---

## 4. Kardinalitäten und Konsistenz

```
organizations (SaaS-Mandant)
    └── mandant_id
            ├── kunden 1:n kunden_objekt_beziehungen
            ├── gebaeude 1:n kunden_objekt_beziehungen
            ├── einheiten 1:n kunden_objekt_beziehungen (optional FK)
            ├── gebaeude 1:n vorgaenge
            ├── einheiten 0..1 pro vorgang (optional)
            ├── vorgaenge 1:n vorgang_beteiligte
            ├── kunden 1:n vorgang_beteiligte
            └── vorgaenge 0..n parent_vorgang_id (Baum innerhalb Mandant)
```

| Beziehung | Kardinalität |
| --- | --- |
| Kunde → Objektbeziehungen | 1:n |
| Gebäude → Objektbeziehungen | 1:n |
| Einheit → Objektbeziehungen | 1:n |
| Vorgang → Gebäude | n:1 (**Pflicht**) |
| Vorgang → Einheit | n:0..1 |
| Vorgang → Beteiligte | 1:n (**Rollen — Source of Truth**) |
| Kunde → Beteiligte | 1:n |
| Vorgang → Kindvorgänge | 1:n über `parent_vorgang_id` |
| Einheit → Gebäude (FK) | n:1 via `(mandant_id, gebaeude_id, id)` |

**Cross-Tenant:** ausgeschlossen durch Composite-FKs und `mandant_id NOT NULL`.

---

## 5. Archivierung und Gültigkeit — Übersicht

| Tabelle | `aktiv` / `archiviert_am` | `gueltig_ab` / `gueltig_bis` | Begründung |
| --- | --- | --- | --- |
| `kunden_objekt_beziehungen` | **`aktiv` + `gueltig_*`** | **`date`** | Beziehung endet durch Periode, nicht durch Archiv-Flag allein |
| `vorgaenge` | **`aktiv` + `archiviert_am`** (wie M1) | — | Vorgang als Ganzes archivierbar |
| `vorgang_beteiligte` | **Nein** | **Optional `timestamptz`** | Historische Zeilen bleiben; seltene Rollenwechsel im laufenden Vorgang |

**Kein Widerspruch:** Objektbeziehung „beendet“ ≠ Vorgang „archiviert“. Vorgang kann abgeschlossen sein, während Mieterbeziehung weiterläuft.

---

## 6. Nummerierung — `vorgangsnummer`

| Aspekt | Entscheidung |
| --- | --- |
| Eindeutigkeit | **UNIQUE `(mandant_id, vorgangsnummer)`** — mandantenintern |
| Global | **Nein** |
| NOT NULL | **Ja** — jeder Vorgang ab Anlage identifizierbar |
| Format-CHECK | **Nein** in M2 — flexibel (`V-2026-0042`, …) |
| Nummern-RPC / Sequenz-Tabelle | **Nein in M2** — Vergabe durch **Server Action** (wie `kundennummer` in M1) |
| Admin-`angebote.angebotsnummer` | **Keine Vermischung** — andere Domäne, anderes Präfix |

**Empfehlung:** NOT NULL ohne DB-Sequenz in M2; atomare Vergabe später via RPC oder Mandanten-Sequenztabelle in **Migration 2b** oder Feature-Sprint.

---

## 7. RLS-Voraussetzungen (Migration 2)

| Aspekt | M2 |
| --- | --- |
| RLS | **ENABLE** auf allen drei Tabellen |
| Policies | **Keine** für `anon` / `authenticated` |
| Zugriff M2 | **Service Role** serverseitig |
| `mandant_id` | Aus vertrauenswürdigem Kontext — nie ungeprüft vom Client |
| Composite-FKs | Cross-Tenant verhindert |
| Später | Policies über `organization_members` — **nach** Auth-Sprint |
| Sensibles | Feingranulare Vorgangssichtbarkeit (Personal, Beschwerde) — **nicht M2** |

---

## 8. Anwendungsfälle (12)

### 1. Privatkunde besitzt Einfamilienhaus

| Ebene | Daten |
| --- | --- |
| Stammdaten (M1) | Kunde Müller; Adresse; EFH-Gebäude |
| Objektbeziehung | Müller → EFH, `rolle=eigentuemer`, `einheit_id` NULL |
| Vorgang | `gebaeude_id`=EFH |
| Beteiligte | Müller: `auftraggeber`, `ist_hauptbeteiligter=true` |
| Datenschutz | Keine fremden Vorgänge |
| Wiederverwendung | Bestehende M1-Stammdaten |

### 2. Mieter fragt für eigene Wohnung an

| Ebene | Daten |
| --- | --- |
| Objektbeziehung | Mieter → Einheit EG links, `rolle=mieter` |
| Vorgang | MFH + `einheit_id` |
| Beteiligte | Mieter: `anfragender` |
| Datenschutz | Kein Zugriff auf andere Wohnungen |

### 3. Eigentümer beauftragt und bezahlt

| Ebene | Daten |
| --- | --- |
| Objektbeziehung | Eigentümer → Objekt, `rolle=eigentuemer` |
| Beteiligte | Eigentümer: `auftraggeber`, `rechnungsempfaenger`, `zahlungspflichtiger` |

### 4. Mieter fragt an, Eigentümer wird Auftraggeber

| Ebene | Daten |
| --- | --- |
| Objektbeziehung | Mieter `mieter`; Eigentümer `eigentuemer` (parallel) |
| Beteiligte | Mieter `anfragender`; Eigentümer `auftraggeber` + `rechnungsempfaenger` |
| Datenschutz | Kommunikation mit Mieter ≠ Rechnung an Eigentümer |

### 5. Hausverwaltung beauftragt Treppenhaus

| Ebene | Daten |
| --- | --- |
| Objektbeziehung | HV → Einheit Treppenhaus, `rolle=hausverwaltung` |
| Vorgang | `einheit_id`=Treppenhaus |
| Beteiligte | HV: `auftraggeber`; optional Eigentümer `ansprechpartner` |

### 6. Mehrere Eigentümer / WG mit mehreren Mietern

| Ebene | Daten |
| --- | --- |
| Objektbeziehung | Zwei `eigentuemer`; zwei `mieter` an gleicher Einheit — **OK** |
| UNIQUE | Kein Duplikat **desselben** Kunden mit gleicher Rolle |
| Beteiligte | Je nach Vorgang getrennt über `vorgang_beteiligte` |

### 7. Mieterwechsel (Einzelmieter)

| Schritt | Aktion |
| --- | --- |
| Alt | Beziehung Mieter A: `gueltig_bis`, `aktiv=false` |
| Neu | Neue Zeile Mieter B, gleiche `einheit_id` |
| Einheit | **Unverändert** |
| Vorgänge | Bleiben bei Mieter A / altem Kontext |

### 8. Folgeanfrage zwei Jahre später

| Ebene | Daten |
| --- | --- |
| Vorgang | Neuer Datensatz; `vorgangstyp=folgeanfrage`; `parent_vorgang_id` optional |
| Beteiligte | **Neu** setzen — kein Auto-Copy |
| Stammdaten | Gleiche `gebaeude_id`/`einheit_id` referenzieren |

### 9. Reklamation zu früherem Vorgang

| Ebene | Daten |
| --- | --- |
| Vorgang | `vorgangstyp=reklamation`; `parent_vorgang_id` → Ursprung |
| Objekt | Aus Parent übernehmen (Server validiert) |
| Beteiligte | Neu bestätigen |

### 10. Unvollständige Nachricht — noch kein Vorgang

| Ebene | Daten |
| --- | --- |
| Anfrageeingang | Rohe Nachricht „Bitte zurückrufen“ — **spätere Entität**, **nicht** `vorgaenge` |
| Vorgang | **Wird nicht angelegt**, bis Kunde + Gebäude + Titel vorliegen |
| Kunde | Erst bei Klärung: `kundenstatus=vorlaeufig` mit **echten** Mindestdaten — **kein** Platzhalter |
| Beteiligte | Erst mit Vorgang |

### 11. Mehrere Ansprechpartner im Unternehmen

| Ebene | Daten |
| --- | --- |
| Beteiligte | Kunde A `ansprechpartner`; Kunde B `ansprechpartner` — erlaubt |
| Hauptbeteiligter | Pro Rolle max. einer mit `ist_hauptbeteiligter=true` |

### 12. Vorgang am gesamten Gebäude ohne Einheit

| Ebene | Daten |
| --- | --- |
| Vorgang | `gebaeude_id` gesetzt; `einheit_id` NULL |
| Objektbeziehung | Eigentümer → Gebäude, `einheit_id` NULL |
| Typisch | EFH, MFH-Dach, Gesamtauftrag |

---

## 9. Migrationsreihenfolge (DDL — Spezifikation)

```
 1. M1-Ergänzungen
      → kunden: kundenstatus, UNIQUE (mandant_id, id)
      → einheiten: UNIQUE (mandant_id, id), UNIQUE (mandant_id, gebaeude_id, id)

 2. Tabelle kunden_objekt_beziehungen
      → Composite-FK (mandant_id, gebaeude_id, einheit_id) → einheiten
      → partielle UNIQUE-Indizes A + B

 3. Tabelle vorgaenge
      → ohne kunde_id; beendet_am; Composite-FK Einheit↔Gebäude

 4. Tabelle vorgang_beteiligte
      → FKs, UNIQUE, partial UNIQUE Hauptbeteiligter

 5. updated_at-Trigger (3 Tabellen)

 6. RLS ENABLE (3 Tabellen, keine Policies)

 7. Grants — nur soweit für Service Role nötig
```

`kunden_objekt_beziehungen` und `vorgaenge` sind **unabhängig** — Reihenfolge 2/3 vertauschbar. `vorgang_beteiligte` **nach** `vorgaenge`.

---

## 10. Testspezifikation (nach DDL)

| # | Szenario | Erwartung |
| --- | --- | --- |
| T1 | Mehrere aktive Mieter (verschiedene Kunden) gleiche Einheit | OK |
| T2 | Doppelte aktive Beziehung gleicher Kunde/Objekt/Rolle | UNIQUE-Fehler |
| T3 | Doppelte aktive Gebäude-Beziehung bei `einheit_id` NULL | UNIQUE-Fehler (Index B) |
| T4 | Inaktive alte Beziehung + neue aktive gleiche Kombination | OK |
| T5 | `aktiv=false` ohne `gueltig_bis` | CHECK-Fehler |
| T6 | `gueltig_bis` vor `gueltig_ab` | CHECK-Fehler |
| T7 | Einheit aus fremdem Gebäude (Composite-FK) | FK-Fehler |
| T8 | Einheit aus fremdem Mandanten | FK-Fehler |
| T9 | Vorgang am gesamten Gebäude (`einheit_id` NULL) | OK |
| T10 | Vorgang mit passender Einheit | OK |
| T11 | Vorgang mit falscher Einheit/Gebäude-Kombination | FK-Fehler |
| T12 | Gleiche `vorgangsnummer`, gleicher Mandant | UNIQUE-Fehler |
| T13 | Gleiche `vorgangsnummer`, anderer Mandant | OK |
| T14 | Endstatus ohne `beendet_am` | CHECK-Fehler |
| T15 | Aktiver Status mit `beendet_am` gesetzt | CHECK-Fehler |
| T16 | `parent_vorgang_id = id` (Selbstreferenz) | CHECK-Fehler |
| T17 | Reklamation mit gültigem `parent_vorgang_id` | OK |
| T18 | Mieter `anfragender`, Eigentümer `auftraggeber`/`rechnungsempfaenger` | OK |
| T19 | Derselbe Kunde mit mehreren Rollen im Vorgang | OK |
| T20 | Doppelte identische Beteiligtenrolle | UNIQUE-Fehler |
| T21 | Zwei Hauptauftraggeber im selben Vorgang | partial UNIQUE-Fehler |
| T22 | Mehrere normale Ansprechpartner (ohne Hauptkennzeichnung) | OK |
| T23 | RLS: anon/authenticated | Kein Zugriff |
| T24 | Service Role CRUD | OK |
| T25 | Bestandsschutz M1 + `/admin`-Tabellen | OK |
| T26 | Vollständiger Cleanup temporärer Testdaten | OK |

---

## 11. Offene Entscheidungen / Blocker vor Migration 2

| # | Punkt | Status |
| --- | --- | --- |
| B1 | Mehrere Mieter/Mitnutzer pro Einheit | ✅ **Entschieden** |
| B2 | Composite-FK `(mandant_id, gebaeude_id, einheit_id)` | ✅ **Entschieden** |
| B3 | Anfrageeingang vs. Vorgang | ✅ **Entschieden** — Eingang nicht in M2 |
| B4 | `kundenstatus` vorläufig/bestätigt | ✅ **Entschieden** |
| B5 | Kein `kunde_id` auf `vorgaenge` | ✅ **Entschieden** |
| B6 | aktiv/Gültigkeit ohne `current_date` | ✅ **Entschieden** |
| B7 | `beendet_am` für abgeschlossen + abgebrochen | ✅ **Entschieden** |
| — | `vorgangsnummer`-Sequenz RPC | ⬜ Nach M2 |
| — | Auth-/Mitgliedschafts-Sprint | ⬜ Vor UI |
| O1 | Tabelle Anfrageeingang | ✅ Spezifikation M3 — [`14-spezifikation-migration-3-anfrageeingang.md`](./14-spezifikation-migration-3-anfrageeingang.md), ADR-0018 |
| O2 | Kunden-Merge-Workflow | ⬜ Post-M2 |
| O3 | Feingranulare Vorgangssichtbarkeit | ⬜ Post-M2 |

---

## 12. Qualitätsprüfung

| Kriterium | Ergebnis |
| --- | --- |
| Mehrere Mieter/Mitnutzer möglich | ✅ |
| Einheit nicht mit falschem Gebäude kombinierbar | ✅ Composite-FK |
| Keine Platzhalterkunden | ✅ |
| Unvollständige Nachricht ≠ Vorgang | ✅ |
| Beteiligte = Source of Truth | ✅ kein kunde_id |
| Keine widersprüchliche Aktiv-/Datumslogik | ✅ ohne current_date |
| Mieterwechsel historisch korrekt | ✅ |
| Keine Änderung /admin, M1 unverändert außer kundenstatus/UNIQUE | ✅ |

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-27 | Erstversion — Spezifikation Migration 2 |
| 2026-07-27 | Blocker B1–B7 finalisiert (Mieter, Composite-FK, kundenstatus, beendet_am) |
| 2026-07-27 | DDL Migration `20260717290000_operative_beziehungen_vorgaenge_v1.sql` |
