# Technisches Kunden- und Objektmodell (Ziel)

Technisches **Zielmodell** für Kunden, Adressen, Gebäude/Objekte, Einheiten und Vorgänge in der **operativen Handwerksplattform** — konzeptionell, **ohne SQL, ohne Migration**.

**Status:** Verbindlich (Zielarchitektur) — **noch nicht implementiert**  
**Bezug:** [`03-kunden-und-objektmodell.md`](./03-kunden-und-objektmodell.md), [`04-anfrageprozess.md`](./04-anfrageprozess.md), [`../adr/ADR-0007-kunden-und-objektmodell.md`](../adr/ADR-0007-kunden-und-objektmodell.md), [`../adr/ADR-0008-automatische-zuordnungslogik.md`](../adr/ADR-0008-automatische-zuordnungslogik.md), [`../adr/ADR-0013-technisches-kunden-objekt-vorgangsmodell.md`](../adr/ADR-0013-technisches-kunden-objekt-vorgangsmodell.md), [`../adr/ADR-0014-trennung-saas-admin-und-operative-kundenplattform.md`](../adr/ADR-0014-trennung-saas-admin-und-operative-kundenplattform.md), [`../adr/ADR-0015-mandantenbezogene-adressen-und-mehrere-gebaeude.md`](../adr/ADR-0015-mandantenbezogene-adressen-und-mehrere-gebaeude.md), [`../adr/ADR-0016-operative-objektgrundlagen-rls-archivierung.md`](../adr/ADR-0016-operative-objektgrundlagen-rls-archivierung.md)

---

## Domänentrennung (verbindlich)

Dieses Dokument beschreibt **ausschließlich die operative Kundenplattform** (`/`). Es gilt **nicht** für die SaaS-Administration (`/admin`).

| Admin (`/admin`, Ist) | Operativ (`/`, Ziel) |
| --- | --- |
| `organizations` = SaaS-Mandant | `kunden` = Endkunde des Handwerks |
| `angebote` = Plattform-Angebot an Mandant | Endkundenangebot = **eigene Entität** (Name noch offen) |
| Plattform-Produkte / Lizenzen | Unternehmensleistungen / operative Prozesse |

Details: ADR-0014. Bestehende Admin-Tabellen **nicht uminterpretieren**.

---

## Einordnung: Zwei „Kunden“-Ebenen

| Begriff | Technische Entität (Ist/Ziel) | Bedeutung |
| --- | --- | --- |
| **Mandant** | `organizations` (Ist ✅) | Handwerksbetrieb als **Kunde von KMU Flow AI** (SaaS) |
| **Operativer Kunde** | `kunden` (Ziel; **`customers` nicht weiterentwickeln**) | **Endkunde** des Handwerksbetriebs (Privatperson, Firma, HV) |
| **Plattform-Angebot** | `angebote.organization_id` (Ist ✅) | Angebot **an den Mandanten** (Plattform-Admin, Phase B) |
| **Operatives Angebot** | `vorgaenge` + spätere Verknüpfung (Ziel) | Angebot **des Handwerks** an seinen Endkunden |

**Verbindlich:** Gebäude-, Wohnungs- und Endkundendaten **nicht** in `organizations` mischen. Adressfelder in `organizations` (`strasse`, `plz`, …) sind **Mandanten-Stammdaten** (Hauptunternehmen im MVP), keine Objektadressen operativer Endkunden.

---

## Entitätsmodell (Überblick)

```
organizations (Mandant, Ist)
    │
    └── mandant_id (= organizations.id) scoped:
            │
            ├── kunden (Geschäftspartner / Endkunde)
            │       │
            │       └── kunden_objekt_beziehungen ──┐
            │                                       │
            ├── adressen ◄── gebaeude (Objekt) ─────┤
            │                    │                  │
            │                    └── einheiten ◄─────┘
            │
            └── vorgaenge
                    ├── → kunde (Auftraggeber)
                    ├── → gebaeude
                    ├── → einheit (optional)
                    └── vorgang_beteiligte (Rollen)
```

---

## 1. Kunde (`kunden`)

