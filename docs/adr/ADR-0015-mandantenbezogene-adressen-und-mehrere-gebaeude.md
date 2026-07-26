# ADR-0015: Mandantenbezogene Adressen und mehrere Gebäude pro Adresse

**Status:** Angenommen (verbindlich, Zielarchitektur) — **noch nicht implementiert**  
**Datum:** 2026-07-26  
**Bezug:** [`docs/fachkonzept/10-technisches-kunden-und-objektmodell.md`](../fachkonzept/10-technisches-kunden-und-objektmodell.md), ADR-0007, ADR-0008, ADR-0013, ADR-0014

---

## Kontext

ADR-0013 definiert die operative Entitäten `adressen` und `gebaeude` als getrennte Bausteine des Kunden- und Objektmodells. Zwei Punkte waren in Dokument 10 noch als **O2** und **O3** offen:

| # | Frage |
| --- | --- |
| **O2** | Ein Gebäude vs. **mehrere** `gebaeude` pro Adresse (Halle 1/2, Vorder-/Hinterhaus, …) |
| **O3** | **Globale** vs. **mandantenbezogene** `adressen` |

Ohne verbindliche Entscheidung bestünde Risiko für inkonsistente Modellierung (z. B. Hallen als `einheiten` statt als Gebäude, oder mandantenübergreifende Adress-Deduplizierung mit ungewollten Kundenverknüpfungen — widerspricht ADR-0007/0008).

---

## Entscheidung

### O2 — Mehrere Gebäude pro Adresse

**Eine Adresse kann ein oder mehrere Gebäude besitzen.**

**Kardinalität:** `adressen` **1:n** `gebaeude`

**Beispiele (fachlich gleichwertig):**

- Haus A / Haus B
- Vorderhaus / Hinterhaus
- Halle 1 / Halle 2
- Wohnhaus / Garage / Nebengebäude
- Bürogebäude / Werkstatt

**Mindestfelder `gebaeude` (konzeptionell):**

| Feld | Pflicht | Beschreibung |
| --- | --- | --- |
| `mandant_id` | ja | FK → `organizations.id` |
| `adresse_id` | ja | FK → `adressen.id` |
| `gebaeudeart` | ja | z. B. EFH, MFH, Gewerbe, Nebengebäude, Halle, Garage |
| `gebaeudebezeichnung` | bedingt | optional; **erforderlich**, wenn unter derselben Adresse mehrere Gebäude existieren und diese sonst nicht eindeutig unterscheidbar sind |
| technische Stammdaten | optional | z. B. `jsonb` — Maße, Material, Baujahr (nicht personenbezogen) |
| `aktiv` / archiviert | ja | Lebenszyklus des Objekts |
| `created_at` / `updated_at` | ja | Audit |

**Regel Bezeichnung:** Bei **einem** Gebäude an einer Adresse kann die Bezeichnung leer bleiben (z. B. EFH). Bei **mehreren** Gebäuden muss die Bezeichnung gesetzt werden, sobald `gebaeudeart` allein nicht eindeutig ist.

### O3 — Mandantenbezogene Adressen

**Jede operative Adresse gehört genau einem SaaS-Mandanten:**

`adressen.mandant_id` → `organizations.id`

**Verbindliche Regeln:**

- **Keine** globale Adresstabelle über mehrere Mandanten
- Die **gleiche reale Adresse** darf bei **mehreren Mandanten** mehrfach gespeichert werden (jeweils eigener Datensatz)
- **Keine** mandantenübergreifende Dublettensuche
- **Keine** mandantenübergreifende Verknüpfung
- **RLS und Queries** müssen **immer** `mandant_id` berücksichtigen
- **Dublettenvorschläge** nur **innerhalb desselben Mandanten**
- Gleiche normalisierte Adresse führt **niemals automatisch** zu Merge oder Kundenverknüpfung (ADR-0008)

### Normalisierung (fachlich — noch nicht implementiert)

Normalisierte Felder dienen **ausschließlich** Suche und Dublettenvorschlägen. **Originaleingaben** bleiben für Anzeige und Dokumente erhalten.

