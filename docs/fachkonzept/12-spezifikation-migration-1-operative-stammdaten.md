# Spezifikation: Migration 1 — Operative Stammdaten

Technische **Spezifikation** für die erste operative Datenbank-Migration (Stammdaten). **Noch keine SQL-Datei, keine RPC, keine UI.**

**Status:** Verbindliche Spezifikation — **finalisiert (B1–B3 entschieden)** — bereit für DDL-Umsetzung  
**Datum:** 2026-07-26  
**Bezug:** ADR-0013, ADR-0014, ADR-0015, ADR-0016, [`10-technisches-kunden-und-objektmodell.md`](./10-technisches-kunden-und-objektmodell.md)

---

## Ziel

Migration 1 legt **vier neue Tabellen** für die operative Kundenplattform (`/`) an:

| Tabelle | Zweck |
| --- | --- |
| `kunden` | Endkunden des Handwerksbetriebs |
| `adressen` | Mandantenbezogene Standortangaben |
| `gebaeude` | Objekte an Adressen |
| `einheiten` | Einheiten und Objektbereiche innerhalb von Gebäuden |

Alle Tabellen sind **mandantenscharf** (`mandant_id` → `organizations.id`).

---

## Nicht-Ziele (Migration 1)

| Ausgeschlossen | Grund |
| --- | --- |
| Änderung an `/admin`-Tabellen | ADR-0014 |
| `vorgaenge`, `kunden_objekt_beziehungen` | Folge-Migration |
| Operative Angebote, Projekte, Rechnungen | Eigene Domäne / spätere Migration |
| `public.customers` anfassen | Legacy, 0 Zeilen, deprecate später |
| Backfill aus `customers` | Entfällt |
| Sequenz-RPC für `kundennummer` | Serverlogik später |
| Gewerkespezifische `jsonb`-Validierung | O5 offen |
| RLS-Policies für `authenticated` / `anon` | **Bewusst ausgeschlossen** — siehe B2 |
| Browser-Direktzugriff auf operative Tabellen | **Nein** in M1 |

---

## Gemeinsame Konventionen (alle vier Tabellen)

| Aspekt | Spezifikation |
| --- | --- |
| Primary Key | `id uuid NOT NULL DEFAULT gen_random_uuid()` |
| Mandant | `mandant_id uuid NOT NULL` → `organizations.id` **ON DELETE RESTRICT** |
| Zeitstempel | `created_at timestamptz NOT NULL DEFAULT now()` |
| | `updated_at timestamptz NOT NULL DEFAULT now()` |
| `updated_at`-Trigger | **`public.set_updated_at()`** wiederverwenden (existiert in `20260717090000_mandanten_onboarding_mvp.sql`) |
| Archivierung | `aktiv boolean NOT NULL DEFAULT true` |
| | `archiviert_am timestamptz NULL` |
| | **Kein** `archiviert_von` in V1 (ADR-0016) |
| Hard Delete | **Nicht** vorgesehen — `ON DELETE RESTRICT` auf FKs |
| RLS | `ENABLE ROW LEVEL SECURITY` — Policies siehe unten |

### Archivierungs-CHECK (verbindlich, alle vier Tabellen)

```sql
CHECK (
  (aktiv = true  AND archiviert_am IS NULL)
  OR
  (aktiv = false AND archiviert_am IS NOT NULL)
)
```

**Finale Bewertung:**

| Aspekt | Bewertung |
| --- | --- |
| Sinnvoll | **Ja** — erzwingt konsistenten Soft-Archive-Zustand |
| Reaktivierung | **Ja** — `aktiv = true`, `archiviert_am = NULL` in **einem** UPDATE |
| Atomare Änderung | **Ja** — App/Server muss `aktiv` und `archiviert_am` **immer gemeinsam** setzen; CHECK verhindert Halbzustände |
| Archivieren | `aktiv = false`, `archiviert_am = now()` (oder expliziter Zeitstempel) |