### Zweck

Rechtlicher oder fachlicher **Geschäftspartner** des Handwerksbetriebs — natürliche oder juristische Person.

### Merkmale (Ziel)

| Kategorie | Felder (konzeptionell) |
| --- | --- |
| Identität | `id`, `mandant_id`, `kundennummer`, `typ` (privat \| firma \| …) |
| Stammdaten | Name/Firmenname, Rechtsform, USt-ID, Steuernummer |
| Kontakt | E-Mail(s), Telefonnummer(n) — normalisiert für Suche |
| Meta | `aktiv`, `created_at`, `updated_at` |

### Verbindliche Regeln

- **Keine Gebäude- oder Wohnungsdaten** in der Kundenentität.
- **Mandantentrennung:** Jeder Datensatz gehört zu genau einem `mandant_id` → `organizations.id`.
- **Keine automatische Identität** mit anderem Kunden bei gleicher Adresse oder gleichem Namen.

### Bezug Ist-System

| Ist | Ziel |
| --- | --- |
| `customers` (Live: existiert, **0 Zeilen**, 0 Code; Legacy) | **Nicht weiterentwickeln** — neue Tabelle **`kunden`**; `customers` später deprecate (ADR-0014, Dok. 11) |
| `organizations` | **Nicht** für operative Endkunden — bleibt SaaS-Mandant; nur als `mandant_id`-Scope |

---

## 2. Adresse (`adressen`)

### Zweck

Normalisierte **Standortangabe** — getrennt von Kunde und Gebäude. **Mandantenbezogen** (ADR-0015): keine globale Adresstabelle.

### Felder (Ziel)

| Feld | Beschreibung |
| --- | --- |
| `mandant_id` | **Pflicht** — FK → `organizations.id`; jede Adresse gehört genau **einem** SaaS-Mandanten |
| `strasse` | Straßenname (Original für Anzeige) |
| `hausnummer` | Hausnummer inkl. Zusatz z. B. „12a“ (Original) |
| `adresszusatz` | z. B. Hintereingang, Gebäudeteil — **separat**, nicht in Normalisierungs-Match |
| `plz` | Postleitzahl |
| `ort` | Ort (Original) |
| `land` | Land (Default z. B. DE) |
| **Normalisiert** (Suche/Dubletten only) | `strasse_normalisiert`, `hausnummer_normalisiert`, `plz_normalisiert`, `ort_normalisiert`, `land_normalisiert` |
| `adress_fingerprint` | optional — mandanteninterner Hash für Dublettenkandidaten (ADR-0016) |
| `aktiv`, `archiviert_am` | Archivierung — siehe Abschnitt Archivierung |
| `created_at` / `updated_at` | Audit |

**Normalisierung:** Deterministisches V1-Konzept in ADR-0016 — **noch nicht implementiert**. Originaleingaben bleiben für Anzeige und Dokumente erhalten.

### Verbindliche Regeln (O3 — ADR-0015)

- **Keine globale Adresstabelle** über mehrere Mandanten.
- **Gleiche reale Adresse** darf bei **mehreren Mandanten** mehrfach gespeichert werden (jeweils eigener Datensatz).
- **Keine** mandantenübergreifende Dublettensuche oder Verknüpfung.
- **RLS und Queries** berücksichtigen **immer** `mandant_id`.
- **Dublettenvorschläge** nur **innerhalb desselben Mandanten**.
- **Gleiche normalisierte Adresse** führt **niemals automatisch** zu Merge oder Kundenverknüpfung (ADR-0008).
- **Gleiche Adresse erzeugt keine automatische Kundenverknüpfung.**

### Kardinalität

`adressen` **1:n** `gebaeude` — siehe Abschnitt Gebäude (O2).

### Bezug Ist-System

| Feld in `organizations` (Ist) | Ziel |
| --- | --- |
| `strasse`, `hausnummer`, `plz`, `ort`, `land` | **Bleiben** Mandanten-Hauptadresse (SaaS-Admin); operative Objektadressen in **`adressen`** mit `mandant_id` |

---

