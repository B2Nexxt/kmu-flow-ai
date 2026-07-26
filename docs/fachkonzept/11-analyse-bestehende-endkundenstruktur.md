# Analyse: Bestehende Endkundenstruktur (`customers`)

Repository-Analyse zur Entscheidung **Option A** (`customers` weiterentwickeln) vs. **Option B** (neue Tabelle `kunden`).

**Status:** Analyse abgeschlossen — **Live-Introspection durchgeführt (2026-07-26)** — **keine Migration, keine Schema-Änderung**  
**Datum:** 2026-07-26  
**Bezug:** [`10-technisches-kunden-und-objektmodell.md`](./10-technisches-kunden-und-objektmodell.md), [`../adr/ADR-0013-technisches-kunden-objekt-vorgangsmodell.md`](../adr/ADR-0013-technisches-kunden-objekt-vorgangsmodell.md), [`../adr/ADR-0014-trennung-saas-admin-und-operative-kundenplattform.md`](../adr/ADR-0014-trennung-saas-admin-und-operative-kundenplattform.md)

---

## Zusammenfassung der Empfehlung

**Empfehlung: Option B — neue Tabelle `kunden` (Zielmodell), `customers` deprecate (kein Backfill).**

**ADR-0014:** `customers` ist **keine Admin-Tabelle** und **keine operative Zielentität** — Legacy-Zwischenstruktur, vorerst unangetastet, später deprecate. Operative Domäne nutzt **`kunden`** unter Route **`/`**; Admin-Domäne (`/admin`) bleibt unverändert.

Begründung in Kurzform: Im Repository existiert **kein** DDL für `customers`, **keine** Code-Abhängigkeit, und das Zielmodell (ADR-0013) trennt Kunde, Adresse, Gebäude, Einheit und Vorgang — eine flache CRM-Tabelle reicht nicht. Die Live-Tabelle bestätigt die fachliche Rolle (Endkunden **des** Mandanten via `organization_id`), ist aber **leer** und produktiv **unbenutzt**.

**Live-Bestätigung (Empfehlung B):** `public.customers` **existiert**, enthält **0 Zeilen**. Backfill entfällt.

---

## 0. Live-Introspection (verbundene Supabase-Instanz)

**Methode:** Read-only REST/PostgREST (`HEAD`/`GET` mit `Prefer: count=exact`, OpenAPI-Schema). **Keine** Inserts/Updates/Deletes. **Keine** personenbezogenen Einzelwerte ausgegeben.

**Einschränkung:** `information_schema`, `pg_policies`, `pg_indexes` und Trigger sind über PostgREST **nicht** exponiert. Indizes, Check-Constraints, Trigger und RLS-Policy-Details sind daher **nicht vollständig** aus der Live-DB auslesbar (kein `DATABASE_URL` / kein Supabase-CLI-Login im Projekt). PK/FK/NOT NULL/Defaults stammen aus dem PostgREST-OpenAPI-Schema.

### 0.1 Tabellenexistenz

| Tabelle | Existiert (Live) | Zeilen (aggregiert) |
| --- | --- | --- |
| `public.organizations` | **Ja** | **9** |
| `public.organization_members` | **Ja** | **0** |
| `public.customers` | **Ja** | **0** |

Referenz: `angebote` hat **14** Zeilen (Kontext — Plattform-Angebote unabhängig von `customers`).

### 0.2 Schema `public.customers` (Live, PostgREST OpenAPI)

| Spalte | Typ | NOT NULL | Default | PK | FK |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | ja | `gen_random_uuid()` | **PK** | — |
| `organization_id` | `uuid` | ja | — | — | **`organizations.id`** |
| `customer_number` | `text` | ja | — | — | — |
| `company_name` | `text` | ja | — | — | — |
| `contact_name` | `text` | nein | — | — | — |
| `email` | `text` | nein | — | — | — |
| `phone` | `text` | nein | — | — | — |
| `street` | `text` | nein | — | — | — |
| `postal_code` | `text` | nein | — | — | — |
| `city` | `text` | nein | — | — | — |
| `country` | `text` | nein | `Deutschland` | — | — |
| `vat_id` | `text` | nein | — | — | — |
| `notes` | `text` | nein | — | — | — |
| `created_at` | `timestamptz` | nein* | `now()` | — | — |
| `updated_at` | `timestamptz` | nein* | `now()` | — | — |

