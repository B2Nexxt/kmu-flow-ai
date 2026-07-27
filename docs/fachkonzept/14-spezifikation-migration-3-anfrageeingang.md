# Spezifikation: Migration 3 — Anfrageeingang und Zuordnungsprüfung

Technische **Spezifikation** für die dritte operative Datenbank-Migration (kanalunabhängiger Anfrageeingang). **Noch keine SQL-Datei, keine RPC, keine UI.**

**Status:** Verbindliche Spezifikation — **DDL in Migration `20260717300000_operativer_anfrageeingang_v1.sql`** — noch nicht auf Supabase ausgeführt  
**Datum:** 2026-07-27 (DDL-Blocker finalisiert: 2026-07-27)  
**Bezug:** ADR-0008, ADR-0013, ADR-0014, ADR-0015, ADR-0016, ADR-0017, **ADR-0018**, [`04-anfrageprozess.md`](./04-anfrageprozess.md), [`10-technisches-kunden-und-objektmodell.md`](./10-technisches-kunden-und-objektmodell.md), [`13-spezifikation-migration-2-beziehungen-und-vorgaenge.md`](./13-spezifikation-migration-2-beziehungen-und-vorgaenge.md)

**Voraussetzung:** Migration 1 und Migration 2 angewendet und getestet.

---

## Ziel

Migration 3 legt **eine neue Tabelle** für die operative Kundenplattform (`/`) an:

| Tabelle | Zweck |
| --- | --- |
| `anfrageeingaenge` | Kanalunabhängiger Eingang roher/teilstrukturierter Anfragen inkl. Zuordnungs- und Vollständigkeitsmetadaten |

Die Migration bildet **ausschließlich** den **Datenspeicher** und die **integritätsrelevanten Constraints** ab. Zuordnungslogik, Vorgangserzeugung und Nummernvergabe erfolgen **serverseitig in späteren Sprints** — nicht in M3-DDL.

---

## Nicht-Ziele (Migration 3)

| Ausgeschlossen | Grund |
| --- | --- |
| Änderung an `/admin`-Tabellen | ADR-0014 |
| Providerintegration (E-Mail, WhatsApp, SMS) | Kanal = Herkunft; technische Anbindung später |
| KI-Auswertung / Prompting | Nur JSON-Felder vorbereiten |
| Automatisches Versenden von Rückfragen | Kommunikation später |
| Separate Nachrichten-/Kommunikationstabelle | Nicht zwingend in M3 (Abschnitt 11) |
| `vorgaenge` anlegen bei unvollständigem Eingang | ADR-0018 |
| Platzhalterkunden / erfundene Objekte | ADR-0017, ADR-0018 |
| Auto-Zuordnung nur über Adresse | ADR-0008 |
| RLS-Policies für `authenticated` / `anon` | Wie M1/M2 |
| Nummern-RPC / Sequenz-Tabellen | Serverseitig wie `kundennummer`/`vorgangsnummer` |
| Fuzzy-Match / Auto-Merge | ADR-0008 |
| Gewerkespezifische Checklisten | Server/UI später |
| UI, RPC, Server Actions | Explizit ausgeschlossen |

---

## 0. DDL-Blocker final (B1–B4)

| # | Entscheidung | Status |
| --- | --- | --- |
| **B1** | `rohinhalt` unveränderlich via `rohinhalt_gesperrt_am` + Trigger `anfrageeingaenge_protect_raw_content()` | ✅ |
| **B2** | `confidence_score numeric(5,4) NULL`, CHECK 0–1, rein diagnostisch | ✅ |
| **B3** | `konversation_id` = UUID-Gruppierung ohne eigene Tabelle; `parent_*` ohne Pflicht-Konversation | ✅ |
| **B4** | `inhalt_hash` ohne UNIQUE/Trigger; `kanal_externe_id` mit part. UNIQUE | ✅ |

Details: Abschnitte 3, 5, 6, 13, 15, 22–23.

---

## 1. Fachliche Abgrenzung (verbindlich)

### Anfrageeingang

Der **Anfrageeingang** nimmt rohe oder teilweise strukturierte Eingangsinformationen auf — **kanalunabhängig**.

| Beispiel | Kanal (Herkunft) |
| --- | --- |
| Telefonnotiz | `telefon` |
| E-Mail | `email` |
| Kontaktformular | `kontaktformular` |
| WhatsApp-Nachricht | `whatsapp` |
| SMS | `sms` |
| Persönliche Anfrage | `persoenlich` |
| Empfehlung | `empfehlung` |

Der Anfrageeingang ist **noch kein Vorgang**.

### Vorgang

Ein **`vorgang`** darf erst entstehen, wenn mindestens feststehen:

| Mindestanforderung | Technische Abbildung (später) |
| --- | --- |
| Echter vorläufiger oder bestätigter Kunde | `kunden` mit `kundenstatus IN ('vorlaeufig','bestaetigt')` — **kein Platzhalter** |
| Gebäude | `gebaeude_id` |
| Gegebenenfalls Einheit | `einheit_id` optional; MFH serverseitig ggf. Pflicht |
| Fachliches Anliegen / Titel | `vorgaenge.titel` nicht leer |

| Verboten | |
| --- | --- |
| Platzhalterkunden | z. B. „Unbekannt“, „Neuer Kunde“ ohne Bezug |
| Erfundene Objekte | Gebäude/Einheit ohne echte Mindestdaten |
| Auto-Vorgang bei unzureichenden Daten | Eingang bleibt in `anfrageeingaenge` |

### Datenfluss (konzeptionell)

```
Kanal → anfrageeingaenge (neu)
           ↓ Analyse / Zuordnungsprüfung (Server, später)
           ↓ bei ausreichender Vollständigkeit + bestätigter Zuordnung
        vorgaenge + vorgang_beteiligte (+ ggf. neue Stammdaten)
           ↓
        erzeugter_vorgang_id, status=in_vorgang_ueberfuehrt
```

---

## 2. Tabellenentscheidung

### Eine Tabelle reicht für M3

| Option | Bewertung |
| --- | --- |
| **Nur `anfrageeingaenge`** | ✅ **Empfohlen für M3** |
| Zusätzliche `anfrage_nachrichten` | ❌ Overhead ohne Provider; erst bei Kommunikationsmodul |
| Zusätzliche `zuordnungsvorschlaege` | ❌ Kandidaten in `zuordnungskandidaten jsonb` ausreichend |