## 3. Gebäude / Objekt (`gebaeude`)

### Zweck

Physisches **Gebäude oder abgrenzbares Objekt** an einer Adresse — Träger **technischer Objektdaten**, unabhängig vom aktuellen Mieter/Eigentümer.

**O2 (ADR-0015):** Eine Adresse kann **ein oder mehrere** Gebäude besitzen (`adressen` **1:n** `gebaeude`).

**Beispiele:** Haus A/B, Vorder-/Hinterhaus, Halle 1/2, Wohnhaus/Garage/Nebengebäude, Büro/Werkstatt.

### Felder (Ziel)

| Feld | Beschreibung |
| --- | --- |
| `id`, `mandant_id` | Mandantentrennung — FK → `organizations.id` |
| `adresse_id` | **Pflicht** — FK → `adressen.id` |
| `gebaeudeart` | **Pflicht** — text, V1-Werteset (ADR-0016): `einfamilienhaus`, `mehrfamilienhaus`, `wohn_und_geschaeftshaus`, `gewerbeobjekt`, `industrieobjekt`, `oeffentliches_gebaeude`, `nebengebaeude`, `sonstiges` — **kein** PostgreSQL-ENUM |
| `gebaeudebezeichnung` | optional; **erforderlich**, wenn unter derselben Adresse mehrere Gebäude existieren und sonst nicht eindeutig unterscheidbar |
| `technische_stammdaten` | optional — z. B. `jsonb` (nicht personenbezogen) |
| `aktiv`, `archiviert_am` | Archivierung |
| `created_at` / `updated_at` | Audit |

### Verbindliche Regeln

- Objekt **darf langfristig bestehen**, auch wenn sich Kunden-Zuordnungen ändern (Mieterwechsel).
- **Technische Historie** am Objekt ≠ **personenbezogene Vorgangshistorie** am Kunden.
- Bei **mehreren** Gebäuden pro Adresse: **`gebaeudebezeichnung`** setzen, sobald `gebaeudeart` allein nicht eindeutig ist.
- **Ein** Gebäude an einer Adresse (z. B. EFH): Bezeichnung kann leer bleiben.

---

## 4. Einheit / Objektbereich (`einheiten`)

### Zweck

Abgrenzbarer Bereich **innerhalb eines Gebäudes** — Wohnung, Gewerbeeinheit, Gemeinschafts- oder Funktionsbereich (ADR-0016).

### Pflicht (fachlich)

| Gebäudeart | Einheit |
| --- | --- |
| `einfamilienhaus` | **Optional** — Vorgang kann ganzes Gebäude ohne `einheit_id` |
| `mehrfamilienhaus` | **Verpflichtend** für wohnungsbezogene Vorgänge |
| Gemeinschaftsaufträge (Dach, Treppenhaus) | Einheit Typ `gemeinschaftsbereich` oder `gebaeudeteil` |
| Mehrere Hallen **als Gebäude** (O2) | `gebaeude` pro Halle — **nicht** zwingend `einheit` |

### Beispiele `bezeichnung`

EG links, 1. OG rechts, Wohnung 7, Gewerbeeinheit 3, Dach, Fassade, Treppenhaus, Heizungszentrale, Garage, Anbau

### `einheit_typ` — V1-Werteset (text, kein ENUM)

`wohnung`, `gewerbeeinheit`, `gemeinschaftsbereich`, `funktionsbereich`, `gebaeudeteil`, `sonstiges`

### Felder (Ziel)

| Feld | Beschreibung |
| --- | --- |
| `mandant_id` | FK → `organizations.id` |
| `gebaeude_id` | FK → `gebaeude` |
| `bezeichnung` | Anzeigename — **eindeutig** pro Gebäude (solange aktiv) |
| `einheit_typ` | siehe Werteset |
| `nummer` | optional — Wohnungs-/Gewerbeeinheit-Nr. |
| `etage` | optional |
| `lage` | optional — links/rechts/Mitte |
| `technische_stammdaten` | optional `jsonb` |
| `aktiv`, `archiviert_am` | Archivierung |
| `created_at` / `updated_at` | Audit |

