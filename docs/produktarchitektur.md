# Produktarchitektur — Plattformmodule, Produkte und Mandantenlizenzierung

Diese Dokumentation beschreibt das **Ziel-Produktmodell** von KMU Flow AI: die fachliche Trennung zwischen **Plattformfunktionen** (Lizenzierung) und **verkaufbaren Produkten** (Angebote, Rechnungen). Sie ist die Architektur-Referenz für alle künftigen Schema-, RPC- und UI-Arbeiten in diesem Bereich.

**Status:** Verbindliche Architekturreferenz — Phase 0 (fachliche Katalogdefinition) teilweise abgeschlossen; **noch keine Migration, kein SQL, keine RPC, keine UI**  
**Bezug:** [`docs/systemarchitektur.md`](./systemarchitektur.md), [`docs/roadmap.md`](./roadmap.md), [`docs/adr/`](./adr/), [`docs/plattformmodule-katalog.md`](./plattformmodule-katalog.md), [`docs/produktkatalog-fachlich.md`](./produktkatalog-fachlich.md), [`docs/produktkonzept.md`](./produktkonzept.md), [`docs/angebote-modulkatalog.md`](./angebote-modulkatalog.md), [`docs/module-zusammenfuehrung-mapping.md`](./module-zusammenfuehrung-mapping.md), [`docs/angebote-datenmodell.md`](./angebote-datenmodell.md)

---

## Verbindliche Architekturentscheidungen

Die folgenden Regeln sind **verbindlich** für alle künftige Entwicklung. Details in [`docs/adr/`](./adr/).

### Produkte

| Produkttyp | Beschreibung | Plattformmodule |
| --- | --- | --- |
| **Paket** | Software-Bundle mit definiertem Funktionsumfang | Ja — über Paketbestandteile |
| **Dienstleistung** | Beratungs-, Einrichtungs- oder Umsetzungsleistung | Nein |

Produkte tragen **Preis**, **Preisart**, **Beschreibung** und erscheinen als **Angebots- und Rechnungspositionen**.

### Plattformmodule (verbindlicher Katalog)

| Name | technischer_schluessel | Verkauf |
| --- | --- | --- |
| CRM | `crm` | nein |
| Angebote | `angebote` | nein |
| Rechnungen | `rechnungen` | nein |
| Dokumente | `dokumente` | nein |
| KI-Assistent | `ki_assistent` | nein |
| Automatisierungen | `automatisierungen` | nein |

Vollständige Stammdaten: [`docs/plattformmodule-katalog.md`](./plattformmodule-katalog.md). **Keine Preise. Keine Angebotspositionen.**

### Paketbestandteile

| Regel | Beschreibung |
| --- | --- |
| **Produkt enthält Plattformmodule** | Nur bei `produkttyp = paket` über `produkt_plattformmodule` |
| **Dienstleistungen enthalten keine Plattformmodule** | Kein Eintrag in `produkt_plattformmodule` |
| **Lizenzwirkung** | Nur Paket-Positionen in angenommenen Angeboten aktivieren Plattformmodule |

### Redundanzregel (Angebote, V1)

**Ein Paket darf nicht ausgewählt werden**, wenn **alle** seine enthaltenen Plattformmodule bereits durch die **übrigen ausgewählten Pakete** derselben Angebotsversion abgedeckt sind.

- Es ist **keine identische Modulmenge** erforderlich — Teilmengen genügen für Redundanz.
- **Teilüberschneidungen** zwischen Paketen bleiben in **V1 erlaubt** (z. B. Basispaket + KI-Paket).
- Dienstleistungen werden bei der Prüfung **nicht** berücksichtigt.

### Preisregeln

| Regel | Beschreibung |
| --- | --- |
| **Preise nur auf Produktebene** | Listenpreis, Preisart, Einheit, Umsatzsteuer am Produkt |
| **Keine Preise auf Plattformmodulen** | Plattformmodule haben keinen `einzelpreis_netto_cents` |
| **Keine 0-Cent-Platzhalter** | Seed und Migration erst nach fachlicher Preisfreigabe |
| **Getrennte Summen** | Einmalige und monatliche Positionen getrennt aggregieren |

### Snapshot- und Lizenzregeln

