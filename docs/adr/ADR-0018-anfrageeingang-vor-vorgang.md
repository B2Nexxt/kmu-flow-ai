# ADR-0018: Anfrageeingang vor Vorgang — kanalunabhängiger Eingang und Zuordnungsprüfung

**Status:** Angenommen (verbindlich, Zielarchitektur) — **DDL in Migration `20260717300000_operativer_anfrageeingang_v1.sql`** — noch nicht ausgeführt  
**Datum:** 2026-07-27  
**Bezug:** ADR-0008, ADR-0013, ADR-0014, ADR-0015, ADR-0016, ADR-0017, [`docs/fachkonzept/04-anfrageprozess.md`](../fachkonzept/04-anfrageprozess.md), [`docs/fachkonzept/14-spezifikation-migration-3-anfrageeingang.md`](../fachkonzept/14-spezifikation-migration-3-anfrageeingang.md)

---

## Kontext

Migration 1 (Stammdaten) und Migration 2 (Beziehungen, Vorgänge) sind angewendet und getestet. ADR-0017 legt fest: **unvollständige Nachrichten sind kein Vorgang**. ADR-0008 regelt die Zwei-Merkmale-Zuordnung.

Bisher fehlt eine **persistente Entität** für rohe oder teilweise strukturierte Eingänge (Telefonnotiz, E-Mail, Kontaktformular, …). Ohne diese Trennung drohen:

- Vorgänge ohne ausreichenden fachlichen Kontext
- Platzhalterkunden oder erfundene Objekte zur „Lückenfüllung“
- Automatische Kundenverknüpfung allein über Adresse
- Überladene Vorgangszeilen mit Kommunikationshistorie

Migration 3 soll **ausschließlich** den kanalunabhängigen Anfrageeingang und die **Zuordnungsprüfung** abbilden — **ohne** Providerintegration, **ohne** KI-Auswertung, **ohne** UI/RPC in M3 selbst.

---

## Entscheidung

### 1. Getrennte Entität `anfrageeingaenge`

Rohe oder teilweise strukturierte Eingänge werden **getrennt von `vorgaenge`** gespeichert.

| Ebene | Tabelle | Wann |
| --- | --- | --- |
| **Eingang** | `anfrageeingaenge` | Sobald eine Nachricht/Notiz im System ankommt oder erfasst wird |
| **Vorgang** | `vorgaenge` | Erst nach ausreichender fachlicher Zuordnung und Vollständigkeit |

### 2. Vorgangserzeugung nur bei ausreichendem Kontext

Ein Vorgang darf erst entstehen, wenn mindestens feststehen:

| Pflicht | Beschreibung |
| --- | --- |
| Kunde | Echter vorläufiger (`kundenstatus=vorlaeufig`) **oder** bestätigter Kunde — **kein Platzhalter** |
| Gebäude | `gebaeude_id` |
| Einheit | Optional; bei MFH-Wohnvorgang serverseitig ggf. Pflicht (später) |
| Anliegen | Titel / fachliches Anliegen nicht leer |

**Keine** automatische Vorgangserstellung bei unzureichenden Daten. **Keine** erfundenen Objekte.

### 3. Zwei-Merkmale-Regel (ADR-0008)

Automatische Zuordnung zu bestehendem Kunden/Objekt nur bei:

1. Mindestens **zwei unabhängige Merkmale** übereinstimmend  
2. **Keine widersprüchlichen** Merkmale  
3. Gebäude und ggf. Einheit **eindeutig**

**Nicht ausreichend:** allein gleiche Adresse, allein gleicher Name, allein gleiche E-Mail.

`zuordnungsstatus=eindeutig` = **maschinelle Bewertung**.  
Verbindliche FK-Felder (`zugeordnet_*`) werden erst bei `zuordnungsstatus=bestaetigt` gesetzt (manuell oder nach Regelbestätigung).

### 4. Mehrere Eingänge → ein Vorgang

| Regel | Festlegung |
| --- | --- |
| Ein Anfrageeingang | erzeugt **höchstens einen** Vorgang (`erzeugter_vorgang_id`) |
| Ein Vorgang | darf aus **mehreren** Anfrageeingängen stammen (Ergänzungsmail, Telefonnotiz, zweiter Kanal) |
| UNIQUE auf `erzeugter_vorgang_id` | **Nein** — mehrere Eingänge dürfen auf denselben Vorgang verweisen |

Historische Nachverfolgbarkeit: Vorgangserzeugung ist **nicht still rückgängig** zu machen; Neuzuordnung nur über expliziten Korrekturprozess (später).

### 5. Kanal = Herkunft, nicht Fachprozess

`kanal` beschreibt nur die **Herkunft** (telefon, email, …). Keine Providerlogik, keine Kanal-spezifischen Tabellen in M3.

### 6. Nachvollziehbare Bewertung, keine KI als alleinige Entscheidung

- `zuordnungsgrund jsonb` protokolliert Merkmale, Widersprüche, Regelversion — **ohne** personenbezogene Klartext-Duplikate wo vermeidbar (Hashes)
- Optionaler `confidence_score` nur als **Diagnosewert**, **niemals** allein entscheidend
- `strukturierte_daten jsonb` enthält erkannte Felder mit Quelle und Bestätigungsstatus — **keine** ungeprüfte Source of Truth
- KI-Auswertung ist **nicht Bestandteil von M3**

### 7. Keine Kommunikationshistorie in der Eingangszeile

Rückfragen, Erinnerungen, gesendete Antworten und Nachrichtenketten werden **später** in separaten Entitäten modelliert. M3 speichert nur den **fachlichen Eingang** und Zuordnungsmetadaten.

