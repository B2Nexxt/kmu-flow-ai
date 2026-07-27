# Spezifikation: M3.1 — Anfrageeingang Serverlogik (RPC & Sequenzen)

Technische **Spezifikation** für die serverseitige Fachlogik des operativen Anfrageeingangs. **Noch keine RPC-Implementierung, keine UI, keine Server Actions.**

**Status:** Verbindliche Spezifikation — bereit für DDL M3.1a + RPC M3.1b  
**Datum:** 2026-07-27  
**Bezug:** ADR-0008, ADR-0018, **ADR-0019**, [`14-spezifikation-migration-3-anfrageeingang.md`](./14-spezifikation-migration-3-anfrageeingang.md)

**Voraussetzung:** Migration 1, 2 und 3 angewendet und getestet.

---

## Ziel

M3.1 definiert die **serverseitige Fachlogik** für den operativen Anfrageeingang:

| Ebene | M3.1 Inhalt |
| --- | --- |
| **DDL M3.1a** | Sequenztabellen; Umbenennung `erzeugter_vorgang_id` → `zugeordneter_vorgang_id` |
| **RPC M3.1b** | Atomare Prozesse: Anlegen, Bewerten, Zuordnen, Stammdaten, Vorgang, Verwerfen, Archiv |

Zugriff vorerst **nur serverseitig** über Service Role. Mandant aus **vertrauenswürdigem Kontext** — nie ungeprüft vom Client.

---

## Nicht-Ziele (M3.1)

| Ausgeschlossen | Grund |
| --- | --- |
| UI / React-Komponenten | Folge-Sprint |
| Server Actions (Implementierung) | Nur Zielbild benannt |
| Provider / Webhooks / IMAP | Post-M3.1 |
| KI-Pipeline / Prompting | Post-M3.1 |
| Kommunikationsversand | Post-M3.1 |
| Operative Angebote, Termine | Eigene Domäne |
| Änderung `/admin` | ADR-0014 |
| RLS-Policies für Browser | Auth-Sprint |
| Automatische Zusammenführung / Platzhalterkunden | ADR-0008, ADR-0018 |

---

## 1. Serverprozesse (Übersicht)

| # | Prozess | RPC (geplant) | Anmerkung |
| --- | --- | --- | --- |
| 1 | Neuen Anfrageeingang anlegen | `create_anfrageeingang` | Nummer sofort |
| 2 | Zuordnungsbewertung speichern | `update_anfrageeingang_bewertung` | Keine finalen FKs |
| 3 | Manuell Kunde/Objekt zuordnen | `bestaetige_anfrageeingang_zuordnung` | `bestaetigt` + FKs |
| 4 | Vorläufigen Kunden anlegen | `create_vorlaeufiger_kunde_mit_objekt` | Atomar |
| 5 | Adresse/Gebäude/Einheit (Teil von 4) | — | In RPC 4 integriert |
| 6 | Als `bereit_fuer_vorgang` markieren | Teil von 3 oder `set_anfrageeingang_bereit` | Siehe RPC 3 |
| 7 | Vorgang erzeugen | `erstelle_vorgang_aus_anfrageeingang` | Atomar |
| 8 | Eingang bestehendem Vorgang zuordnen | `ordne_anfrageeingang_vorgang_zu` | Kein neuer Vorgang |
| 9 | Verwerfen | `verwerfe_anfrageeingang` | Terminal |
| 10 | Archivieren / reaktivieren | `archiviere_anfrageeingang` / `reaktiviere_anfrageeingang` | Orthogonal zu Status |

---

## 2. Nummerierung

### Sequenztabellen (M3.1a DDL)

#### `eingangsnummer_sequenzen`

| Feld | Typ | Beschreibung |
| --- | --- | --- |
| `mandant_id` | `uuid` NOT NULL | FK → `organizations` |
| `jahr` | `integer` NOT NULL | Kalenderjahr der Vergabe |
| `letzter_wert` | `integer` NOT NULL DEFAULT 0 | Letzter vergebener Zähler |
| `updated_at` | `timestamptz` NOT NULL DEFAULT now() | |

**PK:** `(mandant_id, jahr)`

#### `vorgangsnummer_sequenzen`

| Feld | Typ | Beschreibung |
| --- | --- | --- |
| `mandant_id` | `uuid` NOT NULL | |
| `jahr` | `integer` NOT NULL | |
| `letzter_wert` | `integer` NOT NULL DEFAULT 0 | |
| `updated_at` | `timestamptz` NOT NULL DEFAULT now() | |

