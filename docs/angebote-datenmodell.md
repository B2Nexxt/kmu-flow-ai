# Technisches Datenmodell: Angebotsmodul V1

Diese Dokumentation beschreibt die **technische Abbildung** des Angebotsmoduls in PostgreSQL (Supabase). Sie ist die Grundlage für die spätere Migration und serverseitige Persistierung.

**Version:** 1  
**Status:** Schema-Migration implementiert (`20260717200000_angebote_v1.sql`); `create_angebot` und `freigeben_angebot` implementiert; weitere RPCs und Anwendung folgen  
**Bezug:** Fachliche Spezifikation Angebotsmodul V1, `docs/datenmodell.md`, `docs/entscheidungen.md`

---

## Geltungsbereich

### In Scope (V1)

| Bereich | Beschreibung |
| --- | --- |
| Tabellen | `angebote`, `angebot_versionen`, `angebot_positionen`, `angebotsnummer_sequenzen` |
| Mandantenbezug | `angebote.organization_id` → `organizations.id` (Pflicht-FK, V1-Scope) |
| Versionierung | Stabile Angebots-Identität mit versionierten Inhalten |
| Empfänger | Snapshot-Felder in `angebot_versionen` (kein separater Empfänger-Datensatz) |
| Geldmodell | Einzelpreis in Cent, Positionsrabatt, berechnete Summen |
| PDF | Vorbereitung über Storage-Pfad und Zeitstempel pro Version |

### Out of Scope (V1)

| Bereich | Beschreibung |
| --- | --- |
| CRM-FK | Kein `customer_id` → `customers.id`; operative Endkunden werden nicht per FK verknüpft |
| Herkunfts-FK | Keine Verknüpfung zu Beratung, Prozessanalyse, Vertrag, Projekt |
| Kopf-/Gesamtrabatt | Kein Rabatt auf Angebots- oder Versionsebene |
| PDF-Erzeugung | Kein Generator, kein Download (Bucket-Name und Pfadkonvention sind festgelegt) |
| Dokumentenmodul | Keine `dokumente`-Tabelle |
| Berechtigungen | Kein RLS; Schreibzugriffe laufen serverseitig (wie Mandanten-Onboarding) |

### Verweis in zentraler Dokumentation

In `docs/datenmodell.md` (Abschnitt **Angebote**) verweist ein Link auf diese Datei.

---

## Übersicht

```
organizations
    │
    └── 1:n  angebote
                │
                ├── n:1  angenommene_version_id   → angebot_versionen  (optional)
                ├── n:1  versendete_version_id    → angebot_versionen  (optional)
                │
                └── 1:n  angebot_versionen
                            │
                            └── 1:n  angebot_positionen

angebotsnummer_sequenzen   (global, pro Kalenderjahr)
```

**Kein zirkulärer FK:** Es gibt **kein** `angebote.aktuelle_version_id`. Die aktuelle Version wird über Abfrage- bzw. RPC-Logik bestimmt (siehe Abschnitt 5.1).

### Trennung Container und Version

| Ebene | Rolle |
| --- | --- |
| **`angebote.status`** | Aktueller **Gesamtzustand** des Vorgangs (Workflow: entwurf → freigegeben → versendet → …) |
| **`angebot_versionen`** | **Unveränderliche Historie** einzelner Fassungen; versendete/angenommene Fassungen bleiben eingefroren |
| **Neue Version** | `angebote.status` wechselt zurück auf **`entwurf`**; alte Fassungen behalten `ist_eingefroren = true` |

---

## 1. Tabellen und Spalten

Konventionen (analog zu bestehenden Migrationen):

- Primärschlüssel: `uuid`, Default `gen_random_uuid()`
- Zeitstempel: `timestamptz`, Default `now()`
- Textfelder ohne Längenbegrenzung in PostgreSQL als `text`
- Geldbeträge in Cent: `bigint`
- Boolean-Defaults: `false`, sofern nicht anders angegeben

---

### 1.1 `angebote`

Logischer Angebots-Container: Identität, Mandantenbezug, Angebotsnummer, Workflow-Status.

| Spalte | Datentyp | NOT NULL | Default | Beschreibung |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | ja | `gen_random_uuid()` | Primärschlüssel |
| `organization_id` | `uuid` | ja | — | FK → `organizations.id`; Mandant, dem das Angebot zugeordnet ist (**V1-Scope**) |
| `angebotsnummer` | `text` | nein | — | Format `AN-YYYY-NNNN`; `NULL` bis zur Freigabe, danach unveränderlich |
| `status` | `text` | ja | `'entwurf'` | Workflow-Status (siehe Abschnitt 3) |
| `angenommene_version_id` | `uuid` | nein | — | FK → `angebot_versionen`; historisch angenommene Version **desselben** Angebots |
| `versendete_version_id` | `uuid` | nein | — | FK → `angebot_versionen`; **aktuell maßgebliche** versendete Version desselben Angebots |
| `created_at` | `timestamptz` | ja | `now()` | Erstellzeitpunkt |
| `updated_at` | `timestamptz` | ja | `now()` | Letzte Änderung am Container |

**Liegen hier:** Identität, Nummer, Status, Mandanten-FK, Verweise auf angenommene/versendete Version.  
**Liegen nicht hier:** Positionsdaten, Empfänger-Snapshot, Angebotsinhalte, Summen, aktuelle Version als FK.

---

### 1.2 `angebot_versionen`

Versionierter Inhalts-Snapshot eines Angebots.