| Regel | ADR |
| --- | --- |
| Angebote/Rechnungen snapshotten Produktdaten | [ADR-0002](./adr/ADR-0002-snapshot-prinzip.md) |
| Lizenzen aus Paket-Produkten, nicht aus Onboarding-Checkboxen | [ADR-0003](./adr/ADR-0003-lizenzmodell.md) |
| Produkt-Versionierung später vorgesehen | [ADR-0004](./adr/ADR-0004-produkt-versionierung.md) |

---

## Einordnung zum bestehenden Schema

In der Datenbank existiert bereits die Zwischenlösung **`leistungsmodule`** (Migration `20260717270000_angebots_modulkatalog.sql`) mit Anbindung an `angebot_positionen.leistungsmodul_id`. Das Zielmodell in diesem Dokument **ersetzt** die bisherige Idee eines einheitlichen Modulstamms mit `modultyp` durch **zwei getrennte Entitäten**:

| Bisher (Zwischenlösung) | Ziel (dieses Dokument) |
| --- | --- |
| `leistungsmodule` mit `modultyp = plattform` | `plattformmodule` |
| `leistungsmodule` mit `modultyp = leistung` / `beides` | `produkte` |
| implizite Zuordnung über `modultyp` | explizite Zuordnung über `produkt_plattformmodule` |
| `organization_modules.leistungsmodul_id` | `organization_modules.plattformmodul_id` |
| `angebot_positionen.leistungsmodul_id` | `angebot_positionen.produkt_id` |

Die Übergangs-Migration von `leistungsmodule` auf das Zielmodell wird **separat** geplant; dieses Dokument definiert nur das Ziel.

### Zwischenlösung `leistungsmodule` (Ist)

| Regel | Beschreibung |
| --- | --- |
| **Abgelöst** | `leistungsmodule` wird durch `plattformmodule` + `produkte` ersetzt |
| **Keine neue Admin-UI** | Keine weiteren Features auf `leistungsmodule` aufbauen |
| **Daten erhalten** | Bestehende Zeilen und `angebot_positionen.leistungsmodul_id` bleiben bis zur Angebotsmigration unverändert |
| **Spätere Zuordnung** | `angebot_positionen.leistungsmodul_id` → `angebot_positionen.produkt_id` (separate Migrations-Doku) |
| **Dokumentation** | [`docs/angebote-modulkatalog.md`](./angebote-modulkatalog.md) beschreibt die Zwischenlösung; Ziel ist dieses Dokument |

---

## Architektur-Überblick

```
plattformmodule (Funktions-/Lizenzstamm)
    │
    ├── 1:n  organization_modules.plattformmodul_id   (Mandantenlizenz)
    │
    └── n:m  produkt_plattformmodule                  (Bestandteil von Paketen)
                    │
                    └── n:1  produkte
                                  │
                                  ├── 1:n  angebot_positionen.produkt_id
                                  └── 1:n  rechnung_positionen.produkt_id  (später)
```

**Kernprinzip:** Plattformmodule sind **technische Funktionseinheiten** der Software. Produkte sind **Verkaufseinheiten**. Mandanten erhalten Plattformfunktionen **ausschließlich** über gekaufte Produkte — nicht durch direkte Modulauswahl im Onboarding.

---

## 1. Plattformmodule

### Zweck

Plattformmodule beschreiben **Funktionsbereiche der Software**, die ein Mandant nutzen darf, wenn die entsprechende Lizenz aktiv ist. Sie sind der **technische und lizenzrechtliche Anker** für Feature-Gates, Navigation und Berechtigungen im Kundenportal.

Plattformmodule sind **keine Verkaufseinheiten**. Sie haben **keinen Listenpreis** und erscheinen **nicht** in Angebots- oder Rechnungspositionen.

### Merkmale

| Merkmal | Beschreibung |
| --- | --- |
| Stabilität | `technischer_schluessel` ist nach Go-Live unveränderlich (Feature-Gates, Code) |
| Kein Preis | Kein `einzelpreis_netto_cents`; Preis liegt beim **Produkt** |
| Lizenzierung | Nur über `organization_modules` referenzierbar |
| Aktivierung | Nur indirekt — über gekaufte **Paket-Produkte** (siehe Abschnitt 5) |