**PK:** `(mandant_id, jahr)`

#### `kundennummer_sequenzen`

| Feld | Typ | Beschreibung |
| --- | --- | --- |
| `mandant_id` | `uuid` NOT NULL | |
| `letzter_wert` | `integer` NOT NULL DEFAULT 0 | **Fortlaufend**, kein Jahresreset |
| `updated_at` | `timestamptz` NOT NULL DEFAULT now() | |

**PK:** `(mandant_id)`

### Formate (V1)

| Typ | Format | Beispiel |
| --- | --- | --- |
| Eingang | `AE-YYYY-NNNN` | `AE-2026-0001` |
| Vorgang | `VG-YYYY-NNNN` | `VG-2026-0042` |
| Kunde | `K-NNNNNN` | `K-000001` |

`NNNN` / `NNNNNN` = zero-padded Sequenzwert. **Kein** DB-Format-CHECK — Server erzeugt String.

### Vergabezeitpunkt

| Nummer | Zeitpunkt | Begründung |
| --- | --- | --- |
| `eingangsnummer` | **Sofort** bei `create_anfrageeingang` | Jeder Eingang ist sofort referenzierbar |
| `vorgangsnummer` | **Erst** bei `erstelle_vorgang_aus_anfrageeingang` | Vorgang existiert fachlich noch nicht |
| `kundennummer` | Bei `create_vorlaeufiger_kunde_mit_objekt` | M1 NOT NULL |

### Regeln

| Regel | |
| --- | --- |
| Nummern **unveränderlich** nach Vergabe | |
| **Keine Wiederverwendung** nach Löschung/Fehler (Sequenz nur increment) | |
| Atomare Vergabe in **derselben Transaktion** wie Entitäts-INSERT | |
| UPSERT + `RETURNING letzter_wert` oder `FOR UPDATE` auf Sequenzzeile | |
| Keine Vermischung mit Admin-Angebotsnummern | |

---

## 3. Semantik Vorgangs-FK-Spalte (Entscheidung)

### Problem

`erzeugter_vorgang_id` suggeriert, dass der Eingang den Vorgang **erzeugt** hat. `ordne_anfrageeingang_vorgang_zu` verknüpft aber nur mit **bestehendem** Vorgang (Ergänzungsmail).

### Entscheidung: Umbenennung vor M3.1-RPCs

| | |
| --- | --- |
| **Option B (verbindlich)** | `erzeugter_vorgang_id` → **`zugeordneter_vorgang_id`** |
| Migration | **M3.1a** — Tabelle leer, keine UI/Code-Referenzen, risikoarm |
| Bedeutung | Verweis auf den **zugeordneten** operativen Vorgang — unabhängig davon, ob dieser Eingang ihn erzeugt hat oder nur zugeordnet wurde |
| Provenienz | Optional später: `vorgang_zuordnungsart` (`erzeugt` \| `zugeordnet`) — **nicht M3.1** |

CHECK `vorgang_status_check` und partieller Index entsprechend umbenennen.

---

## 4. RPC-Zielbild

### Gemeinsame RPC-Konventionen

| Aspekt | Regel |
| --- | --- |
| Sprache | PostgreSQL `plpgsql`, `SECURITY INVOKER` |
| `search_path` | `public` (fix) |
| Mandant | Parameter `p_mandant_id` aus Server — RPC prüft alle IDs |
| Rückgabe | Strukturiertes JSON (`success`, `data`, `error`) |
| Fehler | Stabile `error_code` — Abschnitt 8 |
| Transaktion | Jede RPC = eine Transaktion (implizit) |

---

### `create_anfrageeingang`

**Zweck:** Prozess 1 — Eingang anlegen.

**Input:**

| Parameter | Typ | Pflicht |
| --- | --- | --- |
| `p_mandant_id` | `uuid` | ja |
| `p_kanal` | `text` | ja |
| `p_betreff` | `text` | nein |
| `p_rohinhalt` | `text` | nein |
| `p_absender_name` | `text` | nein |
| `p_absender_email` | `text` | nein |
| `p_absender_telefon` | `text` | nein |
| `p_empfangen_am` | `timestamptz` | nein (Default `now()`) |
| `p_kanal_externe_id` | `text` | nein |
| `p_inhalt_hash` | `text` | nein |
| `p_parent_anfrageeingang_id` | `uuid` | nein |
| `p_konversation_id` | `uuid` | nein |