| Spalte | Datentyp | NOT NULL | Default | Beschreibung |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | ja | `gen_random_uuid()` | Primärschlüssel |
| `angebot_id` | `uuid` | ja | — | FK → `angebote.id` |
| `version_nr` | `integer` | ja | — | Fortlaufend pro Angebot: 1, 2, 3 … |
| `angebot_datum` | `date` | ja | — | Angebotsdatum; bei Erstanlage gesetzt (siehe Abschnitt 5.7) |
| `gueltig_bis` | `date` | ja | — | Gültigkeitsende; bei Erstanlage Default `angebot_datum + 30 Tage` (siehe Abschnitt 5.8) |
| `betreff` | `text` | nein | — | Betreffzeile des Angebots |
| `einleitungstext` | `text` | nein | — | Einleitung / Angebotstext |
| `schlusstext` | `text` | nein | — | Schlusstext / Fußtext |
| `empfaenger_firmenname` | `text` | ja | — | Firmenname oder Name des Empfängers |
| `empfaenger_rechtsform` | `text` | nein | — | z. B. GmbH, e.K., Einzelunternehmen |
| `empfaenger_strasse` | `text` | nein | — | Straße |
| `empfaenger_hausnummer` | `text` | nein | — | Hausnummer |
| `empfaenger_plz` | `text` | nein | — | Postleitzahl |
| `empfaenger_ort` | `text` | nein | — | Ort |
| `empfaenger_land` | `text` | nein | `'Deutschland'` | Land |
| `empfaenger_ansprechpartner` | `text` | nein | — | Name des Ansprechpartners |
| `empfaenger_email` | `text` | nein | — | E-Mail-Adresse des Empfängers |
| `empfaenger_telefon` | `text` | nein | — | Telefonnummer des Empfängers |
| `empfaenger_umsatzsteuer_id` | `text` | nein | — | USt-IdNr. des Empfängers (B2B) |
| `ist_eingefroren` | `boolean` | ja | `false` | `true` = Version ist unveränderlich |
| `freigegeben_am` | `timestamptz` | nein | — | Zeitpunkt der Freigabe dieser Fassung |
| `versendet_am` | `timestamptz` | nein | — | Versandzeitpunkt dieser Fassung (bleibt in der Historie) |
| `angenommen_am` | `timestamptz` | nein | — | Annahmezeitpunkt dieser Fassung |
| `pdf_storage_path` | `text` | nein | — | Relativer Pfad im Bucket `angebote` (Vorbereitung) |
| `pdf_erstellt_am` | `timestamptz` | nein | — | Zeitpunkt der PDF-Erzeugung (Vorbereitung) |
| `created_at` | `timestamptz` | ja | `now()` | Erstellzeitpunkt der Version |
| `updated_at` | `timestamptz` | ja | `now()` | Letzte Änderung an der Version |

**Liegen hier:** Dokumentinhalt, Empfänger-Snapshot, Datumsfelder, versionsspezifische Zeitstempel, PDF-Metadaten, Einfrier-Flag.  
**Liegen nicht hier:** Angebotsnummer, Container-Status, Mandanten-FK.

---

### 1.3 `angebot_positionen`

Positionen einer konkreten Angebotsversion.

| Spalte | Datentyp | NOT NULL | Default | Beschreibung |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | ja | `gen_random_uuid()` | Primärschlüssel |
| `angebot_version_id` | `uuid` | ja | — | FK → `angebot_versionen.id` |
| `position_nr` | `integer` | ja | — | Reihenfolge ab 1, eindeutig pro Version |
| `bezeichnung` | `text` | ja | — | Kurzbezeichnung der Leistung |
| `beschreibung` | `text` | nein | — | Ausführliche Positionsbeschreibung |
| `menge` | `numeric(12, 3)` | ja | — | Menge; muss > 0 sein |
| `einheit` | `text` | ja | `'Stk.'` | Freitext-Mengeneinheit (keine Enum-/Lookup-Liste in V1) |
| `einzelpreis_netto_cents` | `bigint` | ja | — | Netto-Einzelpreis in Cent; ≥ 0 |
| `rabatt_prozent` | `numeric(5, 2)` | ja | `0` | Positionsrabatt in Prozent; 0–100 |
| `umsatzsteuer_satz` | `smallint` | ja | — | Erlaubt: `0`, `7`, `19` |
| `created_at` | `timestamptz` | ja | `now()` | Erstellzeitpunkt |
| `updated_at` | `timestamptz` | ja | `now()` | Letzte Änderung an der Position |

**Liegen hier:** Positionsinhalt und preisrelevante Eingabewerte.  
**Liegen nicht hier:** berechnete Positions- oder Angebots-Summen, Kopf- oder Gesamtrabatt.

---

### 1.4 `angebotsnummer_sequenzen`

Globale Jahressequenz für die Vergabe von Angebotsnummern.

| Spalte | Datentyp | NOT NULL | Default | Beschreibung |
| --- | --- | --- | --- | --- |
| `jahr` | `integer` | ja | — | Primärschlüssel; Kalenderjahr, z. B. `2026` |
| `letzte_nummer` | `integer` | ja | `0` | Zuletzt vergebene Laufnummer im Jahr |

---

## 2. Beziehungen

### 2.1 Fremdschlüssel

| Kind-Tabelle | Spalte | Referenz | ON DELETE | Begründung |
| --- | --- | --- | --- | --- |
| `angebote` | `organization_id` | `organizations.id` | **RESTRICT** | Mandant mit Angeboten darf nicht gelöscht werden |
| `angebote` | `angenommene_version_id` | `(id, angenommene_version_id)` → `angebot_versionen (angebot_id, id)` | **RESTRICT** | Verweis nur auf Version **desselben** Angebots |
| `angebote` | `versendete_version_id` | `(id, versendete_version_id)` → `angebot_versionen (angebot_id, id)` | **RESTRICT** | Verweis nur auf Version **desselben** Angebots |
| `angebot_versionen` | `angebot_id` | `angebote.id` | **CASCADE** | Versionen gehören zum Angebot |
| `angebot_positionen` | `angebot_version_id` | `angebot_versionen.id` | **CASCADE** | Positionen gehören zur Version |

**Hinweis zu `angenommene_version_id` / `versendete_version_id`:** Zusammengesetzte FKs `(angebote.id, …_version_id) → angebot_versionen (angebot_id, id)` verhindern Verweise auf Versionen eines **anderen** Angebots. Voraussetzung: Unique-Index `(angebot_id, id)` auf `angebot_versionen`.

**Weiterhin RPC-/Anwendungsprüfung (nicht als DB-Check):** referenzierte Version muss `ist_eingefroren = true` sein; `versendete_version_id` wird bei erneutem Versand einer neueren Fassung aktualisiert.

### 2.2 Kardinalitäten

| Beziehung | Kardinalität |
| --- | --- |
| `organizations` → `angebote` | 1:n |
| `angebote` → `angebot_versionen` | 1:n |
| `angebot_versionen` → `angebot_positionen` | 1:n |
| `angebote` → `angenommene_version_id` | n:1 (optional) |
| `angebote` → `versendete_version_id` | n:1 (optional) |

### 2.3 Mandantenbezug (`organization_id`)

