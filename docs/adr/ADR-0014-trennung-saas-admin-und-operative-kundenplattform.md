# ADR-0014: Trennung SaaS-Administration und operative Kundenplattform

**Status:** Angenommen (verbindlich)  
**Datum:** 2026-07-26  
**Bezug:** [`docs/systemarchitektur.md`](../systemarchitektur.md), [`docs/fachkonzept/10-technisches-kunden-und-objektmodell.md`](../fachkonzept/10-technisches-kunden-und-objektmodell.md), [`docs/fachkonzept/11-analyse-bestehende-endkundenstruktur.md`](../fachkonzept/11-analyse-bestehende-endkundenstruktur.md), ADR-0013

---

## Kontext

KMU Flow AI umfasst **zwei fachlich getrennte Welten** in einer technischen Plattform:

| Welt | Route (Ist) | Zielgruppe |
| --- | --- | --- |
| **SaaS-Administration** | `/admin/**` | Internes Team von KMU Flow AI |
| **Operative Kundenplattform** | `/` (App-Routen außerhalb `/admin`) | Handwerksbetriebe (SaaS-Mandanten) im Tagesgeschäft |

Im Ist-System existieren bereits **Admin-Funktionen** (Mandanten-Onboarding ✅, Plattform-Angebote ✅). Gleichzeitig ist das **operative Handwerksmodell** (Kunden, Objekte, Vorgänge) dokumentiert (ADR-0013, Fachkonzept 10), aber **noch nicht implementiert**.

Ohne verbindliche Grenzen besteht das Risiko, Admin-Tabellen (`organizations`, `angebote`, …) für operative Handwerksdaten umzudeuten oder fachlich ähnliche Namen (`customers` vs. `kunden`, `angebote` vs. Endkundenangebote) zu vermischen.

**Live-Ergebnis `public.customers` (2026-07-26):** Tabelle existiert, **0 Zeilen**, **0 Codeverwendungen**, eingebettete Adressfelder, kein vollständiges Zielmodell — **nicht weiterentwickeln**; operative Domäne nutzt **`kunden`** (neu). `customers` bleibt vorerst unangetastet, spätere Deprecation/Löschung in separater Migration; **kein Backfill** erforderlich.

---

## Entscheidung

Die **SaaS-Administration** und die **operative Kundenplattform** werden **strikt getrennt** — fachlich, technisch (Tabellen/Prozesse) und im Routing. Sie teilen **nur domänenneutrale Infrastruktur**.

**Bestehende `/admin`-Funktionen bleiben unverändert.** Bestehende Plattform-Tabellen (`organizations`, `angebote`, `angebot_versionen`, `angebot_positionen`, …) bleiben **ausschließlich** der SaaS-Administration zugeordnet.

Die operative Kundenplattform erhält **eigene Tabellen**, **eigene Geschäftsprozesse** und **eindeutige Namenskonventionen** — ohne Uminterpretation oder Wiederverwendung bestehender Admin-Fachtabellen.

---

## Fachliche Grenzen

### SaaS-Administration (`/admin`)

**Zweck:** Verwaltung von KMU Flow AI und **seinen eigenen Kunden** (Handwerksbetriebe als SaaS-Mandanten).

**Gehört dazu (Ist und Ziel):**

- `organizations` — SaaS-Mandanten
- Mandantenverwaltung und Onboarding
- Plattform-Produkte und Plattformmodule
- SaaS-Lizenzen (`organization_modules`)
- SaaS-Abonnements (geplant)
- Plattform-Angebote (`angebote`, `angebot_versionen`, `angebot_positionen`) — Angebote **von KMU Flow AI an Mandanten**
- spätere SaaS-Rechnungen
- Einrichtung, Schulung, Datenmigration (Vertrieb/Dienstleistung)
- interne Administration von KMU Flow AI

### Operative Kundenplattform (`/`)

