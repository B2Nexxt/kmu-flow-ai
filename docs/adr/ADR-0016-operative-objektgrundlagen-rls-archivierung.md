# ADR-0016: Operative Objektgrundlagen — Gebäudearten, Einheiten, Archivierung, RLS, Adressnormalisierung

**Status:** Angenommen (verbindlich, Zielarchitektur) — **B1–B3 für Migration 1 entschieden** — DDL noch nicht implementiert  
**Datum:** 2026-07-26 (B1–B3 finalisiert: 2026-07-26)  
**Bezug:** [`docs/fachkonzept/10-technisches-kunden-und-objektmodell.md`](../fachkonzept/10-technisches-kunden-und-objektmodell.md), ADR-0013, ADR-0014, ADR-0015

---

## Kontext

ADR-0013/0015 definieren das operative Kunden- und Objektmodell (`kunden`, `adressen`, `gebaeude`, `einheiten`, `vorgaenge`). Vor der **ersten operativen Migration** fehlten verbindliche Entscheidungen zu:

| Thema | Vorher (Dokument 10) |
| --- | --- |
| **Gebäudearten** | Beispiele ohne Werteset |
| **Einheiten** | Grobes Modell; Typen uneinheitlich |
| **Archivierung** | `aktiv` erwähnt, Regeln offen |
| **RLS** | O6 offen |
| **Adressnormalisierung** | O7 fachlich skizziert (ADR-0015), Algorithmus offen |

**Grundlage unverändert:** `/admin` bleibt SaaS-Administration; operative Tabellen gehören ausschließlich zur Kundenplattform `/`; alle operativen Entitäten sind **mandantenscharf** (ADR-0014).

---

## Entscheidung

Verbindliche **V1-Strukturentscheidungen** für die erste operative Migration — **Dokumentation only**, kein SQL/RLS-Code.

---

## Gebäudearten

### `gebaeude.gebaeudeart` — textbasiertes V1-Werteset

| Wert | Bedeutung |
| --- | --- |
| `einfamilienhaus` | Freistehendes / einziges Wohngebäude |
| `mehrfamilienhaus` | Mehrere Wohnungen / Mietparteien |
| `wohn_und_geschaeftshaus` | Gemischte Nutzung Wohnen + Gewerbe |
| `gewerbeobjekt` | Gewerbe / Handwerk / Lager (nicht rein industrial) |
| `industrieobjekt` | Industrie, Produktion, große Hallenkomplexe |
| `oeffentliches_gebaeude` | Schule, Verwaltung, öffentliche Träger |
| `nebengebaeude` | Garage, Carport, Schuppen, Anbau als Nebenbau |
| `sonstiges` | Fallback — UI soll spezifischere Art bevorzugen |

### Technische Abbildung (Ziel)

- **Kein PostgreSQL-ENUM** in V1
- Spalte `text` — später über **CHECK-Constraint** validierbar
- Erweiterung künftig über **Migration** (neue Werte + CHECK anpassen)

### Prüfung weiterer Werte

**Keine zusätzlichen allgemeinen Werte erforderlich** für V1:

| Nicht als eigene Art | Abgedeckt durch |
| --- | --- |
| Halle, Werkstatt | `gewerbeobjekt`, `industrieobjekt` |
| Garage, Carport | `nebengebaeude` (ggf. zusätzlich `gebaeudebezeichnung`) |
| MFH vs. WGH | `mehrfamilienhaus` vs. `wohn_und_geschaeftshaus` |

**Keine gewerkespezifischen** Gebäudearten (z. B. `dach`, `flachdach`) — diese gehören in `einheiten` / technische Stammdaten.

---

## Einheitenmodell

### Zweck

`einheiten` bildet **private/gewerbliche Einheiten** sowie **Gemeinschafts- und Funktionsbereiche** innerhalb eines Gebäudes ab.

### Felder (V1, konzeptionell)