**Verhalten:**

1. Mandant validieren
2. Bei `p_kanal_externe_id`: bestehenden Eingang gleichen Mandanten/Kanals suchen → **idempotent** bestehende `id` + `eingangsnummer` zurückgeben (`duplicate_external_message` optional als Hinweis, kein Fehler)
3. `eingangsnummer` atomar vergeben (`AE-YYYY-NNNN`)
4. INSERT `anfrageeingaenge` mit `status=neu`, Defaults
5. Parent/Konversation: Mandant + Parent-Existenz prüfen

**Output (Neuanlage):**

```json
{
  "ok": true,
  "code": "created",
  "idempotent": false,
  "anfrageeingang_id": "uuid",
  "eingangsnummer": "AE-2026-0001"
}
```

**Output (Idempotenz-Replay):**

```json
{
  "ok": true,
  "code": "duplicate_external_message",
  "idempotent": true,
  "anfrageeingang_id": "uuid",
  "eingangsnummer": "AE-2026-0001"
}
```

**Output (Fehler):** `ok: false`, `code`, optional `field` — keine SQL-Details.

---

### `update_anfrageeingang_bewertung`

**Zweck:** Prozess 2 — Bewertung speichern ohne finale Zuordnung.

**Input:**

| Parameter | Typ |
| --- | --- |
| `p_mandant_id` | `uuid` |
| `p_anfrageeingang_id` | `uuid` |
| `p_strukturierte_daten` | `jsonb` (Pflicht, Objekt) |
| `p_zuordnungsstatus` | `text` (Pflicht, **nicht** `bestaetigt`) |
| `p_zuordnungsgrund` | `jsonb` (Pflicht, Objekt) |
| `p_zuordnungskandidaten` | `jsonb` (Pflicht, Array) |
| `p_vollstaendigkeitsstatus` | `text` (Pflicht) |
| `p_fehlende_angaben` | `jsonb` (Pflicht, Array) |
| `p_confidence_score` | `numeric` (optional) |
| `p_dringlichkeit` | `text` (Default `normal`) |
| `p_manuelle_pruefung_erforderlich` | `boolean` (Default `false`; RPC setzt bei `moeglicher_treffer`/`mehrere_treffer`/`konflikt` deterministisch `true`) |

**Verhalten:**

- Eingang `FOR UPDATE` sperren + Mandant prüfen
- Ausgangsstatus nur: `neu`, `analysiert`, `wartet_auf_informationen`, `zur_manuellen_pruefung`
- **Keine** finalen `zugeordnet_*` setzen
- **`zuordnungsstatus=bestaetigt` verboten** → `validation_error`
- Bei `eindeutig`: Zwei-Merkmale-Strukturprüfung in `zuordnungsgrund.merkmale` (ADR-0008)
- `confidence_score` allein darf **nicht** zu Auto-Bestätigung führen
- Statusermittlung (Priorität): manuelle Prüfung → fehlende Infos → `analysiert`
- **`bereit_fuer_vorgang` wird nicht gesetzt** (erst Bestätigungs-RPC)
- `zuletzt_bearbeitet_am = now()`

**Output (Erfolg):**

```json
{
  "ok": true,
  "code": "updated",
  "anfrageeingang_id": "uuid",
  "status": "zur_manuellen_pruefung",
  "zuordnungsstatus": "mehrere_treffer",
  "vollstaendigkeitsstatus": "vollstaendig",
  "manuelle_pruefung_erforderlich": true
}
```

---

### `bestaetige_anfrageeingang_zuordnung`

**Zweck:** Prozess 3 — Manuelle finale Zuordnung (einzige RPC für `zuordnungsstatus=bestaetigt`).

**Input:**

| Parameter | Typ |
| --- | --- |
| `p_mandant_id` | `uuid` |
| `p_anfrageeingang_id` | `uuid` |
| `p_kunde_id` | `uuid` |
| `p_gebaeude_id` | `uuid` |
| `p_einheit_id` | `uuid` (optional) |
| `p_bestaetigungsquelle` | `text` (Default `manuell`) |

**Ausgangsvoraussetzungen:**