### Verbindliche Regeln (ADR-0016)

- EFH: Einheiten **dürfen**, müssen **nicht**.
- MFH: wohnungsbezogene Vorgänge **benötigen** `einheit_id`.
- Gesamtes Gebäude: `einheit_id` **NULL** zulässig.
- **Keine** Auto-Verknüpfung bei gleicher Bezeichnung.
- **Mieterwechsel:** Beziehung wechseln — Einheit **nicht** archivieren.

---

## 5. Kunden-Objekt-Zuordnung (`kunden_objekt_beziehungen`)

### Zweck

Explizite, zeitlich begrenzte **Beziehung** zwischen Kunde und Objekt bzw. Einheit — **keine** Ableitung aus Adresse allein.

### Felder (Ziel)

| Feld | Beschreibung |
| --- | --- |
| `kunde_id` | FK → `kunden` |
| `gebaeude_id` | FK → `gebaeude` |
| `einheit_id` | optional — NULL = gesamtes Gebäude |
| `rolle` | eigentuemer \| mieter \| hausverwaltung \| auftraggeber \| ansprechpartner \| rechnungsempfaenger |
| `gueltig_ab` | Start der Beziehung |
| `gueltig_bis` | Ende (nullable = unbefristet aktiv) |
| `aktiv` | boolean |
| `quelle` | manuell \| telefon \| anfrage \| import \| … |
| `bestaetigt_am` / `bestaetigt_von` | Nachweis manueller Bestätigung |

### Verbindliche Regeln

- Mehrere aktive Beziehungen möglich (z. B. Eigentümer + Hausverwaltung am selben Objekt).
- **Mieterwechsel:** neue Zeile für neuen Mieter; alte Beziehung `gueltig_bis` setzen — **Einheit unverändert**.
- **Eigentümerwechsel:** separate fachliche Behandlung von Mieterwechsel (siehe Datenschutz).

---

## 6. Vorgang (`vorgaenge`)

### Zweck

Einheitlicher **Vorgangskontext** für Anfrage, Besichtigung, Angebot, Projekt, Rechnung — mit eindeutiger Objekt- und Beteiligtenzuordnung.

### Felder (Ziel, Kern)

| Feld | Beschreibung |
| --- | --- |
| `id`, `mandant_id`, `vorgangsnummer` | |
| `typ` | anfrage \| besichtigung \| angebot \| projekt \| rechnung \| … |
| `status` | prozessspezifisch |
| `gebaeude_id` | **Pflicht** — Objektkontext |
| `einheit_id` | optional; **Pflicht bei MFH-Wohnungsvorgängen**; **NULL** = gesamtes Gebäude |
| `auftraggeber_kunde_id` | Kunde mit Rolle Auftraggeber für diesen Vorgang |
| `rechnungsempfaenger_kunde_id` | optional abweichend |
| `anfragender_kunde_id` / Kontakt | wer die Anfrage stellte (kann ≠ Auftraggeber) |
| `parent_vorgang_id` | optional — Folgeanfrage, Angebot aus Besichtigung |

### Vorgang beteiligte (`vorgang_beteiligte`)

| Feld | Beschreibung |
| --- | --- |
| `vorgang_id` | |
| `kunde_id` oder externe Kontaktreferenz | |
| `rolle` | anfragender \| auftraggeber \| ansprechpartner \| rechnungsempfaenger \| eigentuemer \| … |
| `fachliche_hinweise` | optional |

### Verbindliche Regeln

- **Genau ein Objektkontext** pro Vorgang (`gebaeude` + ggf. `einheit`).
- **Mehrere Beteiligte** mit unterschiedlichen Rollen erlaubt.
- **Personenbezogene Kommunikation** hängt am **Vorgang** und **Kundenkontext** — nicht ungeprüft am Gebäude „mitlesbar“ für neue Mieter.
- **Gleiche Anschrift ≠ gemeinsame Vorgangshistorie** — Vorgänge sind kunden- und vorgangsbezogen verknüpft.

---

## Kardinalitäten