**Verbindlicher Katalog (Phase 0):** [`docs/plattformmodule-katalog.md`](./plattformmodule-katalog.md) — sechs Module mit `code`, `technischer_schluessel`, `name`, `beschreibung`, `aktiv`, `sortierung`. **Keine Verkaufspreise.**

Diese sechs Module entsprechen den bisherigen Freitextwerten aus dem Mandanten-Onboarding (`MODULE_OPTIONS`). Im Zielmodell werden sie **Stammdaten in `plattformmodule`**, nicht mehr manuell auswählbare Checkboxen.

### Abgrenzung

| Plattformmodul | Kein Plattformmodul |
| --- | --- |
| Software-Funktion mit Feature-Gate | Verkaufbares Beratungspaket |
| Lizenz über `organization_modules` | Position in Angebot/Rechnung |
| Kein eigener Listenpreis | Preis über `produkte` |

---

## 2. Produkte

### Zweck

Produkte sind **verkaufbare Einheiten** — alles, was in Angeboten und Rechnungen als Position erscheint. Sie bündeln fachliche Leistungen und (bei Paketen) die enthaltenen Plattformfunktionen zu einem Angebot für den Kunden.

### Produktarten

| Art | `produkttyp` | Beschreibung | Plattformmodule |
| --- | --- | --- | --- |
| **Paket** | `paket` | Software-Bundle mit definiertem Funktionsumfang | Ja — über `produkt_plattformmodule` |
| **Dienstleistung** | `dienstleistung` | Beratungs-, Analyse- oder Umsetzungsleistung | Nein — aktiviert keine Plattformmodule |

**Fachlicher Produktkatalog (Phase 0):** [`docs/produktkatalog-fachlich.md`](./produktkatalog-fachlich.md) — Kandidaten und Freigabe-Checkliste; noch keine Seed-Daten.

### Preisarten

Jedes Produkt hat genau **eine** Preisart:

| Preisart | Bedeutung (V1) |
| --- | --- |
| `einmalig` | Einmaliger Festpreis |
| `monatlich` | Monatlicher Festpreis — **immer pro Monat**; keine Quartals-/Jahresintervalle in V1 |

Weitere Felder (konzeptionell): Listenpreis netto in Cent, Einheit, Umsatzsteuer-Satz, Name, Beschreibung, Code, `aktiv`, `sortierung`.

**Regel:** Keine Platzhalterpreise (0 Cent). Seed und Migration erst nach fachlicher Preisfreigabe aller erforderlichen Produkte.

### Produktkandidaten (Phase 0, ohne Preise)

Siehe [`docs/produktkatalog-fachlich.md`](./produktkatalog-fachlich.md). Kurzüberblick:

| Typ | Kandidaten |
| --- | --- |
| Pakete | Basispaket, KI-Paket, Enterprise-Paket |
| Dienstleistungen | Einrichtung, Schulung, Datenmigration, Individuelle Entwicklung |

Preise, Preisarten und Paketbestandteile sind **noch festzulegen** — keine erfundenen Werte.

### Angebots- und Rechnungspositionen

Angebots- und Rechnungspositionen referenzieren **`produkt_id`** und speichern einen **Snapshot** der Produktwerte zum Zeitpunkt der Positionsanlage:

| Snapshot-Feld | Quelle |
| --- | --- |
| `bezeichnung` | `produkte.name` |
| `beschreibung` | `produkte.beschreibung` |
| `einzelpreis_netto_cents` | `produkte.einzelpreis_netto_cents` |
| `einheit` | `produkte.einheit` |
| `umsatzsteuer_satz` | `produkte.umsatzsteuer_satz` |
| `preisart` | `produkte.preisart` |
| `produkttyp` | `produkte.produkttyp` (Paket / Dienstleistung) |

**Editierbarkeit in Entwürfen:** Nur `rabatt_prozent` (0–100 %); Menge immer `1` in V1. Katalogänderungen wirken **nicht rückwirkend** auf bestehende Positionen.

**Summen:** Einmalige und monatliche Positionen werden **getrennt** aggregiert; keine gemeinsame Mischsumme.

---

## 3. Produktbestandteile

### Zweck