| Feld | Normalisiert | Anmerkung |
| --- | --- | --- |
| Straße | `strasse_normalisiert` | siehe ADR-0016 |
| Hausnummer | `hausnummer_normalisiert` | siehe ADR-0016 |
| PLZ | `plz_normalisiert` | trimmen |
| Ort | `ort_normalisiert` | siehe ADR-0016 |
| Land | `land_normalisiert` | siehe ADR-0016 |
| Adresszusatz | — | **bleibt separat**, nicht im Standard-Match |
| Fingerprint | `adress_fingerprint` | mandantenintern — ADR-0016 |

Details und Algorithmus: **ADR-0016** (verbindlich). ADR-0015 definiert Grundprinzipien (kein Auto-Merge, mandantenintern).

**Keine Auto-Merge-Logik** auf Basis normalisierter Adressen — Ergebnis ist immer **Vorschlag** zur manuellen Prüfung.

---

## Alternativen (verworfen)

| Alternative | Grund der Ablehnung |
| --- | --- |
| **O2:** Genau ein `gebaeude` pro Adresse; Hallen nur als `einheiten` | Hallen/Werkstätten/Nebengebäude sind oft **eigenständige Objekte** mit eigener Technik; erzwingt künstliche Einheiten |
| **O2:** Mehrere Adressen für dasselbe Grundstück statt 1:n | Dupliziert Standortdaten; erschwert Suche und Kartenansicht |
| **O3:** Globale Adresstabelle (Shared Address Pool) | Mandantenübergreifende Verknüpfung; Datenschutz- und RLS-Risiko; gleiche Adresse ≠ gleicher Kunde (ADR-0007) |
| **O3:** Mandantenübergreifende Dublettensuche | Verletzt Mandantentrennung; suggeriert falsche Identität zwischen Mandanten |
| Normalisierung ersetzt Originalfelder | Anzeige und Rechtssicherheit (Brief, Angebot) brauchen Originaltext |

---

## Begründung

1. **Realitätsnähe** — Grundstücke mit mehreren Gebäuden sind im Handwerk häufig (MFH, Gewerbe, Nebengebäude).
2. **Klare Hierarchie** — Adresse = Standort; Gebäude = technisches Objekt; Einheit = Bereich im Gebäude (ADR-0013).
3. **Mandantentrennung** — Operative Adressen sind **Tenant-Daten**, keine Plattform-weite Referenzdaten (ADR-0014).
4. **Datenschutz** — Keine inferierte Kundenidentität über Adresse; Mieterwechsel und MFH bleiben modellierbar (ADR-0007).
5. **Dublettenlogik** — Normalisierung unterstützt Büro-Workflow, ohne Auto-Merge (ADR-0008).

---

## Kardinalitäten (verbindlich)

```
organizations (Mandant)
    │
    └── mandant_id scoped:
            │
            ├── adressen (1 pro Mandant-Scope, n Adressen)
            │       │
            │       └── gebaeude (1:n — mindestens 0..n, fachlich 1..n)
            │               │
            │               └── einheiten (1:n)
            │
            ├── kunden
            └── kunden_objekt_beziehungen → gebaeude / einheiten
```

| Beziehung | Kardinalität |
| --- | --- |
| Mandant → `adressen` | 1:n |
| `adressen` → `gebaeude` | **1:n** |
| `gebaeude` → `einheiten` | 1:n |
| Gleiche reale Adresse über Mandanten | **keine** gemeinsame Entität — n getrennte `adressen`-Zeilen |
| Normalisierte Adresse → Kunden-Merge | **keine** — nur Dubletten**vorschlag** innerhalb Mandant |

---

## Datenschutzfolgen