**Begründung:** M3 speichert den fachlichen Eingang und Metadaten. Gesendete/empfangene Nachrichtenketten, Anhänge und Provider-Envelope kommen in **späteren Migrationen**.

---

## 3. Tabelle `anfrageeingaenge` — finale Feldspezifikation

### Vollständige Feldliste (M3)

| Feld | Typ | NULL | Default | Beschreibung |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary Key |
| `mandant_id` | `uuid` | NOT NULL | — | FK → `organizations(id)` RESTRICT |
| `eingangsnummer` | `text` | NOT NULL | — | Mandantenintern eindeutig; serverseitig vergeben |
| `kanal` | `text` | NOT NULL | — | Abschnitt 4 |
| `status` | `text` | NOT NULL | `'neu'` | Abschnitt 5 |
| `betreff` | `text` | NULL | — | Trim nicht leer wenn gesetzt; Korrektur nur Server-Prozess |
| `rohinhalt` | `text` | NULL | — | Original; nach Sperre unveränderlich (B1) |
| `rohinhalt_gesperrt_am` | `timestamptz` | NULL | — | Gesetzt beim ersten Verlassen von `status=neu` (B1) |
| `strukturierte_daten` | `jsonb` | NOT NULL | `'{}'` | Abschnitt 9; CHECK `object` |
| `absender_name` | `text` | NULL | — | Roh-Metadatum; Korrektur nur Server-Prozess |
| `absender_email` | `text` | NULL | — | Roh-Metadatum; Korrektur nur Server-Prozess |
| `absender_telefon` | `text` | NULL | — | Roh-Metadatum; Korrektur nur Server-Prozess |
| `empfangen_am` | `timestamptz` | NOT NULL | `now()` | Eingangszeitpunkt |
| `zuletzt_bearbeitet_am` | `timestamptz` | NULL | — | Server setzt bei fachlicher Bearbeitung |
| `beendet_am` | `timestamptz` | NULL | — | Endstatus — Abschnitt 5 |
| `zugeordnet_kunde_id` | `uuid` | NULL | — | Nur bei `zuordnungsstatus=bestaetigt` |
| `zugeordnet_gebaeude_id` | `uuid` | NULL | — | Nur bei `bestaetigt`; Pflicht dann NOT NULL |
| `zugeordnet_einheit_id` | `uuid` | NULL | — | Optional; Composite-FK mit Gebäude |
| `erzeugter_vorgang_id` | `uuid` | NULL | — | Max. ein Vorgang pro Eingang |
| `zuordnungsstatus` | `text` | NOT NULL | `'kein_treffer'` | Abschnitt 6 |
| `zuordnungsgrund` | `jsonb` | NOT NULL | `'{}'` | CHECK `object` |
| `zuordnungskandidaten` | `jsonb` | NOT NULL | `'[]'` | CHECK `array` |
| `vollstaendigkeitsstatus` | `text` | NOT NULL | `'unbekannt'` | Abschnitt 8 |
| `fehlende_angaben` | `jsonb` | NOT NULL | `'[]'` | CHECK `array` |
| `confidence_score` | `numeric(5,4)` | NULL | — | Diagnose only (B2) |
| `dringlichkeit` | `text` | NOT NULL | `'normal'` | `niedrig`…`dringend` |
| `manuelle_pruefung_erforderlich` | `boolean` | NOT NULL | `false` | |
| `kanal_externe_id` | `text` | NULL | — | Provider-Message-ID (B4) |
| `inhalt_hash` | `text` | NULL | — | Server berechnet; kein UNIQUE (B4) |
| `parent_anfrageeingang_id` | `uuid` | NULL | — | Composite-FK self; ≠ `id` |
| `konversation_id` | `uuid` | NULL | — | Gruppierung ohne Tabelle (B3) |
| `aktiv` | `boolean` | NOT NULL | `true` | Archivierung M1/M2 |
| `archiviert_am` | `timestamptz` | NULL | — | CHECK aktiv/archiviert |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Trigger `set_updated_at()` |

### Explizit nicht in M3

| Feld | Grund |
| --- | --- |
| `bevorzugter_antwortkanal` | Kommunikationsmodul |
| `rueckfrage_anzahl` | Kommunikationsmodul |
| `erinnerungstermin` | Aufgaben-/Kommunikationsmodul |

### JSON-Felder — Defaults und Typ-CHECKs (final)

| Feld | NOT NULL | Default | `jsonb_typeof` |
| --- | --- | --- | --- |
| `strukturierte_daten` | ja | `'{}'` | `object` |
| `zuordnungsgrund` | ja | `'{}'` | `object` |
| `zuordnungskandidaten` | ja | `'[]'` | `array` |
| `fehlende_angaben` | ja | `'[]'` | `array` |

Keine fachliche JSON-Schema-Validierung in M3 — Server validiert Inhalt.

---

## 4. Kanalwerte (V1)

| Wert | Bedeutung |
| --- | --- |
| `telefon` | Telefonnotiz / Anruf |
| `email` | E-Mail-Eingang |
| `kontaktformular` | Webformular |
| `whatsapp` | WhatsApp (nur Herkunft in M3) |
| `sms` | SMS |
| `persoenlich` | Persönliche Anfrage vor Ort / Schalter |
| `empfehlung` | Weiterempfehlung |
| `sonstiges` | Fallback |

- CHECK-Constraint in DDL: `kanal IN (...)`  
- **Keine** Providerlogik, Webhooks oder IMAP in M3  
- `kanal` beschreibt **nur die Herkunft**, nicht den Fachprozess

---

## 5. Statusmodell Anfrageeingang (V1)

### Empfehlung: kein Status `archiviert`

| Thema | Entscheidung |
| --- | --- |
| `archiviert` als Status | ❌ **Nicht verwenden** — redundant zu `aktiv`/`archiviert_am` (M1/M2-Konvention) |
| Archivierung | Über `aktiv=false` + `archiviert_am NOT NULL` |
| Prozessstatus vs. Archiv | **Orthogonal:** ein Eingang kann `status=wartet_auf_informationen` und später archiviert werden |

### Statuswerte (V1)

| Status | Bedeutung | Endstatus? |
| --- | --- | --- |
| `neu` | Frisch eingegangen, noch nicht analysiert | nein |
| `analysiert` | Erste Auswertung/Zuordnungsprüfung durchgeführt | nein |
| `wartet_auf_informationen` | Rückfrage nötig (Versand später) | nein |
| `zur_manuellen_pruefung` | Konflikt/mehrere Treffer — Büro entscheidet | nein |
| `bereit_fuer_vorgang` | Zuordnung + Vollständigkeit ausreichend | nein |
| `in_vorgang_ueberfuehrt` | Vorgang wurde erzeugt | **ja** |
| `verworfen` | Spam, Fehlanfrage, absichtlich verworfen | **ja** |