### 8. Dubletten: technisch ≠ fachlich

- Technische Dubletten (gleiche Message-ID, gleicher Inhalt-Hash) → erkennen, **nicht** automatisch verschmelzen
- Fachlich getrennte Anfragen (gleiche Adresse, anderer Mieter) → **getrennte** Eingänge

### 9. RLS wie M1/M2

`ENABLE ROW LEVEL SECURITY`, **keine** Policies für `anon`/`authenticated` in M3. Zugriff serverseitig über Service Role.

### 10. `/admin` unverändert

Keine Schema- oder Prozessänderung an SaaS-Administration, `customers`, Plattform-Angeboten.

### 11. DDL-Blocker B1–B4 (Migration 3 — final)

| Blocker | Entscheidung |
| --- | --- |
| **B1 Rohinhalt** | `rohinhalt_gesperrt_am`; Trigger `anfrageeingaenge_protect_raw_content()` BEFORE INSERT OR UPDATE; Sperre nicht durch Status-Rücksetzung aufhebbar |
| **B2 Score** | `confidence_score numeric(5,4) NULL`, CHECK 0–1, rein diagnostisch |
| **B3 Konversation** | `konversation_id` = UUID-Gruppierung ohne eigene Tabelle; `parent_*` ohne Pflicht-Konversation |
| **B4 Dubletten** | `inhalt_hash` ohne UNIQUE; part. UNIQUE auf `(mandant_id, kanal, kanal_externe_id)`; kein Auto-Merge |

Details: Dokument 14, Abschnitte 0, 13, 15, 22–23.

---

## Alternativen (verworfen)

| Alternative | Grund |
| --- | --- |
| Unvollständige Nachricht direkt als `vorgaenge` | Verstößt gegen ADR-0017; erzeugt leere Vorgänge |
| Platzhalterkunde „Unbekannt“ | Falsche Stammdaten, Datenschutzrisiko |
| Auto-Zuordnung nur über Adresse | Verstößt gegen ADR-0008 und ADR-0015 |
| 1:1 Eingang↔Vorgang (UNIQUE auf Vorgang) | Ergänzungsmails und Mehrkanal-Anfragen nicht abbildbar |
| Separate Nachrichten-Tabelle in M3 | Overhead ohne Provider; eine Tabelle reicht für M3 |
| `archiviert` als Status **und** `aktiv`/`archiviert_am` | Redundant; Archivierung wie M1/M2 über `aktiv`/`archiviert_am` |
| KI-Score als alleinige Zuordnungsentscheidung | Unnachvollziehbar, datenschutzriskant |
| Kommunikationsfelder in `anfrageeingaenge` | Überladung; separates Modell später |

---

## Begründung

1. **Trennung Eingang/Vorgang** schützt Datenqualität und verhindert Platzhalter-Stammdaten.
2. **Zwei-Merkmale-Regel** ist in ADR-0008 verbindlich — technisches Modell muss Vorschläge vs. Bestätigung unterscheiden.
3. **Mehrere Eingänge pro Vorgang** entspricht realem Büroalltag (E-Mail + Anruf + Ergänzung).
4. **Eine Tabelle in M3** hält Migration schlank; Nachrichten/Provider folgen später.
5. **Audit-JSON ohne Klartext-Duplikate** reduziert Datenschutzrisiko bei Protokollierung.

---

## Konsequenzen

| Bereich | Folge |
| --- | --- |
| Migration 3 | Eine neue Tabelle `anfrageeingaenge` gemäß Dokument 14 |
| Server (später) | Zuordnungsengine, Vorgangserzeugung, Nummernvergabe `eingangsnummer` |
| UI (später) | Eingangswarteschlange, Konflikt-/Vorschlagsmaske, manuelle Bestätigung |
| Kommunikation (später) | Eigene Tabellen für gesendete/empfangene Nachrichten |
| KI (später) | Schreibt nur in `strukturierte_daten` mit `status=erkannt`, nie direkt in FK-Felder |
| `/admin` | Unberührt |

---

## Datenschutzfolgen

| Aspekt | Maßnahme |
| --- | --- |
| Rohe Nachrichten | `rohinhalt` personenbezogen — RLS strikt; Zugriff nur Service Role bis Auth-Sprint |
| Audit-JSON | Merkmalswerte bevorzugt gehasht; keine unnötige Duplikation von E-Mail/Telefon in `zuordnungsgrund` |
| Falsche Zuordnung | FK-Felder erst nach Bestätigung; Konflikte blockieren Auto-Aktion |
| Mieterwechsel / gleiche Adresse | Kein Zugriff auf fremde Vorgangshistorie; getrennte Eingänge |
| Löschung | Fachlich verarbeitete Eingänge nicht hart löschen; Archivierung |

---

## Nicht Bestandteil dieser Entscheidung

- E-Mail-/WhatsApp-/SMS-Providerintegration
- KI-Prompting oder Modellauswahl
- Automatisches Versenden von Rückfragen
- UI, RPC, Server Actions
- Gewerkespezifische Checklisten
- Feingranulare Rollen (Büro vs. Monteur)
- Signierter Vorgangslink als Merkmal (später)
- SQL-DDL (Dokument 14 spezifiziert; Implementierung separat)

---

## Verweise

| Dokument | Inhalt |
| --- | --- |
| ADR-0008 | Zwei-Merkmale-Regel |
| ADR-0017 | Anfrageeingang vs. Vorgang |
| Dokument 04 | Anfrageprozess fachlich |
| Dokument 14 | Migration-3-Spezifikation |