`produkt_plattformmodule` definiert, **welche Plattformmodule ein Paket-Produkt freischaltet**. Dienstleistungs-Produkte haben **keine** Einträge in dieser Zuordnungstabelle.

### Zuordnung Produkt → Plattformmodule

| Regel | Beschreibung |
| --- | --- |
| Nur Pakete | `produkt_plattformmodule` existiert nur für `produkttyp = paket` |
| n:m | Ein Paket kann mehrere Plattformmodule enthalten; ein Plattformmodul kann in mehreren Paketen vorkommen |
| Keine Duplikate | `(produkt_id, plattformmodul_id)` ist eindeutig |
| Keine Preise | Die Zuordnung enthält keine Preisinformation — Preis liegt beim Produkt |

### Paketbestandteile (Phase 0)

Voraussichtliche Zuordnungen für Basispaket, KI-Paket und Enterprise-Paket sind in [`docs/produktkatalog-fachlich.md`](./produktkatalog-fachlich.md) dokumentiert — überwiegend mit Status **offen**, bis fachlich freigegeben.

### Auswirkung auf Lizenzierung

Wenn ein Mandant ein Paket-Produkt über ein angenommenes Angebot erwirbt, werden beim Lizenz-Aktivierungsschritt **alle zugeordneten Plattformmodule** in `organization_modules` angelegt oder aktualisiert (siehe Abschnitt 4).

Mehrere Pakete im selben Angebot **vereinigen** ihre Plattformmodule (Vereinigungsmenge). Doppelte Module werden nicht doppelt lizenziert.

---

## 4. Mandantenlizenzierung

### Grundsatz

`organization_modules` ist die **Laufzeit-Lizenzierung** eines Plattformmoduls für einen Mandanten. Sie speichert **keine** Namen, Beschreibungen oder Preise — nur den Lizenzstatus und mandantenspezifische Konfiguration.

Plattformmodule werden **ausschließlich aus gekauften Paket-Produkten** aktiviert. Eine direkte manuelle Modulauswahl im Onboarding (wie heute über Checkboxen) entfällt im Zielmodell.

### Onboarding — Ziel vs. Ist

| Aspekt | Ist (unverändert) | Ziel |
| --- | --- | --- |
| Modulauswahl | Checkboxen über `MODULE_OPTIONS` → Freitext in `organization_modules.modul` | **Keine** direkte Auswahl einzelner Plattformmodule |
| Lizenzentstehung | Beim Onboarding sofort freie `organization_modules`-Zeilen | Lizenzen entstehen **später** aus angenommenen **Paket-Produkten** (Angebot → Vertrag → Aktivierung) |
| Dienstleistungen | Nicht modelliert | Werden als Angebotspositionen gebucht; **keine** Lizenzwirkung |
| Anwendungscode | `mandanten-onboarding-context.tsx`, `create_mandant_onboarding` | **Noch nicht ändern** — Umstellung in Phase 4 |

Das bestehende Onboarding bleibt bis Phase 4 produktiv unverändert. Die Zielarchitektur gilt ab Lizenz-RPC und Onboarding-Anpassung.

### Ablauf nach Vertragsannahme

```
Angebot angenommen
    │
    ▼
Vertrag geschlossen (Referenz: angenommene Angebotsversion)
    │
    ▼
Mandanten-Onboarding / Lizenz-Aktivierung
    │
    ├── Alle Paket-Positionen der angenommenen Version ermitteln
    │       └── über produkt_id → produkt_plattformmodule → plattformmodul_id
    │
    ├── Vereinigungsmenge der Plattformmodule bilden
    │
    └── Für jedes Plattformmodul in organization_modules:
            ├── INSERT (neu) oder UPDATE (bestehend)
            ├── plattformmodul_id setzen
            ├── lizenz_status = 'aktiv' (oder 'geplant' bei verzögerter Aktivierung)
            ├── aktiviert_am = now()
            └── konfiguration = {} (oder mandantenspezifische Defaults)
    │
    ▼
Feature-Gates im Kundenportal prüfen:
    organization_modules.lizenz_status = 'aktiv'
    AND plattformmodule.technischer_schluessel
```

**Dienstleistungs-Positionen** lösen **keine** Plattform-Lizenzierung aus.

