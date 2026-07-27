# Entwicklungs-Roadmap — KMU Flow AI

Überblick über die **Phasen der Plattformentwicklung**. Die Reihenfolge folgt dem verbindlichen Geschäftsprozess: Produkte → Angebote → Verträge → Abonnements → Rechnungen → Lizenzen.

**Status:** Planungsreferenz — **keine Implementierungsverpflichtung für zukünftige Phasen**  
**Bezug:** [`docs/systemarchitektur.md`](./systemarchitektur.md), [`docs/fachkonzept/`](./fachkonzept/), [`docs/produktarchitektur.md`](./produktarchitektur.md), [`docs/adr/`](./adr/)

---

## Phasen

| Phase | Bereich | Status | Kurzbeschreibung |
| --- | --- | --- | --- |
| **A** | Mandanten | ✅ | Mandantenanlage, Onboarding-Assistent, Mandantenakte |
| **B** | Angebote | ✅ | Angebotsmodul V1: Versionen, Positionen, Freigabe, Mandantenbezug |
| **C** | Produktmanagement | 🚧 | Plattformmodule, Produkte, Paketbestandteile — Phase 0 fachlich; Schema folgt |
| **D** | Verträge | ⬜ | Verträge auf Basis angenommener Angebotsversionen |
| **E** | Abonnements | ⬜ | Laufende Verträge, monatliche Produkte, Abrechnungszyklen |
| **F** | Rechnungen | ⬜ | Rechnungen aus Angeboten/Abonnements; Snapshot-Positionen |
| **G** | Lizenzverwaltung | ⬜ | `organization_modules` aus Paket-Produkten; Feature-Gates |
| **H** | Operative Kundenplattform | ⬜ | Handwerks-Arbeitsplattform unter **`/`** — [`docs/fachkonzept/`](./fachkonzept/), ADR-0014 — **noch nicht implementiert** |
| **I** | Automatisierungen | ⬜ | Workflows mit manueller Freigabe bei kritischen Schritten |
| **J** | PDF | ⬜ | Angebots-, Vertrags- und Rechnungs-PDF |

**Legende:** ✅ abgeschlossen (V1) · 🚧 in Arbeit · ⬜ geplant

---

## Abhängigkeiten zwischen Phasen

```
Phase A (Mandanten) ✅
    │
    ▼
Phase B (Angebote) ✅
    │
    ▼
Phase C (Produktmanagement) 🚧  ← aktueller Fokus
    │
    ├──► Phase D (Verträge)
    │         │
    │         ├──► Phase E (Abonnements)
    │         │
    │         └──► Phase G (Lizenzverwaltung)
    │
    ├──► Phase F (Rechnungen)  ← benötigt Produkte + Angebote
    │
    └──► Phase J (PDF)         ← parallel zu D/F möglich

Phase H (Operative Kundenplattform)  ← benötigt Phase G (Lizenzen); eigene Tabellen (ADR-0014); Adressen/Gebäude ADR-0015
Phase I (Automatisierungen)  ← benötigt Phase H + G
```

---

## Phase C — Detail (aktuell)

| Teil | Status | Dokumentation |
| --- | --- | --- |
| Fachliche Katalogdefinition (Phase 0) | teilweise | [`docs/plattformmodule-katalog.md`](./plattformmodule-katalog.md), [`docs/produktkatalog-fachlich.md`](./produktkatalog-fachlich.md) |
| Architekturentscheidungen | dokumentiert | [`docs/produktarchitektur.md`](./produktarchitektur.md), [`docs/adr/`](./adr/) |
| Schema / Migration | ausstehend | nach fachlicher Freigabe |
| Angebots-Anbindung an Produkte | ausstehend | Phase C → Anschluss an Phase B |
| Zwischenlösung `leistungsmodule` | bestehend | nicht weiter ausbauen |

---

## Phase H — Vorbereitung (fachlich, noch nicht implementiert)

| Entscheidung | Status | ADR |
| --- | --- | --- |
| Domänentrennung `/admin` vs `/` | ✅ dokumentiert | ADR-0014 |
| Kunden/Objekte/Vorgänge (Zielmodell) | ✅ dokumentiert | ADR-0013 |
| Mehrere Gebäude pro Adresse (O2) | ✅ **`adressen` 1:n `gebaeude`** | ADR-0015 |
| Mandantenbezogene Adressen (O3) | ✅ **`adressen.mandant_id` Pflicht** | ADR-0015 |
| Gebäudearten / Einheiten / Archivierung / RLS / Normalisierung | ✅ dokumentiert | ADR-0016 |
| B1 Normalisierung (DB-Trigger, kein pgcrypto) | ✅ **entschieden** | ADR-0016, Dokument 12 |
| B2 RLS M1 (ENABLE only, Service Role) | ✅ **entschieden** | ADR-0016, Dokument 12 |
| B3 Gebäudebezeichnung (nullable, Server später) | ✅ **entschieden** | ADR-0016, Dokument 12 |
| Erste operative Migration (M1) | ✅ angewendet & getestet | [`12-spezifikation-migration-1-operative-stammdaten.md`](./fachkonzept/12-spezifikation-migration-1-operative-stammdaten.md) |
| Migration 2 Beziehungen/Vorgänge | ✅ angewendet & getestet | [`13-…`](./fachkonzept/13-spezifikation-migration-2-beziehungen-und-vorgaenge.md), `20260717290000_operative_beziehungen_vorgaenge_v1.sql` |
| Migration 3 Anfrageeingang | ✅ angewendet & getestet | [`14-spezifikation-migration-3-anfrageeingang.md`](./fachkonzept/14-spezifikation-migration-3-anfrageeingang.md), `20260717300000_operativer_anfrageeingang_v1.sql`, ADR-0018 |
| M3.1a Nummernsequenzen + FK-Umbenennung | ✅ angewendet & getestet | `20260717310000_anfrageeingang_nummernsequenzen_v1.sql`, ADR-0019, `scripts/test-anfrageeingang-nummernsequenzen-migration.mjs` |
| M3.1b Anfrageeingang RPCs | ✅ 4/4 Kern-RPCs (create/update/bestaetige/erstelle) angewendet & getestet | ADR-0019, `scripts/test-erstelle-vorgang-aus-anfrageeingang-rpc.mjs` |
| Auth-/Mitgliedschafts-Sprint | ⬜ vor operativer UI | Voraussetzung für RLS-Policies |