### Endstatus und `beendet_am` (final)

| Regel | Spezifikation |
| --- | --- |
| Endstatus | `in_vorgang_ueberfuehrt`, `verworfen` |
| CHECK `beendet_check` | Endstatus ↔ `beendet_am IS NOT NULL`; alle anderen Status ↔ `beendet_am IS NULL` |
| Analogie | Wie `vorgaenge.beendet_check` in M2 |

`verworfen` ist ein **Endstatus** — Eingang bleibt historisch lesbar.

### Vorgangsverknüpfung und Status (final)

| CHECK | Regel |
| --- | --- |
| `vorgang_status_check` (bidirektional) | `erzeugter_vorgang_id IS NOT NULL` ↔ `status = 'in_vorgang_ueberfuehrt'` |

### Archivierung (final)

| CHECK | Regel |
| --- | --- |
| `aktiv_archiviert_check` | `aktiv = true` ↔ `archiviert_am IS NULL` |
| Orthogonalität | Archivierung **unabhängig** vom Prozessstatus |

### `manuelle_pruefung_erforderlich` bei `verworfen`

**Nicht** per CHECK erzwingen (`manuelle_pruefung_erforderlich = false`). Historische Gründe für Verwerfung können variieren (Auto-Spam vs. manuelle Entscheidung).

### Statusübergänge

M3 definiert **keine** DB-Trigger für Statusmaschine. Übergänge werden **serverseitig** validiert. DDL nur CHECK auf erlaubte Werte + `beendet_am`-Konsistenz.

---

## 6. Zuordnungsstatus (V1)

| Wert | Bedeutung | Auto-Aktion |
| --- | --- | --- |
| `kein_treffer` | Kein passender Bestandskunde/Objekt | Neuanlage **später** nur bei vollständigen Mindestdaten |
| `eindeutig` | Maschinelle Bewertung: ≥2 Merkmale, kein Widerspruch, Objekt eindeutig | **Noch keine** FK-Schreibung — Vorschlag |
| `moeglicher_treffer` | Nur ein belastbares Merkmal | Vorschlag in `zuordnungskandidaten`, **keine** FK |
| `mehrere_treffer` | Mehrere zulässige Kandidaten | Manuelle Auswahl |
| `konflikt` | Widersprüchliche Merkmale | **Keine** Auto-Verknüpfung oder Neuanlage |
| `bestaetigt` | Zuordnung final bestätigt (manuell oder regelbasiert nach Freigabe) | FK-Felder dürfen gesetzt werden |
| `nicht_erforderlich` | Keine Kunden-/Objektzuordnung fachlich nötig (Spam, allgemeine Anfrage ohne Bezug) | **Keine** FK-Felder — bleiben NULL |

### `eindeutig` vs. `bestaetigt` — getrennte Zustände

| Zustand | Ebene | FK-Felder |
| --- | --- | --- |
| `eindeutig` | **Maschinelle Bewertung** | bleiben NULL |
| `bestaetigt` | **Verbindliche Zuordnung** | **Pflicht:** `zugeordnet_kunde_id`, `zugeordnet_gebaeude_id`; Einheit optional |

Übergang `eindeutig → bestaetigt` durch explizite Bestätigung (Auto-Freigabe-Regel **oder** manuell im Büro — Server).

### Zuordnungs-FK-Konsistenz (finale CHECKs)

| Regel | DDL |
| --- | --- |
| `zuordnungsstatus = 'bestaetigt'` | → `zugeordnet_kunde_id IS NOT NULL` **und** `zugeordnet_gebaeude_id IS NOT NULL` |
| `zuordnungsstatus <> 'bestaetigt'` | → `zugeordnet_kunde_id IS NULL` **und** `zugeordnet_gebaeude_id IS NULL` **und** `zugeordnet_einheit_id IS NULL` |
| `nicht_erforderlich` | finale FK-Felder **NULL** (keine Ausnahme) |

Composite-FKs greifen nur, wenn FK-Spalten gesetzt sind (bei `bestaetigt`).

---

## 7. Zwei-Merkmale-Regel — technisches Modell

### Grundsätze (ADR-0008)

| Regel | |
| --- | --- |
| Mindestens zwei **unabhängige** Merkmale für `eindeutig` | |
| Straße + Hausnummer = **ein** Adressmerkmal `objektadresse` | |
| Gleiche Adresse allein = **kein** Auto-Match | |
| Kein Fuzzy-Match ohne manuelle Bestätigung | |
| Keine automatische Kunden-/Objektzusammenführung | |
| Signierter Vorgangslink | starkes Einzelmerkmal — **später**, nicht M3 |
| Keine KI-Wahrscheinlichkeit als alleinige Grundlage | |

### Geeignete Merkmale (V1)

| `typ` in JSON | Beschreibung |
| --- | --- |
| `kundennummer` | Mandanteninterne Nummer |
| `email` | E-Mail-Adresse |
| `telefon` | Telefonnummer (normalisiert) |
| `objektadresse` | Normalisierte Adresse (Straße+Nr+PLZ+Ort als Einheit) |
| `einheit_bezeichnung` | Einheit innerhalb bekannten Gebäudes |
| `name` | Personen-/Firmenname (schwächer allein) |

### `zuordnungsgrund jsonb` — Schema-Grundmuster (V1)

```json
{
  "merkmale": [
    {
      "typ": "email",
      "wert_hash": "sha256:…",
      "ergebnis": "uebereinstimmung",
      "kandidat_id": "uuid-des-kunden"
    },
    {
      "typ": "objektadresse",
      "wert_hash": "sha256:…",
      "ergebnis": "uebereinstimmung",
      "kandidat_gebaeude_id": "uuid"
    }
  ],
  "widersprueche": [
    {
      "typ": "kundennummer_email",
      "beschreibung": "kundennummer_gehoert_zu_anderem_kunden"
    }
  ],
  "regelversion": "v1",
  "bewertet_am": "2026-07-27T10:00:00Z"
}
```