### Nutzung von `organization_modules`

| Spalte | Beschreibung |
| --- | --- |
| `id` | Primärschlüssel |
| `organization_id` | FK → `organizations.id` |
| `plattformmodul_id` | FK → `plattformmodule.id` |
| `lizenz_status` | `geplant` \| `aktiv` \| `pausiert` \| `gekündigt` |
| `aktiviert_am` | Zeitpunkt der Aktivierung (nullable bei `geplant`) |
| `deaktiviert_am` | Zeitpunkt der Deaktivierung/Kündigung (nullable) |
| `konfiguration` | `jsonb` nullable — mandantenspezifische Einstellungen |

**Constraint:** `UNIQUE (organization_id, plattformmodul_id)`

### `lizenz_status`-Semantik

| Status | Bedeutung |
| --- | --- |
| `geplant` | Lizenz vorgemerkt, Funktion noch nicht nutzbar |
| `aktiv` | Mandant darf Funktion nutzen |
| `pausiert` | Temporär gesperrt; Zuordnung bleibt erhalten |
| `gekündigt` | Beendet; `deaktiviert_am` gesetzt; Feature-Gate sperrt Zugriff |

### Lebenszyklus-Events

| Event | Auswirkung auf `organization_modules` |
| --- | --- |
| Paket-Produkt neu gebucht | Betroffene Module → `aktiv`, `aktiviert_am` |
| Paket gekündigt / Produkt entfernt | Betroffene Module → `gekündigt`, `deaktiviert_am` (nur wenn kein anderes aktives Paket dasselbe Modul enthält) |
| Upgrade (größeres Paket) | Zusätzliche Module → `aktiv`; bestehende bleiben |
| Downgrade | Module, die im neuen Paket fehlen und nicht durch anderes Paket abgedeckt → `gekündigt` |
| Manuelle Sperre (Support) | `pausiert` |

Org-Gesamtpreise auf Mandantenebene (`organizations.monatlicher_grundpreis`, Rabatt) bleiben vorerst **parallel** zum Produktmodell und werden in einer späteren Phase harmonisiert.

---

## 5. Fachliche Regeln

### 5.1 Angebotszusammenstellung

| Regel | Beschreibung |
| --- | --- |
| **Mehrere Produkte pro Angebot** | Ein Angebot darf beliebig viele Produktpositionen enthalten — mehrere Pakete und Dienstleistungen gleichzeitig |
| **Dienstleistungen immer zusätzlich** | Dienstleistungs-Produkte sind unabhängig von Paketen wählbar und können jedem Angebot hinzugefügt werden |
| **Mindestens eine Position** | Jede speicherbare Angebotsversion hat ≥ 1 Position |
| **Ein Produkt pro Version** | Dieselbe `produkt_id` höchstens **einmal** pro `angebot_version_id` |
| **Nur aktive Produkte** | Neue Positionen nur aus `produkte WHERE aktiv = true` |

### 5.2 Redundante Pakete in einem Angebot verhindern

**Definition:** Ein Paket ist **vollständig redundant**, wenn **alle** seine enthaltenen Plattformmodule bereits durch die **übrigen ausgewählten Pakete** derselben Angebotsversion abgedeckt sind.

Es ist **keine identische Modulmenge** erforderlich — ein Paket kann eine **Teilmenge** der Vereinigungsmenge anderer Pakete sein und gilt dann als redundant.

**Teilüberschneidungen** zwischen Paketen sind in **V1 erlaubt** (z. B. Basispaket + KI-Paket), solange kein Paket vollständig redundant ist.

| Regel | Beschreibung |
| --- | --- |
| **Prüfebene** | Pro **Angebotsversion** bei Speichern/Freigeben — nicht pauschal im Produktkatalog |
| **Algorithmus (fachlich)** | Für jedes Paket P: Menge(P) ⊆ Vereinigung(Menge(Q) für alle anderen Pakete Q) → P redundant → Fehler oder Warnung |
| **Teilüberschneidung** | Erlaubt — z. B. {CRM, Dokumente} + {KI-Assistent, CRM} ist **nicht** redundant |
| **Identische Menge** | Zwei Pakete mit exakt gleicher Modulmenge im Katalog sind unzweckmäßig, aber die **Angebotsregel** prüft die Auswahl, nicht die Katalogidentität |
| **Dienstleistungen** | Werden bei der Redundanzprüfung **nicht** berücksichtigt (aktivieren keine Module) |