Constraint-Name pro Tabelle: `{tabelle}_aktiv_archiviert_check`.

---

## 1. Tabelle `kunden`

### Feldspezifikation

| Spalte | Typ | NULL | Default | Beschreibung |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `mandant_id` | `uuid` | NO | — | FK → `organizations.id` RESTRICT |
| `kundennummer` | `text` | **NO** | — | Mandanten-eindeutig — siehe Entscheidung |
| `kundentyp` | `text` | NO | — | `privatperson`, `unternehmen`, `sonstiges` |
| `firmenname` | `text` | YES | — | Pflicht bei `unternehmen` |
| `vorname` | `text` | YES | — | Pflicht bei `privatperson` |
| `nachname` | `text` | YES | — | Pflicht bei `privatperson` |
| `anzeigename` | `text` | NO | — | Immer gespeichert (Anzeige, Suche) |
| `email` | `text` | YES | — | Nicht eindeutig |
| `telefon` | `text` | YES | — | Nicht eindeutig |
| `mobil` | `text` | YES | — | Nicht eindeutig |
| `umsatzsteuer_id` | `text` | YES | — | Optional |
| `notizen` | `text` | YES | — | Intern |
| `aktiv` | `boolean` | NO | `true` | Archivierung |
| `archiviert_am` | `timestamptz` | YES | — | Siehe Archivierungs-CHECK |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | Trigger |

### Zusätzliche Kontaktfelder (Prüfung V1)

| Feld | V1? | Begründung |
| --- | --- | --- |
| `email`, `telefon`, `mobil` | **Ja** | Standard-Kontakt im Handwerk |
| Fax, Website, Rechtsform | **Nein** | Später / Unternehmens-Stammdaten |
| Ansprechpartner-Tabelle | **Nein** | Explizit ausgeschlossen — Folge-Migration |

### CHECK-Constraints

| Constraint | Regel |
| --- | --- |
| `kunden_kundentyp_check` | `kundentyp IN ('privatperson', 'unternehmen', 'sonstiges')` |
| `kunden_anzeigename_not_empty` | `length(trim(anzeigename)) > 0` |
| `kunden_kundennummer_not_empty` | `length(trim(kundennummer)) > 0` |
| `kunden_typ_privatperson_check` | Wenn `kundentyp = 'privatperson'`: `vorname` und `nachname` NOT NULL und nicht leer |
| `kunden_typ_unternehmen_check` | Wenn `kundentyp = 'unternehmen'`: `firmenname` NOT NULL und nicht leer |
| `kunden_typ_sonstiges_check` | Wenn `kundentyp = 'sonstiges'`: `anzeigename` nicht leer ( durch allgemeinen CHECK abgedeckt) |
| `kunden_aktiv_archiviert_check` | Archivierungs-CHECK |

**Hinweis:** `anzeigename` wird **serverseitig** aus Typ-Feldern abgeleitet und **immer persistiert** (z. B. „Max Müller“, „Müller GmbH“).

### Indizes

| Index | Spalten | Zweck |
| --- | --- | --- |
| **UNIQUE** | `(mandant_id, kundennummer)` | Mandanten-eindeutige Nummer |
| B-tree | `(mandant_id, aktiv)` | Aktive Kundenliste |
| B-tree | `(mandant_id, lower(anzeigename))` | Namenssuche (optional GIN/trgm später) |

### Foreign Keys

| FK | Referenz | ON DELETE |
| --- | --- | --- |
| `kunden_mandant_id_fkey` | `organizations(id)` | **RESTRICT** |

---

## 2. Kundennummer — Entscheidung

