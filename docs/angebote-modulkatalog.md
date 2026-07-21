# Modulkatalog und zentraler Modulstamm

Diese Dokumentation beschreibt das **gemeinsame Modulmodell** der Plattform: `leistungsmodule` ist der **zentrale Modulstamm** für Angebotspositionen, künftige Rechnungspositionen und Mandantenlizenzen über `organization_modules`. Angebotspositionen entstehen künftig aus diesem Stamm; nur der **Positionsrabatt** bleibt pro Angebot individuell editierbar.

**Version:** 2  
**Status:** Schema-Grundlage Angebote implementiert (`20260717270000_angebots_modulkatalog.sql`); **Zusammenführung mit Mandantenlizenzen dokumentiert, noch nicht migriert**  
**Bezug:** `docs/module-zusammenfuehrung-mapping.md`, `docs/angebote-datenmodell.md`, `docs/datenmodell.md`, `docs/entscheidungen.md`

---

## Verbindliche Entscheidungen (Zusammenfassung)

| # | Thema | Entscheidung |
| --- | --- | --- |
| 1 | **Zentraler Stamm** | `leistungsmodule` für Angebotspositionen, künftige Rechnungspositionen und `organization_modules` (Mandantenlizenzen) |
| 2 | **`modultyp`** | `plattform` \| `leistung` \| `beides` — steuert Lizenz- vs. Verkaufsnutzung (siehe Abschnitt 1.3) |
| 3 | **Listenpreise** | **Keine Platzhalterpreise (0 Cent)**; Seed/Migration erst nach fachlicher Preisfreigabe aller erforderlichen Preise |
| 4 | **`organization_modules`** | FK `leistungsmodul_id`; Lizenzfelder `lizenz_status`, `aktiviert_am`, `deaktiviert_am`, `konfiguration`; **keine** duplizierten Namen/Preise |
| 5 | **`lizenz_status`** | `geplant`, `aktiv`, `pausiert`, `gekündigt` |
| 6 | **Legacy Angebote** | Positionen ohne `leistungsmodul_id` bleiben gültig; Spalten nullable; gemischte Versionen vorübergehend erlaubt |
| 7 | **Angebotsposition** | Menge immer `1`; nur `rabatt_prozent` individuell (0–100 %); ein Modul höchstens einmal pro Version |
| 8 | **Snapshots** | Katalogänderungen nicht rückwirkend; vollständige Snapshots in Positionszeilen |
| 9 | **Preisart** | `einmalig` oder `monatlich`; Snapshot in Positionen; getrennte Summen; monatlich = pro Monat in V1 |
| 10 | **Sortierung** | `aktiv` + `sortierung`; keine Kategorien in V1 |

---

## Geltungsbereich

### In Scope (geplant)

| Bereich | Beschreibung |
| --- | --- |
| Zentraler Stamm | `leistungsmodule` — Verkaufs- und technische Stammdaten |
| Angebote | `angebot_positionen.leistungsmodul_id`, `preisart` (nullable in Übergang) |
| Rechnungen (später) | `rechnung_positionen.leistungsmodul_id` (geplant) |
| Mandantenlizenzen | `organization_modules.leistungsmodul_id` (geplant) |
| Snapshot-Modell | Positions- und Lizenzzeilen ohne duplizierte Stammtexte/-preise |
| Admin-UI (später) | Eine Seite für Modulstamm-Pflege |

### Out of Scope (aktuell)

| Bereich | Beschreibung |
| --- | --- |
| Rechnungspositionen | Tabellen/RPCs folgen in separatem Schritt |
| Kategorien | Keine Gruppierung / Kategorie-Tabelle in V1 |
| Kopf-/Gesamtrabatt | Weiterhin nur Positionsrabatt |
| Platzhalter-Listenpreise | Kein Seed mit `0` Cent |
| RPC / UI-Zusammenführung | Folgen nach fachlicher Preisfreigabe und Schema-Migration |

### Gemeinsames Stammdatenmodell

Es gibt **eine** Modultabelle `leistungsmodule`. Mandantenlizenzen, Angebots- und Rechnungspositionen referenzieren denselben Stamm über `leistungsmodul_id`. Die Nutzung pro Domäne wird über **`modultyp`** gesteuert — nicht über getrennte Tabellen oder Freitext in `organization_modules`.

