# ADR-0019: Atomare Überführung Anfrageeingang → Vorgang und operative Nummernvergabe

**Status:** Angenommen (verbindlich, Zielarchitektur)  
**Datum:** 2026-07-27  
**Bezug:** ADR-0008, ADR-0018, [`docs/fachkonzept/14-spezifikation-migration-3-anfrageeingang.md`](../fachkonzept/14-spezifikation-migration-3-anfrageeingang.md), [`docs/fachkonzept/15-spezifikation-m31-anfrageeingang-serverlogik.md`](../fachkonzept/15-spezifikation-m31-anfrageeingang-serverlogik.md)

---

## Kontext

Migration 3 (`anfrageeingaenge`) ist angewendet und getestet. Die Tabelle speichert Eingänge, Zuordnungsmetadaten und optional eine Verknüpfung zu `vorgaenge`. **Vorgangserzeugung, Nummernvergabe und Stammdatenanlage** waren bewusst **nicht** in M3-DDL.

Ohne verbindliche Serverregeln drohen:

- Teilzustände (Vorgang ohne Beteiligte, Eingang ohne Nummer)
- Doppelte Vorgänge bei parallelen Requests
- Doppelnummern bei Race Conditions
- Client-seitige `mandant_id`-Injection
- Semantisch irreführende Spalte `erzeugter_vorgang_id` bei reiner Zuordnung zu bestehendem Vorgang

M3.1 definiert **RPCs und Sequenztabellen** — noch keine UI, keine Provider, keine KI.

---

## Entscheidung

### 1. Vorgangserzeugung ausschließlich atomar über RPC

`erstelle_vorgang_aus_anfrageeingang` führt in **einer Transaktion** aus:

1. `SELECT … FOR UPDATE` auf `anfrageeingaenge`
2. Voraussetzungen prüfen
3. Vorgangsnummer atomar vergeben
4. `vorgaenge` + `vorgang_beteiligte` anlegen
5. Eingang aktualisieren (`zugeordneter_vorgang_id`, Status, `beendet_am`)
6. **Rollback** bei jedem Fehler — keine Teilzustände

Kein Client erstellt `vorgaenge` oder `vorgang_beteiligte` direkt.

### 2. Nummernvergabe in derselben Transaktion

| Nummer | Zeitpunkt | Sequenztabelle |
| --- | --- | --- |
| `eingangsnummer` | Beim Anlegen (`create_anfrageeingang`) | `eingangsnummer_sequenzen (mandant_id, jahr)` |
| `vorgangsnummer` | Bei Vorgangserzeugung | `vorgangsnummer_sequenzen (mandant_id, jahr)` |
| `kundennummer` | Bei Neukundenanlage | `kundennummer_sequenzen (mandant_id)` — fortlaufend, kein Jahresreset |

Vergabe via `INSERT … ON CONFLICT DO UPDATE … RETURNING` oder `SELECT … FOR UPDATE` auf Sequenzzeile — **atomar**, **keine Wiederverwendung**.

Keine Vermischung mit `/admin`-Angebotsnummern.

### 3. Eingang sperren bei kritischen Schreibvorgängen

`FOR UPDATE` auf `anfrageeingaenge` bei:

- Vorgangserzeugung
- Zuordnung zu bestehendem Vorgang
- Paralleler Schutz → zweite Ausführung: `already_converted`

Sequenzzeilen ebenfalls sperren/UPSERT in derselben Transaktion.

### 4. Beteiligte und Status gemeinsam schreiben

Mindestens **ein** `vorgang_beteiligte`-Datensatz (Standard: `anfragender`, `ist_hauptbeteiligter=true`) wird **in derselben Transaktion** wie der Vorgang angelegt — nicht nachträglich durch Client.

Kein automatischer Auftraggeber/Rechnungsempfänger ohne expliziten Input.

### 5. Semantik Vorgangs-FK: Umbenennung vor M3.1-Implementierung

| Option | Entscheidung |
| --- | --- |
| `erzeugter_vorgang_id` behalten | ❌ irreführend bei `ordne_anfrageeingang_vorgang_zu` |
| **`zugeordneter_vorgang_id`** | ✅ **Migration M3.1a** (Tabelle leer, risikoarm) |

CHECK `vorgang_status_check` und Index entsprechend anpassen.

### 6. Mandant und Service Role

RPCs laufen mit **Service Role**, prüfen aber **jede** referenzierte Entität auf **gleichen** `mandant_id`. `mandant_id` kommt aus vertrauenswürdigem Serverkontext — **nie** ungeprüft vom Client.

### 7. Statusübergänge in RPCs, nicht DB-Trigger

Fachliche Statusmaschine wird **serverseitig** in RPCs validiert. DB-CHECKs bleiben als harte Untergrenze.

---

## Alternativen (verworfen)

| Alternative | Grund |
| --- | --- |
| Client schreibt direkt in Tabellen | Kein Mandantenschutz, Race Conditions, Teilzustände |
| Vorgang ohne RPC / nur Server Action | Keine atomare DB-Garantie ohne Transaktion in RPC |
| Nummern in Application-Memory | Nicht parallel-sicher |
| `erzeugter_vorgang_id` semantisch erweitern | Verwirrt Audit und UI später |
| Status-Trigger in DB | Schwerer testbar; RPC-Logik reicht mit CHECK-Fallback |

---

## Konsequenzen

| Bereich | Folge |
| --- | --- |
| M3.1a | DDL: Sequenztabellen + Spaltenumbenennung `zugeordneter_vorgang_id` |
| M3.1b | RPC-Funktionen gemäß Dokument 15 |
| Server Actions (später) | Dünne Wrapper um RPCs |
| UI (später) | Keine direkten Tabellenwrites |
| `/admin` | Unberührt |

---

## Nicht Bestandteil dieser Entscheidung

- UI, Provider, Webhooks, KI
- Kommunikationsversand
- Operative Angebote / Termine
- RLS-Policies für Browser-Client
- Implementierungs-SQL (Dokument 15 spezifiziert)

---

## Verweise

| Dokument | Inhalt |
| --- | --- |
| ADR-0008 | Zwei-Merkmale-Regel |
| ADR-0018 | Anfrageeingang vs. Vorgang |
| Dokument 15 | M3.1 Serverlogik |