**Zweck:** Arbeitsplattform des **jeweiligen Handwerksbetriebs** (Mandant) im Tagesgeschäft.

**Gehört künftig dazu (Ziel — noch nicht implementiert):**

- `kunden`, `adressen`, `gebaeude`, `einheiten`, `kunden_objekt_beziehungen`
- `vorgaenge`, `vorgang_beteiligte`
- operative Anfragen, Besichtigungen, Endkundenangebote
- Projekte, Baustellen, Mitarbeiter, Material, Arbeitszeiten
- operative Rechnungen, Zahlungen, Mahnwesen

**Adressen/Gebäude (ADR-0015):** Operative `adressen` sind **mandantenbezogen** (`mandant_id`); **`adressen` 1:n `gebaeude`**. Keine globale Adresstabelle, keine mandantenübergreifende Dublettensuche.

**Alle operativen Daten** sind mandantenscharf einem `organizations`-Datensatz zugeordnet (`mandant_id`), ohne diesen Datensatz fachlich zum Endkunden zu machen.

---

## Technische Grenzen

| Aspekt | SaaS-Administration | Operative Kundenplattform |
| --- | --- | --- |
| Route | `/admin/**` | `/`, `/dashboard`, `/kunden`, … (alles **außer** `/admin`) |
| Mandant | `organizations` = **SaaS-Kunde von KMU Flow AI** | `organizations.id` = **Tenant-Scope** für operative Daten |
| Endkunde | **Nicht** in `organizations` | **`kunden`** (Ziel) |
| Angebote | `angebote` → Mandant | **Eigene Entität** (z. B. `operative_angebote`, `kunden_angebote`) |
| Rechnungen | SaaS-Rechnungen (geplant) | **Eigene Entität** (z. B. `operative_rechnungen`) |
| Produkte/Leistungen | Plattform-Produkte / Pakete | **Unternehmensleistungen** des Handwerksbetriebs |
| Berechtigungen | Admin-Rollen, Plattform-Login | Operative Rollen (Handwerker, Büro, …) |
| Nummernkreise | z. B. `angebotsnummer_sequenzen` (Plattform) | **Eigene Sequenzen** — keine gemeinsame Nutzung |
| Statuslogik | Plattform-Angebotsstatus (Entwurf, Freigabe, …) | **Eigene** operative Statusmodelle |

**Verboten:**

- gemeinsame **operative Fachtabellen**
- gemeinsame **Nummernsequenzen** über Domänengrenzen
- gemeinsame **Fachstatuslogik** (z. B. Plattform-Freigabe = operatives Angebot freigegeben)
- gemeinsame **Angebots- oder Rechnungsentität** für Admin und Handwerk

---

## Tabellen- und Namensregeln

### Bestehende Admin-Tabellen

**Behalten ihre Namen** und bleiben der SaaS-Administration zugeordnet, u. a.:

- `organizations`
- `angebote`, `angebot_versionen`, `angebot_positionen`, `angebotsnummer_sequenzen`
- `ansprechpartner`, `bankverbindungen`, `organization_modules`, `organization_automatisierungen`
- `leistungsmodule` (Zwischenlösung Plattform-Katalog)

### Neue operative Tabellen

**Eindeutige Namen** — Domäne muss am Namen oder Schema erkennbar sein.

| Admin (bestehend) | Operativ (Ziel, Beispiele) |
| --- | --- |
| `organizations` (Mandant) | **`kunden`** (Endkunde) — **nicht** `organizations` |
| `angebote` | **`operative_angebote`** oder **`kunden_angebote`** |
| `rechnungen` (geplant, SaaS) | **`operative_rechnungen`** oder **`kunden_rechnungen`** |
| Plattform-Produkte | **`unternehmensleistungen`** (Handwerks-Kalkulation) |
| `organization_members` (Plattform-Login) | ggf. **`operative_mitarbeiter`** — nur wenn fachlich getrennt nötig |