| Aspekt | Entscheidung |
| --- | --- |
| Eindeutigkeit | **UNIQUE `(mandant_id, kundennummer)`** — nicht global |
| NOT NULL | **Ja — empfohlen und verbindlich für M1** |
| Begründung NOT NULL | Jeder Kunde ist von Anlage an identifizierbar; vermeidet mehrfache NULL in UNIQUE; analog Live-`customers.customer_number` NOT NULL |
| Auto-Sequenz RPC | **Nein** in M1 — Vergabe durch **Server Action** / spätere Logik |
| Format-CHECK | **Nein** in M1 — flexibel (`K-00001`, `2026-0042`, …) |
| Konflikt | INSERT schlägt fehl bei Duplikat — App muss Nummer vor INSERT setzen |

---

## 3. Tabelle `adressen`

### Feldspezifikation

| Spalte | Typ | NULL | Default | Beschreibung |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `mandant_id` | `uuid` | NO | — | FK → `organizations.id` RESTRICT |
| `strasse` | `text` | NO | — | Original |
| `hausnummer` | `text` | NO | — | Original |
| `adresszusatz` | `text` | YES | — | Nicht im Fingerprint |
| `plz` | `text` | NO | — | Original |
| `ort` | `text` | NO | — | Original |
| `land` | `text` | NO | `'Deutschland'` | Original |
| `strasse_normalisiert` | `text` | NO | — | Suche/Dubletten |
| `hausnummer_normalisiert` | `text` | NO | — | Suche/Dubletten |
| `plz_normalisiert` | `text` | NO | — | Suche/Dubletten |
| `ort_normalisiert` | `text` | NO | — | Suche/Dubletten |
| `land_normalisiert` | `text` | NO | — | Suche/Dubletten |
| `adress_fingerprint` | `text` | NO | — | Mandanteninterner Dubletten-Key |
| `aktiv` | `boolean` | NO | `true` | |
| `archiviert_am` | `timestamptz` | YES | — | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |

**Keine** `kunde_id` — Adressen sind ** nicht** an Kunden gebunden (ADR-0015).

### Normalisierung und Fingerprint — **Entscheidung B1 (verbindlich)**

| Aspekt | Entscheidung |
| --- | --- |
| **Source of Truth** | **Datenbank** — Funktionen/Trigger setzen `*_normalisiert` und `adress_fingerprint` |
| App-Code | Anzeigen/Vorprüfen erlaubt — **nicht** alleinige Schreibquelle |
| Trigger | **BEFORE INSERT OR UPDATE** bei Änderung relevanter Originalspalten |
| Postalische Korrektur | **Nein** |
| Straßensuffixe | **Keine** aggressive Abkürzungsauflösung |
| Unicode | **NFC** + Kleinschreibung |
| Leerzeichen | Trim + Reduktion mehrfacher Leerzeichen |
| Hausnummer | Zwischenräume entfernen, Bestandteile erhalten |
| `adresszusatz` | **Nicht** im Fingerprint |
| Fingerprint | Aus: `strasse_normalisiert`, `hausnummer_normalisiert`, `plz_normalisiert`, `ort_normalisiert`, `land_normalisiert` |
| `mandant_id` | **Nicht** im Fingerprint — Scope via Index `(mandant_id, adress_fingerprint)` |
| UNIQUE Fingerprint | **Nein** |
| Auto-Merge | **Verboten** |

#### pgcrypto / `digest()` — Prüfung

| Prüfung | Ergebnis |
| --- | --- |
| `CREATE EXTENSION pgcrypto` in Repo | **Nein** |
| `gen_random_uuid()` | Genutzt (Supabase-Standard) |

**Empfehlung M1:** **Stabile Textverkettung** mit Trennzeichen `\|` — **kein** pgcrypto-Zwang, kein `digest()` in M1.

### CHECK-Constraints

| Constraint | Regel |
| --- | --- |
| Pflichtfelder nicht leer | `trim(strasse)`, `trim(hausnummer)`, `trim(plz)`, `trim(ort)`, `trim(land)` length > 0 |
| Normalisierte Felder nicht leer | analog für `*_normalisiert` und `adress_fingerprint` |
| `adressen_aktiv_archiviert_check` | Archivierungs-CHECK |