\*PostgREST markiert `created_at`/`updated_at` nicht als `required`; DB-seitig können sie dennoch NOT NULL sein — vor DDL-Migration via `pg_catalog` verifizieren.

**Nicht über PostgREST ermittelbar (offen bis pg_catalog):** Unique Constraints (z. B. `(organization_id, customer_number)`), Check Constraints, Indizes, Trigger, RLS-Policy-Namen/Rollen.

**REST-Methoden auf `/customers`:** `GET`, `POST`, `PATCH`, `DELETE` (Schreibzugriff technisch möglich — im Anwendungscode **nicht** genutzt).

### 0.3 Eingebettete Adressfelder (Live)

| Ziel-Feld (Dok. 10) | In `customers` (Live) | Anmerkung |
| --- | --- | --- |
| `strasse` | **`street`** (engl.) | vorhanden, nullable |
| `hausnummer` | **fehlt** | — |
| `plz` | **`postal_code`** | vorhanden, nullable |
| `ort` | **`city`** | vorhanden, nullable |
| `land` | **`country`** | vorhanden, Default `Deutschland` |
| `adresszusatz` | **fehlt** | — |

**Fazit:** Flache, eingebettete Adresse (Teilmenge) — passt nicht zum Zielmodell (`adressen`/`gebaeude` getrennt).

### 0.4 Aggregierter Datenbestand `customers` (Live)

| Kennzahl | Wert |
| --- | --- |
| Gesamtanzahl | **0** |
| Unterschiedliche Mandanten (`organization_id`) | **0** |
| Zeilen ohne Mandantenbezug | **0** |
| Zeilen mit eingebetteter Adresse (`street`/`postal_code`/`city`/`country`) | **0** |
| Mögliche Dubletten (normalisierte E-Mail) | **0** |
| Mögliche Dubletten (normalisierte Telefonnummer) | **0** |
| Mögliche Dubletten (normalisierte Adresse) | **0** |

### 0.5 RLS-Status (Live, eingeschränkt)

| Prüfung | Ergebnis |
| --- | --- |
| Lesezugriff `service_role` | HTTP 200, Count `0` |
| Lesezugriff `publishable_key` | HTTP 200, Count `0` |
| RLS aktiviert (ja/nein) | **Nicht eindeutig** über PostgREST (leere Tabelle); Policy-Details **nicht** auslesbar |

**Vor erster Migration:** RLS-Status und Policies im Supabase-Dashboard oder per read-only `pg_catalog`-Abfrage verifizieren.

### 0.6 Live-Empfehlung A / B / C

| Option | Beschreibung | Live-Ergebnis |
| --- | --- | --- |
| **A** | Existiert, relevante Daten, Backfill nötig | **Nein** (0 Zeilen) |
| **B** | Existiert, leer, deprecate | **Ja — bestätigt** |
| **C** | Existiert nicht | **Nein** (Tabelle vorhanden) |

**Finale Live-Empfehlung: B** — `customers` deprecate; **`kunden` neu ohne Backfill**.

**ADR-0013:** Unverändert (bestehende Empfehlung Option B / `kunden` neu wird bestätigt; Backfill entfällt).

---

## 1. Datenbank (Repository-Stand)

### Existiert `public.customers`?

| Quelle | Ergebnis |
| --- | --- |
| `supabase/migrations/*.sql` (11 Dateien) | **Kein** `CREATE TABLE public.customers` |
| Kommentar in `20260717090000_mandanten_onboarding_mvp.sql` | „Unverändert: **customers**, organization_members**“ — Tabelle wird als **vorbestehend** vorausgesetzt |
| `supabase/migrations/README.md` | „CRM-Kunden des Mandanten (unverändert)“ |
| **Live-Introspection (2026-07-26)** | **Ja** — Tabelle existiert, **0 Zeilen** |