- Status: `analysiert`, `wartet_auf_informationen`, `zur_manuellen_pruefung` — **nicht** `neu`
- `zuordnungsstatus`: `kein_treffer`, `eindeutig`, `moeglicher_treffer`, `mehrere_treffer`, `konflikt` — **nicht** `nicht_erforderlich`
- `aktiv=true`, kein `zugeordneter_vorgang_id`, nicht terminal

**Verhalten:**

1. `FOR UPDATE` + Mandant/Cross-Tenant-Prüfung
2. Kunde/Gebäude/Einheit aktiv, gleicher Mandant; Einheit → Gebäude konsistent
3. Atomares UPDATE: FKs + `zuordnungsstatus=bestaetigt` + Zielstatus
4. `zuordnungsgrund.bestaetigung` ergänzen (bestehendes JSON bleibt)
5. Idempotenz: identische Zuordnung → `already_confirmed`; abweichend → `conflict`

**Zielstatus:**

| `vollstaendigkeitsstatus` | `status` |
| --- | --- |
| `ausreichend_fuer_vorgang`, `vollstaendig` | `bereit_fuer_vorgang` |
| sonst | `wartet_auf_informationen` |

**Output (Erfolg):**

```json
{
  "ok": true,
  "code": "confirmed",
  "idempotent": false,
  "anfrageeingang_id": "uuid",
  "kunde_id": "uuid",
  "gebaeude_id": "uuid",
  "einheit_id": null,
  "status": "bereit_fuer_vorgang",
  "zuordnungsstatus": "bestaetigt"
}
```

**Output (Idempotenz):** `code: already_confirmed`, `idempotent: true`

---

### `create_vorlaeufiger_kunde_mit_objekt`

**Zweck:** Prozesse 4 + 5 — Neukunde + Objekt atomar.

**Empfehlung: Eine atomare RPC** (nicht mehrere Client-RPCs).

| Kriterium | Eine RPC | Mehrere RPCs |
| --- | --- | --- |
| Teilzustände | ❌ vermieden | ⚠️ möglich |
| Transaktion | ✅ garantiert | Server muss orchestrieren |
| API-Komplexität | ⚠️ größerer Input | ✅ kleiner |
| **Entscheidung** | ✅ **Verbindlich für M3.1** | Interne Hilfsfunktionen erlaubt |

**Input (fachlich):**

| Block | Felder |
| --- | --- |
| Mandant / Eingang | `p_mandant_id`, `p_anfrageeingang_id` (optional, für Auto-Zuordnung danach) |
| Kunde | `kundentyp`, `vorname`, `nachname`, `firmenname`, `anzeigename`, Kontaktdaten |
| Adresse | `strasse`, `hausnummer`, `plz`, `ort`, … |
| Gebäude | `gebaeudeart`, `gebaeudebezeichnung` optional |
| Einheit | optional: `bezeichnung`, `einheit_typ` |
| Beziehung | optional: `rolle` (`eigentuemer`, `mieter`, …) |
| Dubletten | `p_dubletten_modus` (`abbrechen_bei_kandidat`, `erzwingen_mit_bestaetigung`) |

**Verhalten (eine Transaktion):**

1. Mindestdaten validieren (M1-Regeln, **keine** Dummywerte)
2. Dublettenprüfung (ADR-0008): bei Kandidat ohne Bestätigung → `conflict` / Abbruch
3. `kundennummer` atomar (`K-NNNNNN`)
4. INSERT `kunden` mit `kundenstatus=vorlaeufig`
5. INSERT `adressen`, `gebaeude`, optional `einheiten`
6. Optional INSERT `kunden_objekt_beziehungen`
7. Optional: `bestaetige_anfrageeingang_zuordnung` logisch inline (gleiche Transaktion)

**Kein** Auto-Merge bestehender Kunden.

---

### `erstelle_vorgang_aus_anfrageeingang`

**Zweck:** Prozess 7 — Atomare Vorgangserzeugung (ADR-0019).

**Input:**

| Parameter | Typ |
| --- | --- |
| `p_mandant_id` | `uuid` |
| `p_anfrageeingang_id` | `uuid` |
| `p_vorgangstyp` | `text` (Default `anfrage`) |
| `p_titel` | `text` |
| `p_beschreibung` | `text` optional |
| `p_prioritaet` | `text` optional |
| `p_beteiligte` | `jsonb` — Array `{ rolle, kunde_id, ist_hauptbeteiligter }` |