| Regel | |
| --- | --- |
| Keine Klartext-Duplikate | E-Mail/Telefon/Name bevorzugt als `wert_hash` |
| Nachvollziehbarkeit | `regelversion`, `bewertet_am`, `ergebnis` pro Merkmal |
| Keine JSON-Schema-Validierung in M3 | Freie Erweiterung; Server validiert |

### `confidence_score` (B2 — final)

| Aspekt | Entscheidung |
| --- | --- |
| Datentyp | **`numeric(5,4)`** — expliziter Wertebereich 0.0000–1.0000; **nicht** `double precision` (Drift, uneinheitliche Anzeige) |
| NULL | Erlaubt — z. B. bei manueller Zuordnung ohne Score |
| CHECK | `confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)` |
| Entscheidungsrelevant | ❌ **Niemals allein** — keine Auto-Zuordnung allein wegen Score |
| Verwendung | Diagnose, UI-Sortierung, spätere KI-Metrik |

---

## 8. Vollständigkeitsstatus

### Werte (V1)

| Wert | Bedeutung |
| --- | --- |
| `unbekannt` | Noch nicht bewertet (Default) |
| `unvollstaendig` | Wesentliche Angaben fehlen |
| `ausreichend_fuer_rueckfrage` | Genug für gezielte Rückfrage, noch kein Vorgang |
| `ausreichend_fuer_vorgang` | Mindestanforderungen für Vorgangserzeugung erfüllt |
| `vollstaendig` | Alle für nächsten Prozessschritt relevanten Angaben vorhanden |

**Bewertung:** Die Werte sind **verständlich und widerspruchsfrei**, sofern der Server `ausreichend_fuer_vorgang` **nur** setzt, wenn Zuordnung **bestätigt** ist und Pflichtfelder (Kunde, Gebäude, Anliegen) vorliegen.

### `fehlende_angaben jsonb`

Array oder Objekt mit festgestellten Lücken — **keine** Gewerke-Checkliste in M3.

```json
{
  "eintraege": [
    { "schluessel": "objektadresse", "prioritaet": "hoch" },
    { "schluessel": "einheit", "prioritaet": "mittel" },
    { "schluessel": "anliegen", "prioritaet": "hoch" }
  ],
  "schema_version": "v1"
}
```

| Mögliche `schluessel` | |
| --- | --- |
| `kundenname`, `kontaktmoglichkeit`, `objektadresse`, `gebaeude`, `einheit`, `anliegen`, `dringlichkeit`, `fotos`, … | gewerkeübergreifend |

Nicht jedes Gewerk benötigt dieselben Angaben — M3 speichert **nur festgestellte** Lücken.

---

## 9. Strukturierte Eingangsdaten (`strukturierte_daten`)

| Regel | |
| --- | --- |
| `rohinhalt` bleibt unverändert | Original |
| `strukturierte_daten` = Ergebnis späterer Analyse | Manuell oder KI — **nicht in M3** |
| Kein Feld mit `status=bestaetigt` ohne menschliche/regelbasierte Freigabe | |
| Keine freie Interpretation als Source of Truth | |

### Schema-Grundmuster (V1)

```json
{
  "felder": {
    "anliegen": {
      "wert": "Undichtigkeit Bad",
      "quelle": "rohinhalt",
      "status": "erkannt"
    },
    "objektadresse": {
      "wert": "Hauptstr. 12, 10115 Berlin",
      "quelle": "kontaktformular_feld",
      "status": "erkannt"
    }
  },
  "schema_version": "v1"
}
```

| `status` pro Feld | Bedeutung |
| --- | --- |
| `erkannt` | Automatisch/manuell extrahiert, unbestätigt |
| `bestaetigt` | Fachlich freigegeben |
| `abgelehnt` | Verworfen |

Keine strenge JSON-Schema-Validierung in M3.

---

## 10. Objekt- und Kundenzuordnung

### FK-Felder vs. Kandidaten

| Speicherort | Inhalt |
| --- | --- |
| `zugeordnet_*` | **Nur bestätigte** Zuordnung |
| `zuordnungskandidaten` | Vorschläge mit Score/Rang |

### `zuordnungskandidaten jsonb` — Grundmuster

```json
{
  "kunden": [
    { "kunde_id": "uuid", "score": 0.85, "grund": "email+adresse" }
  ],
  "gebaeude": [
    { "gebaeude_id": "uuid", "einheit_id": null }
  ],
  "schema_version": "v1"
}
```

### Composite-FKs (wie M2)

| FK | Referenz |
| --- | --- |
| `(mandant_id, zugeordnet_kunde_id)` | `kunden(mandant_id, id)` RESTRICT |
| `(mandant_id, zugeordnet_gebaeude_id)` | `gebaeude(mandant_id, id)` RESTRICT |
| `(mandant_id, zugeordnet_gebaeude_id, zugeordnet_einheit_id)` | `einheiten(mandant_id, gebaeude_id, id)` MATCH SIMPLE RESTRICT |
| `(mandant_id, erzeugter_vorgang_id)` | `vorgaenge(mandant_id, id)` RESTRICT |
| `(mandant_id, parent_anfrageeingang_id)` | `anfrageeingaenge(mandant_id, id)` RESTRICT |

Parent-Key für Selbstreferenz: `UNIQUE (mandant_id, id)` auf `anfrageeingaenge`.

### Regeln

| Regel | |
| --- | --- |
| Cross-Tenant | durch Composite-FKs verhindert |
| Einheit ohne passendes Gebäude | Composite-FK verhindert |
| Max. ein Vorgang pro Eingang | `erzeugter_vorgang_id` singular; kein UNIQUE auf Vorgangsseite |
| Vorgangserzeugung | historisch nachvollziehbar; stille Neuzuordnung verboten |
| `erzeugter_vorgang_id` gesetzt | → `status=in_vorgang_ueberfuehrt`, `beendet_am` gesetzt |

---

## 11. Verknüpfung zum Vorgang

### Entscheidung: Option A (empfohlen und verbindlich)

| Aspekt | Festlegung |
| --- | --- |
| Ein Anfrageeingang | max. **ein** `erzeugter_vorgang_id` |
| Ein Vorgang | darf von **mehreren** Eingängen referenziert werden |
| UNIQUE auf `erzeugter_vorgang_id` | **Nein** |
| Use Cases | Erstmail + Ergänzungsmail, Formular + Telefonnotiz |

### CHECK-Empfehlung

`erzeugter_vorgang_id IS NOT NULL` → `status = 'in_vorgang_ueberfuehrt'`.

---

## 12. Rückfragen und Kommunikation