| Feld | Pflicht | Beschreibung |
| --- | --- | --- |
| `mandant_id` | ja | FK → `organizations.id` |
| `gebaeude_id` | ja | FK → `gebaeude.id` |
| `bezeichnung` | ja | z. B. „EG links“, „Dach“, „Treppenhaus“ — **Original für Anzeige** |
| `bezeichnung_normalisiert` | ja | DB-Trigger — Eindeutigkeit unter aktiven Einheiten |
| `einheit_typ` | ja | siehe Werteset |
| `nummer` | nein | z. B. Wohnungsnummer, Gewerbeeinheit-Nr. |
| `etage` | nein | z. B. „EG“, „1. OG“ |
| `lage` | nein | z. B. „links“, „rechts“, „Mitte“ |
| `technische_stammdaten` | nein | optional `jsonb` |
| `aktiv` | ja | boolean |
| `archiviert_am` | nein | gesetzt bei Archivierung |
| `created_at` / `updated_at` | ja | Audit |

### `einheit_typ` — V1-Werteset (text, kein ENUM)

| Wert | Beispiele |
| --- | --- |
| `wohnung` | EG links, 1. OG rechts, Wohnung 7 |
| `gewerbeeinheit` | Gewerbeeinheit 3, Ladenfläche |
| `gemeinschaftsbereich` | Dach, Fassade, Treppenhaus, Keller |
| `funktionsbereich` | Heizungszentrale, Technikraum |
| `gebaeudeteil` | Anbau, Erker, Seitenflügel (innerhalb Gebäude) |
| `sonstiges` | Fallback |

**Hinweis:** „Halle 2“ als **eigenes Gebäude** an derselben Adresse → `gebaeude` (O2/ADR-0015), nicht `einheit`. Einheiten modellieren Bereiche **innerhalb** eines Gebäudes.

### Verbindliche Regeln

| # | Regel |
| --- | --- |
| E1 | **Einfamilienhäuser** dürfen Einheiten haben, **müssen** aber nicht |
| E2 | **Mehrfamilienhäuser:** wohnungsbezogene Vorgänge **benötigen** eine konkrete `einheit_id` |
| E3 | **Gemeinschaftsaufträge** (Dach, Treppenhaus): Einheit mit Typ `gemeinschaftsbereich` oder `gebaeudeteil` |
| E4 | Vorgang kann **gesamtes Gebäude** betreffen → `einheit_id` **NULL** zulässig |
| E5 | Einheit gehört **genau einem** Gebäude und **einem** Mandanten |
| E6 | `bezeichnung_normalisiert` muss **innerhalb eines Gebäudes eindeutig** sein (solange `aktiv = true`) — DB-Trigger aus `bezeichnung` |
| E7 | **Keine** automatische Verknüpfung nur wegen gleicher Einheitsbezeichnung (ADR-0008) |
| E8 | **Mieterwechsel** über `kunden_objekt_beziehungen`, **nicht** über Archivierung der Einheit |

---

## Archivierung

### Grundsatz

**Keine Hard Deletes** für Entitäten mit fachlicher Verwendung:

- `kunden`, `adressen`, `gebaeude`, `einheiten`, `vorgaenge` (und abgeleitete Beziehungen/Beteiligte mit Historie)

### Mechanismus (V1)

| Aspekt | Regel |
| --- | --- |
| Archivierung | `aktiv = false` **und** `archiviert_am` setzen (timestamp) |
| Historische Vorgänge | Bleiben **referenzierbar** — keine CASCADE-Löschung |
| Neue Vorgänge | Archivierte Datensätze werden **standardmäßig nicht angeboten** (Auswahl/UI) |
| Reaktivierung | **Muss möglich sein** — `aktiv = true`, `archiviert_am = NULL` |
| Technische Historie | Am Objekt/Einheit **erhalten** |
| Mieterwechsel | **Nicht** über Archivierung der Einheit — Beziehungen zeitlich beenden (ADR-0013) |

### `archiviert_von` — Entscheidung V1

**Nicht Pflicht in V1** — erst in **V2** ergänzen, wenn Audit-Anforderungen es verlangen.

Begründung: `created_at`/`updated_at` + Anwendungs-Log genügen für erste Migration; weniger Schema-Komplexität. Optional kann V2 `archiviert_von` (User-Referenz) ergänzen.

