# ADR-0005: Rollen steuern Dashboards, nicht Geschäftsprozesse

**Status:** Angenommen (verbindlich)  
**Datum:** 2026-07-26  
**Bezug:** [`docs/fachkonzept/01-philosophie.md`](../fachkonzept/01-philosophie.md), [`docs/fachkonzept/08-rollenmodell.md`](../fachkonzept/08-rollenmodell.md)

---

## Kontext

In Handwerksbetrieben arbeiten Geschäftsführung, Büro, Bauleiter und Monteure mit unterschiedlichen Prioritäten. Gefahr: parallele „Mini-Systeme“ pro Rolle (eigenes Angebots-UI für Büro, separates Projekt-Tool für Bauleiter).

---

## Entscheidung

**Rollen steuern Dashboards, Prioritäten und Berechtigungen — nicht die Existenz der Geschäftsprozesse.**

Alle Rollen nutzen dieselben Fachprozesse (Anfrage → Besichtigung → Angebot → Projekt → Rechnung) und dieselbe Datenbasis. Rollen bestimmen, **was prominent angezeigt wird** und **welche Aktionen erlaubt sind**.

---

## Alternativen ( verworfen )

| Alternative | Grund der Ablehnung |
| --- | --- |
| Pro Rolle eigene Prozesskette | Doppelte Daten, Inkonsistenzen, höherer Pflegeaufwand |
| Ein Dashboard für alle ohne Rollenfilter | Überfrachtung, irrelevante Informationen |
| Monteure nur über Voll-App | Widerspricht Philosophie niedriger Hürde (WhatsApp/SMS) |

---

## Begründung

1. **Ein Prozess, eine Wahrheit** — Angebot und Projekt bleiben verknüpft unabhängig von der Rolle.
2. **Skalierbarkeit** — Neue Rollen erweitern Sicht und Rechte, nicht Prozesslandschaft.
3. **Monteur-Realität** — Feldmitarbeiter brauchen fokussierte Ansicht, nicht separates Fachsystem.

---

## Konsequenzen

### Positiv

- Einheitliche Prozessdokumentation und Workflow-Engine.
- Berechtigungsmodell zentral steuerbar.
- Dashboards als Konfigurationsschicht, nicht als Domänenmodell.

### Aufwand

- Dashboard- und Berechtigungskonzept pro Rolle ausarbeiten.
- Operative Rollen (GF, Büro, Bauleiter, Monteur) von Plattform-Admin-Rollen trennen.

### Nicht Bestandteil dieser Entscheidung

- Konkrete UI-Mockups oder Screen-Listen
- Feingranulare Rechte je Aktion (folgt später)
- Implementierung des Mandanten-Rollenmodells

---