| Aspekt | Regel |
| --- | --- |
| Pflicht | Jedes Angebot hat genau einen Mandantenbezug über `organization_id` |
| V1-Scope | FK `angebote.organization_id` → `organizations.id` ist **explizit Teil von V1** |
| Plattform-Vertrieb | `organization_id` = Interessent/Mandant, dem das Angebot gilt |
| Operative Nutzung | `organization_id` = Mandant, der das Angebot erstellt |
| Empfänger | Wird **nicht** über FK abgebildet, sondern als Snapshot in `angebot_versionen` |
| Listen/Filter | Angebotslisten filtern über `organization_id` |

Out of Scope ist ausschließlich ein zusätzlicher CRM-FK (`customer_id` → `customers.id`).

### 2.4 Atomare RPCs (Anlage und Versionswechsel)

Erstellung und Versionswechsel laufen **ausschließlich** über PostgreSQL-RPC-Funktionen in Transaktionen — analog zu `create_mandant_onboarding`.

| RPC (empfohlener Name) | Zweck |
| --- | --- |
| `create_angebot(...)` | Container + Version 1 + Positionen atomar anlegen | **Implementiert** — siehe Abschnitt 15 |
| `freigeben_angebot(...)` | Validierung, Angebotsnummer vergeben, Status → `freigegeben` | **Implementiert** — siehe Abschnitt 16 |
| `erstelle_neue_angebotsversion(...)` | Neue Version aus Basisversion kopieren, Status → `entwurf` |

Keine zirkulären FKs; keine mehrstufige Anlage über getrennte Client-Requests ohne Transaktion.

---

## 3. Constraints

### 3.1 Primärschlüssel

| Tabelle | Constraint-Name (empfohlen) | Spalte(n) |
| --- | --- | --- |
| `angebote` | `angebote_pkey` | `id` |
| `angebot_versionen` | `angebot_versionen_pkey` | `id` |
| `angebot_positionen` | `angebot_positionen_pkey` | `id` |
| `angebotsnummer_sequenzen` | `angebotsnummer_sequenzen_pkey` | `jahr` |

### 3.2 Unique-Constraints

| Tabelle | Constraint-Name (empfohlen) | Spalte(n) | Regel |
| --- | --- | --- | --- |
| `angebote` | `angebote_angebotsnummer_key` | `angebotsnummer` | Global eindeutig, sobald vergeben (`NULL` mehrfach erlaubt) |
| `angebot_versionen` | `angebot_versionen_angebot_id_version_nr_key` | `(angebot_id, version_nr)` | Pro Angebot eindeutige Versionsnummer |
| `angebot_versionen` | `angebot_versionen_angebot_id_id_key` | `(angebot_id, id)` | Voraussetzung für zusammengesetzte FKs von `angebote` |
| `angebot_versionen` | `angebot_versionen_angebot_id_offene_version_key` | `(angebot_id)` WHERE `ist_eingefroren = false` | **Partieller UNIQUE-Index:** höchstens eine offene Version pro Angebot |
| `angebot_positionen` | `angebot_positionen_version_id_position_nr_key` | `(angebot_version_id, position_nr)` | Pro Version eindeutige Positionsreihenfolge |

### 3.3 Check-Constraints

#### `angebote.status`

Constraint-Name (empfohlen): `angebote_status_check`

Erlaubte Werte: `entwurf`, `freigegeben`, `versendet`, `angenommen`, `abgelehnt`, `abgelaufen`

#### `angebote.angebotsnummer`

Constraint-Name (empfohlen): `angebote_angebotsnummer_format_check`

Regel: `angebotsnummer IS NULL OR angebotsnummer ~ '^AN-[0-9]{4}-[0-9]{4}$'`

#### `angebot_versionen.version_nr`

Regel: `version_nr >= 1`

#### `angebot_versionen.gueltig_bis`

Regel (empfohlen): `gueltig_bis >= angebot_datum`

#### `angebot_positionen.menge`

Regel: `menge > 0`

#### `angebot_positionen.einzelpreis_netto_cents`

Regel: `einzelpreis_netto_cents >= 0`

#### `angebot_positionen.rabatt_prozent`

Regel: `rabatt_prozent >= 0 AND rabatt_prozent <= 100`

#### `angebot_positionen.umsatzsteuer_satz`

Regel: `umsatzsteuer_satz IN (0, 7, 19)`

#### `angebotsnummer_sequenzen.letzte_nummer`

Regel: `letzte_nummer >= 0 AND letzte_nummer <= 9999`

### 3.4 Fachliche Integritätsregeln (RPC / Server Action)

| Regel | Beschreibung |
| --- | --- |
| Mindestens eine Position | Jede speicherbare Version hat ≥ 1 Position |
| Pflicht-Empfänger | `empfaenger_firmenname` ist bei Speicherung Pflicht |
| Pflicht-Daten vor Freigabe | `angebot_datum` und `gueltig_bis` müssen gesetzt sein |
| Eingefrorene Version | Wenn `ist_eingefroren = true`, dürfen Kopf- und Positionsfelder nicht geändert werden |
| Angenommene Version | `angenommene_version_id` muss auf eine eingefrorene Version zeigen |
| Versendete Version | `versendete_version_id` muss auf eine eingefrorene Version zeigen |
| Angebotsnummer unveränderlich | Nach Vergabe kein UPDATE auf `angebotsnummer` |
| Genau ein bearbeitbarer Entwurf | Höchstens eine Version mit `ist_eingefroren = false` pro Angebot (**DB:** partieller UNIQUE-Index) |

### 3.5 Empfohlene Indizes

| Index-Name (empfohlen) | Tabelle | Spalte(n) | Hinweis |
| --- | --- | --- | --- |
| `idx_angebote_organization_id` | `angebote` | `organization_id` | Listenfilter |
| `idx_angebote_status` | `angebote` | `status` | Statusfilter |
| `idx_angebote_created_at` | `angebote` | `created_at` | Sortierung |
| `idx_angebot_versionen_angebot_id` | `angebot_versionen` | `angebot_id` | Versionen laden |
| `idx_angebot_versionen_angebot_id_version_nr` | `angebot_versionen` | `(angebot_id, version_nr DESC)` | Aktuelle Version ermitteln |
| `angebot_versionen_angebot_id_offene_version_key` | `angebot_versionen` | `(angebot_id)` WHERE `ist_eingefroren = false` | **UNIQUE:** höchstens eine offene Version |
| `angebot_versionen_angebot_id_id_key` | `angebot_versionen` | `(angebot_id, id)` | Zusammengesetzte FKs |
| `idx_angebot_positionen_angebot_version_id` | `angebot_positionen` | `angebot_version_id` | Positionen laden |