Gleiches gilt analog für `kunden`, `gebaeude`, `adressen`, `vorgaenge`: **`archiviert_am` in V1**, `archiviert_von` **später**.

### Archivierungs-CHECK (Migration 1, verbindlich)

Auf allen vier Stammdatentabellen (`kunden`, `adressen`, `gebaeude`, `einheiten`):

```sql
CHECK (
  (aktiv = true  AND archiviert_am IS NULL)
  OR
  (aktiv = false AND archiviert_am IS NOT NULL)
)
```

| Aspekt | Bewertung |
| --- | --- |
| Sinnvoll | **Ja** — konsistenter Soft-Archive-Zustand |
| Reaktivierung | **Ja** — `aktiv = true`, `archiviert_am = NULL` in einem UPDATE |
| Atomare Änderung | **Ja** — `aktiv` und `archiviert_am` müssen gemeinsam gesetzt werden |

---

## RLS-Grundmodell

### Mandantenspalte (alle operativen Tabellen)

| Regel | Beschreibung |
| --- | --- |
| R1 | Jede operative Tabelle: **`mandant_id NOT NULL`** |
| R2 | `mandant_id` → `organizations.id` (SaaS-Mandant = Tenant-Scope) |
| R3 | RLS filtert **immer** über authentifizierten **Mandantenkontext** |
| R4 | **`mandant_id` direkt** auf jeder Tabelle — auch wenn über FK ableitbar |
| R5 | **Zusammengesetzte Konsistenz:** Child-`mandant_id` muss Parent-`mandant_id` entsprechen |

### Konsistenzbeispiele (bei Implementierung als FK/CHECK/Trigger)

```
gebaeude(mandant_id, adresse_id)  →  adressen(mandant_id, id)
einheiten(mandant_id, gebaeude_id)  →  gebaeude(mandant_id, id)
kunden_objekt_beziehungen  →  nur kunden + gebaeude/einheiten desselben mandant_id
vorgaenge, vorgang_beteiligte  →  keine fremden mandant_id-Referenzen
```

### Policy-Zielbild (noch nicht implementiert)

| Akteur | Ziel |
| --- | --- |
| **SaaS-Admin** (`/admin`) | **Kein** Zugriff auf operative Tabellen über Standard-Portal-RLS — Admin nutzt **eigene** Domäne (`organizations`, `angebote`, …). Operative Daten nur über dedizierte Support-Pfade (falls später), explizit dokumentiert |
| **Mandanten-Administratoren** | Voller CRUD **innerhalb** `mandant_id` des eigenen Betriebs; User-/Rollenverwaltung operativ |
| **Operative Benutzer** | CRUD/Lesen gemäß Rolle **innerhalb** `mandant_id`; personenbezogene Vorgänge nur im berechtigten Kontext (Mieterwechsel: kein Zugriff auf Vorgänge anderer Kunden ohne Berechtigung) |
| **Service Role / Hintergrundprozesse** | Bypass RLS nur serverseitig; **immer** explizit `mandant_id` setzen/prüfen — nie mandantenübergreifende Batch-Jobs ohne Absicherung |

**Mieterwechsel (O6):** Kein separates RLS-Modell — **Vorgangs- und Kundenkontext** in App-Logik + Policies, die `mandant_id` und Berechtigungsrollen kombinieren. Personenbezogene Historie bleibt am **Kunden/Vorgang**, nicht an der Einheit.

### Migration 1 — **Entscheidung B2 (verbindlich)**

| Aspekt | M1 |
| --- | --- |
| RLS aktivieren | **Ja** auf `kunden`, `adressen`, `gebaeude`, `einheiten` |
| Policies `authenticated` / `anon` | **Nein** in M1 |
| Browser-Direktzugriff | **Nein** |
| Zugriff M1 | **Nur serverseitig** über **Service Role** |
| Service Role | `mandant_id` aus **vertrauenswürdigem** Serverkontext — **nie** ungeprüft vom Client |
| `organization_members` | Später Policy-Grundlage — **nicht** in M1 ändern |
| Auth-/Mitgliedschafts-Sprint | **Pflicht** vor erster operativer UI |