**Fazit:** `customers` ist **physisch vorhanden**, aber **nicht versioniert** im Repo und **ohne produktive Daten**.

### Vollständiges Schema (Spalten, Constraints, RLS, …)

| Aspekt | Repository-Stand | Live-Stand (2026-07-26) |
| --- | --- | --- |
| Spalten / Datentypen | **Nicht dokumentiert** | **15 Spalten** — siehe Abschnitt 0.2 |
| PK | **Nicht dokumentiert** | `id` (`uuid`) |
| FK | **Nicht dokumentiert** | `organization_id` → `organizations.id` |
| NOT NULL | **Nicht dokumentiert** | `id`, `organization_id`, `customer_number`, `company_name` |
| Defaults | **Nicht dokumentiert** | `id`, `country`, `created_at`, `updated_at` |
| Unique / Check / Indizes / Trigger | **Nicht dokumentiert** | **Nicht über PostgREST ermittelbar** |
| RLS | **Nicht dokumentiert** | **Nicht eindeutig** (leere Tabelle); Policies nicht auslesbar |
| Mandantenbezug | fachlich erwartet | **`organization_id`** (NOT NULL) |
| Adressfelder | **Unbekannt** | `street`, `postal_code`, `city`, `country` (kein `hausnummer`, kein `adresszusatz`) |
| Kontaktfelder | **Unbekannt** | `contact_name`, `email`, `phone` |
| Status / Archivierung | **Unbekannt** | **Keine** Status-/Archiv-Spalte |

### Vergleichbare Tabellen im Repository (Kontext)

| Tabelle | In Migrationen definiert | Rolle |
| --- | --- | --- |
| `organizations` | Erweitert in `20260717090000` | **SaaS-Mandant** — bleibt unverändert laut ADR-0013 |
| `organization_members` | Nicht in Repo (vorbestehend) | **Login-Benutzer** — nicht Endkunde |
| `ansprechpartner` | Ja | Ansprechpartner **des Mandanten** (Plattform-Vertrieb) |
| `angebote` | Ja | Plattform-Angebote → `organization_id` = Mandant |

**Wichtig:** `organization_members` und `customers` sind laut Projektentscheidung (Onboarding-Migration, Juli 2026) ** verschiedene Domänen** — Mitglieder vs. operative CRM-Kunden.

### Datenbestand (Live, aggregiert)

| Kennzahl | Live-Stand (2026-07-26) |
| --- | --- |
| Anzahl Datensätze | **0** |
| Mandantenverteilung | **0** distinct `organization_id` |
| NULL-/Dublettenmuster | **Nicht bewertbar** (keine Zeilen) |
| Produktivität | **Kein Code** liest/schreibt `customers` → fachlich **keine produktive Abhängigkeit** |

---

## 2. Codeverwendung

### Treffer für `customers` im Anwendungscode

| Bereich | Treffer |
| --- | --- |
| `lib/**/*.ts` | **0** |
| `app/**/*.tsx` | **0** (kein `.from('customers')`, kein Typ) |
| Supabase-RPCs in Migrationen | **0** |
| Server Actions | **0** |
| Generierte DB-Typen | **Keine** (`database.types.ts` o. ä. nicht im Repo) |

### Operative „Kunden“-UI (ohne `customers`-Tabelle)

| Datei | Verhalten |
| --- | --- |
| `app/(app)/kunden/page.tsx` | Platzhalter „Diese Seite befindet sich im Aufbau“ — **keine Datenbank** |
| `app/(app)/angebote/page.tsx` | Client-Prototyp; Feld „Kunde“ als **Freitext** im Formular — **keine DB** |
| `app/(app)/sidebar.tsx` | Navigation `/kunden` — noch ohne Backend |

### Plattform-Angebote (Ist ✅)

| Aspekt | Implementierung |
| --- | --- |
| `angebote.organization_id` | FK → **Mandant** (`organizations`) |
| Empfänger | Snapshot in `angebot_versionen` (`empfaenger_*`) |
| `customer_id` | **Bewusst nicht** in V1 (`docs/angebote-datenmodell.md`) |

