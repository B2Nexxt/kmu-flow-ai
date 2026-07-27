# ADR-0017: Dauerhafte Objektbeziehungen und vorgangsbezogene Beteiligte

**Status:** Angenommen (verbindlich, Zielarchitektur) — **M2-Blocker präzisiert (2026-07-27)**  
**Datum:** 2026-07-27  
**Bezug:** ADR-0013, ADR-0016, [`docs/fachkonzept/10-technisches-kunden-und-objektmodell.md`](../fachkonzept/10-technisches-kunden-und-objektmodell.md), [`docs/fachkonzept/13-spezifikation-migration-2-beziehungen-und-vorgaenge.md`](../fachkonzept/13-spezifikation-migration-2-beziehungen-und-vorgaenge.md)

---

## Kontext

ADR-0013 führt zwei Verknüpfungsebenen ein:

- **`kunden_objekt_beziehungen`** — Kunde ↔ Gebäude/Einheit über Zeit
- **`vorgang_beteiligte`** — Kunde ↔ Vorgang mit konkreter Rolle

In Dokument 10 waren Rollen wie `auftraggeber` und `ansprechpartner` teilweise auch an Objektbeziehungen skizziert. Für Migration 2 muss die **Trennung der Ebenen** verbindlich sein — sonst entstehen Redundanz, widersprüchliche Wahrheiten und Datenschutzprobleme (Mieterwechsel, unterschiedliche Rollen pro Vorgang).

---

## Entscheidung

### Zwei Ebenen — nicht zusammenlegen

| Ebene | Tabelle | Zweck | Zeitbezug |
| --- | --- | --- | --- |
| **Objekt** | `kunden_objekt_beziehungen` | Dauerhafte oder langfristige Rollen am Gebäude/Einheit (Eigentum, Miete, Hausverwaltung, Nutzung) | `gueltig_ab` / `gueltig_bis` |
| **Vorgang** | `vorgang_beteiligte` | Rollen **in genau einem** Vorgang (Anfragender, Auftraggeber, Rechnungsempfänger, …) | Vorgangslebensdauer; optional `gueltig_ab`/`gueltig_bis` |

**Beide Tabellen bleiben getrennt.** Keine zusammengelegte „Kontakt-Rollen“-Tabelle.

### Rollen an der Objektbeziehung (V1)

Nur **objektbezogene Dauerrollen:**

`eigentuemer`, `mieter`, `hausverwaltung`, `nutzer`, `sonstiges`

**Nicht** in `kunden_objekt_beziehungen`:

`anfragender`, `auftraggeber`, `ansprechpartner`, `angebotsempfaenger`, `rechnungsempfaenger`, `zahlungspflichtiger`

Diese Rollen sind **vorgangsbezogen** und gehören ausschließlich in `vorgang_beteiligte`.

### Rollen an Vorgangsbeteiligten (V1)

`anfragender`, `auftraggeber`, `ansprechpartner`, `angebotsempfaenger`, `rechnungsempfaenger`, `eigentuemer`, `mieter`, `hausverwaltung`, `zahlungspflichtiger`, `sonstiges`

`eigentuemer` / `mieter` / `hausverwaltung` **dürfen** zusätzlich in `vorgang_beteiligte` vorkommen, wenn sie für **diesen Vorgang** fachlich relevant sind — **ohne** automatische Übernahme aus `kunden_objekt_beziehungen`.

### Keine automatische Übernahme

| Verboten | Erlaubt |
| --- | --- |
| Beim Anlegen eines Vorgangs alle Objektbeziehungen blind als Beteiligte kopieren | Vorschlag im UI auf Basis aktueller Objektbeziehungen — **manuelle Bestätigung** |
| Auftraggeber aus letztem Vorgang automatisch übernehmen | Regelbasierte Vorschläge mit expliziter Bestätigung |
| Mieter als Auftraggeber setzen, weil er Mieter am Objekt ist | Mieter als `anfragender`, Eigentümer als `auftraggeber` — bewusst getrennt |

### Mieterwechsel und mehrere Mieter

- **Mehrere Mieter/Nutzer** gleichzeitig an einer Einheit **erlaubt** (WG, Ehepartner, Mitmieter)
- **Kein** Limit „max. ein Mieter pro Einheit“
- **Mieterwechsel (Einzelmieter):** alte Zeile beenden; neue Zeile — Mitmieter können parallel bleiben
- Doppelte identische aktive Beziehung (gleicher Kunde + Rolle + Objekt) **verboten**
- **`einheiten`-Datensatz bleibt unverändert** (ADR-0016 E8)
- Vorgänge des Vormieters bleiben an **dessen** Vorgangskontext

### Kein `kunde_id` auf `vorgaenge`

- **`vorgang_beteiligte`** sind **einzige Source of Truth** für Anfragender, Auftraggeber, Rechnungsempfänger, …
- **Kein** `kunde_id` / `hauptkunde_id` auf `vorgaenge` — vermeidet doppelte Wahrheit

### Anfrageeingang vs. Vorgang

- **Unvollständige Nachrichten** sind **kein Vorgang** — spätere Eingangsentität (nicht M2)
- Vorgang erst bei Kunde (vorläufig/bestätigt) + Gebäude + Titel
- **`kunden.kundenstatus`:** `vorlaeufig` | `bestaetigt` — **keine** Platzhalterkunden

### Objektkonsistenz (Composite-FK)

- `(mandant_id, gebaeude_id, einheit_id)` → `einheiten(mandant_id, gebaeude_id, id)` wenn `einheit_id` gesetzt
- Verhindert Gebäude A + Einheit aus Gebäude B

### Datenschutz

Personenbezogene Vorgangsdaten hängen am **Vorgang** und **vorgang_beteiligte**, nicht an der Objektbeziehung. Objektbeziehungen enthalten **keine** Kommunikations-, Angebots- oder Rechnungsinhalte.

---

## Alternativen (verworfen)

| Alternative | Grund |
| --- | --- |
| Auftraggeber dauerhaft an Objekt speichern | Rolle ist pro Auftrag/Vorgang unterschiedlich |
| Nur `vorgang_beteiligte`, keine Objektbeziehungen | Mieterwechsel und Dauereigentum nicht abbildbar |
| Eine Rollentabelle für alles | Vermischt Zeitachsen; RLS und Datenschutz schwerer |
| Auto-Copy Objektrollen → Vorgang | Verstößt gegen ADR-0008; falsche Auftraggeber |

---

## Konsequenzen

| Bereich | Folge |
| --- | --- |
| Migration 2 | Drei Tabellen + M1-Ergänzungen (`kundenstatus`, UNIQUE auf `kunden`/`einheiten`) gemäß Dokument 13 |
| Dokument 10 | Rollen an Objektbeziehung präzisiert (kein Auftraggeber dort) |
| UI (später) | Getrennte Masken: „Rollen am Objekt“ vs. „Beteiligte am Vorgang“ |
| `/admin` | Unberührt |

---

## Verweise

| Dokument | Inhalt |
| --- | --- |
| ADR-0013 | Gesamtmodell |
| ADR-0016 | Archivierung Objekte/Einheiten |
| Dokument 13 | Migration-2-Spezifikation |
