# Systemarchitektur von KMU Flow AI

Verbindliche **Domänen- und Systemarchitektur** von KMU Flow AI. Dieses Dokument ist die Grundlage für alle weiteren Entwicklungsentscheidungen — fachlich vor technisch.

**Status:** Verbindlich  
**Bezug:** [`docs/produktarchitektur.md`](./produktarchitektur.md), [`docs/roadmap.md`](./roadmap.md), [`docs/adr/`](./adr/)

---

## Ziel des Systems

KMU Flow AI ist ein **SaaS-ERP** für Beratungsunternehmen und deren Mandanten. Die Plattform bildet den **gesamten Verkaufs- und Betriebsprozess** ab — von der Produktdefinition bis zur Mandantenlizenzierung.

### Verbindlicher Geschäftsprozess

```
Produkte
  → Angebote
  → Verträge
  → Abonnements
  → Rechnungen
  → Lizenzen
```

**Nicht umgekehrt.** Lizenzen entstehen aus gekauften Produkten, nicht aus manueller Modulauswahl oder isolierter Mandantenkonfiguration.

---

## Domänenmodell

```
Produkte
    ↓
Angebote
    ↓
Verträge
    ↓
Rechnungen
    ↓
Lizenzen
```

**Plattformmodule** sind technische Funktionen der Software. Sie werden **niemals direkt verkauft** und erscheinen nicht als Angebots- oder Rechnungspositionen. Sie werden über **Paket-Produkte** und **Paketbestandteile** lizenziert.

Detaillierte Produktarchitektur: [`docs/produktarchitektur.md`](./produktarchitektur.md)

---

## Verantwortlichkeiten

### Produkte

| Verantwortung | Beschreibung |
| --- | --- |
| Verkaufbare Einheiten | Alles, was in Angeboten und Rechnungen als Position erscheint |
| Preise | Listenpreis netto, ausschließlich auf Produktebene |
| Preisart | `einmalig` oder `monatlich` |
| Beschreibung | Name und ausführliche Produktbeschreibung |
| Produkttyp | `paket` (mit Plattformmodulen) oder `dienstleistung` (ohne) |

### Plattformmodule

| Verantwortung | Beschreibung |
| --- | --- |
| Technische Funktionen | CRM, Angebote, Rechnungen, Dokumente, KI-Assistent, Automatisierungen |
| Keine Preise | Kein Listenpreis, keine Preisart |
| Keine Angebotspositionen | Werden nicht verkauft — nur über Pakete lizenziert |
| Feature-Gates | `technischer_schluessel` + aktive Lizenz |

Katalog: [`docs/plattformmodule-katalog.md`](./plattformmodule-katalog.md)

### Paketbestandteile

| Verantwortung | Beschreibung |
| --- | --- |
| Zuordnung | Produkt (Paket) → enthaltene Plattformmodule |
| Nur Pakete | Dienstleistungen haben keine Paketbestandteile |
| n:m | Ein Paket kann mehrere Module enthalten; ein Modul kann in mehreren Paketen vorkommen |

### organization_modules

| Verantwortung | Beschreibung |
| --- | --- |
| Mandanten-Lizenz | Welche Plattformmodule ein Mandant **tatsächlich nutzen darf** |
| Laufzeit | `lizenz_status`, `aktiviert_am`, `deaktiviert_am`, `konfiguration` |
| Keine Stammdaten | Keine duplizierten Namen, Beschreibungen oder Preise |

---

## Datenfluss

```
Produkt
    ↓
Angebot (Positionen mit Produkt-Snapshot)
    ↓
Vertrag (Referenz angenommene Angebotsversion)
    ↓
Rechnung (Positionen aus Angebot übernommen)
    ↓
Aktivierung der Plattformmodule (organization_modules)
```

**Snapshot-Prinzip:** Angebote und Rechnungen speichern Produktdaten zum Zeitpunkt der Erstellung — Katalogänderungen wirken nicht rückwirkend. Siehe [`docs/adr/ADR-0002-snapshot-prinzip.md`](./adr/ADR-0002-snapshot-prinzip.md).

**Lizenzkette:** Siehe [`docs/adr/ADR-0003-lizenzmodell.md`](./adr/ADR-0003-lizenzmodell.md).

---

## Architekturentscheidungen (ADR)