### Fachliche Bedeutung von `customers` (laut Projekt-Doku)

| Dokument | Aussage |
| --- | --- |
| `docs/datenmodell.md` | „Operative Kunden **des Mandanten** im CRM“ |
| Onboarding-Migration | „**kein** Mandant“ — parallel zu `organizations` |
| `docs/systemarchitektur.md` | CRM-Endkunden vs. `organization_members` (Login) |

**Das entspricht** dem Zielbegriff **Endkunde des Handwerksbetriebs** in ADR-0013 — **nicht** `organizations` (SaaS-Mandant).

### Produktive Abhängigkeit

**Keine.** Kein deployter Pfad hängt von `customers` ab. Entwicklung kann am Zielmodell (`kunden` + Satellitentabellen) ansetzen, ohne bestehenden Code zu brechen.

---

## 3. Vergleich mit Zielmodell (Dokument 10 / ADR-0013)

Ziel-Entitäten: `kunden`, `adressen`, `gebaeude`, `einheiten`, `kunden_objekt_beziehungen`, `vorgaenge`, `vorgang_beteiligte`.

| Ziel-Feld / Konzept | `customers` (Live) | Bewertung |
| --- | --- | --- |
| `mandant_id` → `organizations.id` | **`organization_id`** (NOT NULL, FK) | **Weiterverwendbar** als Semantik — Zielname `mandant_id` |
| `kundennummer` | **`customer_number`** (NOT NULL) | **Weiterverwendbar** (Mapping) |
| `typ` (privat/firma) | **fehlt** | **Fehlt** |
| Keine Gebäudedaten am Kunden | Eingebettete Adress-Spalten | **Auslagern** nach `adressen`/`gebaeude` |
| Getrennte Adressen | `street`, `postal_code`, `city`, `country` inline | **Auslagern** |
| Objekt/Einheit | Nicht vorhanden | **Neu** |
| Kunden-Objekt-Beziehung mit Rolle, Gültigkeit | Nicht vorhanden | **Neu** |
| Vorgänge | Nicht vorhanden | **Neu** |
| Mieterwechsel / Datenschutz-Trennung | Nicht modellierbar in flachem Stamm | **Neu** |

### Felder in `customers` (Live)

| Spalte in `customers` | Ziel |
| --- | --- |
| `id`, `company_name`, `contact_name`, `email`, `phone`, `customer_number` | Teilweise **mapping-fähig** auf `kunden` (bei Backfill — hier **entfällt**) |
| `street`, `postal_code`, `city`, `country` | **Auslagern** → `adressen` + `gebaeude` |
| `organization_id` | **Weiterverwendbar** als `mandant_id` |
| `vat_id`, `notes` | Fachlich prüfen — ggf. `kunden`/`notizen` |
| Alles in einer Zeile | **Nicht** ausreichend für MFH/Einheiten/Vorgänge |

---

## 4. Option A: `customers` schrittweise weiterentwickeln

### Vorteile

- Englischer Tabellenname bereits in Supabase-Konvention und Doku erwähnt
- Kein zweiter Name neben `customers`, falls Live-Daten existieren
- Theoretisch weniger Tabellen, wenn Schema bereits passt

### Nachteile

- **Schema im Repo unbekannt** — Erweiterung blind oder abhängig von undokumentiertem Live-Stand
- Zielmodell erfordert **mehrere neue Tabellen** trotzdem (`adressen`, `gebaeude`, …) — `customers` allein reicht nicht
- Adressfelder in `customers` würden **Legacy-Pflicht** für Migration und Dublettenlogik
- Name `customers` vs. fachliches **`kunden`** in Fachkonzept — dauerhafte Begriffs-Spannung
- Risiko, versehentlich **organizations**-Semantik zu vermischen, wenn `customers` historisch anders genutzt wurde
- Onboarding-Migration explizit: „**customers dürfen nicht verändert werden**“ (Stand Juli 2026) — Weiterentwicklung widerspricht dieser Arbeitsannahme bis Klärung