M3 **versendet keine** Kommunikation.

| Information | M3 | Später |
| --- | --- | --- |
| `fehlende_angaben` | ✅ | — |
| Bevorzugter Antwortkanal | ❌ | Kommunikationsmodul |
| Letzte Rückfrage / nächste Erinnerung | ❌ | Nachrichten-/Aufgabenmodul |
| Anzahl Rückfragen | ❌ | Kommunikationsmodul |
| Gesendete E-Mails/SMS | ❌ | `kommunikation_*` o. ä. |

**Empfehlung:** M3 nur fachlichen Eingang; Rückfragen und Historie **separat** modellieren.

---

## 13. Dubletten und erneute Nachrichten (B3, B4 — final)

### Konversation (B3)

| Regel | Entscheidung |
| --- | --- |
| `konversation_id` | UUID-Gruppierungswert **ohne eigene Tabelle** in M3 |
| Eigene `konversationen`-Tabelle | Erst mit **Kommunikationsmodul** |
| `parent_anfrageeingang_id` | Nullable; **keine** DB-Pflicht für `konversation_id` wenn parent gesetzt |
| Parent-Mandant | Composite-FK `(mandant_id, parent_anfrageeingang_id)` → self |
| Selbstreferenz | CHECK `parent_anfrageeingang_id IS NULL OR parent_anfrageeingang_id <> id` |
| Mehrstufige Zyklen | **Nicht** per Trigger in M3 — bewusste Grenze (wie `vorgaenge.parent`) |
| Mehrere Eingänge → ein Vorgang | Erlaubt; gleiche `konversation_id` optional |

### Inhaltshash und externe ID (B4)

| Feld | Regel |
| --- | --- |
| `inhalt_hash` | `text` nullable; **kein** DB-Trigger; Server/Provider normalisiert später |
| UNIQUE auf `inhalt_hash` | ❌ **Nein** — nur part. Index für Suche/Dubletten**vorschläge** |
| Auto-Merge | ❌ **Verboten** — Hash dient nur Hinweis |

| Feld | Regel |
| --- | --- |
| `kanal_externe_id` | `text` nullable; technische Provider-ID |
| Partieller UNIQUE | `(mandant_id, kanal, kanal_externe_id) WHERE kanal_externe_id IS NOT NULL` |
| Cross-Tenant | Gleiche externe ID in **verschiedenen** Mandanten **erlaubt** |

### Bedeutung gleicher `kanal_externe_id`

| Situation | Bewertung |
| --- | --- |
| Gleiche ID, gleicher Mandant, gleicher Kanal | **Standard:** technische Dublette → INSERT mit gesetzter ID schlägt fehl |
| Provider-Reuse / fehlerhafte IDs | Server lässt `kanal_externe_id` **NULL** oder protokolliert Ausnahme — kein Auto-Merge |
| Bewusst erneuter Import | Server muss neue externe ID oder NULL wählen |
| Fachlich gleiche Anfrage, andere Message-ID | **Zwei** Eingänge — ggf. gleiche `konversation_id`, **kein** Merge |

### Fallmatrix

| # | Fall | M3-Verhalten |
| --- | --- | --- |
| 1 | Gleiche E-Mail technisch doppelt zugestellt | `kanal_externe_id` + part. UNIQUE → zweiten Insert ablehnen oder als Duplikat markieren |
| 2 | Gleiche Anfrage Formular + E-Mail | **Zwei** Eingänge; optional gleiche `konversation_id` nach Server-Bewertung |
| 3 | Ergänzungsmail mit fehlenden Daten | Neuer Eingang mit `parent_anfrageeingang_id`; gleiche `konversation_id` |
| 4 | Telefonnotiz zu bestehendem Eingang | Neuer Eingang, `parent_*` oder `konversation_id` |
| 5 | Zwei Kunden, gleiche Adresse | **Getrennte** Eingänge; kein Merge |
| 6 | Mehrere Mieter, gleiche Wohnung | Zuordnung über Einheit + Kunde; ggf. `mehrere_treffer` |
| 7 | Bestandskunde, neue E-Mail | `moeglicher_treffer` oder `eindeutig` mit zweitem Merkmal |
| 8 | Unbekannter Absender mit Kundennummer + Adresse | `eindeutig` möglich |
| 9 | Nur Name + Adresse | **Ein** Merkmal adresse + schwaches Name — typisch `moeglicher_treffer` |
| 10 | Widersprüchliche Kundennummer und E-Mail | `konflikt` |

### M3-Felder für Dubletten/Konversation

| Feld | Zweck | Pflicht in M3 |
| --- | --- | --- |
| `kanal_externe_id` | Provider-Message-ID | nullable; UNIQUE mit `kanal` wenn gesetzt |
| `inhalt_hash` | Technische Dublette (normalisierter Inhalt) | nullable; kein Auto-Merge |
| `parent_anfrageeingang_id` | Ergänzung/Follow-up | nullable |
| `konversation_id` | Fachliche Gruppierung | nullable; Server-vergeben |

**Nicht in M3:** automatisches Zusammenführen fachlich getrenner Anfragen.

### Partieller UNIQUE-Index (DDL-Empfehlung)

```sql
UNIQUE (mandant_id, kanal, kanal_externe_id)
WHERE kanal_externe_id IS NOT NULL
```

---

## 14. Nummerierung

| Aspekt | Spezifikation |
| --- | --- |
| `eingangsnummer` | NOT NULL, mandantenintern eindeutig |
| UNIQUE | `(mandant_id, eingangsnummer)` |
| Trennung | Keine Vermischung mit `vorgangsnummer` / `kundennummer` |
| Vergabe | Serverseitig (wie M1/M2) — **kein** Nummern-RPC in M3 |
| Format-CHECK | **Keiner** in DB |

---

## 15. Archivierung, Endstatus, Rohinhalt-Sperre (B1 — final)

| Regel | |
| --- | --- |
| Fachlich verarbeitete Eingänge | **nicht** hart löschen |
| Spam/Test | `verworfen` + Archivierung |
| Archivierung | `aktiv`/`archiviert_am` wie M1/M2 — **nicht** Status `archiviert` |
| Endstatus | bleiben lesbar mit `beendet_am` |

### B1 — `rohinhalt` und `rohinhalt_gesperrt_am`

