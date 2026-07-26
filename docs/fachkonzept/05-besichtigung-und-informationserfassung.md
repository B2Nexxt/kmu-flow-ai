# Besichtigung und Informationserfassung

Fachlicher Prozess für **Besichtigungen** und **kanalunabhängige Informationserfassung** — gewerkeübergreifend, KI-unterstützt.

**Status:** Verbindlich (Fachkonzept) — **noch nicht implementiert**  
**Bezug:** [`docs/fachkonzept/02-grundprinzipien.md`](./02-grundprinzipien.md), [`docs/adr/ADR-0006-informationsaufnahme-statt-dateneingabe.md`](../adr/ADR-0006-informationsaufnahme-statt-dateneingabe.md)

---

## Grundsatz

**Informationsaufnahme statt Dateneingabe.**

Der Bauleiter (oder andere Rollen) liefert Informationen in natürlicher Form; das System strukturiert, ergänzt und bereitet vor — ohne starre Formularpflicht während der Erfassung.

---

## Gewerke und Referenz

| Aspekt | Regel |
| --- | --- |
| **Allgemeiner Prozess** | Gilt für verschiedene Handwerksgewerke |
| **Gewerkespezifisch** | Checklisten und Wissensmodelle pro Gewerk |
| **Referenz** | **Dachdecker** nur als Referenzbetrieb — nicht als alleinige Ausprägung |

---

## Flexible Erfassung (Bauleiter)

Der Bauleiter kann flexibel arbeiten:

| Kanal / Situation |
| --- |
| Tablet auf der Baustelle |
| Freie Texteingabe |
| Sprache während der Besichtigung |
| Sprache im Fahrzeug |
| E-Mail |
| SMS / WhatsApp |
| Spätere Sammelerfassung im Büro |

**Der Eingabekanal ist fachlich unerheblich** — alle Kanäle führen in **dieselbe strukturierte Besichtigungsdokumentation**.

---

## KI-Unterstützung

### Extraktion (nach Eingang)

Die KI extrahiert aus unstrukturierten Eingaben u. a.:

| Kategorie |
| --- |
| Maße |
| Kundenwünsche |
| Besonderheiten |
| Risiken |
| Leistungsbedarf |
| Fotos und Dokumente (Zuordnung, Beschreibung) |

### Keine starre Checkliste während der Erfassung

| Regel | Beschreibung |
| --- | --- |
| **Kein Formular-Zwang live** | KI zeigt **keine** starre Checkliste während der aktiven Erfassung |
| **Lückenprüfung nach Abschluss** | Erst nach Abschluss prüft die KI, welche Informationen für **diesen konkreten Fall** fehlen |
| **Situationsbezogene Nachfragen** | Fehlende Angaben werden **kontextbezogen** vorgeschlagen — nicht als generischer Pflichtkatalog |
| **Erfahrene Mitarbeiter** | Werden nicht durch starre Formulare eingeschränkt |

---

## Verantwortung und Freigabe

| Thema | Verantwortung |
| --- | --- |
| **Fachliche Bewertung** | Bauleiter |
| **Risikoentscheidung** | Bauleiter |
| **Angebotsentwurf** | KI darf **vorbereiten** — Freigabe durch Mensch |
| **Materialbedarf** | KI darf **vorschlagen** — Bestätigung erforderlich |
| **Zeitansatz** | KI darf **vorschlagen** — kritische Werte **bestätigen oder korrigieren** |

**Keine ungeprüfte Übernahme** fachlich kritischer KI-Werte in Angebot oder Projekt.

---

## Verbindliche Regeln

1. Alle Kanäle → eine Besichtigungsdokumentation pro Vorgang/Kontext.
2. KI strukturiert — Mensch bestätigt fachlich Relevantes.
3. Gewerkespezifische Vollständigkeit wird **fallbezogen** geprüft, nicht pauschal vorab.
4. Fotos und Dokumente werden dem **Kunden- und Objektkontext** zugeordnet.

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-26 | Erstversion |
