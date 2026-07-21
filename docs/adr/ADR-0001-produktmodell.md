# ADR-0001: Getrenntes Produkt- und Plattformmodell

**Status:** Angenommen (verbindlich)  
**Datum:** 2026-07-21  
**Bezug:** [`docs/produktarchitektur.md`](../produktarchitektur.md), [`docs/systemarchitektur.md`](../systemarchitektur.md)

---

## Kontext

KMU Flow AI verkauft Software-Funktionen und Beratungsleistungen über Angebote an Mandanten. Bisher existierten parallele Konzepte: Freitext-Module im Onboarding, die Zwischenlösung `leistungsmodule` und undokumentierte Preislogik auf Mandantenebene.

Es braucht ein klares fachliches Modell, das **Verkauf** und **Lizenzierung** trennt, ohne doppelte Stammdatenpflege.

---

## Entscheidung

**Produkte** und **Plattformmodule** werden **getrennt** modelliert.

| Entität | Rolle |
| --- | --- |
| **Produkte** | Verkaufbare Einheiten mit Preis, Preisart und Beschreibung |
| **Plattformmodule** | Technische Funktionen der Software — **niemals direkt verkauft** |
| **Paketbestandteile** (`produkt_plattformmodule`) | Explizite Zuordnung: welches Paket-Produkt welche Plattformmodule freischaltet |

Produkttypen:

- **Paket** — enthält Plattformmodule über Paketbestandteile
- **Dienstleistung** — enthält **keine** Plattformmodule

---

## Begründung

1. **Produkte sind verkaufbare Einheiten** — sie erscheinen in Angeboten und Rechnungen mit Preis und Beschreibung.
2. **Plattformmodule sind technische Funktionen** — sie steuern Feature-Gates und `organization_modules`, haben aber keinen eigenen Listenpreis.
3. **Ein Produkt kann mehrere Plattformmodule enthalten** — Pakete bündeln Funktionsumfang; die Zuordnung ist explizit und versionierbar.
4. **Dienstleistungen sind unabhängig** — Beratung, Einrichtung oder Entwicklung werden verkauft, ohne Plattform-Lizenzen auszulösen.

---

## Konsequenzen

### Positiv

- **Produkte steuern Angebote und Rechnungen** — eine klare Verkaufsebene.
- **Plattformmodule steuern Lizenzen** — Feature-Gates prüfen `organization_modules`, nicht Angebotspositionen direkt.
- **Keine doppelte Pflege** — Namen, Beschreibungen und Preise nur in `produkte`; Plattformmodule nur technische Metadaten.

### Negativ / Aufwand

- Migration von `leistungsmodule` (Zwischenlösung) auf `produkte` + `plattformmodule` erforderlich.
- Onboarding muss umgestellt werden (keine direkte Modulauswahl mehr).
- Admin-UI benötigt zwei Stammdaten-Pflegebereiche (Produkte, Plattformmodule).

### Verboten

- Keine neue Admin-UI oder Features auf `leistungsmodule` aufbauen.
- Plattformmodule nicht als Angebotspositionen verkaufen.
- Preise auf Plattformmodul-Ebene einführen.

---

## Alternativen ( verworfen )

| Alternative | Grund der Ablehnung |
| --- | --- |
| Einheitlicher Stamm `leistungsmodule` mit `modultyp` | Vermischt Verkauf und Lizenz; Paketlogik nicht explizit |
| Plattformmodule direkt im Onboarding wählen | Umgeht Produkt-/Angebotskette; widerspricht SaaS-ERP-Prozess |
| Preise nur auf Mandantenebene | Kein produktbasierter Angebots- und Rechnungsfluss |
