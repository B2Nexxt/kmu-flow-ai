# Modul-Zusammenführung: Mapping `organization_modules` → `leistungsmodule`

Diese Dokumentation beschreibt die **konkrete Datenmigration** von Freitext-Modulzuordnungen (`organization_modules.modul`) auf den **zentralen Modulstamm** `leistungsmodule`.

**Status:** Migrations-Mapping (Konzept); **noch keine Migration, keine UI, keine RPC-Anpassung**  
**Bezug:** `docs/angebote-modulkatalog.md`, `docs/datenmodell.md`, Migration `20260717270000_angebots_modulkatalog.sql`

---

## Verbindliche Entscheidungen (Kurz)

| Thema | Entscheidung |
| --- | --- |
| Zentraler Stamm | `leistungsmodule` für Angebote, Rechnungen (später) und `organization_modules` |
| `modultyp` | `plattform` \| `leistung` \| `beides` — steuert Lizenz- vs. Verkaufsnutzung |
| Listenpreise | **Keine Platzhalterpreise (0 Cent)**; Seed/Migration erst nach fachlicher Preisfreigabe |
| `organization_modules` | `leistungsmodul_id` + `lizenz_status`, `aktiviert_am`, `deaktiviert_am`, `konfiguration` |
| `lizenz_status` | `geplant`, `aktiv`, `pausiert`, `gekündigt` |
| Mapping | Explizit, kein Fuzzy-Match; Abbruch bei unbekannten Werten |

---

## 1. Bestehende Werte (Ermittlung)

### 1.1 Abfrage gegen verbundene Supabase-Instanz

Stand der Ermittlung: **0 Zeilen** in `organization_modules`.

Die Migration basiert auf den **sechs kanonischen Freitextwerten** aus `MODULE_OPTIONS`, die 1:1 in `organization_modules.modul` persistiert werden.

### 1.2 Schema `organization_modules` (Ist)

| Spalte | Typ | Beschreibung |
| --- | --- | --- |
| `id` | `uuid` | Primärschlüssel |
| `organization_id` | `uuid` | FK → `organizations.id` (ON DELETE CASCADE) |
| `modul` | `text` | Freitext — einziges fachliches Modulfeld |

**Constraint:** `UNIQUE (organization_id, modul)`

### 1.3 Die sechs kanonischen Modulwerte

| # | Freitextwert (`modul`) | Zuordnungen (DB) | Quelle |
| --- | --- | ---: | --- |
| 1 | `CRM` | 0 | `MODULE_OPTIONS` |
| 2 | `Angebote` | 0 | `MODULE_OPTIONS` |
| 3 | `Rechnungen` | 0 | `MODULE_OPTIONS` |
| 4 | `KI-Assistent` | 0 | `MODULE_OPTIONS` |
| 5 | `Automatisierungen` | 0 | `MODULE_OPTIONS` |
| 6 | `Dokumente` | 0 | `MODULE_OPTIONS` |

### 1.4 Code-Stellen

| Datei | Erwartung |
| --- | --- |
| `app/admin/mandanten/neu/mandanten-onboarding-context.tsx` | `MODULE_OPTIONS` — 6 exakte Strings |
| `app/admin/mandanten/neu/module/page.tsx` | Checkbox-Vergleich über String-Gleichheit |
| `lib/mandanten/build-onboarding-payload.ts` | `module: ausgewaehlteModule[]` |
| `create_mandant_onboarding` (RPC) | INSERT Freitext in `organization_modules.modul` |
| `lib/mandanten/get-mandant-akte.ts` | Liest `modul` → `akte.module: string[]` |
| `app/admin/mandanten/[id]/mandanten-akte-view.tsx` | Anzeige `formatList(akte.module)` |

---

## 2. Mapping-Tabelle (explizit, ohne Fuzzy-Match)

### 2.1 `modultyp` — Bedeutung

| `modultyp` | Als Angebotsposition auswählbar | Lizenzierbar (`organization_modules`) |
| --- | --- | --- |
| `plattform` | nein | ja |
| `leistung` | ja | nein |
| `beides` | ja | ja |

Die sechs bestehenden Onboarding-Module sind **`modultyp = plattform`** (Funktions-/Lizenzmodule, keine Verkaufspositionen).

### 2.2 Vollständige Mapping-Tabelle