---

## 4. Angebotsnummer

### 4.1 Format

```
AN-{YYYY}-{NNNN}
```

| Bestandteil | Regel |
| --- | --- |
| Präfix | `AN` |
| Jahr | 4-stelliges Kalenderjahr |
| Laufnummer | 4-stellig, zero-padded (`0001` … `9999`) |

**Beispiele:** `AN-2026-0001`, `AN-2026-0042`

### 4.2 Vergabe — finale Entscheidung

| Aspekt | Regel |
| --- | --- |
| Zeitpunkt | **Erst bei Freigabe** (`entwurf` → `freigegeben`) |
| Entwürfe | `angebotsnummer = NULL`; Entwürfe haben **keine** Angebotsnummer |
| Geltungsbereich | Global über **alle** Angebote, unabhängig von `organization_id` |
| Jahresbezug | Laufnummer beginnt pro Kalenderjahr bei `0001` |
| Unveränderlichkeit | Nach Vergabe kein UPDATE auf `angebotsnummer` |
| Versionen | Alle Versionen eines Angebots teilen dieselbe Nummer |
| Identität | Angebotsnummer und `angebote.id` bleiben bei neuen Versionen unverändert |

### 4.3 Atomare Vergabe über RPC

Vergabe erfolgt **ausschließlich** in der RPC `freigeben_angebot` innerhalb derselben Transaktion wie die Statusänderung:

1. Validierung (Pflichtfelder, Positionen, `gueltig_bis`)
2. `INSERT INTO angebotsnummer_sequenzen (jahr) VALUES (p_jahr) ON CONFLICT (jahr) DO NOTHING`
3. `SELECT letzte_nummer FROM angebotsnummer_sequenzen WHERE jahr = p_jahr FOR UPDATE`
4. `letzte_nummer := letzte_nummer + 1`; Abbruch wenn `> 9999`
5. `UPDATE angebotsnummer_sequenzen SET letzte_nummer = …`
6. Formatierung `AN-{YYYY}-{NNNN}` und Speicherung in `angebote.angebotsnummer`
7. Status → `freigegeben`; `freigegeben_am` auf der Version setzen

`FOR UPDATE` verhindert Doppelvergabe bei parallelen Requests.

---

## 5. Versionierung

### 5.1 Aktuelle Version — ohne zirkulären FK

Es gibt **kein** `angebote.aktuelle_version_id`. Die aktuelle Version wird zuverlässig über folgende Regeln bestimmt:

#### Bearbeitbare Version (Entwurf)

Gilt wenn `angebote.status = 'entwurf'`:

```sql
SELECT *
FROM angebot_versionen
WHERE angebot_id = :angebot_id
  AND ist_eingefroren = false
ORDER BY version_nr DESC
LIMIT 1;
```

**Invariante:** Es existiert **höchstens eine** Zeile mit `ist_eingefroren = false` (DB-Constraint via partieller UNIQUE-Index). Die RPCs `create_angebot` und `erstelle_neue_angebotsversion` stellen das fachlich sicher.

#### Anzeige-Version (Read-only, kein offener Entwurf)

Gilt wenn `angebote.status` ∈ (`freigegeben`, `versendet`, `angenommen`, `abgelehnt`, `abgelaufen`) und kein offener Entwurf existiert:

| Priorität | Quelle |
| --- | --- |
| 1 | `angenommene_version_id`, falls gesetzt |
| 2 | sonst `versendete_version_id`, falls gesetzt |
| 3 | sonst höchste `version_nr` mit `ist_eingefroren = true` |

#### Zusammenfassung

| Situation | Aktuelle / angezeigte Version |
| --- | --- |
| Status `entwurf` | Einzige nicht eingefrorene Version (höchste `version_nr` unter `ist_eingefroren = false`) |
| Status `freigegeben` | Nicht eingefrorene Version existiert nicht; Anzeige = zuletzt freigegebene Version (`freigegeben_am` gesetzt, noch nicht versendet) |
| Status `versendet` / `abgelehnt` / `abgelaufen` | `versendete_version_id` |
| Status `angenommen` (ohne neuen Entwurf) | `angenommene_version_id` |
| Status `angenommen` (mit neuem Entwurf) | Entwurfsregel für Bearbeitung; `angenommene_version_id` bleibt auf alter Version |

### 5.2 Eindeutigkeit der Versionsnummer

Unique-Constraint `(angebot_id, version_nr)` stellt sicher, dass es pro Angebot nur eine Version 1, 2, 3 … gibt.

### 5.3 Entwurf bearbeitbar

| Bedingung | Verhalten |
| --- | --- |
| `angebote.status = 'entwurf'` | Bearbeitbare Version ist die nicht eingefrorene Version |
| `ist_eingefroren = false` | Kopf- und Positionsfelder dürfen geändert werden |
| Keine neue Version | `version_nr` bleibt unverändert |

### 5.4 Versendete Version eingefroren

| Ereignis | Wirkung |
| --- | --- |
| Übergang zu `versendet` | `ist_eingefroren = true` auf der versendeten Version |
| | `versendet_am` setzen (bleibt dauerhaft auf dieser Fassung) |
| | `versendete_version_id` auf diese Version setzen (bei erneutem Versand einer neueren Fassung **aktualisieren**) |
| Danach | Kein UPDATE auf Kopf-, Empfänger- oder Positionsfelder dieser Version |

### 5.5 Neue Version nach Versand, Ablehnung, Ablauf oder Annahme

| Bedingung | Verhalten |
| --- | --- |
| Ausgangslage | Status `versendet`, `abgelehnt`, `abgelaufen` oder **`angenommen`** |
| Aktion | RPC `erstelle_neue_angebotsversion` |
| Neue Version | `version_nr + 1`; Kopie aus `angenommene_version_id`, `versendete_version_id` oder höchster eingefrorener Version |
| Alte Version(en) | Bleiben unverändert und eingefroren |
| Container-Status | Wechselt auf **`entwurf`** |
| `angenommene_version_id` | **Bleibt unverändert** auf der historisch angenommenen Version |
| `versendete_version_id` | Bleibt auf der zuletzt versendeten Version |
| `angebotsnummer` | Bleibt unverändert (bereits bei früherer Freigabe vergeben) |
| `angebote.id` | Bleibt unverändert |

