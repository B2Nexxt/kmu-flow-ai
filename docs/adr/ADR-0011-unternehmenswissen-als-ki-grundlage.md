# ADR-0011: Unternehmenswissen als KI-Grundlage

**Status:** Angenommen (verbindlich)  
**Datum:** 2026-07-26  
**Bezug:** [`docs/fachkonzept/06-unternehmenswissen-und-standards.md`](../fachkonzept/06-unternehmenswissen-und-standards.md), [`docs/grundprinzipien.md`](../grundprinzipien.md)

---

## Kontext

KI kann Angebotsentwürfe, Materialvorschläge und Texte generieren. Ohne Leitplanke entstehen erfundene Preise, Hersteller oder Leistungen — fachlich und rechtlich problematisch.

---

## Entscheidung

**Die KI verwendet vorrangig freigegebenes Unternehmenswissen.**

| Regel | Beschreibung |
| --- | --- |
| **Keine erfundenen Materialien/Hersteller/Preise** | KI wählt aus Unternehmens-Stammdaten und Standards |
| **Priorität** | Unternehmenswissen → Standards → explizite Nutzerangabe |
| **Wiederverwendung** | Wissen einmal erfassen, in Angebot, Projekt, Material, Rechnung nutzen |
| **Bestätigung** | KI output ist Entwurf — Mensch gibt frei (konsistent Grundprinzipien §3) |

---

## Alternativen ( verworfen )

| Alternative | Grund der Ablehnung |
| --- | --- |
| Generische Branchen-KI ohne Betriebswissen | Falsche Preise/Produkte |
| Vollautomatische Angebotsfreigabe | Widerspricht Mensch-entscheidet |
| Nur manuelle Eingabe ohne KI | Verschenkt Assistenzpotenzial |

---

## Begründung

1. **Vertrauen** — Vorschläge basieren auf vom Betrieb definiertem Wissen.
2. **Haftung** — Fachliche Verantwortung beim Betrieb ([`docs/fachkonzept/01-philosophie.md`](../fachkonzept/01-philosophie.md)).
3. **Effizienz** — KI übersetzt bestätigte Lösung in Katalogbausteine (Fachkonzept 07).

---

## Konsequenzen

### Positiv

- Einheitliche Wissensbasis für alle KI-Funktionen.
- Abgrenzung zu SaaS-Produktkatalog (Vertrieb an Mandant).

### Aufwand

- Unternehmenswissen-Store (Struktur, Pflege-UI) — geplant.
- RAG/Context-Injection aus freigegebenen Daten.

### Nicht Bestandteil dieser Entscheidung

- LLM-Modellauswahl
- Konkrete Prompt-Architektur
- `produkte`-Katalog Plattform-Admin (ADR-0001)

---