| Bisheriger Wert | `code` | `technischer_schluessel` | Name | `modultyp` | Angebotsposition | Lizenzierbar | Beschreibung (kurz) | `preisart` | Preis netto (Cent) | MwSt. | Einheit | `aktiv` | Zuordnungen |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: |
| `CRM` | `MOD-CRM` | `crm` | CRM | `plattform` | nein | ja | Kunden- und Kontaktverwaltung | `monatlich` | noch festzulegen | 19 | `Monat` | ja | 0 |
| `Angebote` | `MOD-ANGEBOTE` | `angebote` | Angebote | `plattform` | nein | ja | Angebotsfunktion im Mandantenportal | `monatlich` | noch festzulegen | 19 | `Monat` | ja | 0 |
| `Rechnungen` | `MOD-RECHNUNGEN` | `rechnungen` | Rechnungen | `plattform` | nein | ja | Rechnungsfunktion für den Mandanten | `monatlich` | noch festzulegen | 19 | `Monat` | ja | 0 |
| `KI-Assistent` | `MOD-KI-ASSISTENT` | `ki_assistent` | KI-Assistent | `plattform` | nein | ja | KI-gestützte Assistenzfunktionen | `monatlich` | noch festzulegen | 19 | `Monat` | ja | 0 |
| `Automatisierungen` | `MOD-AUTOMATISIERUNGEN` | `automatisierungen` | Automatisierungen | `plattform` | nein | ja | Workflow- und Automatisierungsfunktionen | `monatlich` | noch festzulegen | 19 | `Monat` | ja | 0 |
| `Dokumente` | `MOD-DOKUMENTE` | `dokumente` | Dokumente | `plattform` | nein | ja | Dokumentenverwaltung | `monatlich` | noch festzulegen | 19 | `Monat` | ja | 0 |

**Hinweis:** Verkaufbare Beratungsleistungen (z. B. Projektpakete) werden **zusätzlich** als eigene `leistungsmodule` mit `modultyp = leistung` oder `beides` angelegt — nicht über diese sechs Plattform-Module.

### 2.3 Codeanpassungen (alle sechs Module)

| Bereich | Anpassung |
| --- | --- |
| `MODULE_OPTIONS` | Ersetzen durch DB: `leistungsmodule WHERE modultyp IN ('plattform','beides') AND aktiv = true` |
| `build-onboarding-payload.ts` | `leistungsmodul_ids[]` statt Freitext-`module[]` |
| `create_mandant_onboarding` | INSERT mit `leistungsmodul_id`, `lizenz_status = 'aktiv'` (oder `geplant`) |
| `get-mandant-akte.ts` | JOIN `leistungsmodule`; Anzeige über `name` |
| Feature-Gates (später) | `technischer_schluessel` + `lizenz_status = 'aktiv'` |

### 2.4 Mapping-SQL (Referenz)

```sql
UPDATE organization_modules om
SET leistungsmodul_id = lm.id
FROM leistungsmodule lm
WHERE om.leistungsmodul_id IS NULL
  AND (
    (om.modul = 'CRM'                 AND lm.technischer_schluessel = 'crm')
    OR (om.modul = 'Angebote'         AND lm.technischer_schluessel = 'angebote')
    OR (om.modul = 'Rechnungen'       AND lm.technischer_schluessel = 'rechnungen')
    OR (om.modul = 'KI-Assistent'     AND lm.technischer_schluessel = 'ki_assistent')
    OR (om.modul = 'Automatisierungen' AND lm.technischer_schluessel = 'automatisierungen')
    OR (om.modul = 'Dokumente'       AND lm.technischer_schluessel = 'dokumente')
  );
```

---

## 3. Gemeinsames Zielmodell

### 3.1 `leistungsmodule` — zentraler Modulstamm

| Kategorie | Felder |
| --- | --- |
| Identität | `id`, `code`, `technischer_schluessel`, `name`, `beschreibung` |
| Typ | `modultyp` (`plattform` \| `leistung` \| `beides`) |
| Verkauf | `einzelpreis_netto_cents`, `einheit`, `umsatzsteuer_satz`, `preisart` |
| Steuerung | `aktiv`, `sortierung` |
| Meta | `created_at`, `updated_at` |

**Regeln:**

- Ein Datensatz = eine fachliche Leistung oder Plattformfunktion
- Angebots-/Rechnungspositionen: **Snapshots** in Positionszeilen
- Keine 0-Cent-Platzhalter bei Seed
- `code` / `technischer_schluessel` nach Go-Live nicht änderbar (Admin-Regel)

### 3.2 `organization_modules` — Mandanten-Lizenz (Ziel)

Keine duplizierten Namen, Beschreibungen oder Preise.