### Migrationsaufwand

| Schritt | Aufwand |
| --- | --- |
| Live-Schema dokumentieren | Mittel |
| Spalten ergänzen + Daten in Satellitentabellen splitten | Hoch |
| Code auf erweitertes Modell | Mittel (heute 0 Referenzen) |
| MFH/Vorgangsmodell | Hoch — faktisch Neubau um alte Tabelle |

### Risiken

- Unbekanntes RLS/FK bricht bei ALTER
- Historische Daten mit eingebetteter Adresse → fehlerhafte Auto-Zuordnung (ADR-0008)
- `customers` evtl. **leer** — dann unnötiger Legacy-Ballast

### Auswirkungen auf Code

Gering **heute** (keine Referenzen). Zukünftiger Code müsste englischen Namen `customers` tragen oder View-Alias `kunden` pflegen.

### Übergangsstrategie (falls A)

1. Live-Introspection
2. `customers` nur als Stamm **Name/Kontakt**; Adressen migrieren
3. Neue Tabellen parallel
4. Deprecation eingebetteter Adressspalten

---

## 5. Option B: Neue Tabelle `kunden`, `customers` später migrieren

### Vorteile

- **100 % aligned** mit Dokument 10 und ADR-0013 (deutsche Domänennamen, klare Trennung)
- **Kein Breaking Change** an undokumentiertem `customers`-Schema
- Onboarding-Regel „customers unverändert“ bleibt eingehalten bis explizite Migrationsphase
- Grüne Wiese für `mandant_id`, `kundennummer`, Rollen, Vorgänge
- **Kein Code-Umbau** bestehender Pfade (es gibt keine)
- Plattform-`angebote` und `organizations` **unberührt**

### Nachteile

- Zwei Kunden-Stämme temporär, falls `customers` Live-Daten hat
- Einmaliger Backfill-Aufwand
- Entscheidung Tabellenname endgültig (`kunden` vs. View auf `customers`)

### Migrationsaufwand

| Schritt | Aufwand |
| --- | --- |
| Neue Tabellen laut Dokument 10 | Mittel–hoch (einmalig) |
| Backfill `customers` → `kunden` | **Entfällt** (0 Zeilen, Live 2026-07-26) |
| `customers` deprecate / read-only | Niedrig (separate Migration, ADR-0014) |
| Operative Features neu an `kunden` | Geplant (Phase H) |

### Risiken

- Vergessene Live-Daten in `customers` ohne Backfill
- Doppelpflege, wenn jemand manuell in `customers` schreibt (unwahrscheinlich — kein UI)

### Auswirkungen auf Code

**Keine** auf Ist-Code. Neue Features nur gegen `kunden`.

### Übergangsstrategie (empfohlen)

```
Phase B0 — Live-Introspection customers ✅ (2026-07-26: existiert, 0 Zeilen)
Phase B1 — Tabellen kunden, adressen, gebaeude, … (parallel, Dokument 10)
Phase B2 — Operative Prozesse nur noch kunden
Phase B3 — Backfill entfällt (leere customers)
Phase B4 — customers deprecate oder DROP (nach Bestätigung; kein Datenverlust)
```

Plattform-Angebote: **`organization_id` unverändert** in Phase B1–B4.

---

## 6. Abgrenzung: Was `customers` **nicht** ist

| Entität | Ist das der Endkunde des Handwerks? |
| --- | --- |
| `organizations` | **Nein** — SaaS-Mandant (Handwerksbetrieb als Kunde von KMU Flow AI) |
| `organization_members` | **Nein** — Plattform-Login des Mandanten |
| `ansprechpartner` | **Nein** — GF/HA des **Mandanten** (Vertrieb) |
| `angebote.organization_id` | **Nein** — Bezug zum **Mandanten** als Empfänger des Plattform-Angebots |
| `customers` (Doku) | **Ja (fachlich)** — operative Endkunden des Mandanten — **wenn** Tabelle existiert und so genutzt wurde |