**PLZ:** `text` (internationale Formate); Länge optional `check (length(trim(plz)) between 3 and 12)` — empfohlen.

### Indizes

| Index | Spalten | Zweck |
| --- | --- | --- |
| B-tree | `(mandant_id, adress_fingerprint)` | Dublettenkandidaten |
| B-tree | `(mandant_id, aktiv)` | Aktive Adressen |
| B-tree | `(mandant_id, plz_normalisiert, ort_normalisiert)` | PLZ/Ort-Suche |

### Foreign Keys / UNIQUE für Composite FK

| Constraint | Definition |
| --- | --- |
| FK Mandant | `mandant_id` → `organizations(id)` RESTRICT |
| **UNIQUE** | `(mandant_id, id)` — für zusammengesetzte Child-FKs |

---

## 4. Tabelle `gebaeude`

### Feldspezifikation

| Spalte | Typ | NULL | Default | Beschreibung |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `mandant_id` | `uuid` | NO | — | FK → `organizations.id` RESTRICT |
| `adresse_id` | `uuid` | NO | — | FK → `adressen` (zusammengesetzt) |
| `gebaeudeart` | `text` | NO | — | ADR-0016-Werteset |
| `gebaeudebezeichnung` | `text` | YES | — | Nullable; siehe **B3** |
| `technische_stammdaten` | `jsonb` | NO | `'{}'` | Keine Schema-Validierung M1 |
| `aktiv` | `boolean` | NO | `true` | |
| `archiviert_am` | `timestamptz` | YES | — | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |

### `gebaeudeart` CHECK

`einfamilienhaus`, `mehrfamilienhaus`, `wohn_und_geschaeftshaus`, `gewerbeobjekt`, `industrieobjekt`, `oeffentliches_gebaeude`, `nebengebaeude`, `sonstiges`

Kein PostgreSQL-ENUM (ADR-0016).

### Regeln — **Entscheidung B3 (verbindlich)**

| Regel | M1 |
| --- | --- |
| Mehrere Gebäude pro Adresse | **Erlaubt** (1:n) |
| Mandant = Adress-Mandant | **Zusammengesetzter FK** |
| `gebaeudebezeichnung` | **Nullable** — bedingte Pflicht nur **Servervalidierung** (später) |
| DB bei gesetzter Bezeichnung | CHECK: `IS NULL OR length(trim(gebaeudebezeichnung)) > 0` |
| Normalisierte Bezeichnung / Dublettenindex | **Später**, falls Bedarf |

### CHECK-Constraints (zusätzlich)

| Constraint | Regel |
| --- | --- |
| `gebaeude_gebaeudeart_check` | ADR-0016-Werteset |
| `gebaeude_bezeichnung_not_empty` | Wenn gesetzt, nicht leer |
| `gebaeude_aktiv_archiviert_check` | Archivierungs-CHECK |

### Foreign Keys

| FK | Definition | ON DELETE |
| --- | --- | --- |
| Mandant | `(mandant_id)` → `organizations(id)` | RESTRICT |
| Adresse (composite) | `(mandant_id, adresse_id)` → `adressen(mandant_id, id)` | **RESTRICT** |
| UNIQUE für Children | `(mandant_id, id)` | — |

**PostgreSQL-Bewertung:** Zusammengesetzte FKs mit `UNIQUE (mandant_id, id)` auf Parent sind **Standard-Multi-Tenant-Pattern** und **korrekt**.

### Indizes

| Index | Spalten |
| --- | --- |
| B-tree | `(mandant_id, adresse_id)` |
| B-tree | `(mandant_id, aktiv)` |

---

## 5. Tabelle `einheiten`

### Feldspezifikation