| Spalte | Beschreibung |
| --- | --- |
| `id` | Primärschlüssel |
| `organization_id` | FK → `organizations.id` |
| `leistungsmodul_id` | FK → `leistungsmodule.id` RESTRICT; nur `modultyp IN ('plattform','beides')` |
| `lizenz_status` | `geplant` \| `aktiv` \| `pausiert` \| `gekündigt` |
| `aktiviert_am` | Aktivierung (nullable bei `geplant`) |
| `deaktiviert_am` | Deaktivierung/Kündigung (nullable) |
| `konfiguration` | `jsonb` nullable |
| `modul` | Legacy-Rückfallebene; später entfernen |

**Constraints:** `UNIQUE (organization_id, leistungsmodul_id)`

**`lizenz_status`-Semantik (Ziel):**

| Status | Bedeutung |
| --- | --- |
| `geplant` | Lizenz vorgemerkt, noch nicht aktiv |
| `aktiv` | Mandant darf Funktion nutzen |
| `pausiert` | Temporär gesperrt, Zuordnung bleibt |
| `gekündigt` | Beendet; `deaktiviert_am` gesetzt |

Org-Gesamtpreise bleiben vorerst auf **`organizations`**.

---

## 4. Migrationsreihenfolge

```
Phase 0 — Fachliche Freigabe (Voraussetzung)
  P0  Listenpreise netto (Cent), MwSt., preisart für alle 6 Module festlegen
  P0  Keine Migration/Seed mit einzelpreis_netto_cents = 0

Phase A — Schema erweitern
  A1  leistungsmodule: technischer_schluessel, modultyp (+ Constraints)
  A2  organization_modules: leistungsmodul_id, lizenz_status, aktiviert_am,
      deaktiviert_am, konfiguration (modul bleibt)

Phase B — Seed
  B1  INSERT genau 6 leistungsmodule aus Abschnitt 2.2 (mit echten Preisen)

Phase C — Backfill
  C1  Explizites UPDATE (Abschnitt 2.4)
  C2  Vollständigkeit: leistungsmodul_id IS NULL → Abbruch
  C3  Unbekannte modul-Werte → Abbruch

Phase D — Integrität
  D1  FK + UNIQUE (organization_id, leistungsmodul_id)
  D2  NOT NULL leistungsmodul_id (nach C2)

Phase E — Anwendung (separat)
  E1  RPC + UI auf leistungsmodul_id

Phase F — Aufräumen (später)
  F1  DROP modul, DROP UNIQUE (organization_id, modul)
```

---

## 5. Sicherheitsregeln

| Regel | Umsetzung |
| --- | --- |
| Keine verlorene Zuordnung | Explizites Mapping + Vollständigkeitsprüfung |
| Abbruch bei unbekannten Werten | Pre-Check Distinct-Werte |
| Kein Fuzzy-Match | Nur exakter Match auf `modul` |
| Keine 0-Cent-Seeds | Phase B blockiert bis P0 abgeschlossen |
| Rückfallebene | Spalte `modul` bis Phase F |
| Idempotenz | Backfill nur `WHERE leistungsmodul_id IS NULL` |

---

## 6. Noch manuell festzulegende Angaben

| Modul | Preis netto (Cent) | Weitere offene Punkte |
| --- | --- | --- |
| CRM | noch festzulegen | — |
| Angebote | noch festzulegen | Abgrenzung Plattform-Lizenz vs. verkaufbare Leistungspositionen |
| Rechnungen | noch festzulegen | — |
| KI-Assistent | noch festzulegen | — |
| Automatisierungen | noch festzulegen | Nicht verwechseln mit `organization_automatisierungen` |
| Dokumente | noch festzulegen | — |

**Global noch offen:**

- Org-Gesamtpreis vs. Modul-Listenpreis (Beziehung klären)
- Initialer `lizenz_status` bei Onboarding (`geplant` vs. `aktiv`)
- Schema/Keys für `konfiguration` jsonb
- Zusätzliche `leistungsmodule` mit `modultyp = leistung` für Angebotskatalog (separater Katalogaufbau)

---

## 7. Risiken

| Risiko | Mitigation |
| --- | --- |
| Abweichende `modul`-Texte | Pre-Check + Abbruch |
| Leere DB vs. Produktion | Distinct-Check nach erstem Onboarding |
| `modultyp = plattform` für alle 6 Seeds | Verkaufspakete separat als `leistung`/`beides` anlegen |
| Blockade ohne Preise | Bewusst — keine 0-Cent-Migration |
| Parallele UNIQUE-Constraints | Altes UNIQUE erst in Phase F entfernen |

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-21 | Erstversion — Mapping-Dokumentation |
| 2026-07-21 | Gemeinsames Modell: `modultyp`, `lizenz_status`, keine 0-Cent-Seeds, Angebotsposition/Lizenz-Spalten |
