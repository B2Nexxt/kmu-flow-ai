# Anfrageprozess

Fachlicher Prozess für den **Eingang und die Bearbeitung von Kundenanfragen** — kanalunabhängig, mit kontrollierter automatischer Zuordnung.

**Status:** Verbindlich (Fachkonzept) — **noch nicht implementiert**  
**Bezug:** [`docs/fachkonzept/03-kunden-und-objektmodell.md`](./03-kunden-und-objektmodell.md), [`docs/adr/ADR-0008-automatische-zuordnungslogik.md`](../adr/ADR-0008-automatische-zuordnungslogik.md)

---

## Eingangskanäle

Alle Kanäle führen in **denselben Anfrageprozess**:

| Kanal |
| --- |
| Telefon |
| E-Mail |
| Kontaktformular |
| WhatsApp |
| SMS |
| Empfehlung |
| Persönliche Anfrage |

---

## Fachliche Bewertungen (pro Anfrage)

| Bewertung | Beschreibung |
| --- | --- |
| **Anfrageart** | z. B. Reparatur, Neubau, Wartung, Notfall |
| **Vollständigkeit** | Sind alle für den nächsten Schritt nötigen Informationen vorhanden? |
| **Dringlichkeit** | Normal, zeitkritisch, Notfall |
| **Klärungsbedarf** | Offene Fragen an Kunde oder intern |
| **Nächster sinnvoller Schritt** | System- oder Mitarbeitervorschlag |

---

## Mögliche Prozesspfade

| Pfad | Auslöser |
| --- | --- |
| Fehlende Informationen automatisch anfordern | Vollständigkeit unzureichend |
| Besichtigung erforderlich | Leistung nicht aus Ferne kalkulierbar |
| Direktangebot möglich | Vollständige, standardisierbare Anfrage |
| Notfall | Dringlichkeit = Notfall |
| Manuelle Klärung erforderlich | Widersprüche, unklare Zuordnung, Sonderfall |

---

## Kanal-spezifisches Verhalten

### Telefon

- Büro **bestätigt Kunde und Objekt direkt im Gespräch**
- Manuelle oder assistierte Zuordnung während des Calls
- Keine automatische Zuordnung ohne Bestätigung

### Digitale Anfrage

- Automatische Zuordnung **nur bei eindeutiger Datenlage**
- Sonst: Vorschlag + manuelle Bestätigung oder Neuanlage

---

## Zuordnungslogik (verbindlich)

Automatische Verknüpfung mit bestehendem Kunden/Objekt nur wenn:

1. **Mindestens zwei unabhängige Merkmale** stimmen überein
2. **Keine widersprüchlichen** Merkmale vorliegen
3. Bei Mehrfamilienhäusern: **konkrete Einheit oder Gemeinschaftsbereich eindeutig**

Details: ADR-0008.

### Geeignete Merkmalskombinationen (Beispiele)

| Kombination |
| --- |
| Kundennummer + Objektadresse |
| E-Mail-Adresse + Objektadresse |
| Telefonnummer + Objektadresse |
| Kundennummer + konkrete Einheit |
| Bekannter Kontakt + signierter Vorgangslink |

### Nicht ausreichend (allein oder als „zwei Merkmale“)

| Unzureichend |
| --- |
| Straße + Hausnummer als zwei getrennte Merkmale derselben Adresse |
| Nur gleicher Name |
| Nur gleiche E-Mail |
| Nur gleiche Adresse (ohne Einheit bei MFH) |

---

## Fallbehandlung

| Fall | Verhalten |
| --- | --- |
| **Eindeutige Zuordnung** | Automatisch verknüpfen; Entscheidungsgrundlage protokollieren |
| **Ein Treffer / mehrere Möglichkeiten** | Vorschlag an Büro; **manuelle Bestätigung** |
| **Widersprüchliche Daten** | Konflikt markieren; **keine automatische Aktion** |
| **Kein Treffer** | Neuen Kunden, neues Objekt und neue Anfrage **anlegen** (assistiert/automatisch) |

---

## Zusätzliche verbindliche Regeln

| Regel | Beschreibung |
| --- | --- |
| **Protokollierung** | Automatische Entscheidungsgrundlage (Merkmale, Regel, Ergebnis) wird protokolliert |
| **Kein Fuzzy-Match** | Keine unscharfe Zuordnung ohne menschliche Bestätigung |
| **Terminvorschläge** | Bei vollständiger Anfrage: passende Terminvorschläge automatisch an Kunden |
| **Terminbestätigung ohne Portal** | Kunde bestätigt Termin **ohne Portalpflicht und ohne Benutzerkonto** (Link, SMS, E-Mail) |
| **Nachfassen** | Bei fehlender Reaktion: automatische Erinnerungen → später Aufgabe für Büro |

---

## Abgrenzung zum Ist-Zustand

| Bereich | Ist (Plattform) | Ziel (Fachkonzept) |
| --- | --- | --- |
| Anfragen operativ | Nicht implementiert | Dieser Prozess |
| Angebote Plattform-Admin | Phase B ✅ | Separater Prozess (Mandantenvertrieb) |

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-26 | Erstversion |