| Spalte | Typ | NULL | Default | Beschreibung |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | NO | `gen_random_uuid()` | PK |
| `mandant_id` | `uuid` | NO | — | FK → `organizations.id` RESTRICT |
| `gebaeude_id` | `uuid` | NO | — | FK → `gebaeude` (zusammengesetzt) |
| `bezeichnung` | `text` | NO | — | Original — Anzeige |
| `bezeichnung_normalisiert` | `text` | NO | — | DB-Trigger — Eindeutigkeit |
| `einheit_typ` | `text` | NO | — | ADR-0016-Werteset |
| `nummer` | `text` | YES | — | Wohnungs-/Gewerbenr. |
| `etage` | `text` | YES | — | |
| `lage` | `text` | YES | — | links/rechts/… |
| `technische_stammdaten` | `jsonb` | NO | `'{}'` | |
| `aktiv` | `boolean` | NO | `true` | |
| `archiviert_am` | `timestamptz` | YES | — | |
| `created_at` | `timestamptz` | NO | `now()` | |
| `updated_at` | `timestamptz` | NO | `now()` | |

**Keine** Kunden-/Mieter-FKs. Mieterwechsel später über `kunden_objekt_beziehungen`.

### `einheit_typ` CHECK

`wohnung`, `gewerbeeinheit`, `gemeinschaftsbereich`, `funktionsbereich`, `gebaeudeteil`, `sonstiges`

### Regeln

| Regel | M1 |
| --- | --- |
| Einheit pro Gebäude optional | **Ja** — keine DB-Pflicht „mindestens eine Einheit“ |
| Bezeichnung eindeutig (aktiv) | Partieller UNIQUE auf **`bezeichnung_normalisiert`** — siehe B1/Einheiten |
| Normalisierung Bezeichnung | **DB-Trigger** (gleiche Regeln wie Text-Normalisierung: trim, lower, NFC, Leerzeichen) |
| Varianten | „EG links“, „eg links“, „ EG  links “ → gleiche `bezeichnung_normalisiert` |
| Keine personenbezogenen Daten | **Ja** — nur technische/strukturelle Daten |

### Foreign Keys

| FK | Definition | ON DELETE |
| --- | --- | --- |
| Mandant | `mandant_id` → `organizations(id)` | RESTRICT |
| Gebäude (composite) | `(mandant_id, gebaeude_id)` → `gebaeude(mandant_id, id)` | **RESTRICT** |

### Indizes

| Index | Definition |
| --- | --- |
| **UNIQUE partial** | `(mandant_id, gebaeude_id, bezeichnung_normalisiert) WHERE aktiv = true` |
| B-tree | `(mandant_id, gebaeude_id)` |
| B-tree | `(mandant_id, aktiv)` |

---

## 6. FK- und Löschregeln (Zusammenfassung)

```
organizations
    ↑ RESTRICT
    ├── kunden (mandant_id)
    ├── adressen (mandant_id)  UNIQUE (mandant_id, id)
    │       ↑ RESTRICT composite
    │       └── gebaeude (mandant_id, adresse_id)  UNIQUE (mandant_id, id)
    │               ↑ RESTRICT composite
    │               └── einheiten (mandant_id, gebaeude_id)
```

| Regel | Wert |
| --- | --- |
| ON DELETE | **RESTRICT** überall — kein CASCADE auf fachlichen Daten |
| CASCADE | **Nicht** verwenden |
| Composite FKs | **Ja** — verhindert mandantenübergreifende Verknüpfungen auf DB-Ebene |

---

## 7. RLS — **Entscheidung B2 (verbindlich)**

| Aspekt | M1 |
| --- | --- |
| RLS aktivieren | **Ja** auf `kunden`, `adressen`, `gebaeude`, `einheiten` |
| Policies `authenticated` | **Nein** in M1 |
| Policies `anon` | **Nein** in M1 |
| Browser-Direktzugriff | **Nein** — kein PostgREST-Client-Zugriff für Endnutzer |
| Zugriff M1 | **Nur serverseitig** über **Service Role** |
| Service Role | `mandant_id` aus **vertrauenswürdigem** Serverkontext — **nie** ungeprüft vom Client |
| `organization_members` | **Später** Policy-Grundlage — **nicht** in M1 ändern |
| Auth-/Mitgliedschafts-Sprint | **Pflicht** vor erster operativer UI |