**Noch keine endgültigen Namen** für alle künftigen operativen Tabellen festlegen — aber **Domänentrennung am Namen** ist verbindlich.

### Legacy: `public.customers`

| Aspekt | Stand |
| --- | --- |
| Existenz | **Ja** (Live) |
| Datensätze | **0** |
| Codeverwendung | **0** |
| Adressfelder | eingebettet (`street`, `postal_code`, `city`, `country`) — kein Zielmodell |
| Entscheidung | **Nicht weiterentwickeln** |
| Operatives Modell | **`kunden`** (neu) |
| Übergang | `customers` **vorerst unangetastet**; Deprecation/Löschung **separate Migration** |
| Backfill | **Nicht erforderlich** |

Details: [`docs/fachkonzept/11-analyse-bestehende-endkundenstruktur.md`](../fachkonzept/11-analyse-bestehende-endkundenstruktur.md)

---

## Routing-Regeln

| Regel | Beschreibung |
| --- | --- |
| **`/admin/**`** | Ausschließlich SaaS-Administration — bestehender Stand **unverändert** |
| **`/** außer `/admin`** | Operative Kundenplattform (Ist: teils Platzhalter; Ziel: Handwerks-Tagesgeschäft) |
| **Server Actions / Queries** | Admin und Operativ **dürfen nicht stillschweigend dieselben** Fach-Actions oder DB-Queries teilen |
| **UI-Bausteine** | Gemeinsame Komponenten (Buttons, Layout, Formularfelder) **erlaubt** |
| **Fachlogik** | Nur **domänenneutral** (Formatierung, Validierung, Auth-Helpers) — keine gemischten Angebots-/Kunden-Services |

---

## Fachliche Trennregeln (verbindlich)

1. Ein **`organization`-Datensatz** ist **niemals** ein Endkunde des Handwerksbetriebs.
2. Ein **`kunden`-Datensatz** ist **niemals** ein SaaS-Mandant.
3. Ein **Plattform-Angebot** (`angebote`) ist **niemals** ein Endkundenangebot.
4. Eine **Plattform-Rechnung** ist **niemals** eine Handwerker-Rechnung.
5. **Admin-Produkte** (Pakete, Plattformmodule) und **operative Unternehmensleistungen** sind unterschiedliche Domänen.
6. **SaaS-Lizenzen** und **operative Mitarbeiter-/Kundenberechtigungen** sind unterschiedliche Domänen.
7. **Bestehende Admin-Daten** dürfen **nicht** in operative Tabellen umgedeutet werden.
8. **Operative Daten** müssen **immer mandantenscharf** einem `organization`-Datensatz zugeordnet sein.
9. Tabellen dürfen **nicht** nur deshalb gemeinsam verwendet werden, weil sie fachlich ähnlich heißen.

---

## Gemeinsame Infrastruktur (erlaubt)

Folgende technische Schichten **dürfen gemeinsam** genutzt werden:

| Infrastruktur | Anmerkung |
| --- | --- |
| Supabase (PostgreSQL, Auth, Storage, RLS-Mechanismus) | **Eine** Datenbank-Instanz — **getrennte Fachschemas/Tabellen** |
| Authentifizierung | Gemeinsamer IdP; **getrennte Rollenmodelle** pro Domäne |
| Rollen- und Rechte-Framework | Gemeinsame Mechanik; **getrennte Policies** |
| Dateispeicher | Gemeinsamer Bucket/Storage; **getrennte Pfade/Policies** |
| Benachrichtigungsinfrastruktur | Domänenneutraler Versand |
| Kommunikationsadapter (E-Mail, WhatsApp, …) | Domänenneutral |
| KI-Infrastruktur | Domänenneutral; **Kontext aus jeweiliger Domäne** |
| Logging, Audit | Gemeinsam; mit Domänen-Kontext |
| Gemeinsame UI-Komponenten | Präsentationsschicht — keine Fachtabellen |

**Nicht erlaubt** trotz gemeinsamer Infrastruktur: gemeinsame operative Fachtabelle, Nummernsequenz, Fachstatuslogik, Angebots- oder Rechnungsentität.

---

## Konsequenzen

| Bereich | Konsequenz |
| --- | --- |
| **`/admin`** | Unverändert weiterentwickeln (Mandanten, Plattform-Angebote, Produktmanagement) |
| **`/` (operativ)** | Neue Features nur gegen **operative Tabellen** und Prozesse |
| **`organizations`** | Bleibt SaaS-Mandant; dient operativ nur als **`mandant_id`-Scope** |
| **`angebote`** | Bleiben Plattform-Angebote; operative Angebote **neue Entität** |
| **`customers`** | Unangetastet; **`kunden`** für operatives Modell; Deprecation später |
| **Dokumentation** | Ist vs. Ziel in allen Docs klar trennen |
| **Code-Reviews** | Queries/Actions auf Domänenzugehörigkeit prüfen |

---

## Risiken

| Risiko | Schwere | Mitigation |
| --- | --- | --- |
| Stille Wiederverwendung von `angebote`/`organizations` in operativer UI | Hoch | ADR-0014 + Code-Review; eigene Tabellennamen |
| Namensverwechslung (`customers`/`kunden`, `angebote`/Endkundenangebot) | Hoch | Namensregeln; Linting/Dokumentation |
| Gemeinsame DB suggeriert gemeinsame Domäne | Mittel | Dieses ADR; Schema-Präfixe / eindeutige Namen |
| `customers`-Tabelle wird doch noch befüllt | Niedrig | Kein UI/Code; später deprecate |
| Doppelte Implementierung domänenneutraler Logik | Niedrig | Shared libs nur für echte Neutralität |

---

## Migrationsfolgen

| Phase | Folge |
| --- | --- |
| **Jetzt** | Nur Dokumentation — **keine Schema-Änderung** |
| **Erste operative Migration** | Neue Tabellen (`kunden`, `adressen`, …) — **parallel** zu Admin-Tabellen |
| **`customers`** | **Nicht** in erster Migration anfassen; Backfill **entfällt** (0 Zeilen) |
| **`organizations` / `angebote`** | **Keine** ALTER an bestehenden Admin-Tabellen für operative Features |
| **Später** | Separate Migration: `customers` deprecate oder DROP |
| **Plattform-Angebote** | `organization_id` und Snapshots **bleiben** unverändert |

---

## Nicht Bestandteil dieser Entscheidung

- SQL-DDL, Migrationsskripte, RLS-Policies
- Konkrete endgültige Namen aller operativen Tabellen (außer Prinzipien)
- UI-Implementierung operativer Routen
- Auth-Flow zwischen Admin und Mandantenportal im Detail
- Deprecation-Zeitpunkt von `customers`
- Verknüpfung operatives Angebot ↔ Plattform-Angebot (falls überhaupt nötig)

---

## Verweise

| Dokument | Inhalt |
| --- | --- |
| [`docs/fachkonzept/10-technisches-kunden-und-objektmodell.md`](../fachkonzept/10-technisches-kunden-und-objektmodell.md) | Operatives Zielmodell |
| [`docs/fachkonzept/11-analyse-bestehende-endkundenstruktur.md`](../fachkonzept/11-analyse-bestehende-endkundenstruktur.md) | Live-Analyse `customers` |
| [`docs/angebote-datenmodell.md`](../angebote-datenmodell.md) | Ist Plattform-Angebote |
| ADR-0013 | Technisches Kunden-/Objekt-/Vorgangsmodell |
| ADR-0015 | Mandantenbezogene Adressen; mehrere Gebäude pro Adresse (O2/O3) |
| ADR-0016 | Gebäudearten, Einheiten, Archivierung, RLS, Normalisierung |