| Beziehung | Kardinalität | Hinweis |
| --- | --- | --- |
| Mandant → Kunden | 1:n | `mandant_id` |
| Kunde → Objekte (via Beziehung) | n:m | zeitlich/rollenbezogen |
| Objekt → Kunden (via Beziehung) | n:m | Mieterwechsel, HV + Eigentümer |
| Mandant → Adressen | 1:n | `adressen.mandant_id` — **keine** globale Adresstabelle (O3) |
| Adresse → Gebäude | **1:n** | **O2:** mehrere Gebäude pro Adresse (Halle 1/2, Nebengebäude, …) |
| Gleiche reale Adresse über Mandanten | **keine** gemeinsame Entität | je Mandant eigener `adressen`-Datensatz (O3) |
| Gebäude → Einheiten | 1:n | MFH: viele Einheiten |
| Einheit → Kunden (via Beziehung) | n:m | über Zeit verschiedene Mieter |
| Vorgang → Objektkontext | n:1 | genau ein Gebäude (+ optional Einheit) |
| Vorgang → Beteiligte | 1:n | verschiedene Rollen |
| Vorgang → Kunde (Auftraggeber) | n:1 | pro Vorgang eindeutiger Auftraggeber |
| Gleiche Adresse → gleicher Vorgang | **keine** | Vorgänge nicht über Adresse teilen |

---

## Anwendungsfälle (10)

### 1. Privatkunde mit Einfamilienhaus

| Entität | Anlage |
| --- | --- |
| `kunden` | Müller, privat |
| `adressen` | Musterstraße 12 |
| `gebaeude` | EFH, `gebaeudeart = einfamilienhaus`, ohne Bezeichnung |
| `einheiten` | — (optional leer) |
| `kunden_objekt_beziehungen` | Müller, Eigentümer + Auftraggeber, gesamtes Gebäude |
| `vorgaenge` | Anfrage → `gebaeude_id`, `auftraggeber_kunde_id` = Müller |

### 2. Kunde mit mehreren Gebäuden

| Entität | Anlage |
| --- | --- |
| `kunden` | Schmidt GmbH |
| Zwei `gebaeude` | Werkstraße 1 (Halle), Gartenweg 5 (Büro) |
| Zwei `kunden_objekt_beziehungen` | Schmidt → beide Objekte, Rolle Auftraggeber |
| `vorgaenge` | je Vorgang **ein** referenziertes Gebäude |

### 3. Zwei Mieter im MFH, unterschiedliche Wohnungen

| Entität | Anlage |
| --- | --- |
| `gebaeude` | MFH, `gebaeudeart = mehrfamilienhaus`, Hauptstraße 8 |
| `einheiten` | EG links (Mieter A), 1. OG rechts (Mieter B) |
| `kunden` | Mieter A, Mieter B — **zwei** Kunden |
| `kunden_objekt_beziehungen` | A → EG links; B → 1. OG rechts |
| `vorgaenge` | getrennt; **kein** Zugriff A auf Vorgänge B |

### 4. Mieterwechsel in derselben Wohnung

| Schritt | Aktion |
| --- | --- |
| Bestand | Einheit „1. OG rechts“ unverändert; Beziehung Mieter Alt: `gueltig_bis` |
| Neu | Kunde Neu; neue Beziehung Mieter → dieselbe `einheit_id` |
| Vorgänge | Alt bleiben bei Mieter Alt / altem Vorgangskontext |
| Technik | `gebaeude`/`einheit`.technische_daten **optional** wiederverwendbar mit Bestätigung |

### 5. Eigentümer beauftragt Arbeiten am gesamten MFH-Dach

| Entität | Anlage |
| --- | --- |
| `einheiten` | „Dach“ als `gemeinschaftsbereich` |
| `kunden_objekt_beziehungen` | Eigentümer → Einheit Dach oder gesamtes Gebäude, Rolle Auftraggeber |
| `vorgaenge` | `einheit_id` = Dach; Auftraggeber = Eigentümer |

### 6. Hausverwaltung beauftragt Treppenhaus