**Voraussetzungen (vor + nach Lock):**

| Check | |
| --- | --- |
| `zuordnungsstatus = 'bestaetigt'` | |
| `zugeordnet_kunde_id`, `zugeordnet_gebaeude_id` gesetzt | |
| `vollstaendigkeitsstatus IN ('ausreichend_fuer_vorgang', 'vollstaendig')` | |
| `status = 'bereit_fuer_vorgang'` | |
| `zugeordneter_vorgang_id IS NULL` | |

**Ablauf:**

1. `SELECT … FROM anfrageeingaenge WHERE id = … AND mandant_id = … FOR UPDATE`
2. Voraussetzungen erneut prüfen — sonst `already_converted` / `insufficient_data` / `assignment_not_confirmed`
3. `vorgangsnummer` atomar (`VG-YYYY-NNNN`)
4. INSERT `vorgaenge` (Gebäude/Einheit aus Eingang, `titel`, …)
5. INSERT `vorgang_beteiligte` (mindestens einer, siehe Abschnitt 6)
6. UPDATE Eingang: `zugeordneter_vorgang_id`, `status=in_vorgang_ueberfuehrt`, `beendet_am=now()`
7. Rollback bei jedem Fehler

**Keine** Angebots-/Terminlogik.

---

### `ordne_anfrageeingang_vorgang_zu`

**Zweck:** Prozess 8 — Ergänzungsmail/Telefonnotiz zu bestehendem Vorgang.

**Input:** `p_mandant_id`, `p_anfrageeingang_id`, `p_vorgang_id`

**Voraussetzungen:**

- Gleicher Mandant
- Eingang: `zugeordneter_vorgang_id IS NULL`
- Vorgang existiert, nicht archiviert (Server-Regel)

**Verhalten:**

1. `FOR UPDATE` auf Eingang
2. `zugeordneter_vorgang_id = p_vorgang_id`
3. `status = in_vorgang_ueberfuehrt`, `beendet_am = now()`
4. **Kein** neuer Vorgang

---

### `verwerfe_anfrageeingang`

**Input:** `p_mandant_id`, `p_anfrageeingang_id`, `p_grund` optional

**Verhalten:**

- Nicht-terminaler Status erforderlich
- `status = verworfen`, `beendet_am = now()`
- Terminal — nicht rücksetzbar

---

### `archiviere_anfrageeingang` / `reaktiviere_anfrageeingang`

**Verhalten:** `aktiv`/`archiviert_am` wie M1/M2 — **unabhängig** vom Prozessstatus (außer explizite Server-Regeln für terminal).

---

## 5. Statusübergänge

### Erlaubte Übergänge (V1)

```
neu → analysiert

analysiert → wartet_auf_informationen
analysiert → zur_manuellen_pruefung
analysiert → bereit_fuer_vorgang

wartet_auf_informationen → analysiert
zur_manuellen_pruefung → analysiert

bereit_fuer_vorgang → in_vorgang_ueberfuehrt

{neu, analysiert, wartet_auf_informationen, zur_manuellen_pruefung, bereit_fuer_vorgang} → verworfen
```

### Verboten

| Übergang | Grund |
| --- | --- |
| **Rückkehr zu `neu`** | Nach Rohinhalt-Sperre fachlich unsinnig; DB erlaubt technisch, RPC **verbietet** |
| Aus terminalen Status | `in_vorgang_ueberfuehrt`, `verworfen` — **terminal** |
| `in_vorgang_ueberfuehrt` → andere | Terminal |

### Archivierung

Orthogonal — `archiviere_anfrageeingang` unabhängig vom Prozessstatus (terminal darf archiviert werden).

### Validierung

| Ebene | Verantwortung |
| --- | --- |
| **RPC** | Fachliche Statusmaschine — **primär** |
| **DB CHECK** | Harte Untergrenze (`beendet_am`, `vorgang_status_check`, …) |

**Keine** zusätzlichen Status-Trigger in M3.1.

---

## 6. Beteiligtenrollen bei Vorgangserzeugung

### Mindestanforderung

Mindestens **ein** `vorgang_beteiligte`-Datensatz mit `ist_hauptbeteiligter = true`.

### Standard-Minimalregel (wenn `p_beteiligte` leer oder nicht übergeben)

| Rolle | Kunde | Hauptbeteiligter |
| --- | --- | --- |
| `anfragender` | `zugeordnet_kunde_id` | `true` |