### 5.6 Statusänderung bei neuer Version aus `angenommen` — finale Entscheidung

| Feld / Aspekt | Wert nach RPC |
| --- | --- |
| `angebote.status` | **`entwurf`** |
| `angenommene_version_id` | unverändert (zeigt weiter auf angenommene, eingefrorene Version) |
| Neue Version | `ist_eingefroren = false`; Inhalte aus angenommener Version kopiert |
| Bearbeitung | Nur die neue Entwurfsversion ist editierbar |
| Freigabe erneut | Erfordert erneuten Übergang `entwurf` → `freigegeben`; **keine** neue Angebotsnummer |

### 5.7 Angebotsdatum — finale Entscheidung

| Aspekt | Regel |
| --- | --- |
| Zeitpunkt | **`angebot_datum` wird bereits beim Entwurf gesetzt** (Erstanlage Version 1) |
| Default bei Erstanlage | Heutiges Datum (`CURRENT_DATE` in RPC `create_angebot`) |
| Bearbeitbarkeit | Im Entwurf manuell änderbar |
| Freigabe | Muss gesetzt sein (NOT NULL in DB) |
| Neue Version | Wird aus Basisversion kopiert; im neuen Entwurf manuell änderbar |

**Nicht:** erst bei Freigabe setzen.

### 5.8 Gültigkeitsdatum (`gueltig_bis`) — finale Entscheidung

| Aspekt | Regel |
| --- | --- |
| Default bei Erstanlage | **`angebot_datum + 30 Tage`** (in RPC `create_angebot`) |
| Bearbeitbarkeit | Manuell änderbar (auch im Entwurf) |
| Pflicht vor Freigabe | Muss gesetzt sein; NOT NULL in DB |
| Auto-Update | Änderung an `angebot_datum` passt `gueltig_bis` **nicht** automatisch an |
| Neue Version | Default: Kopie aus Basisversion; im Entwurf manuell änderbar |
| Check | `gueltig_bis >= angebot_datum` |

### 5.9 Statusübergänge (Container)

```
entwurf ──► freigegeben ──► versendet ──► angenommen
                              │              │
                              ├──► abgelehnt │
                              └──► abgelaufen│

freigegeben ──► entwurf        (Freigabe widerrufen, nur wenn noch nicht versendet)
versendet|abgelehnt|abgelaufen|angenommen ──► entwurf  (nur via neue Version)
```

| Von | Nach | Bedingung |
| --- | --- | --- |
| `entwurf` | `freigegeben` | Validierung; `gueltig_bis` gesetzt; Angebotsnummer atomar vergeben |
| `freigegeben` | `entwurf` | Noch nicht versendet; Angebotsnummer bleibt gesetzt |
| `freigegeben` | `versendet` | Manuelle Versandbestätigung |
| `versendet` | `angenommen` | Manuelle Annahme; `angenommene_version_id` und `angenommen_am` auf der Version setzen |
| `versendet` | `abgelehnt` | Manuelle Ablehnung |
| `versendet` | `abgelaufen` | `gueltig_bis < heute` oder manuell |
| `angenommen` | `entwurf` | **Nur** via `erstelle_neue_angebotsversion` (siehe 5.6) |

Nicht erlaubt: `entwurf` → `versendet`; `entwurf` → `angenommen` / `abgelehnt`.

---

## 6. Empfänger-Snapshot

Empfängerdaten liegen ausschließlich in `angebot_versionen`. Kein FK auf `customers` oder zweite `organizations`-Referenz.

### 6.1 Felder

| Spalte | Pflicht (Speicherung) | Zweck |
| --- | --- | --- |
| `empfaenger_firmenname` | ja | Firmenname |
| `empfaenger_rechtsform` | nein | Rechtsform |
| `empfaenger_strasse` | nein | Straße |
| `empfaenger_hausnummer` | nein | Hausnummer |
| `empfaenger_plz` | nein | PLZ |
| `empfaenger_ort` | nein | Ort |
| `empfaenger_land` | nein (Default `Deutschland`) | Land |
| `empfaenger_ansprechpartner` | nein | Ansprechpartner |
| `empfaenger_email` | nein | E-Mail |
| `empfaenger_telefon` | nein | Telefon |
| `empfaenger_umsatzsteuer_id` | nein | USt-IdNr. (B2B) |

### 6.2 Verhalten

| Regel | Beschreibung |
| --- | --- |
| Unabhängigkeit | Snapshot unabhängig von späteren Änderungen in `organizations` |
| Vorbefüllung | Beim Anlegen dürfen Werte aus `organizations` vorgeschlagen werden |
| Neue Version | Snapshot wird aus Basisversion kopiert |
| Eingefrorene Version | Snapshot unveränderlich |

---

## 7. Geldmodell

### 7.1 Gespeicherte Werte

| Spalte | Tabelle | Einheit | Regel |
| --- | --- | --- | --- |
| `menge` | `angebot_positionen` | Dezimal (3 Nachkommastellen) | > 0 |
| `einheit` | `angebot_positionen` | Freitext | Default `Stk.`; **keine Enum-/Lookup-Liste** |
| `einzelpreis_netto_cents` | `angebot_positionen` | Cent (Integer) | ≥ 0 |
| `rabatt_prozent` | `angebot_positionen` | Prozent | 0–100; Default `0`; **nur Positionsrabatt** |
| `umsatzsteuer_satz` | `angebot_positionen` | Prozent | `0`, `7` oder `19` |

**Beispiel:** 12,50 € netto → `einzelpreis_netto_cents = 1250`

**Nicht in V1:** Kopf-Rabatt, Gesamtrabatt, Rabatt in Cent als gespeichertes Feld.

### 7.2 Berechnete Werte (nicht speichern)

| Wert | Ebene | Formel |
| --- | --- | --- |
| Positions-Netto vor Rabatt | Position | siehe Rundungsregeln (7.3) |
| Positions-Rabattbetrag | Position | siehe Rundungsregeln (7.3) |
| Positions-Netto nach Rabatt | Position | `netto_vor_rabatt − rabattbetrag` |
| Positions-USt | Position | siehe Rundungsregeln (7.3) |
| Positions-Brutto | Position | `netto_nach_rabatt + ust` |
| Angebots-Summe Netto | Version | Summe Positions-Netto nach Rabatt |
| Angebots-Summe USt | Version | Summe Positions-USt |
| Angebots-Summe Brutto | Version | Summe Positions-Brutto |
| USt-Aufschlüsselung | Version | Gruppierung nach Satz (0 % / 7 % / 19 %) |

