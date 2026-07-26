# Rollenmodell — operative Ebene

Rollen, **Dashboards** und **Berechtigungen** in der Handwerks-Arbeitsplattform.

**Status:** Verbindlich (Fachkonzept) — **Rollen V1 im Plattform-Admin vereinfacht; operative Rollen noch nicht implementiert**  
**Bezug:** [`docs/fachkonzept/02-grundprinzipien.md`](./02-grundprinzipien.md), [`docs/adr/ADR-0005-rollen-steuern-dashboards.md`](../adr/ADR-0005-rollen-steuern-dashboards.md)

---

## Grundsatz

**Gleiche Geschäftsprozesse und Datenbasis für alle Rollen.**  
Die **Rolle** beeinflusst Dashboard, Prioritäten und Berechtigungen — **nicht** die Existenz paralleler Fachprozesse.

---

## Geschäftsführer

| Fokus |
| --- |
| Betriebsstatus |
| Risiken |
| Auslastung |
| Auftragspipeline |
| Liquidität |
| Personal |
| Wichtige Entscheidungen |

---

## Bauleiter

| Fokus |
| --- |
| Einsatzplanung |
| Projektfortschritt |
| Materialstatus |
| Lieferungen |
| Verzögerungen |
| Besichtigungen |
| Baustellenrisiken |

---

## Büro

| Fokus |
| --- |
| Neue Anfragen |
| Termine |
| Angebote |
| Rechnungen |
| Zahlungen |
| Kundenkommunikation |
| Dokumente |

---

## Monteur

| Fokus |
| --- |
| Nächster Einsatz |
| Adresse |
| Team |
| Aufgabe |
| Materialhinweise |
| Navigation |
| Arbeitszeitmeldung |
| Fertigmeldung |
| Materialmangel |
| Abweichungen |

---

## Verbindliche Regeln

| # | Regel |
| --- | --- |
| 1 | **Gleiche Prozesse, gleiche Datenbasis** — keine Rollen-Silos |
| 2 | **Rolle → Dashboard, Prioritäten, Berechtigungen** — nicht → eigene Prozesse |
| 3 | **Monteure ohne separate App** — bevorzugte Kanäle: WhatsApp, SMS, Nachrichtenlink |
| 4 | **Arbeitszeitmeldung** per Sprache oder Nachricht möglich |
| 5 | **Am Vorabend** automatische Einsatzinformation an Monteure |
| 6 | **Bei Planänderung** automatische Benachrichtigung |

---

## Ist-Zustand Plattform

| Ebene | Rollen (Ist) |
| --- | --- |
| Plattform-Admin | Plattform-Hauptadmin (V1) |
| Mandant | Mandanten-Hauptadmin, Mitarbeiter (geplant erweitert) |

Operative Rollen (GF, Büro, Bauleiter, Monteur) sind **Zielbild** — siehe [`docs/systemarchitektur.md`](../systemarchitektur.md) Rollenmodell.

---

## Änderungshistorie

| Datum | Änderung |
| --- | --- |
| 2026-07-26 | Erstversion |