---

## Verweise

| Dokument | Inhalt |
| --- | --- |
| [`docs/projektplan.md`](./projektplan.md) | Detaillierter Projektplan und Meilensteine |
| [`docs/systemarchitektur.md`](./systemarchitektur.md) | Verbindliche Domänen- und Systemarchitektur |
| [`docs/geschaeftsprozesse.md`](./geschaeftsprozesse.md) | Fachliche Prozessbeschreibungen |
| [`docs/fachkonzept/`](./fachkonzept/) | Verbindliches Fachkonzept operative Handwerksplattform |
| [`docs/adr/ADR-0014-trennung-saas-admin-und-operative-kundenplattform.md`](./adr/ADR-0014-trennung-saas-admin-und-operative-kundenplattform.md) | Domänentrennung `/admin` vs `/` |
| [`docs/adr/ADR-0015-mandantenbezogene-adressen-und-mehrere-gebaeude.md`](./adr/ADR-0015-mandantenbezogene-adressen-und-mehrere-gebaeude.md) | O2/O3 Adressen und Gebäude |
| [`docs/fachkonzept/12-spezifikation-migration-1-operative-stammdaten.md`](./fachkonzept/12-spezifikation-migration-1-operative-stammdaten.md) | Migration 1 Stammdaten (Spezifikation) |

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-21 | Erstversion — Phasen A–J |
| 2026-07-26 | Verweis Fachkonzept, Phase H präzisiert |
| 2026-07-26 | ADR-0014 — Phase H = operative Kundenplattform unter `/` |
| 2026-07-26 | ADR-0015 — O2/O3 entschieden; Phase-H-Vorbereitung ergänzt |
| 2026-07-26 | ADR-0016 — strukturelle Grundlagen erste operative Migration |
| 2026-07-26 | Dokument 12 — Spezifikation Migration 1 Stammdaten |
| 2026-07-26 | B1–B3 finalisiert; ADR-0016 und Dokument 12 bereit für DDL |
| 2026-07-27 | M1 angewendet; Dokument 13 + ADR-0017 Migration 2 |
| 2026-07-27 | M2-Blocker B1–B7 finalisiert (Mieter, Composite-FK, kundenstatus) |
| 2026-07-27 | Migration 2 DDL `20260717290000_operative_beziehungen_vorgaenge_v1.sql` |
| 2026-07-27 | Dokument 14 + ADR-0018 — Spezifikation Migration 3 Anfrageeingang |
| 2026-07-27 | M3-Blocker B1–B4 finalisiert — bereit für DDL |
| 2026-07-27 | Migration 3 DDL `20260717300000_operativer_anfrageeingang_v1.sql` |
| 2026-07-27 | Migration 3 angewendet & getestet (T1–T30) |
| 2026-07-27 | Dokument 15 + ADR-0019 — Spezifikation M3.1 Serverlogik |
| 2026-07-27 | Migration 3.1a DDL `20260717310000_anfrageeingang_nummernsequenzen_v1.sql` |
| 2026-07-27 | Migration 3.1a angewendet & getestet (T1–T20) |
| 2026-07-27 | Migration 3.1b (Teil 1) RPC `create_anfrageeingang` DDL bereit |
| 2026-07-27 | RPC `create_anfrageeingang` angewendet & getestet (T1–T24) |
| 2026-07-27 | Migration 3.1b (Teil 2) RPC `update_anfrageeingang_bewertung` DDL bereit |
| 2026-07-27 | RPC `update_anfrageeingang_bewertung` angewendet & getestet (T1–T30) |
| 2026-07-27 | Migration 3.1b (Teil 3) RPC `bestaetige_anfrageeingang_zuordnung` DDL bereit |
| 2026-07-28 | RPC `bestaetige_anfrageeingang_zuordnung` angewendet & getestet (T1–T34) |
| 2026-07-28 | Migration 3.1b (Teil 4) RPC `erstelle_vorgang_aus_anfrageeingang` DDL bereit |
| 2026-07-28 | RPC `erstelle_vorgang_aus_anfrageeingang` angewendet & getestet (T1–T38) |