---

## 7. Auswirkungen auf `organizations` und Plattform-Angebote

| Bereich | Entscheidung |
| --- | --- |
| `organizations` | **Unverändert** — Mandant; Adressfelder = Mandanten-Sitz, nicht Endkunden-Objekte |
| `angebote` / `angebot_versionen` | **Unverändert** — `organization_id` + Empfänger-Snapshot |
| Operative Endkunden-Angebote | **Zukünftig** über `vorgaenge` — **keine** Umdeutung bestehender `angebote`-Zeilen |
| `leistungsmodule` | Unberührt (Zwischenlösung Plattform-Katalog) |

---

## 8. Offene Fragen vor Migration

| # | Frage | Status |
| --- | --- | --- |
| F1 | Existiert `public.customers` in der Live-DB? | **Ja** |
| F2 | Vollständiges DDL + RLS | **Teilweise** (Spalten/PK/FK via PostgREST); Indizes/Checks/Trigger/Policies **offen** |
| F3 | `COUNT(*)`, Verteilung nach Mandant | **0 Zeilen**, 0 Mandanten |
| F4 | Hat `customers` `organization_id`? | **Ja** (NOT NULL, FK) |
| F5 | Enthält `customers` produktive Zeilen? | **Nein** — Backfill entfällt |
| F6 | Finaler Tabellenname `kunden` vs. Rename `customers` | **`kunden` neu** (bestätigt) |
| F7 | View/Alias für englische API? | Optional später |
| F8 | RLS-Policies auf `customers` | Vor DDL via Dashboard/pg_catalog klären |

---

## 9. Erkannte Risiken

| Risiko | Schwere | Mitigation |
| --- | --- | --- |
| Undokumentiertes Live-Schema | Mittel | Spalten/PK/FK live bekannt; Indizes/Checks/RLS vor DDL prüfen |
| Annahme „customers existiert“ nur aus Kommentar | ~~Mittel~~ | **Erledigt** — Live bestätigt |
| Verwechslung mit `organizations` | Hoch | ADR-0013 + diese Analyse |
| Option A erzwingt Legacy-Adressen | Hoch | Option B |
| Leere `customers`-Tabelle | Niedrig | **Bestätigt** — kein Backfill |

---

## 10. Entscheidungsvorlage (noch nicht ADR-geändert)

| Option | Empfehlung |
| --- | --- |
| **A** — `customers` weiterentwickeln | **Abgelehnt** (Repository + Zielmodell) |
| **B** — `kunden` neu, optional Backfill | **Empfohlen** — Backfill **entfällt** (Live: 0 Zeilen) |

Nach Live-Introspection (2026-07-26): **`customers` existiert, ist leer** → Live-Empfehlung **B** (deprecate, `kunden` ohne Backfill).

---

## Verweise

| Dokument | Inhalt |
| --- | --- |
| [`10-technisches-kunden-und-objektmodell.md`](./10-technisches-kunden-und-objektmodell.md) | Zielmodell |
| [`../adr/ADR-0013-technisches-kunden-objekt-vorgangsmodell.md`](../adr/ADR-0013-technisches-kunden-objekt-vorgangsmodell.md) | Architekturentscheidung Zielmodell |
| [`../adr/ADR-0014-trennung-saas-admin-und-operative-kundenplattform.md`](../adr/ADR-0014-trennung-saas-admin-und-operative-kundenplattform.md) | Domänentrennung `/admin` vs `/` |
| [`../angebote-datenmodell.md`](../angebote-datenmodell.md) | Plattform-Angebote Ist |
| `supabase/migrations/20260717090000_mandanten_onboarding_mvp.sql` | Kommentar „customers unverändert“ |

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-26 | Erstversion — Repository-Analyse, Empfehlung Option B |
| 2026-07-26 | Live-Introspection — `customers` existiert, 0 Zeilen; Empfehlung B (deprecate, kein Backfill) |
| 2026-07-26 | Verweis ADR-0014 — `customers` als Legacy, operative Domäne `kunden` |