| ADR | Thema |
| --- | --- |
| [ADR-0001](./adr/ADR-0001-produktmodell.md) | Getrenntes Produkt- und Plattformmodell |
| [ADR-0002](./adr/ADR-0002-snapshot-prinzip.md) | Snapshot-Prinzip für Angebote und Rechnungen |
| [ADR-0003](./adr/ADR-0003-lizenzmodell.md) | Lizenzmodell über Produkte und Paketbestandteile |
| [ADR-0004](./adr/ADR-0004-produkt-versionierung.md) | Produkt-Versionierung (Vorbereitung, noch nicht implementiert) |

---

## Entwicklungs-Roadmap

Phasen A–J: [`docs/roadmap.md`](./roadmap.md)

| Phase | Bereich | Status |
| --- | --- | --- |
| A | Mandanten | ✅ |
| B | Angebote | ✅ |
| C | Produktmanagement | 🚧 |
| D–J | Verträge, Abonnements, Rechnungen, Lizenzen, Portal, … | geplant |

---

# Technische Plattformarchitektur

Die folgenden Abschnitte beschreiben die **technische Umsetzung** der oben definierten Domänenarchitektur.

---

## Architekturübersicht

Die Plattform folgt einer **modernen Webarchitektur** mit klarer Trennung zwischen Frontend, Backend-Services und zentraler Datenhaltung.

```
Homepage
│
├── Öffentliche Seiten
├── Beratung anfragen
├── Termin buchen
└── Login
        │
        ▼
Next.js Frontend
        │
        ▼
Supabase
├── Auth
├── PostgreSQL
├── Storage
├── Row Level Security
└── Edge Functions (später)
        │
        ▼
KMU Flow AI
├── Plattform-Admin
└── Mandantenbereich
    ├── Verwaltung
    └── Operative Arbeitsplattform
```

**Kernprinzip:** Das Frontend stellt Benutzeroberfläche und Workflows bereit. Supabase übernimmt Authentifizierung, Datenhaltung, Dateispeicher und Berechtigungen. Die fachliche Logik der Plattform ist in den dokumentierten Geschäftsprozessen, im Datenmodell und in der Plattformstruktur verankert.

---

# Frontend

Das Frontend von KMU Flow AI basiert auf **Next.js** mit dem **App Router**.

### Technologien

- **Next.js App Router** – Routing, Layouts, Server- und Client-Komponenten
- **TypeScript** – typsichere Entwicklung
- **Tailwind CSS** – konsistentes, responsives UI-Design

### Eigenschaften

- **Responsive Design** für Desktop und mobile Nutzung
- **Dark Mode** als Bestandteil des UI-Konzepts
- **Komponentenbasierter Aufbau** für Wartbarkeit und Wiederverwendbarkeit
- **Wiederverwendbare UI-Komponenten** für Formulare, Karten, Navigation und Assistenten

### Struktur

Das Frontend bildet die beiden Hauptbereiche der Plattform ab:

- **Plattform-Admin** unter `/admin`
- **Mandantenbereich** unter den App-Routen wie `/dashboard`, `/kunden`, `/angebote` usw.

Öffentliche Seiten wie die Homepage und spätere Terminbuchung sind vom geschützten Anwendungsbereich getrennt.

---

# Backend

Das Backend wird primär über **Supabase** bereitgestellt.

Supabase übernimmt:

- **Authentifizierung**
- **Datenbank**
- **Dateispeicher**
- **Berechtigungen**
- **API**
- **spätere Edge Functions**

### Architekturprinzip

KMU Flow AI nutzt Supabase als **zentralen Backend-Dienst**, nicht als isolierte Einzellösung pro Modul. Alle fachlichen Bereiche greifen auf dieselbe technische Infrastruktur zu.

Serverseitige Logik kann zunächst über Next.js Server Components, Route Handler und später über Supabase Edge Functions ergänzt werden.

---

# Datenbank

Die zentrale Datenbasis ist **PostgreSQL** über Supabase.

Alle Module greifen auf **dieselbe Datenbank** zu. Dadurch bleiben Kunden, Angebote, Verträge, Rechnungen, Dokumente und Projekte im gemeinsamen fachlichen Kontext verfügbar.

### Wichtigste Domänen

- Mandanten
- Unternehmen
- Standorte
- Benutzer
- Verträge
- Angebote
- Rechnungen
- Dokumente
- Projekte
- Prozessanalysen
- Automatisierungen