Optional zusätzlich (Neukunde/Kontaktformular):

| Rolle | Kunde | Hauptbeteiligter |
| --- | --- | --- |
| `ansprechpartner` | derselbe Kunde | `false` |

### Explizit nicht automatisch

| Rolle | Grund |
| --- | --- |
| `auftraggeber` | Fachlich oft Eigentümer vs. Mieter unklar |
| `rechnungsempfaenger` | ADR-0017 |
| Rollen aus `kunden_objekt_beziehungen` | Nur **Hinweis** in UI später — **kein** Auto-Copy (ADR-0008) |

### Entscheidung

RPC **`p_beteiligte` optional** — bei Angabe: vollständige Validierung (keine doppelten Hauptbeteiligten pro Rolle). Ohne Angabe: **Minimalregel** oben.

---

## 7. Vorläufiger Kunde und Kundennummer

Siehe Abschnitt 2 (`kundennummer_sequenzen`).

| Regel | |
| --- | --- |
| Format `K-NNNNNN` | 6-stellig zero-padded |
| Mandantenweit fortlaufend | **Kein** Jahresreset |
| Vergabe in **derselben Transaktion** wie `kunden` INSERT | |
| `kundenstatus = vorlaeufig` | |
| Keine Admin-Sequenzen anfassen | |

---

## 8. Fehlerklassen

| `error_code` | HTTP-Analog | Bedeutung |
| --- | --- | --- |
| `validation_error` | 400 | Pflichtfeld, Format, Statusübergang |
| `not_found` | 404 | Eingang/Kunde/Vorgang unbekannt |
| `conflict` | 409 | Dublette, Zustandskonflikt |
| `duplicate_external_message` | 409 | Externe ID — idempotent behandelbar |
| `assignment_not_confirmed` | 422 | Vorgang ohne `bestaetigt` |
| `insufficient_data` | 422 | Vollständigkeit reicht nicht |
| `already_converted` | 422 | Eingang bereits Vorgang zugeordnet |
| `cross_tenant_reference` | 403 | Mandantenverletzung |
| `invalid_status_transition` | 422 | Statusmaschine |
| `system_error` | 500 | Unerwartet — kein SQL-Detail an Client |

**Rückgabe-Schema bei Fehler:**

```json
{
  "success": false,
  "error": {
    "code": "already_converted",
    "message": "Anfrageeingang ist bereits einem Vorgang zugeordnet.",
    "details": {}
  }
}
```

Keine internen SQL-Messages an UI.

---

## 9. Idempotenz und Parallelität

| Szenario | Verhalten |
| --- | --- |
| `create_anfrageeingang` + gleiche `kanal_externe_id` | Bestehenden Datensatz zurückgeben (`idempotent_replay: true`) |
| Parallele `erstelle_vorgang_aus_anfrageeingang` | `FOR UPDATE` auf Eingang — zweiter Call: `already_converted` |
| Parallele Nummernvergabe | Sequenzzeile UPSERT/FOR UPDATE — **keine Doppelnummern** |
| Fehler mid-transaction | **Vollständiger Rollback** — kein Teil-Vorgang |

---

## 10. Server-Action-Zielbild (später)

```
Client → Server Action → Validierung → RPC → DB-Constraints
```

| Server Action (geplant) | RPC |
| --- | --- |
| `createAnfrageeingangAction` | `create_anfrageeingang` |
| `updateAnfrageeingangBewertungAction` | `update_anfrageeingang_bewertung` |
| `bestaetigeAnfrageeingangZuordnungAction` | `bestaetige_anfrageeingang_zuordnung` |
| `createVorlaeufigerKundeMitObjektAction` | `create_vorlaeufiger_kunde_mit_objekt` |
| `erstelleVorgangAusAnfrageeingangAction` | `erstelle_vorgang_aus_anfrageeingang` |
| `ordneAnfrageeingangVorgangZuAction` | `ordne_anfrageeingang_vorgang_zu` |
| `verwerfeAnfrageeingangAction` | `verwerfe_anfrageeingang` |

Bis Auth-Sprint: Actions nur aus vertrauenswürdigem Server-/Testkontext.

---

## 11. RLS und Mandantenkontext