**RLS ohne Policies ist Absicht — kein Fehler.** Default: `authenticated`/`anon` haben **keinen** Zugriff; Service Role bypassed RLS (Supabase-Standard).

### Policy-Vorbereitung (Post-M1, nicht in Migration)

```text
mandant_id IN (
  SELECT organization_id FROM organization_members
  WHERE user_id = auth.uid()
)
```

| Akteur (später) | Ziel |
| --- | --- |
| SaaS-Admin | Kein operativer Standardzugriff |
| Mandanten-Admin | CRUD im eigenen Mandant |
| Operative Benutzer | Lesen/Schreiben im Mandant; feinere Rollen später |

---

## 8. Funktionen und Trigger (Migration 1 — Spezifikation, kein SQL)

### Wiederverwendung

| Objekt | Status |
| --- | --- |
| `public.set_updated_at()` | **Besteht** — Trigger auf allen vier Tabellen |

### Neue Funktionen

| Funktion | Volatility | Security | `search_path` | Zweck |
| --- | --- | --- | --- | --- |
| `public.normalize_operative_text(text)` | **IMMUTABLE** | **INVOKER** | `public` | Trim, NFC, lowercase, Leerzeichen reduzieren |
| `public.normalize_hausnummer(text)` | **IMMUTABLE** | **INVOKER** | `public` | Trim, Leerzeichen entfernen, lowercase |
| `public.normalize_land(text)` | **STABLE** | **INVOKER** | `public` | Trim, lowercase, Alias (`deutschland`/`de` → `de`) |
| `public.build_adress_fingerprint(...)` | **IMMUTABLE** | **INVOKER** | `public` | Delimited join der 5 normalisierten Felder |
| `public.adressen_normalize_row()` | **VOLATILE** | **INVOKER** | `public` | Trigger: setzt `*_normalisiert` + `adress_fingerprint` auf NEW |
| `public.einheiten_normalize_bezeichnung_row()` | **VOLATILE** | **INVOKER** | `public` | Trigger: setzt `bezeichnung_normalisiert` auf NEW |

**Kein** `SECURITY DEFINER` — Normalisierung braucht keine Rechte-Eskalation.

### Trigger

| Trigger | Tabelle | Timing | Funktion |
| --- | --- | --- | --- |
| `kunden_set_updated_at` | `kunden` | BEFORE UPDATE | `set_updated_at()` |
| `adressen_set_updated_at` | `adressen` | BEFORE UPDATE | `set_updated_at()` |
| `adressen_normalize_before_insert_update` | `adressen` | BEFORE INSERT OR UPDATE OF strasse, hausnummer, plz, ort, land | `adressen_normalize_row()` |
| `gebaeude_set_updated_at` | `gebaeude` | BEFORE UPDATE | `set_updated_at()` |
| `einheiten_set_updated_at` | `einheiten` | BEFORE UPDATE | `set_updated_at()` |
| `einheiten_normalize_bezeichnung_before_insert_update` | `einheiten` | BEFORE INSERT OR UPDATE OF bezeichnung | `einheiten_normalize_bezeichnung_row()` |

**Hinweis:** Client darf normalisierte Spalten mitliefern — Trigger **überschreibt** sie (Source of Truth DB).

---

## 9. Finale DDL-Reihenfolge