### 7.3 Rundungsregeln — finale Entscheidung

Alle Geldbeträge werden intern als **ganze Cent** (Integer) berechnet. Rundung erfolgt **pro Position**, danach Aggregation.

#### Schritt 1 — Menge × Einzelpreis

```
netto_vor_rabatt_cents = round(menge × einzelpreis_netto_cents)
```

- `menge` ist `numeric(12, 3)`; Multiplikation mit Integer-Cent
- Rundung auf **nächsten ganzen Cent** (kaufmännisch: Halb-abwärts bei ,5 — PostgreSQL `round()`)

#### Schritt 2 — Positionsrabatt

```
rabattbetrag_cents = round(netto_vor_rabatt_cents × rabatt_prozent / 100)
netto_nach_rabatt_cents = netto_vor_rabatt_cents − rabattbetrag_cents
```

- Rabatt wird auf den gerundeten Nettobetrag vor Rabatt angewendet
- Ergebnis ist ganzzahlig Cent

#### Schritt 3 — Umsatzsteuer

```
ust_cents = round(netto_nach_rabatt_cents × umsatzsteuer_satz / 100)
```

- MwSt.-Satz `0`, `7` oder `19`
- Rundung auf ganzen Cent

#### Schritt 4 — Brutto

```
brutto_cents = netto_nach_rabatt_cents + ust_cents
```

- Keine weitere Rundung (beide Summanden sind ganzzahlig)

#### Schritt 5 — Angebots-Summen

```
summe_netto_cents  = Σ netto_nach_rabatt_cents
summe_ust_cents    = Σ ust_cents
summe_brutto_cents = Σ brutto_cents
```

- Summen sind **Summe der gerundeten Positionswerte**, nicht Rundung über Gesamtsumme

#### Was nicht gerundet wird

| Feld | Regel |
| --- | --- |
| `menge` | Wird gespeichert, nicht auf Cent gerundet; max. 3 Nachkommastellen |
| `rabatt_prozent` | Wird gespeichert; max. 2 Nachkommastellen |
| `einzelpreis_netto_cents` | Immer ganzzahlig (Eingabe wird bei Persistierung in Cent umgerechnet) |

---

## 8. PDF-Vorbereitung

V1 implementiert **keine** PDF-Erzeugung. Bucket-Name, Pfadkonvention und Metadaten-Felder sind festgelegt.

### 8.1 Felder

| Spalte | Tabelle | Beschreibung |
| --- | --- | --- |
| `pdf_storage_path` | `angebot_versionen` | Relativer Pfad im Bucket `angebote` |
| `pdf_erstellt_am` | `angebot_versionen` | Zeitpunkt der PDF-Erzeugung und Ablage |

### 8.2 Storage — finale Entscheidung

| Aspekt | Regel |
| --- | --- |
| Bucket | Dedizierter Supabase-Storage-Bucket: **`angebote`** |
| Bindung | PDF ist an **genau eine** `angebot_versionen`-Zeile gebunden |
| Pfad | `{organization_id}/{angebotsnummer}/v{version_nr}.pdf` |
| Beispiel | `8f3c…/AN-2026-0042/v1.pdf` (innerhalb Bucket `angebote`) |

### 8.3 Regeln

| Regel | Beschreibung |
| --- | --- |
| V1 | Felder bleiben `NULL`; Storage-Bucket `angebote` separat anlegen, **keine** PDF-Erzeugung |
| Erstellungszeitpunkt | `pdf_erstellt_am` wird gesetzt, wenn PDF erzeugt und hochgeladen wurde |
| Immutabilität | PDF bezieht sich auf eingefrorene Version; bei neuer Version neuer Pfad |
| Download | Nur serverseitig über signierte URL (nach V1) |

### 8.4 Geplanter Ablauf (nach V1)

1. Angebot erreicht `freigegeben` oder `versendet`
2. Server erzeugt PDF aus Version + Positionen + berechneten Summen
3. Upload in Bucket `angebote`
4. `pdf_storage_path` und `pdf_erstellt_am` speichern

---

## 9. Löschverhalten

### 9.1 Mandant (`organizations`)

| Aktion | Verhalten |
| --- | --- |
| DELETE `organizations` | **RESTRICT**, wenn verknüpfte `angebote` existieren |
| Alternative | Mandant auf Status `inaktiv` setzen |

### 9.2 Angebot (`angebote`)

| Bedingung | Verhalten |
| --- | --- |
| Status `entwurf` und `angebotsnummer IS NULL` | Hard-Delete erlaubt (Anwendungsregel); CASCADE auf Versionen und Positionen |
| `angebotsnummer` vergeben oder Status ≠ `entwurf` | Hard-Delete **nicht** erlaubt |

### 9.3 Versionen (`angebot_versionen`)

| Bedingung | Verhalten |
| --- | --- |
| `ist_eingefroren = true` | Einzelnes DELETE **nicht** erlaubt |
| Referenziert durch `angenommene_version_id` / `versendete_version_id` | Einzelnes DELETE **nicht** erlaubt (RESTRICT) |
| Nicht eingefrorene Version ohne Referenz | Nur implizit über Angebots-Löschung (CASCADE) |

### 9.4 Positionen (`angebot_positionen`)

| Bedingung | Verhalten |
| --- | --- |
| Version nicht eingefroren | INSERT, UPDATE, DELETE erlaubt |
| Version eingefroren | Kein INSERT, UPDATE, DELETE |
| Version gelöscht | CASCADE löscht Positionen |

---

## 10. Trigger und Timestamps

| Tabelle | Trigger |
| --- | --- |
| `angebote` | `BEFORE UPDATE` → `set_updated_at()` auf `updated_at` |
| `angebot_versionen` | `BEFORE UPDATE` → `set_updated_at()` auf `updated_at` |
| `angebot_positionen` | `BEFORE UPDATE` → `set_updated_at()` auf `updated_at` |

---

## 11. Schreibzugriff (Architektur-Hinweis)

```
UI / Formular
  → Server Action
  → Validierung
  → Supabase Admin Client (Service Role)
  → PostgreSQL-RPC (Transaktion)
```

Schreibzugriffe mit erhöhten Rechten **nicht** im Browser.

---

## 12. Finale Entscheidungen (Zusammenfassung)