| Folge | Maßnahme |
| --- | --- |
| Mandant A und B an gleicher Straße | **Getrennte** `adressen`-Datensätze — kein Shared Record, keine gegenseitige Sichtbarkeit |
| Neuer Mieter an bekanntem Objekt | Technische Daten am `gebaeude` optional wiederverwendbar; **personenbezogene Vorgänge** am Kunden/Vorgang (ADR-0013) |
| Dublettenvorschläge | Nur innerhalb Mandant — kein Leak über „Adresse existiert bereits bei anderem Mandanten“ |
| Normalisierung | Kein Ersatz für Original — DSGVO-konforme Anzeige und Auskunft über gespeicherte Originale |
| Adresssuche | Ergebnisse mandantenbeschränkt — keine Cross-Tenant-Enumeration |

---

## RLS-Folgen

| Anforderung | Konsequenz (bei Implementierung) |
| --- | --- |
| Mandantentrennung | Jede Policy auf `adressen` und `gebaeude` filtert **`mandant_id`** |
| Kein Cross-Tenant-Read | SELECT/INSERT/UPDATE ohne passende `mandant_id` verboten |
| Joins | `gebaeude` → `adressen` nur innerhalb desselben `mandant_id` |
| Dubletten-Query | `WHERE mandant_id = :current_mandant` **Pflicht** |
| Admin vs. Operativ | `organizations`-Adressfelder (Mandanten-Sitz) **separate** Domäne — nicht über operative `adressen`-RLS gemischt (ADR-0014) |

**Hinweis:** Konkrete Policy-Namen und SQL — **nicht** Gegenstand dieser Entscheidung.

---

## Dublettenlogik

| Aspekt | Regel |
| --- | --- |
| **Scope** | Nur **innerhalb** desselben `mandant_id` |
| **Matching** | Normalisierte Felder: Straße, Hausnummer, PLZ, Ort, Land |
| **Adresszusatz** | Separat; nicht automatisch in Match (oder nur mit expliziter Regel) |
| **Ergebnis** | **Vorschlag** — manuelle Bestätigung oder Neuanlage |
| **Verboten** | Auto-Merge von `adressen`, Auto-Verknüpfung zu `kunden`, mandantenübergreifende Suche |
| **Gebäude-Dubletten** | Unter derselben `adresse_id`: Bezeichnung + `gebaeudeart` prüfen — kein Auto-Merge |

---

## Konsequenzen

### Positiv

- O2 und O3 in Dokument 10 **geschlossen**
- Gewerbe-/MFH-Szenarien (Halle 1/2, Nebengebäude) ohne Modellbruch
- Klare RLS- und Dubletten-Regeln vor erster Migration

### Aufwand (später)

- Schema: `adressen.mandant_id`, Normalisierungsfelder, `gebaeude`-Pflichtfelder
- Normalisierungsfunktion (einmalig definieren, z. B. ADR-Nachfolger oder Implementierungs-ADR)
- UI: Pflicht Bezeichnung bei mehreren Gebäuden pro Adresse

### Dokumentation

- [`docs/fachkonzept/10-technisches-kunden-und-objektmodell.md`](../fachkonzept/10-technisches-kunden-und-objektmodell.md) — Abschnitte Adresse, Gebäude, Kardinalitäten, O2/O3
- ADR-0013 — Verweis und Präzisierung

---

## Nicht Bestandteil dieser Entscheidung

- SQL-DDL, Migrationsscripte, Trigger für Normalisierung
- RLS-Policy-Texte
- Geocoding, Karten-UI, Adress-APIs (Google, OSM, …)
- Konkrete Normalisierungsalgorithmen (Implementierung)
- CHECK-Constraints für `gebaeudeart`-Enum
- Verknüpfung `adressen` ↔ `organizations`-Stammdresse des Mandanten
- Einheiten-Modell (bleibt ADR-0013)

---

## Verweise

| Dokument | Inhalt |
| --- | --- |
| ADR-0007 | Keine Adress-Identität für Kunden |
| ADR-0008 | Zwei-Merkmale-Regel, keine Auto-Zuordnung |
| ADR-0013 | Gesamtmodell Kunden/Objekte/Vorgänge |
| ADR-0014 | Domänentrennung Admin/Operativ |
| ADR-0016 | Gebäudearten, Einheiten, Archivierung, RLS, Normalisierung (V1) |