| Entität | Anlage |
| --- | --- |
| `einheiten` | Treppenhaus, `gemeinschaftsbereich` |
| `kunden` | HV GmbH |
| `kunden_objekt_beziehungen` | HV, Rolle `hausverwaltung` oder `auftraggeber` |
| `vorgang_beteiligte` | optional Eigentümer als `ansprechpartner` |

### 7. Mieter fragt an, Eigentümer ist Auftraggeber und Rechnungsempfänger

| Feld | Wert |
| --- | --- |
| `anfragender` / `vorgang_beteiligte` | Mieter, Rolle `anfragender` |
| `auftraggeber_kunde_id` | Eigentümer |
| `rechnungsempfaenger_kunde_id` | Eigentümer |
| Kommunikation | Mieter: anfragebezogen; Rechnung: Eigentümer |

### 8. Gewerbekunde mit mehreren Hallen, gleiche Anschrift

| Entität | Anlage |
| --- | --- |
| `adressen` | Industriepark 1 |
| `gebaeude` | **Zwei** Datensätze: Gewerbe „Halle 2“, Gewerbe „Halle 3“ (O2: `adressen` 1:n `gebaeude`) |
| `vorgaenge` | je Halle eigener Objektkontext — **nicht** nur Adresse |

### 9. Folgeanfrage zum selben Objekt

| Regel | Verhalten |
| --- | --- |
| Kunde | bekannter Kunde (2 Merkmale) → auto oder Vorschlag |
| Objekt/Einheit | explizit gleiche `gebaeude_id` / `einheit_id` |
| `vorgaenge` | neuer Vorgang; `parent_vorgang_id` optional; technische Daten mit Kontext wiederverwendbar |

### 10. Frühere Anfrage anderer Kunde, gleiche Adresse

| Regel | Verhalten |
| --- | --- |
| Adresse | kann dieselbe `adresse_id` / Gebäude referenzieren |
| Kunde | **neuer** Kunde — keine Verknüpfung zum Vorgänger |
| Vorgänge | **keine** sichtbare Historie des anderen Kunden |
| Auto-Zuordnung | **nicht** nur wegen Adresse — Neuanlage oder manuelle Bestätigung |

---

## Datenschutz- und Wiederverwendungsregeln

| # | Regel |
| --- | --- |
| D1 | Personenbezogene Vorgangsdaten (Kommunikation, Angebote, Rechnungen) bleiben beim **jeweiligen Kunden-/Vorgangskontext**. |
| D2 | **Neuer Mieter** erhält **keinen Zugriff** auf frühere Kommunikation, Angebote oder Rechnungen des Vormieters. |
| D3 | Technische Objektinformationen dürfen intern nur genutzt werden, wenn **fachlich und rechtlich zulässig** — mit Quellenangabe. |
| D4 | **Keine automatische Wiederverwendung** allein wegen gleicher Adresse oder Einheit. |
| D5 | Wiederverwendung muss **Quelle, Alter und Kontext** anzeigen (z. B. „Maß von Besichtigung 2024-03“). |
| D6 | **Kritische Übernahmen** (Maße in Angebot, personenbezogene Notizen) müssen **bestätigt** werden. |
| D7 | **Eigentümerwechsel** und **Mieterwechsel** sind unterschiedliche Sachverhalte (Beziehungs-/Eigentumshistorie). |
| D8 | **Technische Historie** (Objekt/Einheit) und **personenbezogene Historie** (Kunde/Vorgang) müssen **unterscheidbar** sein. |

---

## Automatische Zuordnung (Integration ADR-0008)

Gilt für Anfragen und digitale Eingänge — konsistent mit [`04-anfrageprozess.md`](./04-anfrageprozess.md).

### Automatisch verknüpfen nur wenn

1. Mindestens **zwei unabhängige Merkmale** übereinstimmen  
2. **Kein Widerspruch**  
3. **Objekt bzw. Einheit eindeutig** (bei MFH Pflicht)

### Kein Treffer

Neu anlegen (assistiert):