Die fachliche Struktur dieser Domänen ist in [`docs/datenmodell.md`](./datenmodell.md) beschrieben. Die technische Tabellenabbildung erfolgt separat auf Basis dieses fachlichen Modells.

### Mandanten-Onboarding (Phase 2)

Die Speicherung aus dem Einrichtungsassistenten erfolgt serverseitig über eine **Server Action** und eine **PostgreSQL-Funktion** in Supabase:

```
Browser (Schritt 6)
  → Server Action createMandantAction
  → Supabase Admin Client (Service Role, nur Server)
  → RPC create_mandant_onboarding (Transaktion)
  → Redirect /admin/mandanten/[id]?created=true
  → Mandantenakte lädt Daten per Server Component
```

**Sicherheit:** Der Browser-Supabase-Client (`lib/supabase/client.ts`) wird für Lese-/Schreibvorgänge mit erhöhten Rechten **nicht** verwendet. Schreibzugriffe für die Mandantenanlage laufen ausschließlich über `lib/supabase/server.ts` mit `SUPABASE_SERVICE_ROLE_KEY`.

**Migration:** `supabase/migrations/20260717090000_mandanten_onboarding_mvp.sql`

**Datenmodell:** Mandanten werden in der bestehenden Tabelle `organizations` gespeichert (erweitert um Onboarding-Felder). `customers` und `organization_members` bleiben unverändert für CRM bzw. Login-Benutzer.

---

# Authentifizierung

Es gibt **keine öffentliche Registrierung**.

Benutzer werden **ausschließlich durch den Plattform-Hauptadmin** eingeladen oder angelegt. Die Authentifizierung erfolgt über **Supabase Auth**.

### Aktueller Stand

- Supabase-Client ist vorbereitet
- Verbindungstest ist möglich
- Login und geschützte Bereiche folgen als Nächstes

### Geplante Erweiterungen

- Passwort zurücksetzen
- Zwei-Faktor-Authentifizierung
- Single Sign-On (optional)

---

# Rollenmodell

Das Rollenmodell ist bewusst **einfach in Version 1** und später erweiterbar.

### Plattform

- **Plattform-Hauptadmin**

### Mandanten

- **Mandanten-Hauptadmin**
- **Mitarbeiter**

**Hinweis:** Weitere Rollen wie Vertrieb, Buchhaltung, Support, Technik, Berater, Büro oder Monteur werden später ergänzt. Rollen und Berechtigungen sollen **zentral verwaltet** werden, nicht fest in einzelnen Seiten verankert.

---

# Plattformbereiche

Die technische Architektur bildet die fachliche Plattformstruktur ab.

## Plattform-Admin

Interner Bereich für das eigene Unternehmen.

Verwaltung von:

- Interessenten
- Beratungen
- Prozessanalysen
- Mandanten
- Verträgen
- Rechnungen
- Modulen
- Automatisierungen
- Support
- Mitarbeitern

Aktuell ist der Plattform-Admin-Bereich mit Dashboard und 6-stufigem Mandanten-Einrichtungsassistent als Prototyp umgesetzt.

## Mandantenbereich

Der Mandantenbereich ist unterteilt in:

- **Verwaltung**
- **operative Arbeitsplattform**

Die fachliche Aufteilung ist in [`docs/plattformstruktur.md`](./plattformstruktur.md) beschrieben.

---

# Dateiverwaltung

Dateien werden über **Supabase Storage** verwaltet.

Gespeichert werden unter anderem:

- Angebote
- Verträge
- Rechnungen
- Dokumente
- Bilder
- Fotos
- Leistungsnachweise

Zugriffe erfolgen **ausschließlich über Rollen und Berechtigungen**. Dateien sind stets einem fachlichen Kontext zugeordnet, z. B. Mandant, Unternehmen, Projekt oder Rechnung.

---

# KI-Architektur

Die KI in KMU Flow AI ist als **Assistenzschicht** konzipiert.

Sie **unterstützt ausschließlich** und erzeugt unter anderem:

- Zusammenfassungen
- Angebotsentwürfe
- Prozessanalysen
- Automatisierungsvorschläge
- Textentwürfe

**Grundsatz:** Die endgültige Entscheidung trifft **immer ein Mensch**.