```
 1. Extension-Prüfung (optional)
      → KEIN pgcrypto-Zwang in M1
      → gen_random_uuid() bereits verfügbar (Supabase)

 2. Normalisierungsfunktionen
      → normalize_operative_text, normalize_hausnummer, normalize_land
      → build_adress_fingerprint
      → adressen_normalize_row, einheiten_normalize_bezeichnung_row

 3. Tabelle kunden
      → Spalten, CHECKs, FK organizations RESTRICT
      → UNIQUE (mandant_id, kundennummer)

 4. Tabelle adressen
      → Spalten, CHECKs, FK organizations RESTRICT
      → UNIQUE (mandant_id, id)

 5. Tabelle gebaeude
      → Spalten, CHECKs, FK composite → adressen
      → UNIQUE (mandant_id, id)

 6. Tabelle einheiten
      → Spalten inkl. bezeichnung_normalisiert
      → CHECKs, FK composite → gebaeude

 7. Indizes (alle Tabellen)
      → siehe Abschnitt Constraint-/Index-Liste

 8. updated_at-Trigger (4 Tabellen)
      → set_updated_at()

 9. Normalisierungstrigger
      → adressen, einheiten

10. RLS ENABLE (4 Tabellen)
      → KEINE Policies in M1

11. Grants
      → Nur soweit für service_role / postgres erforderlich
      → Keine erweiterten Grants für anon/authenticated auf operative Tabellen
```

`kunden` und `adressen` (Schritte 3/4) vertauschbar.

---

## 10. Finale Constraint- und Index-Liste

### `kunden`

| Typ | Name / Definition |
| --- | --- |
| PK | `id` |
| FK | `mandant_id` → `organizations(id)` RESTRICT |
| UNIQUE | `(mandant_id, kundennummer)` |
| CHECK | `kundentyp`, Pflichtregeln privat/unternehmen, `anzeigename`, `kundennummer`, `aktiv/archiviert_am` |
| INDEX | `(mandant_id, aktiv)` |
| INDEX | `(mandant_id, lower(anzeigename))` |

### `adressen`

| Typ | Definition |
| --- | --- |
| PK | `id` |
| FK | `mandant_id` → `organizations(id)` RESTRICT |
| UNIQUE | `(mandant_id, id)` |
| CHECK | Original nicht leer, normalisiert nicht leer, PLZ-Länge optional, archiv |
| INDEX | `(mandant_id, adress_fingerprint)` — **kein UNIQUE** |
| INDEX | `(mandant_id, aktiv)` |
| INDEX | `(mandant_id, plz_normalisiert, ort_normalisiert)` |

### `gebaeude`

| Typ | Definition |
| --- | --- |
| PK | `id` |
| FK | `mandant_id` → `organizations(id)` RESTRICT |
| FK composite | `(mandant_id, adresse_id)` → `adressen(mandant_id, id)` RESTRICT |
| UNIQUE | `(mandant_id, id)` |
| CHECK | `gebaeudeart`, Bezeichnung not empty if set, archiv |
| INDEX | `(mandant_id, adresse_id)`, `(mandant_id, aktiv)` |

### `einheiten`

| Typ | Definition |
| --- | --- |
| PK | `id` |
| FK | `mandant_id` → `organizations(id)` RESTRICT |
| FK composite | `(mandant_id, gebaeude_id)` → `gebaeude(mandant_id, id)` RESTRICT |
| CHECK | `einheit_typ`, `bezeichnung` not empty, archiv |
| UNIQUE partial | `(mandant_id, gebaeude_id, bezeichnung_normalisiert) WHERE aktiv = true` |
| INDEX | `(mandant_id, gebaeude_id)`, `(mandant_id, aktiv)` |

---

## 11. Testfälle (nach DDL)