| Domäne | Tabelle | Bezug | Erlaubte `modultyp`-Werte |
| --- | --- | --- | --- |
| Mandantenlizenz | `organization_modules` | `leistungsmodul_id` | `plattform`, `beides` |
| Angebotsposition | `angebot_positionen` | `leistungsmodul_id` | `leistung`, `beides` |
| Rechnungsposition (später) | `rechnung_positionen` | `leistungsmodul_id` | `leistung`, `beides` |

Details zur Migration bestehender Freitext-Module: `docs/module-zusammenfuehrung-mapping.md`.

---

## Übersicht

```
leistungsmodule (zentraler Modulstamm)
    │
    ├── 1:n  organization_modules.leistungsmodul_id   (Mandantenlizenz, geplant)
    │
    ├── 1:n  angebot_positionen.leistungsmodul_id      (nullable in Übergang)
    │           └── n:1  angebot_versionen → angebote
    │
    └── 1:n  rechnung_positionen.leistungsmodul_id     (später, geplant)
```

**Snapshot-Prinzip:** Beim Anlegen oder Aktualisieren einer Modulposition schreibt die RPC die Modulwerte (`bezeichnung`, `beschreibung`, `einzelpreis_netto_cents`, `einheit`, `umsatzsteuer_satz`, `preisart`) **in die Positionszeile**. Spätere Katalogänderungen verändern **keine** bereits gespeicherten Angebotsversionen.

---

## 1. Entität `leistungsmodule`

### 1.1 Zweck

Zentraler, plattformweiter **Modulstamm** für:

- **Verkauf** in Angeboten (und später Rechnungen) über Positions-Snapshots
- **Mandantenlizenzierung** über `organization_modules`
- **Technische Identifikation** über `technischer_schluessel` (Feature-Gates, Integrationen)

**Verwaltung:**

- Pflege später über **eine Admin-Seite** im Plattform-Admin
- Seed-Daten erlaubt, aber nicht die einzige Pflegeform
- **Seed und Zusammenführungs-Migration erst**, wenn alle erforderlichen Listenpreise festgelegt sind (**keine 0-Cent-Platzhalter**)

### 1.2 Tabellenentwurf

**Tabellenname:** `leistungsmodule`

**Bereits implementiert** (`20260717270000_angebots_modulkatalog.sql`):

| Spalte | Datentyp | NOT NULL | Default | Beschreibung |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | ja | `gen_random_uuid()` | Primärschlüssel |
| `code` | `text` | ja | — | Eindeutiger fachlicher Code (Angebot/Rechnung/Dokumente) |
| `name` | `text` | ja | — | Anzeigename |
| `beschreibung` | `text` | nein | — | Ausführliche Beschreibung |
| `einzelpreis_netto_cents` | `bigint` | ja | — | Listenpreis netto in Cent; ≥ 0; **Pflicht vor Seed** |
| `einheit` | `text` | ja | `'Stk.'` | Mengeneinheit |
| `umsatzsteuer_satz` | `smallint` | ja | — | `0`, `7`, `19` |
| `preisart` | `text` | ja | — | `einmalig` oder `monatlich` |
| `aktiv` | `boolean` | ja | `true` | Steuert Auswählbarkeit in UI |
| `sortierung` | `integer` | ja | `0` | Reihenfolge in Auswahllisten |
| `created_at` | `timestamptz` | ja | `now()` | Erstellzeitpunkt |
| `updated_at` | `timestamptz` | ja | `now()` | Letzte Änderung |

**Geplant** (Zusammenführungs-Migration, noch nicht implementiert):

| Spalte | Datentyp | Beschreibung |
| --- | --- | --- |
| `technischer_schluessel` | `text` UNIQUE | Stabiler App-Schlüssel (z. B. `crm`, `rechnungen`) |
| `modultyp` | `text` | `plattform` \| `leistung` \| `beides` |

### 1.3 `modultyp` (verbindlich)

| Wert | Lizenz über `organization_modules` | Angebot/Rechnung als Position |
| --- | --- | --- |
| `plattform` | ja | nein |
| `leistung` | nein | ja |
| `beides` | ja | ja |

**Validierung (Ziel-RPCs):**

- Angebot/Rechnung: nur Module mit `modultyp IN ('leistung', 'beides')` und `aktiv = true`
- Mandanten-Onboarding/Lizenz: nur Module mit `modultyp IN ('plattform', 'beides')` und `aktiv = true`