Die KI ist damit kein autonomer Entscheidungsträger, sondern ein Werkzeug zur Beschleunigung und Strukturierung von Inhalten.

---

# Workflow-Engine

Geschäftsprozesse werden langfristig als **Workflows** umgesetzt.

### Beispiel 1: Vertrieb

```
Interessent
  → Beratung
  → Angebot
  → Vertrag
```

### Beispiel 2: Mahnwesen

```
Rechnung
  → Zahlung prüfen
  → Mahnung
  → Vertragsprüfung
```

Workflow-Aufgaben können **automatisch erzeugt** werden, z. B. Erinnerungen, Prüfaufträge oder Folgeaufgaben.

**Kritische Entscheidungen** – wie Mahnversand, Kündigung oder Zugangssperre – erfolgen **ausschließlich nach manueller Freigabe**.

---

# Integrationen (zukünftig)

Die Architektur ist für spätere Integrationen vorbereitet:

- Homepage
- E-Mail
- Kalender
- Digitale Signatur
- Bank
- DATEV
- API
- Microsoft 365
- Google Workspace

Diese Schnittstellen werden ergänzt, sobald der jeweilige Geschäftsprozess dokumentiert und fachlich entschieden ist.

### Stammdatenservices

Die Plattform soll zukünftig externe Stammdatenquellen nutzen, um Eingaben automatisch zu vervollständigen.

Beispiele:

- IBAN → Bankname
- IBAN → BIC
- Land → Telefonvorwahl
- PLZ → Ort
- Adresse → Geokoordinaten
- Unternehmensstammdaten aus offiziellen Registern (soweit technisch und rechtlich möglich)

Diese Dienste dienen ausschließlich der Unterstützung des Benutzers.

Die endgültige Kontrolle verbleibt immer beim Benutzer.

---

# Sicherheit

Sicherheit ist ein zentraler Bestandteil der Architektur.

Maßnahmen und Prinzipien:

- **HTTPS**
- **Rollen**
- **Rechte**
- **Mandantentrennung**
- **Row Level Security**
- **Audit-Log**
- **Protokollierung**
- **Backups**

**Grundsatz:** Sicherheit vor Komfort. Der Schutz von Mandantendaten hat Vorrang vor vereinfachter Bedienung.

---

# Skalierung

Die Architektur ist von Anfang an auf Wachstum ausgelegt.

Sie soll unterstützen:

- mehrere interne Mitarbeiter
- mehrere Berater
- mehrere Mandanten
- mehrere Unternehmen je Mandant
- mehrere Standorte
- mehrere Benutzer
- mehrere Module

Dies wird technisch über mandantenfähige Datenmodelle, zentrale Berechtigungen und modulare Frontend-Strukturen abgebildet.

---

# Entwicklungsprinzip

Neue Funktionen werden ausschließlich in dieser Reihenfolge entwickelt:

1. **Geschäftsprozess verstehen**
2. **Entscheidung dokumentieren**
3. **Datenmodell prüfen**
4. **Systemarchitektur berücksichtigen**
5. **Implementierung**
6. **Test**
7. **Dokumentation aktualisieren**

Dieses Prinzip verhindert technische Insellösungen und sichert die Übereinstimmung von Produkt, Fachlichkeit und Architektur.

---

# Zusammenfassung

Diese Systemarchitektur definiert die **verbindliche Domänenarchitektur** und die **technische Plattform** von KMU Flow AI.

Gemeinsam mit:

- [`docs/produktarchitektur.md`](./produktarchitektur.md) — Produkt-, Plattformmodul- und Lizenzmodell
- [`docs/roadmap.md`](./roadmap.md) — Entwicklungsphasen A–J
- [`docs/adr/`](./adr/) — Architekturentscheidungen
- [`docs/produktkonzept.md`](./produktkonzept.md)
- [`docs/grundprinzipien.md`](./grundprinzipien.md)
- [`docs/entscheidungen.md`](./entscheidungen.md)
- [`docs/datenmodell.md`](./datenmodell.md)
- [`docs/geschaeftsprozesse.md`](./geschaeftsprozesse.md)
- [`docs/plattformstruktur.md`](./plattformstruktur.md)

definiert sie die **vollständige Architektur** der Plattform — fachlich, organisatorisch und technisch.

Neue Entwickler beginnen mit **Domänenmodell und ADRs**, dann technische Abschnitte dieses Dokuments.