| # | Szenario | Erwartung |
| --- | --- | --- |
| T1 | `privatperson` mit vorname+nachname+anzeigename | OK |
| T2 | `privatperson` ohne nachname | CHECK-Fehler |
| T3 | `unternehmen` mit firmenname | OK |
| T4 | `unternehmen` ohne firmenname | CHECK-Fehler |
| T5 | `sonstiges` mit anzeigename | OK |
| T6 | Gleiche `kundennummer`, gleicher Mandant | UNIQUE-Fehler |
| T7 | Gleiche `kundennummer`, anderer Mandant | OK |
| T8 | Adresse INSERT — Normalisierung deterministisch | Gleiche Eingabe → gleiche `*_normalisiert` + Fingerprint |
| T9 | Gleicher Fingerprint, zwei Mandanten | **Beide OK** — kein Cross-Tenant-Effekt |
| T10 | Gleicher Fingerprint, gleicher Mandant, zweite Zeile | **OK** — kein Auto-Merge, kein UNIQUE |
| T11 | Zwei `gebaeude` an einer `adresse_id` | OK |
| T12 | `gebaeude` mit fremder `adresse_id` (composite FK) | FK-Fehler |
| T13 | Zwei aktive `einheiten`: „EG links“ und „eg links“ | UNIQUE-Fehler auf `bezeichnung_normalisiert` |
| T14 | Archivierte Einheit + neue aktive gleiche Bezeichnung | OK |
| T15 | Reaktivierung archivierte Einheit bei bereits aktiver gleicher Bezeichnung | UNIQUE-Fehler |
| T16 | `aktiv=false` ohne `archiviert_am` | CHECK-Fehler |
| T17 | Reaktivierung atomar `aktiv=true`, `archiviert_am=NULL` | OK |
| T18 | RLS: `anon` SELECT | **Kein Zugriff** |
| T19 | RLS: `authenticated` SELECT ohne Policy | **Kein Zugriff** |
| T20 | Service Role INSERT/SELECT mit `mandant_id` | OK |
| T21 | Keine Änderung an `organizations`, `angebote`, `customers` | OK |

---

## 12. Verbleibende Blocker vor dem Schreiben der Migration

| # | Blocker | Status |
| --- | --- | --- |
| B1 | Normalisierung DB vs. App | ✅ **Entschieden** — DB-Trigger |
| B2 | RLS Policies M1 | ✅ **Entschieden** — ENABLE only, keine Policies |
| B3 | Gebäudebezeichnung bedingt | ✅ **Entschieden** — Server später, DB nur not-empty |
| — | Auth-/Mitgliedschafts-Sprint | ⬜ Vor operativer UI |
| B4 | GIN/trgm auf `anzeigename` | Optional |
| B5 | Land-Alias-Liste finalisieren | In `normalize_land()` bei DDL |
| B6 | Deprecation `customers` | Separate Migration |
| O4 | Operatives Angebot | Offen |
| O5 | Gewerkespezifische jsonb | Offen |

---

## 13. Qualitätsprüfung (Checkliste)

| Kriterium | Status |
| --- | --- |
| `/admin` unverändert | ✅ Keine Admin-Tabellen in M1 |
| Keine operativen `angebote` | ✅ Nicht in M1 |
| `customers` unangetastet | ✅ |
| Keine personenbezogenen Daten an Gebäude/Einheit | ✅ |
| Jede Tabelle mandantenscharf | ✅ |
| Keine Cascades | ✅ RESTRICT |
| Keine globale Adresse | ✅ `mandant_id` + kein globaler Fingerprint |
| Kein Auto-Merge Dubletten | ✅ Kein UNIQUE auf Fingerprint |
| Implementierung nicht vorgetäuscht | ✅ Nur Spezifikation |

---

## Verweise

| Dokument | Inhalt |
| --- | --- |
| ADR-0013 | Gesamtmodell |
| ADR-0014 | Domänentrennung |
| ADR-0015 | Adressen, 1:n Gebäude |
| ADR-0016 | Gebäudearten, Einheiten, Archivierung, RLS-Grundlagen |
| [`11-analyse-bestehende-endkundenstruktur.md`](./11-analyse-bestehende-endkundenstruktur.md) | `customers` Legacy |

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-26 | Erstversion — Spezifikation Migration 1 |
| 2026-07-26 | Finalisierung B1–B3, Trigger/Funktionen, DDL-Reihenfolge, Tests |