| Regel | Spezifikation |
| --- | --- |
| Änderbarkeit `rohinhalt` | Nur solange `rohinhalt_gesperrt_am IS NULL` (entspricht faktisch `status = 'neu'`, plus Übergangs-UPDATE) |
| Sperre setzen | Beim **ersten** Verlassen von `status = 'neu'` → `rohinhalt_gesperrt_am = now()` |
| INSERT mit `status <> 'neu'` | Trigger setzt `rohinhalt_gesperrt_am = now()` sofort |
| Kombi-UPDATE | Status `neu` → Folgestatus **und** letzte `rohinhalt`-Korrektur in **einem** UPDATE: ✅ zulässig wenn `OLD.status = 'neu'` |
| Rückkehr zu `status = 'neu'` | ❌ **Hebt Sperre nicht auf** — `rohinhalt_gesperrt_am` bleibt gesetzt |
| Manuelles Löschen von `rohinhalt_gesperrt_am` | ❌ Trigger verhindert (nur NULL → NOT NULL erlaubt) |
| `betreff`, Absender-Rohdaten | Kein DB-Trigger in M3; Korrektur nur **dokumentierter Server-Korrekturprozess** |
| Korrekturen fachlich | über `strukturierte_daten` mit Audit |

**Entscheidung:** Feld `rohinhalt_gesperrt_am timestamptz NULL` **aufnehmen** — robuster als reine Status-Prüfung, da Status-Rücksetzung die Sperre nicht umgeht.

### Trigger vs. nur Status-Check

| Option | Bewertung |
| --- | --- |
| Nur CHECK `status = 'neu'` für `rohinhalt`-Änderung | ❌ Status-Rücksetzung würde Sperre umgehen |
| `rohinhalt_gesperrt_am` + Trigger | ✅ **Verbindlich für M3** |

---

## 16. RLS-Zielbild

| Aspekt | M3 |
| --- | --- |
| `mandant_id` | NOT NULL |
| RLS | `ENABLE ROW LEVEL SECURITY` |
| Policies `anon`/`authenticated` | **Keine** |
| Zugriff | Service Role serverseitig |
| Client-`mandant_id` | **Nie** ungeprüft übernehmen |
| SaaS-Admin | Keine Standardrechte auf operative Eingänge |

Später: Büro/GF sehen Eingänge; Monteure normalerweise nicht — **nicht M3**.

---

## 17. Anwendungsfälle (16)

| # | Szenario | Eingang | Zuordnung | Vollständigkeit | Man. Prüfung | Kunde/Objekt | Vorgang | Datenschutz |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Vollständiges Kontaktformular, Neukunde | `neu`→`analysiert` | `kein_treffer`→Neuanlage später | `ausreichend_fuer_vorgang` nach Anlage | nein | neu `vorlaeufig` + Objekt neu | ja, nach Bestätigung | nur neuer Kunde |
| 2 | E-Mail ohne Objektadresse | `neu` | `kein_treffer`/`moeglicher_treffer` | `unvollstaendig` | ggf. | kein Objekt | **nein** | — |
| 3 | Bestandskunde E-Mail + Adresse | `analysiert` | `eindeutig`→`bestaetigt` | `ausreichend_fuer_vorgang` | nein | FK Bestand | ja | kein Fremdzugriff |
| 4 | Gleiche Adresse, anderer Mieter | `analysiert` | `mehrere_treffer` oder Einheit+Kunde | variabel | **ja** | kein Auto-Match | erst nach Wahl | Mieter getrennt |
| 5 | Gleiche Wohnung, neuer Mieter | `analysiert` | `kein_treffer` (neuer Kunde) | variabel | ggf. | neue Beziehung | nach Anlage | keine Historie Vormieter |
| 6 | Nur ein Merkmal | `analysiert` | `moeglicher_treffer` | variabel | **ja** | Kandidaten only | **nein** | — |
| 7 | Widersprüchliche Kundennummer + E-Mail | `zur_manuellen_pruefung` | `konflikt` | variabel | **ja** | keine FK | **nein** | Konflikt protokolliert |
| 8 | Technisches E-Mail-Duplikat | Duplikat erkannt | — | — | nein | — | **nein** | UNIQUE/`inhalt_hash` |
| 9 | Ergänzungsmail | neuer Eingang, `parent_*` | ggf. `bestaetigt` wenn Parent schon | aktualisiert | nein | vom Parent | ggf. gleicher Vorgang | gleiche `konversation_id` |
| 10 | Telefonnotiz zu Eingang | neuer Eingang | ggf. `bestaetigt` wenn Kunde+Objekt im Call bestätigt | ergänzt | nein | FK wenn bestätigt | optional gleicher Vorgang | — |
| 11 | Mehrere Eingänge → ein Vorgang | mehrere Zeilen | `bestaetigt` | — | — | — | **ein** Vorgang, mehrere FK | nachvollziehbar |
| 12 | Spam verworfen | `verworfen` | — | — | nein | — | **nein** | bleibt archiviert |
| 13 | Notfall | `dringlichkeit=dringend` | wie fachlich | variabel | ggf. | — | wenn vollständig | — |
| 14 | Unbekannt ohne Mindestdaten | `neu` | `kein_treffer` | `unvollstaendig` | **ja** | **keine** Platzhalter | **nein** | — |
| 15 | Gesamtes Gebäude | — | `bestaetigt` | ausreichend | nein | `gebaeude_id`, `einheit_id` NULL | ja | — |
| 16 | Konkrete Einheit MFH | — | `bestaetigt` | ausreichend | ggf. | Composite-FK Einheit | ja | Einheit Pflicht serverseitig |

---

## 18. Migrationsreihenfolge (DDL — Spezifikation)

```
 1. Funktion public.anfrageeingaenge_protect_raw_content()
      → VOLATILE, INVOKER, search_path public

 2. Tabelle anfrageeingaenge
      → alle Spalten inkl. rohinhalt_gesperrt_am, confidence_score
      → CHECKs: kanal, status, zuordnungsstatus, vollstaendigkeitsstatus, dringlichkeit
      → CHECKs: aktiv/archiviert_am, beendet_check, vorgang_status_check, zuordnungs_fk_check
      → CHECKs: jsonb_typeof (4 JSON-Felder), confidence_score, trim-Felder
      → CHECK: parent_anfrageeingang_id <> id
      → UNIQUE (mandant_id, id)
      → UNIQUE (mandant_id, eingangsnummer)
      → Composite-FKs → organizations, kunden, gebaeude, einheiten, vorgaenge, self
      → part. UNIQUE (mandant_id, kanal, kanal_externe_id) WHERE kanal_externe_id IS NOT NULL

 3. Indizes (Abschnitt 23)

 4. Trigger
      → anfrageeingaenge_set_updated_at (BEFORE UPDATE)
      → anfrageeingaenge_protect_raw_content (BEFORE INSERT OR UPDATE)

 5. RLS ENABLE — keine Policies

 6. Grants — nur Service Role wie M1/M2
```