| # | Thema | Entscheidung |
| --- | --- | --- |
| 1 | Angebotsnummer | Bei Freigabe; Entwürfe ohne Nummer; global pro Jahr; atomar via RPC; unveränderlich |
| 2 | `gueltig_bis` | Default `angebot_datum + 30 Tage` bei Erstanlage; manuell änderbar; Pflicht vor Freigabe |
| 3 | `einheit` | Freitext; keine Enum-/Lookup-Liste |
| 4 | Version aus `angenommen` | Erlaubt; angenommene Version eingefroren; neue Version → Status `entwurf`; Identität und Nummer gleich |
| 5 | Aktuelle Version | Kein zirkulärer FK; Ermittlung über `ist_eingefroren` + `version_nr` bzw. Referenz-FKs |
| 6 | PDF Storage | Bucket `angebote`; Bindung an `angebot_versionen`; keine Erzeugung in V1 |
| 7 | Rabatt | Nur pro Position; dokumentierte Cent-Rundungsregeln |
| 8 | `organization_id` | FK → `organizations.id`; explizit V1-Scope |
| 9 | `angebot_datum` | Bereits beim Entwurf (Erstanlage); Default heute |
| 10 | Zentraldoku | Verweis in `docs/datenmodell.md` bei Migration ergänzen |

---

## 13. Verbleibende Risiken (keine Blocker)

| Risiko | Auswirkung | Mitigation |
| --- | --- | --- |
| Globaler Nummernkreis | Mandantenübergreifend sichtbare Folge | Bewusst so festgelegt; Erweiterung später möglich |
| Kein CRM-FK | Keine automatische Kundenhistorie | Snapshot-Pflicht |
| Nur berechnete Summen | Abweichung bei geänderter Logik | Eingefrorene Versionen + Positionsdaten als Quelle |
| `abgelaufen` ohne Hintergrundjob | Status kann veraltet sein | Prüfung beim Laden oder manuell in V1 |
| Parallele Entwurfs-Bearbeitung | Last-write-wins | V1 akzeptiert; Optimistic Locking später |
| Entwurf-Löschung | UX-Risiko | Bestätigungsdialog (UI, nicht DB) |

---

## 15. RPC: `create_angebot`

**Migration:** `supabase/migrations/20260717210000_create_angebot_rpc.sql`  
**Zugriff:** `service_role` (serverseitig, nicht im Browser)

### Signatur

```sql
create_angebot(payload jsonb) → uuid
```

### Rückgabewert

| Typ | Bedeutung |
| --- | --- |
| `uuid` | `angebote.id` des neu angelegten Angebotsentwurfs |

### Payload-Struktur

```json
{
  "organization_id": "uuid",
  "version": {
    "angebot_datum": "2026-07-18",
    "gueltig_bis": "2026-08-17",
    "betreff": "optional",
    "einleitungstext": "optional",
    "schlusstext": "optional",
    "empfaenger": {
      "firmenname": "Pflicht",
      "rechtsform": "optional",
      "strasse": "optional",
      "hausnummer": "optional",
      "plz": "optional",
      "ort": "optional",
      "land": "optional, Default Deutschland",
      "ansprechpartner": "optional",
      "email": "optional",
      "telefon": "optional",
      "umsatzsteuer_id": "optional"
    }
  },
  "positionen": [
    {
      "position_nr": 1,
      "bezeichnung": "Pflicht",
      "beschreibung": "optional",
      "menge": "1.5",
      "einheit": "optional, Default Stk.",
      "einzelpreis_netto_cents": 1250,
      "rabatt_prozent": 0,
      "umsatzsteuer_satz": 19
    }
  ]
}
```

### Parameter

| Pfad | Pflicht | Default | Beschreibung |
| --- | --- | --- | --- |
| `organization_id` | ja | — | FK → `organizations.id` |
| `version` | ja | — | JSON-Objekt mit Kopf- und Empfängerdaten |
| `version.angebot_datum` | nein | `CURRENT_DATE` | Angebotsdatum |
| `version.gueltig_bis` | nein | `angebot_datum + 30 Tage` | Gültigkeitsende |
| `version.betreff` | nein | `NULL` | Betreffzeile |
| `version.einleitungstext` | nein | `NULL` | Einleitungstext |
| `version.schlusstext` | nein | `NULL` | Schlusstext |
| `version.empfaenger.firmenname` | ja | — | Empfänger-Snapshot |
| `version.empfaenger.*` | nein | siehe Payload | Weitere Empfängerfelder |
| `positionen` | ja | — | Array mit mindestens einer Position |
| `positionen[].position_nr` | ja | — | Eindeutige Reihenfolge ≥ 1 je Aufruf |
| `positionen[].bezeichnung` | ja | — | Positionsbezeichnung |
| `positionen[].beschreibung` | nein | `NULL` | Positionsbeschreibung |
| `positionen[].menge` | ja | — | `> 0` |
| `positionen[].einheit` | nein | `Stk.` | Freitext-Einheit |
| `positionen[].einzelpreis_netto_cents` | ja | — | Integer ≥ 0 |
| `positionen[].rabatt_prozent` | nein | `0` | 0–100 |
| `positionen[].umsatzsteuer_satz` | ja | — | `0`, `7` oder `19` |

### Schreibende Tabellen (eine Transaktion)

| Tabelle | Inhalt |
| --- | --- |
| `angebote` | 1 Zeile: `status = 'entwurf'`, `angebotsnummer = NULL`, `organization_id` |
| `angebot_versionen` | 1 Zeile: `version_nr = 1`, `ist_eingefroren = false`, Empfänger-Snapshot, Datumsfelder, Texte |
| `angebot_positionen` | n Zeilen: alle Positionen aus dem Payload |

**Nicht beschrieben:** `angebotsnummer_sequenzen` (Nummernvergabe erst bei `freigeben_angebot`).

### Verhalten

| Aspekt | Regel |
| --- | --- |
| Transaktion | Alles oder nichts; bei Fehler vollständiger Rollback |
| Angebotsnummer | Bleibt `NULL` |
| Status | Bleibt `entwurf` |
| Offene Version | Genau eine Zeile mit `ist_eingefroren = false` (Version 1) |
| PDF / E-Mail | Nicht Teil dieser RPC |

### Fehlerfälle (Auswahl)

