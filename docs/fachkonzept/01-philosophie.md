# Philosophie — KMU Flow AI (operative Ebene)

Verbindliche **fachliche Leitbilder** für die operative Arbeitsplattform von KMU Flow AI im Handwerkskontext.

**Status:** Verbindlich (Fachkonzept) — **noch nicht vollständig implementiert**  
**Bezug:** [`docs/grundprinzipien.md`](../grundprinzipien.md), [`docs/produktkonzept.md`](../produktkonzept.md), [`docs/fachkonzept/02-grundprinzipien.md`](./02-grundprinzipien.md)

---

## Einordnung

KMU Flow AI umfasst **zwei Ebenen**, die sich ergänzen:

| Ebene | Zielgruppe | Dokumentation |
| --- | --- | --- |
| **Plattform-Admin / SaaS-Betrieb** | Internes Beratungs- und Vertriebsteam — Route **`/admin`** | [`docs/produktkonzept.md`](../produktkonzept.md), [`docs/systemarchitektur.md`](../systemarchitektur.md), ADR-0014 |
| **Operative Arbeitsplattform** | Handwerksbetriebe als Mandanten — Route **`/`** (App außerhalb `/admin`) | Dieses Fachkonzept (`docs/fachkonzept/`), ADR-0014 |

Die folgenden Aussagen gelten für die **operative Ebene** — den digitalen Betriebspartner im Handwerksalltag.

---

## Leitbild

KMU Flow AI ist ein **digitaler Betriebspartner für Handwerksunternehmen**.

Die Plattform soll dafür sorgen, dass ein Betrieb **jeden Tag arbeitsfähig** ist — nicht nur Daten verwaltet, sondern den **Arbeitsalltag aktiv unterstützt**.

| Grundsatz | Bedeutung |
| --- | --- |
| **Mehr als Datenverwaltung** | Die Software organisiert Informationen und unterstützt Entscheidungen, Aufgaben und Kommunikation im Tagesgeschäft |
| **Rollenabhängige Relevanz** | Die Plattform zeigt rollenabhängig, **was heute wichtig ist** — ohne parallele Fachprozesse pro Rolle |
| **Prozesse vor Dashboards** | Geschäftsprozesse bleiben **zentral**; Dashboards aggregieren und priorisieren, ersetzen aber keine Prozesse |
| **Anpassung an Menschen** | Die Software passt sich den Menschen und der **Arbeitsweise des Unternehmens** an — nicht umgekehrt im operativen Alltag |
| **Automatisierung + Verantwortung** | Standardfälle werden automatisiert; Menschen bearbeiten **Ausnahmen** und treffen **fachliche Entscheidungen** |
| **Niedrige Hürde für Externe** | Externe Beteiligte (Kunden, Lieferanten, Monteure ohne App) sollen möglichst **keine App und keinen Login** benötigen |
| **Gewerkeübergreifend** | Die Software ist für **verschiedene Handwerksgewerke** nutzbar — der **Dachdeckerbetrieb dient nur als Referenzbetrieb**, nicht als alleinige Zielbranche |

---

## Verbindliche Leitsätze

1. **Die Plattform gibt den Geschäftsprozess vor. Das Unternehmen bestimmt seine Arbeitsweise.**  
   Standardprozesse und Best Practices sind vorgegeben; Ausführung, Kanäle und Ausnahmen konfiguriert der Betrieb.

2. **Rollen steuern Dashboards und Prioritäten, nicht die Existenz der Geschäftsprozesse.**  
   Alle Rollen arbeiten auf derselben Prozess- und Datenbasis. Siehe [`docs/adr/ADR-0005-rollen-steuern-dashboards.md`](../adr/ADR-0005-rollen-steuern-dashboards.md).

3. **Informationen werden nur einmal erfasst und anschließend wiederverwendet.**  
   Keine doppelte Pflege in Angebot, Projekt, Materialplanung und Rechnung.

4. **Die KI bereitet vor, erinnert und schlägt vor. Der Mensch entscheidet.**  
   Konsistent mit [`docs/grundprinzipien.md`](../grundprinzipien.md) Abschnitt 3 und 4.

5. **Die Software passt sich dem Kommunikationsweg des Nutzers an.**  
   Eingabe per Sprache, WhatsApp, E-Mail oder direkt im System — der Kanal ist sekundär. Siehe ADR-0006.

6. **Standardfälle laufen automatisch. Unklare Fälle werden manuell geprüft.**  
   Automatische Zuordnung und Entscheidungen nur bei eindeutiger Datenlage.

7. **Fachliche Verantwortung bleibt beim Handwerksbetrieb.**  
   Die Plattform unterstützt und dokumentiert — sie übernimmt keine Haftung für fachliche oder kalkulatorische Entscheidungen.

---

## Abgrenzung zum Plattform-Admin

Verbindliche Domänentrennung: [`docs/adr/ADR-0014-trennung-saas-admin-und-operative-kundenplattform.md`](../adr/ADR-0014-trennung-saas-admin-und-operative-kundenplattform.md).

| Thema | Plattform-Admin (`/admin`, Ist/Ziel) | Operative Ebene (`/`, Fachkonzept — **noch nicht implementiert**) |
| --- | --- | --- |
| Angebote | Plattform-Angebote **an Mandanten** — Phase B ✅ | Endkunden-Angebote **des Handwerks** — **geplant**, eigene Tabellen |
| Mandanten-Onboarding | Phase A ✅ mit Modul-Checkboxen | Ziel: Lizenzen aus Paket-Produkten — **noch nicht umgesetzt** |
| Kunden/Leads | `organizations` = SaaS-Mandant (Interessent/Aktiv) | `kunden` = Endkunde des Handwerks — **Fachkonzept, nicht implementiert** |
| Legacy `customers` | Nicht Admin-Domäne; leer, ungenutzt | **Nicht weiterentwickeln** — siehe ADR-0014, Dok. 11 |

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-26 | Erstversion — verbindliche Philosophie operative Ebene |
| 2026-07-26 | Verweis ADR-0014 — Routing- und Domänentrennung `/admin` vs `/` |