- `kunden` (neu)
- `adressen` (neu oder vorhandene Adresse nur referenzieren — **ohne** Kundenmerge)
- `gebaeude` (neu)
- `einheiten` (neu, wenn MFH/Gewerbe)
- `kunden_objekt_beziehungen` (neu)
- `vorgaenge` (neu)

### Ein Treffer / mehrere Möglichkeiten

- **Vorschlag** im Büro
- **Manuelle Bestätigung** vor persistierender Verknüpfung

### Widerspruch

- **Keine Verknüpfung**
- **Konflikt** zur manuellen Prüfung
- Entscheidungsgrundlage protokollieren

---

## Bestehendes System (Ist) und Migration

### `organizations` — Ist-Nutzung ✅

| Aspekt | Ist |
| --- | --- |
| Rolle | **Mandant** (Interessent / aktiver_mandant) + Hauptunternehmen MVP |
| Felder | Stammdaten, Vertrag/Preis, **Adresse des Mandanten** (`strasse`, `hausnummer`, `plz`, `ort`, `land`) |
| Kindtabellen | `ansprechpartner`, `bankverbindungen`, `organization_modules`, `organization_automatisierungen` |
| Anlage | `create_mandant_onboarding` |

**Ziel:** `organizations` **unverändert** als Mandanten-Stamm; **keine** Endkunden-Objektdaten hinzufügen.

### `angebote` — Ist-Nutzung ✅ (Phase B)

| Aspekt | Ist |
| --- | --- |
| `angebote.organization_id` | **Pflicht-FK** → Mandant, dem das **Plattform-Angebot** gilt |
| Empfänger | Snapshot in `angebot_versionen` (`empfaenger_*`) — **kein** FK zu operativem Kunden |
| Positionen | Freitext / optional `leistungsmodul_id` (Zwischenlösung) |
| CRM-FK | **Kein** `customer_id` in V1 |

**Ziel vor Migration:**

- **`organization_id` bleibt erhalten** für alle bestehenden Plattform-Angebote.
- Operative Endkunden-Angebote künftig über **`vorgaenge`** — optional später `vorgang_id` an operativer Angebotsentität; **nicht** bestehende `angebote`-Zeilen uminterpretieren.

### Felder: weiterverwenden vs. auslagern

| Ist (`organizations`) | Empfehlung |
| --- | --- |
| `name`, `rechtsform`, Steuer-/Registerfelder | **Weiterverwenden** — Mandanten-Stamm |
| `strasse`, `hausnummer`, `plz`, `ort`, `land` | **Weiterverwenden** für Mandanten-Sitz; langfristig optional normalisierte `adressen`-Referenz **nur für Mandant** |
| Endkunden-Adressen | **Neu** in `adressen` — nicht in `organizations` |
| `ansprechpartner` | Mandanten-Ansprechpartner; operative Kundenkontakte an `kunden` / `vorgang_beteiligte` |

### Schrittweise Migrationsstrategie (Konzept, ohne SQL)

```
Phase M0 — Dokumentation & ADR (aktuell)
    Keine Schema-Änderung

Phase M1 — Neue Tabellen parallel
    kunden, adressen, gebaeude, einheiten,
    kunden_objekt_beziehungen, vorgaenge, vorgang_beteiligte
    Alle mit mandant_id → organizations.id

Phase M2 — Operative Prozesse
    Anfrageprozess schreibt nur in neues Modell
    Plattform-Angebote unverändert

Phase M3 — Optionale Verknüpfung
    Operatives Angebot/Rechnung → vorgang_id
    Bestehende angebote.organization_id unangetastet

Phase M4 — customers (falls vorhanden)
    ~~Backfill~~ entfällt (Live: 0 Zeilen) — customers deprecate

Phase M5 — Berechtigungen / RLS
    Mandantentrennung + Vorgangskontext für personenbezogene Daten
```

**Kein Datenverlust:** Bestehende `angebote` und `organizations` bleiben lesbar und nutzbar bis explizite operative Migration.

---

## Archivierung (verbindlich, ADR-0016)