| Bedingung | Fehlermeldung (Kurzform) |
| --- | --- |
| Payload fehlt / kein Objekt | `Payload fehlt` / `Payload muss ein JSON-Objekt sein` |
| `organization_id` fehlt / ungültig | `organization_id fehlt` / `organization_id ist ungültig` |
| Organization unbekannt | `Organization nicht gefunden: …` |
| `version` / `empfaenger` ungültig | `version fehlt …` / `version.empfaenger …` |
| `firmenname` fehlt | `version.empfaenger.firmenname fehlt` |
| Keine Positionen | `Mindestens eine Position erforderlich` |
| Datum ungültig | `version.angebot_datum ist ungültig` / `version.gueltig_bis …` |
| `gueltig_bis < angebot_datum` | `version.gueltig_bis muss >= version.angebot_datum sein` |
| Positionsvalidierung | `position_nr …`, `menge …`, `einzelpreis_netto_cents …`, `rabatt_prozent …`, `umsatzsteuer_satz …` |
| DB-Constraint-Verletzung | PostgreSQL-Fehler; Transaktion rollt zurück |

---

## 16. RPC: `freigeben_angebot`

**Migration:** `supabase/migrations/20260717220000_freigeben_angebot_rpc.sql`  
**Zugriff:** `service_role` (serverseitig, nicht im Browser)

### Signatur

```sql
freigeben_angebot(p_angebot_id uuid) → text
```

### Parameter

| Parameter | Typ | Pflicht | Beschreibung |
| --- | --- | --- | --- |
| `p_angebot_id` | `uuid` | ja | `angebote.id` des freizugebenden Entwurfs |

### Rückgabewert

| Typ | Bedeutung |
| --- | --- |
| `text` | Vergebene Angebotsnummer im Format `AN-YYYY-NNNN` |

### Validierungen (vor Freigabe)

| Prüfung | Regel |
| --- | --- |
| Angebot existiert | Zeile in `angebote` mit `p_angebot_id` |
| Status | `angebote.status = 'entwurf'` |
| Angebotsnummer | `angebote.angebotsnummer IS NULL` |
| Offene Version | Genau **eine** Zeile in `angebot_versionen` mit `ist_eingefroren = false` |
| Angebotsdatum | `angebot_datum` gesetzt |
| Gültigkeit | `gueltig_bis` gesetzt und `>= angebot_datum` |
| Empfänger-Snapshot | `empfaenger_firmenname`, `empfaenger_strasse`, `empfaenger_plz`, `empfaenger_ort`, `empfaenger_land` nicht leer |
| Positionen | Mindestens eine Position zur offenen Version |
| Sperre | `angebote`-Zeile wird mit `FOR UPDATE` gesperrt |

### Geänderte Tabellen (eine Transaktion)

| Tabelle | Aktion |
| --- | --- |
| `angebotsnummer_sequenzen` | INSERT ON CONFLICT DO NOTHING; `letzte_nummer` atomar erhöht (`FOR UPDATE`) |
| `angebote` | UPDATE |
| `angebot_versionen` | UPDATE der offenen Version |

### Aktualisierte Felder

| Tabelle | Feld | Wert |
| --- | --- | --- |
| `angebotsnummer_sequenzen` | `letzte_nummer` | +1 für Kalenderjahr der Freigabe |
| `angebote` | `status` | `'freigegeben'` |
| `angebote` | `angebotsnummer` | `AN-YYYY-NNNN` |
| `angebot_versionen` | `freigegeben_am` | `now()` |

**Nicht geändert in dieser RPC:** `ist_eingefroren`, `versendet_am`, `angenommen_am`, `versendete_version_id`, `angenommene_version_id`, PDF-Felder.

### Angebotsnummernvergabe

1. `v_jahr := EXTRACT(YEAR FROM CURRENT_DATE)`
2. Sequenzzeile für `v_jahr` anlegen falls fehlend
3. `SELECT … FOR UPDATE` auf `angebotsnummer_sequenzen`
4. Laufnummer +1; Abbruch wenn `> 9999`
5. Format `AN-{YYYY}-{NNNN}` (4-stellig zero-padded)

### Verhalten

| Aspekt | Regel |
| --- | --- |
| Transaktion | Alles oder nichts; bei Fehler vollständiger Rollback |
| PDF / E-Mail / Versand | Nicht Teil dieser RPC |

### Fehlerfälle (Auswahl)

| Bedingung | Fehlermeldung (Kurzform) |
| --- | --- |
| `angebot_id` fehlt | `angebot_id fehlt` |
| Angebot unbekannt | `Angebot nicht gefunden: …` |
| Falscher Status | `Angebot muss Status entwurf haben, ist: …` |
| Nummer bereits vergeben | `Angebot hat bereits eine Angebotsnummer: …` |
| Falsche Anzahl offener Versionen | `Genau eine offene Version erforderlich, gefunden: …` |
| Datum fehlt / ungültig | `angebot_datum fehlt …` / `gueltig_bis …` |
| Empfänger unvollständig | `Empfänger-Snapshot unvollständig …` |
| Keine Positionen | `Mindestens eine Position erforderlich` |
| Nummernkreis erschöpft | `Angebotsnummernkreis für Jahr … erschöpft` |
| Unique-Kollision Nummer | PostgreSQL-Fehler; Rollback |

---

## 17. Abgrenzung zu `docs/datenmodell.md`

| Thema | `docs/datenmodell.md` | Dieses Dokument |
| --- | --- | --- |
| Ebene | Fachliches Domänenmodell | Technische PostgreSQL-Abbildung |
| SQL | Bewusst ohne SQL | Schema + RPCs in `supabase/migrations/` |
| Mandantenbezug | Fachliche Beschreibung | `angebote.organization_id` → `organizations.id` (V1-Scope) |
| CRM | Erwähnt `customers` im Mandantenkontext | Kein FK auf `customers` in V1 |
| Verweis | Wird bei Migration ergänzt | Technische Referenz für Angebotsmodul |

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-17 | Erstversion |
| 2026-07-17 | Finale Entscheidungen übernommen: kein zirkulärer FK, Angebotsnummer bei Freigabe, Gültigkeitsdefault, Freitext-Einheit, Version aus angenommen, Bucket `angebote`, Rundungsregeln, `angebot_datum` beim Entwurf |
| 2026-07-18 | RPC `create_angebot` (`20260717210000_create_angebot_rpc.sql`) |
| 2026-07-18 | RPC `freigeben_angebot` (`20260717220000_freigeben_angebot_rpc.sql`) |