| Regel | |
| --- | --- |
| RPCs mit Service Role | |
| `p_mandant_id` aus Session/Mitgliedschaft/Server — **nicht** Formular | |
| Jede referenzierte UUID auf gleichen Mandanten prüfen | |
| Keine operative Browser-UI bis Auth-Sprint | |
| DB-RLS bleibt ohne Policies (M3) | |

---

## 12. Migrationsreihenfolge M3.1

```
M3.1a (DDL):
  1. kundennummer_sequenzen
  2. eingangsnummer_sequenzen
  3. vorgangsnummer_sequenzen
  4. RENAME erzeugter_vorgang_id → zugeordneter_vorgang_id
  5. Constraint/Index anpassen
  6. RLS ENABLE auf Sequenztabellen (wie operative Tabellen)

M3.1b (RPC):
  1. Hilfsfunktionen (next_nummer_*, assert_mandant_*)
  2. RPCs gemäß Abschnitt 4
  3. Keine Grants an anon/authenticated
```

---

## 13. Testspezifikation (nach Implementierung)

| # | Szenario | Erwartung |
| --- | --- | --- |
| T1 | Eingangsnummer atomar eindeutig | OK |
| T2 | Gleiche externe Nachricht idempotent | gleiche `id` |
| T3 | Bewertung ohne finale Zuordnung | OK, FK NULL |
| T4 | `confidence_score` allein bestätigt nicht | kein `bestaetigt` |
| T5 | Gültige manuelle Zuordnung | `bestaetigt` + FKs |
| T6 | Cross-Tenant-Zuordnung | `cross_tenant_reference` |
| T7 | Falsche Einheit | FK/validation |
| T8 | Vorläufiger Kunde Mindestdaten | OK |
| T9 | Dummywerte | `validation_error` |
| T10 | Dublettenkandidat | `conflict` |
| T11 | Vorgang nur aus `bereit_fuer_vorgang` | |
| T12 | Vorgang ohne `bestaetigt` | `assignment_not_confirmed` |
| T13 | Unzureichende Vollständigkeit | `insufficient_data` |
| T14 | Parallele Vorgangserzeugung | ein Vorgang |
| T15 | Vorgangsnummer eindeutig | OK |
| T16 | Beteiligtenrollen korrekt | min. `anfragender` |
| T17 | Kein Auto-Auftraggeber | OK |
| T18 | Eingang → bestehender Vorgang | `ordne_…` |
| T19 | Cross-Tenant-Vorgang | abgelehnt |
| T20 | Terminaler Status nicht rücksetzbar | |
| T21 | Rollback bei Fehler | kein Teilzustand |
| T22 | Bestandsschutz `/admin` | OK |
| T23 | RLS geschlossen | OK |
| T24 | Cleanup | OK |

---

## 14. Qualitätsprüfung

| Kriterium | Ergebnis |
| --- | --- |
| Keine UI/Provider/KI | ✅ |
| `/admin` unverändert | ✅ |
| Kein frei übergebener Mandant | ✅ |
| Keine Doppelwahrheit Vorgangs-FK | ✅ Umbenennung |
| Keine Auto-Rollen-Erfindung | ✅ |
| Keine Doppelnummern (Design) | ✅ Sequenzen + Lock |
| Keine Teilzustände (Design) | ✅ Transaktionen |
| DB-Constraints genutzt | ✅ |

---

## 15. Offene Entscheidungen vor Implementierung M3.1

| # | Punkt | Status | Empfehlung |
| --- | --- | --- | --- |
| B1 | Spaltenumbenennung `zugeordneter_vorgang_id` | ✅ ADR-0019 | M3.1a |
| B2 | Eine vs. mehrere RPCs Neukunde | ✅ | Eine atomare RPC |
| B3 | `p_beteiligte` Pflicht vs. Minimalregel | ✅ | Optional mit Default |
| B4 | Idempotenz externe ID: Fehler vs. Replay | ⬜ | **Replay** (kein Fehler) |
| B5 | `vorgang_zuordnungsart` Spalte | ⬜ | Post-M3.1 optional |
| B6 | SECURITY DEFINER für RPCs | ⬜ | INVOKER + Service Role (wie M1) |
| B7 | JSON-Return vs. TABLE return | ⬜ | JSON `jsonb` für Supabase JS |
| — | Auth/Mitgliedschaft | ⬜ | Vor UI |
| — | KI-Bewertung RPC | ⬜ | Post-M3.1 |

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-27 | Erstversion M3.1 Serverlogik-Spezifikation |