**Keine Änderungen** an M1/M2-Tabellen — M3 ist **additiv**.

---

## 22. Funktionen und Trigger (Spezifikation)

### Wiederverwendung

| Objekt | Status |
| --- | --- |
| `public.set_updated_at()` | **Besteht** — Trigger auf `anfrageeingaenge` |

### Neue Funktion

| Funktion | Volatility | Security | `search_path` | Zweck |
| --- | --- | --- | --- | --- |
| `public.anfrageeingaenge_protect_raw_content()` | **VOLATILE** | **INVOKER** | `public` | Rohinhalt-Sperre (B1) |

**Kein** `SECURITY DEFINER`.

### Trigger `anfrageeingaenge_protect_raw_content`

| Aspekt | Entscheidung |
| --- | --- |
| Timing | **`BEFORE INSERT OR UPDATE`** — INSERT mit `status <> 'neu'` muss sofort sperren |
| Name | `anfrageeingaenge_protect_raw_content` |

**Verhalten (Spezifikation):**

1. **Rohinhalt-Änderung blockieren:** Wenn `OLD.rohinhalt_gesperrt_am IS NOT NULL` (UPDATE) und `NEW.rohinhalt IS DISTINCT FROM OLD.rohinhalt` → `RAISE EXCEPTION`.
2. **Sperre setzen bei Statuswechsel:** Wenn UPDATE, `OLD.status = 'neu'`, `NEW.status <> 'neu'`, `NEW.rohinhalt_gesperrt_am IS NULL` → `NEW.rohinhalt_gesperrt_am := now()`.
3. **Sperre bei INSERT ohne `neu`:** Wenn INSERT, `NEW.status <> 'neu'`, `NEW.rohinhalt_gesperrt_am IS NULL` → `NEW.rohinhalt_gesperrt_am := now()`.
4. **`rohinhalt_gesperrt_am` nicht zurücksetzen:** Wenn `OLD.rohinhalt_gesperrt_am IS NOT NULL` und `NEW.rohinhalt_gesperrt_am IS DISTINCT FROM OLD.rohinhalt_gesperrt_am` → Fehler (kein manuelles NULL-Setzen).
5. **Kombi-UPDATE:** Punkt 1 und 2 in derselben Transaktion — erlaubt solange `OLD.rohinhalt_gesperrt_am IS NULL`.

### Trigger `anfrageeingaenge_set_updated_at`

| Trigger | Timing | Funktion |
| --- | --- | --- |
| `anfrageeingaenge_set_updated_at` | BEFORE UPDATE | `set_updated_at()` |

---

## 23. Finale Constraints und Indizes

### Primary / Unique

| Typ | Name / Definition |
| --- | --- |
| PK | `id` |
| UNIQUE | `(mandant_id, id)` — Parent-Key Selbstreferenz |
| UNIQUE | `(mandant_id, eingangsnummer)` |
| UNIQUE (partiell) | `(mandant_id, kanal, kanal_externe_id) WHERE kanal_externe_id IS NOT NULL` |

**Kein** UNIQUE auf `inhalt_hash`, `erzeugter_vorgang_id`, `konversation_id`.

### Foreign Keys (alle ON DELETE RESTRICT)

| Constraint | Spalten → Referenz |
| --- | --- |
| `mandant_id` | → `organizations(id)` |
| `mandant_kunde` | `(mandant_id, zugeordnet_kunde_id)` → `kunden(mandant_id, id)` |
| `mandant_gebaeude` | `(mandant_id, zugeordnet_gebaeude_id)` → `gebaeude(mandant_id, id)` |
| `mandant_gebaeude_einheit` | `(mandant_id, zugeordnet_gebaeude_id, zugeordnet_einheit_id)` → `einheiten(...)` MATCH SIMPLE |
| `mandant_vorgang` | `(mandant_id, erzeugter_vorgang_id)` → `vorgaenge(mandant_id, id)` |
| `mandant_parent` | `(mandant_id, parent_anfrageeingang_id)` → `anfrageeingaenge(mandant_id, id)` |

### CHECK-Constraints (Auswahl)

| Name | Regel |
| --- | --- |
| `kanal_check` | `kanal IN (...)` |
| `status_check` | `status IN (...)` |
| `zuordnungsstatus_check` | `zuordnungsstatus IN (...)` |
| `vollstaendigkeitsstatus_check` | `vollstaendigkeitsstatus IN (...)` |
| `dringlichkeit_check` | `dringlichkeit IN ('niedrig','normal','hoch','dringend')` |
| `beendet_check` | Endstatus ↔ `beendet_am` |
| `vorgang_status_check` | `erzeugter_vorgang_id IS NOT NULL` ↔ `status = 'in_vorgang_ueberfuehrt'` |
| `aktiv_archiviert_check` | wie M1/M2 |
| `zuordnungs_fk_check` | `bestaetigt` ↔ Kunde+Gebäude NOT NULL; sonst alle FK NULL |
| `parent_not_self_check` | `parent_anfrageeingang_id IS NULL OR parent <> id` |
| `confidence_score_check` | NULL OR BETWEEN 0 AND 1 |
| `strukturierte_daten_object` | `jsonb_typeof = 'object'` |
| `zuordnungsgrund_object` | `jsonb_typeof = 'object'` |
| `zuordnungskandidaten_array` | `jsonb_typeof = 'array'` |
| `fehlende_angaben_array` | `jsonb_typeof = 'array'` |
| Text trim | `betreff`, Absender, `eingangsnummer`, `kanal_externe_id` wenn gesetzt |

### Indizes