**RLS ohne Policies ist Absicht — kein Fehler.** Default: `authenticated`/`anon` haben keinen Zugriff; Service Role bypassed RLS (Supabase-Standard).

---

## Adressnormalisierung

### **Entscheidung B1 (Migration 1, verbindlich)**

| Aspekt | Regel |
| --- | --- |
| Source of Truth | **Datenbank** — Funktionen/Trigger setzen `*_normalisiert` und `adress_fingerprint` |
| App-Code | Anzeigen/Vorprüfen erlaubt — **nicht** alleinige Schreibquelle |
| Trigger | **BEFORE INSERT OR UPDATE** bei Änderung relevanter Originalspalten |
| Originalfelder | **Unverändert** gespeichert (Anzeige, Dokumente, Rechtssicherheit) |

### Originalfelder (Anzeige, Dokumente, Rechtssicherheit)

`strasse`, `hausnummer`, `adresszusatz`, `plz`, `ort`, `land` — **unverändert** gespeichert.

### Normalisierungsfelder (Suche, Dublettenvorschläge)

| Original | Normalisiert |
| --- | --- |
| `strasse` | `strasse_normalisiert` |
| `hausnummer` | `hausnummer_normalisiert` |
| `plz` | `plz_normalisiert` |
| `ort` | `ort_normalisiert` |
| `land` | `land_normalisiert` |

`adresszusatz` — **nicht** in Standard-Match einbezogen.

### Deterministisches V1-Konzept (fachlich)

| Schritt | Regel |
| --- | --- |
| Trimmen | führende/nachfolgende Leerzeichen entfernen |
| Kleinschreibung | Unicode-Lowercase (`strasse`, `ort`, `land`) |
| Leerzeichen | mehrfache interne Leerzeichen → ein Leerzeichen |
| Umlaute | **Nicht** umschreiben (ä bleibt ä) — konsistente Unicode-NFC |
| Straßensuffixe | **Nicht** aggressiv umdeuten („Str.“ nicht automatisch → „straße“) |
| Hausnummer | Ziffern + Buchstabe/Zusatz erhalten; „12 a“ → `12a` (Leerzeichen entfernen) |
| PLZ | nur trimmen; führende Nullen erhalten |
| Land | trimmen + lowercase; optional Mapping `deutschland`/`de`/`DE` → `de` (fest definierter Alias-Table **in Implementierung**) |
| Postalische Korrektur | **Keine** automatische PLZ/Ort-Korrektur |
| Verwendung | **Nur** Suche und Dubletten**vorschläge** |
| Auto-Merge | **Verboten** (ADR-0008, ADR-0015) |

### `adress_fingerprint` — Entscheidung (B1, final)

**Ja, sinnvoll in V1** — als deterministischer **Text-Fingerprint** über:

`strasse_normalisiert` + `hausnummer_normalisiert` + `plz_normalisiert` + `ort_normalisiert` + `land_normalisiert`

| Aspekt | Regel |
| --- | --- |
| `mandant_id` | **Nicht** Bestandteil des Fingerprint — Mandantenscope über Index `(mandant_id, adress_fingerprint)` |
| UNIQUE Fingerprint | **Nein** — gleicher Fingerprint darf mehrfach vorkommen |
| Gleicher Fingerprint, zwei Mandanten | **Erlaubt** — kein Cross-Tenant-Effekt |
| Auto-Verknüpfung | **Nein** — Fingerprint liefert Dubletten**kandidaten**, keine Merge-Entscheidung |
| `adresszusatz` | **Nicht** im Fingerprint |
| pgcrypto / `digest()` | **Nicht** in M1 — stabile pipe-delimited Textverkettung (`\|`) statt Extension-Zwang |

### Einheitenbezeichnung — Normalisierung (Migration 1)

| Aspekt | Regel |
| --- | --- |
| `bezeichnung` | Original — Anzeige |
| `bezeichnung_normalisiert` | **NOT NULL** — DB-Trigger (trim, NFC, lowercase, Leerzeichen) |
| Eindeutigkeit | Partieller UNIQUE `(mandant_id, gebaeude_id, bezeichnung_normalisiert) WHERE aktiv = true` |
| Varianten | „EG links“, „eg links“, „ EG  links “ → gleiche normalisierte Bezeichnung |