**Beispiele (Modulmengen pro Angebot):**

| Ausgewählte Pakete | Redundant? | Begründung |
| --- | --- | --- |
| Basispaket {CRM, Dokumente} + KI-Paket {KI-Assistent} | Nein | KI-Assistent nicht durch Basispaket abgedeckt |
| Enterprise {alle 6} + Basispaket {CRM, Dokumente} | **Ja** (Basispaket) | Alle Module des Basispakets ⊆ Enterprise |
| Paket A {CRM} + Paket B {Angebote} | Nein | Keine vollständige Abdeckung eines Pakets durch das andere |
| Zwei Pakete mit identischer Menge {CRM, Dokumente} | **Ja** (eines von beiden) | Zweites Paket adds keine neuen Module |

### 5.3 Rechnungen

| Regel | Beschreibung |
| --- | --- |
| **Positionen aus Angebot übernehmen** | Rechnungen werden aus der angenommenen Angebotsversion erzeugt; Positionen inkl. Snapshots werden kopiert |
| **Kein direkter Katalogzugriff** | Rechnungspositionen referenzieren `produkt_id` zum Snapshot-Zeitpunkt; nachträgliche Katalogänderungen wirken nicht rückwirkend |
| **Getrennte Summen** | Einmalige und monatliche Positionen getrennt aggregieren |

### 5.4 Lizenzierung

| Regel | Beschreibung |
| --- | --- |
| **Nur über Produkte** | Plattformmodule werden **ausschließlich** aus gekauften Paket-Produkten aktiviert |
| **Keine direkte Modulauswahl** | Onboarding wählt keine Plattformmodule manuell; die Lizenz ergibt sich aus den Angebotspositionen |
| **Vereinigungsmenge** | Mehrere Pakete im Angebot → Vereinigung aller enthaltenen Plattformmodule |
| **Dienstleistungen ≠ Lizenz** | Dienstleistungs-Produkte aktivieren keine Plattformmodule |
| **Kein Hard-Delete** | Plattformmodule und Produkte mit Verwendung nur deaktivieren (`aktiv = false`) |

### 5.5 Snapshots und Historie

| Regel | Beschreibung |
| --- | --- |
| **Nicht rückwirkend** | Katalogänderungen verändern keine bestehenden Angebots-/Rechnungspositionen |
| **Eingefrorene Versionen** | Freigegebene/angenommene Angebotsversionen: keine Positionsänderungen |
| **Legacy** | Bestehende Freitext-Positionen ohne `produkt_id` bleiben gültige historische Snapshots |

---

## 6. Geplante Datenbanktabellen

Konzeptionelle Beschreibung — **ohne SQL**. Spaltennamen und Constraints dienen als Zielvorgabe für spätere Migrationen.

### 6.1 `plattformmodule`

**Zweck:** Stamm der Software-Funktionen; Lizenz-Anker; kein Verkauf.

| Feld | Beschreibung |
| --- | --- |
| `id` | Primärschlüssel (uuid) |
| `code` | Global eindeutiger fachlicher Code |
| `technischer_schluessel` | Stabiler App-Schlüssel (z. B. `crm`) — UNIQUE |
| `name` | Anzeigename |
| `beschreibung` | Ausführliche Beschreibung (nullable) |
| `aktiv` | Steuert, ob das Modul in neuen Paket-Zuordnungen wählbar ist |
| `sortierung` | Reihenfolge in Admin-UI |
| `created_at`, `updated_at` | Zeitstempel |

**Kein Preis, keine Preisart, kein `produktart`.**

### 6.2 `produkte`

**Zweck:** Verkaufbare Einheiten für Angebote und Rechnungen.