**Preisart (V1):** `monatlich` = Preis **pro Monat**; keine Quartals-/Jahresintervalle.

### 1.3 Constraints und Indizes

| Art | Name (empfohlen) | Regel |
| --- | --- | --- |
| PK | `leistungsmodule_pkey` | `id` |
| UNIQUE | `leistungsmodule_code_key` | `code` global eindeutig |
| CHECK | `leistungsmodule_einzelpreis_netto_cents_check` | `einzelpreis_netto_cents >= 0` |
| CHECK | `leistungsmodule_umsatzsteuer_satz_check` | `umsatzsteuer_satz IN (0, 7, 19)` |
| CHECK | `leistungsmodule_preisart_check` | `preisart IN ('einmalig', 'monatlich')` |
| CHECK | `leistungsmodule_modultyp_check` | `modultyp IN ('plattform', 'leistung', 'beides')` *(geplant)* |
| UNIQUE | `leistungsmodule_technischer_schluessel_key` | `technischer_schluessel` *(geplant)* |
| CHECK | `leistungsmodule_code_check` | `length(trim(code)) > 0` |
| CHECK | `leistungsmodule_name_check` | `length(trim(name)) > 0` |
| CHECK | `leistungsmodule_sortierung_check` | `sortierung >= 0` |
| INDEX | `idx_leistungsmodule_aktiv_sortierung` | `(aktiv, sortierung, name)` — Auswahllisten |

**Trigger:** `BEFORE UPDATE` → `set_updated_at()` auf `updated_at` (analog zu bestehenden Tabellen).

**Sortierung (V1):** Auswahllisten filtern nach `aktiv = true` und sortieren nach `sortierung`, dann `name`. **Keine Kategorien** in V1.

### 1.4 Pflege-Regeln (Katalog)

| Regel | Beschreibung |
| --- | --- |
| Preisänderung | Wirkt **nicht rückwirkend**; nur künftige Snapshots |
| Beschreibung, Einheit, Steuer | Ebenfalls **nicht rückwirkend**; historische Positionen behalten Snapshot |
| Deaktivierung | `aktiv = false` — Modul erscheint nicht mehr in neuer Modulauswahl |
| Historische Sichtbarkeit | Inaktive Module bleiben in **historischen Angeboten** über Positions-Snapshots sichtbar |
| Löschung | **Kein Hard-Delete** bei Verwendung in Angeboten; nur Deaktivierung |
| `code` | Global eindeutig; nach **erstmaliger Verwendung** in einem Angebot **nicht mehr änderbar** (RPC/Admin-Prüfung) |

---

## 2. Verbindung zu `angebot_positionen`

### 2.1 Neue Spalten

| Spalte | Datentyp | NOT NULL | Beschreibung |
| --- | --- | --- | --- |
| `leistungsmodul_id` | `uuid` | **nein** (V1) | FK → `leistungsmodule.id`; referenziert das Modul zum Zeitpunkt der Positionsanlage |
| `preisart` | `text` | **nein** (V1) | Snapshot von `leistungsmodule.preisart`; `NULL` bei Legacy-Positionen |

**FK:** `leistungsmodul_id` → `leistungsmodule.id` **ON DELETE RESTRICT**  
(Begründung: Hard-Delete verwendeter Module ist ausgeschlossen.)

### 2.2 Snapshot-Felder (unverändert)

Diese Felder **bleiben bestehen** und werden bei jeder Modulpositionsanlage/-aktualisierung **vollständig aus dem Modul übernommen und gespeichert**:

| Spalte | Rolle |
| --- | --- |
| `bezeichnung` | Snapshot von `leistungsmodule.name` |
| `beschreibung` | Snapshot von `leistungsmodule.beschreibung` |
| `einzelpreis_netto_cents` | Snapshot von `leistungsmodule.einzelpreis_netto_cents` |
| `einheit` | Snapshot von `leistungsmodule.einheit` |
| `umsatzsteuer_satz` | Snapshot von `leistungsmodule.umsatzsteuer_satz` |
| `preisart` | Snapshot von `leistungsmodule.preisart` (`einmalig` \| `monatlich`) |

Weitere Spalten:

| Spalte | Rolle |
| --- | --- |
| `menge` | **Immer `1`** in V1 (RPC setzt fest; UI nicht editierbar) |
| `rabatt_prozent` | **Einziges** individuell editierbares Positionsfeld (0–100 %) |
| `position_nr` | Reihenfolge ab 1, eindeutig pro Version |

### 2.3 Zusätzliche Constraints

| Constraint | Regel |
| --- | --- |
| `angebot_positionen_version_id_leistungsmodul_id_key` | **UNIQUE** `(angebot_version_id, leistungsmodul_id)` WHERE `leistungsmodul_id IS NOT NULL` |
| `angebot_positionen_preisart_check` | `preisart IS NULL OR preisart IN ('einmalig', 'monatlich')` |
| Index `idx_angebot_positionen_leistungsmodul_id` | `(leistungsmodul_id)` |

Der partielle UNIQUE-Index gilt nur für modulbasierte Positionen. Legacy-Positionen ohne `leistungsmodul_id` sind davon nicht betroffen.

### 2.4 Berechnete Summen

Summen werden **nicht** in der Datenbank gespeichert, sondern aus den Snapshot-Feldern berechnet (Grundlogik wie in `docs/angebote-datenmodell.md` Abschnitt 7).

**Preisart (Option B):**

| Regel | Beschreibung |
| --- | --- |
| Getrennte Aggregation | Einmalige und monatliche Positionen werden **getrennt** summiert |
| Keine Mischsumme | Es gibt **keine gemeinsame Gesamtsumme** aus einmaligen und monatlichen Preisen |
| Monatlich in V1 | `monatlich` = Preis **pro Monat**; keine quartalsweise oder jährliche Intervalle |
| Legacy | Positionen mit `preisart = NULL` werden in der Anwendung separat behandelt (bis RPC-Rollout) |

---

## 3. Fachliche Regeln

### 3.1 Modulauswahl

| Regel | Beschreibung |
| --- | --- |
| Nur aktive Module | **Neue** Positionen: `aktiv = true` und `modultyp IN ('leistung', 'beides')` |
| Historie | Bereits gespeicherte Positionen nutzen **Snapshot-Felder**; inaktive Module bleiben in historischen Angeboten sichtbar |
| Ein Modul pro Version | Dieselbe `leistungsmodul_id` höchstens **einmal** pro `angebot_version_id` |
| Mindestens eine Position | Jede speicherbare Version hat ≥ 1 Position |

### 3.2 Editierbarkeit im Angebot (Entwurf)

| Feld | Editierbar? |
| --- | --- |
| Modul hinzufügen / entfernen | ja (nur offene Version) |
| `rabatt_prozent` | **ja** — einzige individuelle Anpassung (0–100 %) |
| `bezeichnung`, `beschreibung` | **nein** |
| `einzelpreis_netto_cents` | **nein** |
| `einheit`, `umsatzsteuer_satz` | **nein** |
| `menge` | **nein** — immer `1` |

### 3.3 Katalogänderungen und Historie

| Regel | Beschreibung |
| --- | --- |
| Nicht rückwirkend | Änderungen an Preis, Beschreibung, Einheit oder Steuer im Katalog verändern **keine** bestehenden Positionen |
| Vollständiger Snapshot | `angebot_positionen` speichert weiterhin alle preis- und textrelevanten Werte |
| Eingefrorene Version | Kein INSERT, UPDATE, DELETE an Positionen |
| Neue Version | `erstelle_neue_angebotsversion` kopiert `leistungsmodul_id`, `preisart` und Snapshot-Felder (RPC folgt) |

### 3.4 Legacy-Daten und Übergang

| Regel | Beschreibung |
| --- | --- |
| Bestehende Positionen | Ohne `leistungsmodul_id` / `preisart` bleiben **gültige historische Snapshots** |
| Nullable Spalten | `leistungsmodul_id` und `preisart` bleiben in V1 **nullable** |
| Keine Löschung | Bestehende Angebotsdaten werden nicht gelöscht oder zwangs-migriert |
| Bestehende Entwürfe | Bleiben **bearbeitbar** (Legacy-Positionen inklusive) |
| Neue Positionen nach Rollout | Dürfen **nur noch** aus **aktiven** Leistungsmodulen entstehen |
| Gemischte Versionen | **Vorübergehend erlaubt:** Legacy- und Modulpositionen in derselben Version |
| Freitext in neuen Angeboten | Nach Rollout **nicht** — neue Positionen erfordern `leistungsmodul_id` |