| Aspekt | Regel |
| --- | --- |
| Hard Delete | **Verboten** für `kunden`, `adressen`, `gebaeude`, `einheiten`, `vorgaenge` mit fachlicher Verwendung |
| Mechanismus | `aktiv = false` + `archiviert_am` |
| Historische Vorgänge | Bleiben referenzierbar |
| Neue Vorgänge | Archivierte Entitäten standardmäßig **nicht** in Auswahl |
| Reaktivierung | Muss möglich sein |
| Technische Historie | Am Objekt/Einheit erhalten |
| Mieterwechsel | **Nicht** über Einheiten-Archivierung — `kunden_objekt_beziehungen` zeitlich beenden |
| `archiviert_von` | **Nicht** in V1 — optional V2 (Audit) |

---

## RLS-Grundmodell (Zielbild, ADR-0016)

| Regel | Beschreibung |
| --- | --- |
| `mandant_id` | **NOT NULL** auf **jeder** operativen Tabelle |
| Filter | RLS immer über authentifizierten Mandantenkontext |
| Direkte Spalte | Auch bei ableitbarer Beziehung — `mandant_id` redundant but safe |
| Konsistenz | Child-`mandant_id` = Parent-`mandant_id` (z. B. `gebaeude` ↔ `adressen`) |
| `/admin` | Keine Vermischung — SaaS-Admin-Domäne getrennt (ADR-0014) |

**Policy-Zielbild (noch nicht implementiert):** SaaS-Admin ohne Standardzugriff auf operative Tabellen; Mandanten-Admin voller Zugriff innerhalb Mandant; operative Benutzer rollenbasiert; Service Role nur serverseitig mit expliziter `mandant_id`.

---

## Offene Entscheidungen vor Migration

| # | Thema | Status |
| --- | --- | --- |
| O1 | Tabellenname: `kunden` vs. Erweiterung `customers` | **Entschieden:** **`kunden` neu** — Live: `customers` existiert, **0 Zeilen**, deprecate ([`11-analyse-bestehende-endkundenstruktur.md`](./11-analyse-bestehende-endkundenstruktur.md)) |
| O2 | Ein Gebäude vs. mehrere `gebaeude` pro Adresse | **Entschieden:** **`adressen` 1:n `gebaeude`** — ADR-0015 |
| O3 | Globale vs. mandantenbezogene `adressen` | **Entschieden:** **`adressen.mandant_id` Pflicht** — keine globale Tabelle — ADR-0015 |
| O4 | Verknüpfung operatives Angebot ↔ `angebote` oder separate Tabelle | **Tendenz:** separate Tabelle — ADR-0014 |
| O5 | Technische `jsonb`-Schemas pro Gewerk | offen |
| O6 | RLS-Modell für Mieterwechsel | **Entschieden:** RLS-Grundmodell + Vorgangskontext — ADR-0016 |
| O7 | Adressnormalisierung | **Entschieden:** deterministisches V1 + `adress_fingerprint` mandantenintern — ADR-0016 |
| O8 | `gebaeudeart` / `einheit_typ` Wertesets | **Entschieden** — text + CHECK später — ADR-0016 |
| O9 | `archiviert_von` | **V1 nein**, V2 optional — ADR-0016 |

---

## Verweise

| Dokument | Inhalt |
| --- | --- |
| [`03-kunden-und-objektmodell.md`](./03-kunden-und-objektmodell.md) | Fachliche Regeln (Kurzform) |
| [`../angebote-datenmodell.md`](../angebote-datenmodell.md) | Ist Plattform-Angebote |
| [`12-spezifikation-migration-1-operative-stammdaten.md`](./12-spezifikation-migration-1-operative-stammdaten.md) | Migration 1 DDL-Spezifikation |

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-26 | Erstversion — technisches Zielmodell |
| 2026-07-26 | ADR-0014 — Domänentrennung; `customers` Live-Ergebnis |
| 2026-07-26 | ADR-0015 — O2/O3 entschieden; Normalisierung fachlich |
| 2026-07-26 | ADR-0016 — Gebäudearten, Einheiten, Archivierung, RLS, Normalisierung |
| 2026-07-26 | Dokument 12 — Spezifikation Migration 1 |