### Gebäudebezeichnung — **Entscheidung B3 (Migration 1, verbindlich)**

| Aspekt | M1 |
| --- | --- |
| `gebaeudebezeichnung` | **Nullable** |
| Bedingte Pflicht bei Mehrfach-Gebäude | **Servervalidierung** beim Anlegen/Ändern — **kein** DB-Trigger in M1 |
| DB bei gesetzter Bezeichnung | CHECK: `IS NULL OR length(trim(gebaeudebezeichnung)) > 0` |
| Normalisierte Bezeichnung / Dublettenindex | **Später**, falls Bedarf |

---

## Alternativen (verworfen)

| Alternative | Grund |
| --- | --- |
| PostgreSQL-ENUM für `gebaeudeart` / `einheit_typ` | Erweiterung braucht DDL-Migration; text + CHECK flexibler |
| Hard Delete archivierter Daten | Historische Vorgänge, Audit, Rechtssicherheit |
| RLS nur über JOIN-ableitbare `mandant_id` | Fehleranfällig; direkte Spalte sicherer und performanter |
| Globale Adress-Identität / Fingerprint | ADR-0015; Mandantentrennung |
| Aggressive Straßennormalisierung | Falsche Dubletten; Datenverlust bei Anzeige |
| Mieterwechsel = Einheit archivieren | Physische Einheit bleibt; Beziehung wechselt |
| `archiviert_von` Pflicht in V1 | Overhead; V2 ausreichend |

---

## Begründung

1. **Gewerkeübergreifend** — allgemeine Gebäude- und Einheitstypen ohne Dachdecker-Spezialwerte.
2. **MFH + Gemeinschaft** — explizite Einheitstypen und Regeln E2/E3/E4.
3. **Migration-ready** — text + CHECK, klare Felder, kein ENUM-Lock-in.
4. **Datenschutz** — Soft-Archive, keine Hard Deletes, Mieterwechsel getrennt.
5. **Multi-Tenant** — RLS-Grundmodell + mandanteninterner Fingerprint.

---

## Konsequenzen

| Bereich | Folge |
| --- | --- |
| Dokument 10 | O5 teilweise offen; O6/O7 **Grundlagen entschieden** |
| Dokument 12 | B1–B3 finalisiert — DDL-Spezifikation bereit |
| Erste Migration | CHECK-Constraints, Normalisierungs-Trigger/Funktionen, RLS ENABLE ohne Policies |
| UI | Gebäudeart-/Einheitstyp-Auswahl aus Werteset; archivierte Entitäten ausblenden — **nach** Auth-Sprint |
| `/admin` | Unberührt |

---

## Risiken

| Risiko | Mitigation |
| --- | --- |
| `sonstiges` übernutzt | UI-Hinweis; Auswertung in Admin |
| Fingerprint-Kollisionen | Vorschlag only; manuelle Prüfung |
| RLS-Lücken bei Service Role | Code-Review; explizite `mandant_id` in Server Actions |
| Fehlende `archiviert_von` | V2 nachziehen bei Audit-Bedarf |

---

## Nicht Bestandteil dieser Entscheidung

- SQL-DDL (Migration 1 — folgt separater Implementierung)
- UI-Komponenten, Geocoding
- Gewerkespezifische `jsonb`-Schemas (O5)
- Operatives Angebot — separate Tabelle (O4)
- Deprecation `customers`
- RLS-Policies für `authenticated`/`anon` (Post-M1, nach Auth-Sprint)

---

## Verweise

| Dokument | Inhalt |
| --- | --- |
| ADR-0013 | Gesamtmodell |
| ADR-0014 | Domänentrennung |
| ADR-0015 | Adressen 1:n Gebäude; mandantenbezogene Adressen |
| Dokument 10 | Technisches Zielmodell |
| Dokument 12 | [`12-spezifikation-migration-1-operative-stammdaten.md`](../fachkonzept/12-spezifikation-migration-1-operative-stammdaten.md) — Migration 1 DDL-Spezifikation |