---

## 4. RPC-Verhalten (Zielbild)

**Betroffene RPCs:** `create_angebot`, `update_angebot_entwurf`  
**Kopie:** `erstelle_neue_angebotsversion` kopiert `leistungsmodul_id` mit (nach Migration)

### 4.1 Positions-Payload für Modulpositionen

```json
{
  "position_nr": 1,
  "leistungsmodul_id": "uuid",
  "rabatt_prozent": 0
}
```

| Pfad | Pflicht | Beschreibung |
| --- | --- | --- |
| `position_nr` | ja | Reihenfolge ≥ 1 |
| `leistungsmodul_id` | ja (neue Modulpositionen) | FK → `leistungsmodule.id` |
| `rabatt_prozent` | nein | Default `0`; 0–100 |

**Nicht im Client-Payload für Modulpositionen:** `bezeichnung`, `beschreibung`, `menge`, `einheit`, `einzelpreis_netto_cents`, `umsatzsteuer_satz`, `preisart`

### 4.2 Serverseitige Auflösung

1. Modul laden und prüfen: existiert, `aktiv = true`, `modultyp IN ('leistung', 'beides')`, noch nicht in Version
2. `rabatt_prozent` ∈ [0, 100]
3. Snapshot schreiben: `bezeichnung`, `beschreibung`, `einzelpreis_netto_cents`, `einheit`, `umsatzsteuer_satz`, **`preisart`**; `menge = 1`

### 4.3 Legacy-Entwürfe

| Aspekt | Regel |
| --- | --- |
| Bestehende Legacy-Positionen | Bleiben speicherbar und editierbar mit bisherigem Payload |
| Neue Positionen in Legacy-Entwürfen | Nach Rollout nur als Modulpositionen (`leistungsmodul_id` + `rabatt_prozent`) |
| Gemischte Version | Erlaubt — Legacy- und Modulpositionen können koexistieren |

### 4.4 Fehlerfälle (Auswahl)

| Bedingung | Fehlermeldung (Kurzform) |
| --- | --- |
| `leistungsmodul_id` fehlt (neue Modulposition) | `leistungsmodul_id fehlt` |
| Modul unbekannt | `Leistungsmodul nicht gefunden: …` |
| Modul inaktiv | `Leistungsmodul ist nicht aktiv: …` |
| Modul doppelt | `Leistungsmodul bereits in dieser Version enthalten: …` |
| `rabatt_prozent` ungültig | `rabatt_prozent …` |

---

## 5. `organization_modules` (Zielmodell)

Mandantenlizenzen referenzieren den **selben** Modulstamm. Keine duplizierten Namen, Beschreibungen oder Preise in `organization_modules`.

### 5.1 Spalten (Ziel)

| Spalte | Beschreibung |
| --- | --- |
| `id` | Primärschlüssel |
| `organization_id` | FK → `organizations.id` |
| `leistungsmodul_id` | FK → `leistungsmodule.id` ON DELETE RESTRICT; nur `modultyp IN ('plattform', 'beides')` |
| `lizenz_status` | `geplant` \| `aktiv` \| `pausiert` \| `gekündigt` |
| `aktiviert_am` | Zeitpunkt der Aktivierung (nullable bei `geplant`) |
| `deaktiviert_am` | Zeitpunkt der Deaktivierung/Kündigung (nullable) |
| `konfiguration` | `jsonb` nullable — mandantenspezifische Einstellungen |
| `modul` | **Legacy-Rückfallebene** (Freitext); später entfernen |

**Constraints (Ziel):** `UNIQUE (organization_id, leistungsmodul_id)`

Org-Gesamtpreise (`organizations.monatlicher_grundpreis`, Rabatt) bleiben vorerst auf Mandantenebene.

### 5.2 Migration bestehender Angebotsdaten

**Implementiert** in `20260717270000_angebots_modulkatalog.sql`:

1. Tabelle `leistungsmodule` (ohne `modultyp`, ohne `technischer_schluessel`)
2. `angebot_positionen.leistungsmodul_id`, `preisart` nullable
3. FK, CHECK, partieller UNIQUE-Index
4. **Keine Seed-Daten**