| Index | Spalten | Partiell |
| --- | --- | --- |
| `idx_anfrageeingaenge_mandant_status_aktiv` | `(mandant_id, status, aktiv)` | — |
| `idx_anfrageeingaenge_mandant_zuordnungsstatus` | `(mandant_id, zuordnungsstatus)` | — |
| `idx_anfrageeingaenge_mandant_vollstaendigkeit` | `(mandant_id, vollstaendigkeitsstatus)` | — |
| `idx_anfrageeingaenge_mandant_dringlichkeit_empfangen` | `(mandant_id, dringlichkeit, empfangen_am)` | — |
| `idx_anfrageeingaenge_mandant_empfangen_desc` | `(mandant_id, empfangen_am DESC)` | — |
| `idx_anfrageeingaenge_mandant_vorgang` | `(mandant_id, erzeugter_vorgang_id)` | `erzeugter_vorgang_id IS NOT NULL` |
| `idx_anfrageeingaenge_mandant_parent` | `(mandant_id, parent_anfrageeingang_id)` | `parent IS NOT NULL` |
| `idx_anfrageeingaenge_mandant_konversation` | `(mandant_id, konversation_id)` | `konversation_id IS NOT NULL` |
| `idx_anfrageeingaenge_mandant_inhalt_hash` | `(mandant_id, inhalt_hash)` | `inhalt_hash IS NOT NULL` |
| `idx_anfrageeingaenge_mandant_kunde` | `(mandant_id, zugeordnet_kunde_id)` | `zugeordnet_kunde_id IS NOT NULL` |

---

## 19. Testspezifikation (nach DDL)

| # | Szenario | Erwartung |
| --- | --- | --- |
| T1 | INSERT minimal (`kanal`, `eingangsnummer`) | OK |
| T2 | Ungültiger `kanal` | CHECK-Fehler |
| T3 | Ungültiger `status` | CHECK-Fehler |
| T4 | Endstatus `verworfen` ohne `beendet_am` | CHECK-Fehler |
| T5 | Aktiver Status mit `beendet_am` | CHECK-Fehler |
| T6 | `zuordnungsstatus=bestaetigt` ohne Kunde/Gebäude | CHECK-Fehler |
| T7 | `zuordnungsstatus <> bestaetigt` mit gesetztem FK | CHECK-Fehler |
| T8 | `bestaetigt` mit gültigen Composite-FKs | OK |
| T9 | Einheit aus fremdem Gebäude | FK-Fehler |
| T10 | Cross-Tenant Kunde | FK-Fehler |
| T11 | Gleiche `eingangsnummer` im Mandanten | UNIQUE-Fehler |
| T12 | Gleiche `eingangsnummer` anderer Mandant | OK |
| T13 | Doppelte `kanal_externe_id` gleicher Kanal/Mandant | UNIQUE-Fehler |
| T14 | Gleiche `kanal_externe_id` anderer Mandant | OK |
| T15 | Zwei Eingänge, gleicher `erzeugter_vorgang_id` | OK |
| T16 | `erzeugter_vorgang_id` gesetzt, Status ≠ `in_vorgang_ueberfuehrt` | CHECK-Fehler |
| T17 | `parent_anfrageeingang_id = id` | CHECK-Fehler |
| T18 | Archivierung aktiv/archiviert_am | wie M1/M2 |
| T19 | `rohinhalt`-Änderung nach `rohinhalt_gesperrt_am` gesetzt | Trigger-Fehler |
| T20 | Status-Rücksetzung auf `neu` hebt Sperre nicht auf | `rohinhalt` weiter gesperrt |
| T21 | Kombi-UPDATE: `neu`→`analysiert` + `rohinhalt`-Fix | OK |
| T22 | INSERT mit `status=analysiert` setzt `rohinhalt_gesperrt_am` | OK |
| T23 | Manuelles NULL-Setzen von `rohinhalt_gesperrt_am` | Trigger-Fehler |
| T24 | `nicht_erforderlich` mit NULL FK-Feldern | OK |
| T25 | JSON Defaults und jsonb_typeof | OK / CHECK-Fehler |
| T26 | `confidence_score` 1.5 | CHECK-Fehler |
| T27 | RLS anon/authenticated | kein Zugriff |
| T28 | Service Role CRUD | OK |
| T29 | Bestandsschutz M1/M2 + `/admin` | OK |
| T30 | Cleanup temporärer Daten | OK |

---

## 20. Qualitätsprüfung

| Kriterium | Ergebnis |
| --- | --- |
| `/admin` unverändert | ✅ |
| Rohinhalt nach Verarbeitung unveränderlich | ✅ B1 + Trigger |
| Status-Rücksetzung umgeht Sperre nicht | ✅ `rohinhalt_gesperrt_am` |
| Keine Cross-Tenant-Provider-ID-Kollision | ✅ part. UNIQUE mandant+kanal |
| Finale Zuordnung nur bei `bestaetigt` | ✅ CHECK |
| Mehrere Eingänge → ein Vorgang | ✅ kein UNIQUE auf Vorgang |
| Technische Dublette ≠ fachlicher Auto-Merge | ✅ B4 |
| JSON-Typen konsistent | ✅ Defaults + jsonb_typeof |
| Keine Kommunikationslogik in M3 | ✅ |
| Kein Vorgang aus unvollständiger Nachricht | ✅ |
| Keine Platzhalterkunden | ✅ |
| Zwei-Merkmale-Regel korrekt modelliert | ✅ |
| Spezifikation ≠ Implementierung | ✅ |

---

## 21. Offene Entscheidungen vor DDL-Umsetzung

| # | Punkt | Status |
| --- | --- | --- |
| B1 | Rohinhalt-Sperre + `rohinhalt_gesperrt_am` | ✅ **Entschieden** |
| B2 | `confidence_score numeric(5,4)` | ✅ **Entschieden** |
| B3 | `konversation_id` ohne Tabelle | ✅ **Entschieden** |
| B4 | `inhalt_hash` / `kanal_externe_id` | ✅ **Entschieden** |
| B5 | Auto-Übergang `eindeutig` → `bestaetigt` | ⬜ Server-Regel (nicht DDL) |
| B6 | `nicht_erforderlich` nur Service Role | ⬜ Server-Validierung |
| B7 | `eingangsnummer`-Format | ⬜ Server, kein DB-CHECK |
| B8 | `inhalt_hash`-Algorithmus (Normalisierung) | ⬜ Server vor erstem Provider |
| — | Kommunikationstabellen | ⬜ Post-M3 |
| — | Provider-Webhooks | ⬜ Post-M3 |
| — | KI-Analyse-Pipeline | ⬜ Post-M3 |
| — | Auth-/Mitgliedschafts-Sprint | ⬜ Vor UI |

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-27 | Erstversion Spezifikation Migration 3 |
| 2026-07-27 | Blocker B1–B4 finalisiert; finale Feldliste, Trigger, Constraints |
| 2026-07-27 | DDL Migration `20260717300000_operativer_anfrageeingang_v1.sql` |