| Feld | Beschreibung |
| --- | --- |
| `id` | Primärschlüssel (uuid) |
| `code` | Global eindeutiger fachlicher Code — UNIQUE |
| `name` | Anzeigename |
| `beschreibung` | Ausführliche Beschreibung (nullable) |
| `produkttyp` | `paket` \| `dienstleistung` |
| `einzelpreis_netto_cents` | Listenpreis netto in Cent; ≥ 0; **Pflicht vor Seed** |
| `einheit` | Mengeneinheit (z. B. `Stk.`, `Monat`) |
| `umsatzsteuer_satz` | `0`, `7` oder `19` |
| `preisart` | `einmalig` \| `monatlich` |
| `aktiv` | Steuert Auswählbarkeit in Angeboten |
| `sortierung` | Reihenfolge in Auswahllisten |
| `created_at`, `updated_at` | Zeitstempel |

**Regel:** Paket-Produkte mit `produkttyp = paket` müssen ≥ 1 Eintrag in `produkt_plattformmodule` haben (sobald Paket aktiv ist).

### 6.3 `produkt_plattformmodule`

**Zweck:** n:m-Zuordnung Paket → Plattformmodule.

| Feld | Beschreibung |
| --- | --- |
| `id` | Primärschlüssel (uuid) |
| `produkt_id` | FK → `produkte.id` (nur `produkttyp = paket`) |
| `plattformmodul_id` | FK → `plattformmodule.id` |
| `created_at` | Erstellzeitpunkt |

**Constraint:** `UNIQUE (produkt_id, plattformmodul_id)`

### 6.4 `organization_modules`

**Zweck:** Mandanten-Lizenz je Plattformmodul.

| Feld | Beschreibung |
| --- | --- |
| `id` | Primärschlüssel (uuid) |
| `organization_id` | FK → `organizations.id` |
| `plattformmodul_id` | FK → `plattformmodule.id` |
| `lizenz_status` | `geplant` \| `aktiv` \| `pausiert` \| `gekündigt` |
| `aktiviert_am` | Aktivierung (nullable bei `geplant`) |
| `deaktiviert_am` | Deaktivierung (nullable) |
| `konfiguration` | `jsonb` nullable |
| `modul` | **Legacy** — Freitext aus Ist-Schema; später entfernen |

**Constraint:** `UNIQUE (organization_id, plattformmodul_id)`

### 6.5 Erweiterungen bestehender Tabellen (Ziel)

| Tabelle | Neue Spalte | Beschreibung |
| --- | --- | --- |
| `angebot_positionen` | `produkt_id` | FK → `produkte.id`; nullable in Übergang |
| `angebot_positionen` | `produkttyp` | Snapshot von `produkte.produkttyp` |
| `rechnung_positionen` (später) | `produkt_id` | FK → `produkte.id` |

Die bestehende Spalte `angebot_positionen.leistungsmodul_id` (Zwischenlösung) wird im Zielmodell durch `produkt_id` ersetzt; Übergangsregeln folgen in einer separaten Migrations-Dokumentation.

---

## 7. Migrationsreihenfolge

Empfohlene Phasen — **ohne SQL**, nur Reihenfolge und Abhängigkeiten.

```
Phase 0 — Fachliche Freigabe (Voraussetzung)  ← teilweise erledigt
  P0  Plattformmodul-Katalog festlegen (6 Module)     → docs/plattformmodule-katalog.md ✓
  P0  Produkt-Kandidaten dokumentieren               → docs/produktkatalog-fachlich.md ✓
  P0  Paket-Zuordnungen (produkt_plattformmodule)     → offen
  P0  Listenpreise aller Produkte festlegen           → offen; keine 0-Cent-Platzhalter
  P0  Fachliche Freigabe (P0-8)                       → ausstehend

Phase 1 — Plattformmodul-Stamm
  1.1  Tabelle plattformmodule anlegen
  1.2  Seed: 6 Plattformmodule (ohne Preise)

Phase 2 — Produkt-Stamm
  2.1  Tabelle produkte anlegen
  2.2  Tabelle produkt_plattformmodule anlegen
  2.3  Angebots-Redundanzprüfung (Teilmenge der übrigen Pakete) in RPC
  2.4  Seed: Produkte mit echten Preisen + Paket-Zuordnungen

Phase 3 — Angebots-Anbindung
  3.1  angebot_positionen: produkt_id, produkttyp (nullable)
  3.2  Partieller UNIQUE (angebot_version_id, produkt_id)
  3.3  RPC create_angebot / update_angebot_entwurf: Produkt-Snapshot-Logik
  3.4  RPC erstelle_neue_angebotsversion: produkt_id mitkopieren
  3.5  UI: Produktauswahl (Pakete + Dienstleistungen)

Phase 4 — Mandantenlizenzierung
  4.1  organization_modules: plattformmodul_id, lizenz_status,
       aktiviert_am, deaktiviert_am, konfiguration (modul bleibt)
  4.2  Backfill bestehender Freitext-Zuordnungen → plattformmodul_id
       (explizites Mapping, siehe module-zusammenfuehrung-mapping.md)
  4.3  RPC Lizenz-Aktivierung aus angenommenem Angebot
  4.4  Onboarding: Modul-Checkboxen entfernen; Lizenz aus Angebot ableiten
  4.5  Feature-Gates: technischer_schluessel + lizenz_status = aktiv

Phase 5 — Rechnungen (separater Schritt)
  5.1  rechnung_positionen mit produkt_id
  5.2  RPC: Rechnung aus angenommenem Angebot erzeugen

Phase 6 — Aufräumen
  6.1  leistungsmodule deprecaten / migrieren / entfernen
  6.2  angebot_positionen.leistungsmodul_id entfernen
  6.3  organization_modules.modul (Freitext) entfernen
  6.4  Dokumentation anpassen (angebote-modulkatalog.md → Verweis hierher)
```