**Noch nicht implementiert:** Zusammenführung mit `organization_modules` — siehe `docs/module-zusammenfuehrung-mapping.md`.

### 5.3 Rollout-Reihenfolge (empfohlen)

```
1. Fachliche Listenpreise aller Module festlegen (kein 0-Cent-Seed)
2. Migration: technischer_schluessel, modultyp, organization_modules-Erweiterung
3. Seed + Backfill organization_modules (explizites Mapping)
4. RPC create_angebot / update_angebot_entwurf (modultyp-Filter)
5. RPC create_mandant_onboarding (leistungsmodul_id)
6. UI Angebote + Mandanten-Onboarding + Admin Modulstamm
```

---

## 6. UI-Zielbild (noch nicht implementieren)

### Angebots-UI

| Element | Verhalten |
| --- | --- |
| Modulauswahl | Nur `aktiv = true` und `modultyp IN ('leistung', 'beides')` |
| Beschreibung / Festpreis / MwSt. / Einheit | Read-only |
| Rabatt | Editierbar (`rabatt_prozent`) |
| Menge | Fest `1`, nicht editierbar |
| Legacy-Entwürfe | Bestehende freie Positionen weiter anzeigen/bearbeiten; neue Positionen nur über Modulauswahl |

### Admin-UI (später, eigene Seite)

- CRUD für Leistungsmodule (ohne Hard-Delete bei Verwendung)
- Deaktivierung über `aktiv`
- `code`-Sperre nach erster Angebotsverwendung
- Keine Kategorien in V1

---

## 7. Auswirkungen auf bestehende Komponenten

| Bereich | Änderung |
| --- | --- |
| `calculateAngebotTotals` | Später: getrennte Summen nach `preisart`; aktuell noch unverändert bis Anwendungs-Rollout |
| `pickRelevantAngebotVersion` | Unverändert |
| `getAngeboteList` / `getAngebotAkte` | Optional später: `leistungsmodul_id` mitliefern |
| `erstelle_neue_angebotsversion` | Kopie um `leistungsmodul_id` erweitern |
| `docs/angebote-datenmodell.md` | Nach Umsetzung: Verweis auf dieses Dokument |

---

## 8. Preisart (Entscheidung: Option B)

**Verbindliche Entscheidung:** Leistungsmodule können **`einmalig`** oder **`monatlich`** sein.

| Wert | Bedeutung (V1) |
| --- | --- |
| `einmalig` | Einmaliger Festpreis in `einzelpreis_netto_cents` |
| `monatlich` | Monatlicher Festpreis in `einzelpreis_netto_cents` — **immer pro Monat** |

**Schema:**

| Tabelle | Feld |
| --- | --- |
| `leistungsmodule` | `preisart` NOT NULL |
| `angebot_positionen` | `preisart` nullable (Snapshot; NULL bei Legacy) |

**Auswirkungen:**

| Bereich | Regel |
| --- | --- |
| **Angebotsanzeige** | Kennzeichnung nach Preisart; **zwei Summenblöcke** (einmalig / monatlich), keine gemeinsame Mischsumme |
| **Summenberechnung** | Getrennte Aggregation nach `preisart`; keine Gesamtsumme über beide Preisarten hinweg |
| **Verträge / Abonnements** | Monatliche Module lassen sich direkter in Abonnements überführen |
| **PDF** | Kennzeichnung (z. B. „mtl.“), getrennte Summenzeilen |
| **Intervalle** | V1: nur monatlich; **kein** quartalsweises oder jährliches Intervall |

**Nicht umgesetzt in dieser Migration:** RPC-Snapshot-Logik, getrennte Summenberechnung in der Anwendung, UI.

---

## 9. Verweis in zentraler Dokumentation

Nach Umsetzung:

- `docs/angebote-datenmodell.md`: Verweis auf Modulkatalog
- `docs/datenmodell.md` (Abschnitt Angebote): Kurzverweis auf `leistungsmodule`

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-21 | Erstversion — Konzept Modulkatalog |
| 2026-07-21 | Verbindliche V1-Entscheidungen festgelegt; Abschnitt Preisart ergänzt |
| 2026-07-21 | Option B entschieden; Migration `20260717270000_angebots_modulkatalog.sql` |
| 2026-07-21 | Gemeinsames Modulmodell: Zentralstamm, `modultyp`, `organization_modules`-Anbindung |