**Abhängigkeiten:**

- Phase 2 setzt Phase 1 voraus (Pakete brauchen Plattformmodule)
- Phase 3 kann parallel zu Phase 4 beginnen, aber Lizenz-RPC (4.3) setzt Phase 3 voraus
- Phase 6 erst nach vollständigem Anwendungs-Rollout

---

## Noch manuell festzulegende Daten

Siehe [`docs/produktkatalog-fachlich.md`](./produktkatalog-fachlich.md) (Freigabe-Checkliste).

| Bereich | Offen |
| --- | --- |
| Paketbestandteile | Basispaket, KI-Paket, Enterprise-Paket — voraussichtliche Module noch nicht verbindlich |
| Preise | Alle 7 Produktkandidaten — `einzelpreis_netto_cents` noch festzulegen |
| Preisart, Einheit, MwSt. | Je Produkt noch festzulegen |
| Org-Gesamtpreis vs. Produkt-Listenpreis | Beziehung klären |
| Initialer `lizenz_status` bei Lizenz-Aktivierung | `geplant` vs. `aktiv` |
| Schema für `konfiguration` jsonb | Pro Plattformmodul |

---

## Verweise

| Dokument | Inhalt |
| --- | --- |
| [`docs/systemarchitektur.md`](./systemarchitektur.md) | Verbindliche Domänen- und Systemarchitektur |
| [`docs/roadmap.md`](./roadmap.md) | Entwicklungsphasen A–J |
| [`docs/adr/`](./adr/) | Architekturentscheidungen (ADR-0001–0004) |
| [`docs/plattformmodule-katalog.md`](./plattformmodule-katalog.md) | Verbindlicher Plattformmodul-Katalog (Phase 0) |
| [`docs/produktkatalog-fachlich.md`](./produktkatalog-fachlich.md) | Produktkandidaten und Freigabe-Checkliste (Phase 0) |
| [`docs/produktkonzept.md`](./produktkonzept.md) | Vision, Geschäftsmodell, Kundenlebenszyklus |
| [`docs/angebote-modulkatalog.md`](./angebote-modulkatalog.md) | Zwischenlösung `leistungsmodule` (wird abgelöst — keine neue UI) |
| [`docs/module-zusammenfuehrung-mapping.md`](./module-zusammenfuehrung-mapping.md) | Mapping Freitext → Plattformmodul (Backfill Phase 4.2) |
| [`docs/angebote-datenmodell.md`](./angebote-datenmodell.md) | Technisches Angebots-Schema |

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-21 | Erstversion — Ziel-Produktarchitektur |
| 2026-07-21 | Phase 0: Redundanzregel (Teilmenge), Onboarding-Ziel, Zwischenlösung, Katalog-Verweise |
| 2026-07-21 | Verbindliche Architekturentscheidungen; Verweise Systemarchitektur, ADRs, Roadmap |
