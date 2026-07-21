# ADR-0002: Snapshot-Prinzip für Angebote und Rechnungen

**Status:** Angenommen (verbindlich)  
**Datum:** 2026-07-21  
**Bezug:** [`docs/produktarchitektur.md`](../produktarchitektur.md), [`docs/angebote-datenmodell.md`](../angebote-datenmodell.md)

---

## Kontext

Produktstammdaten (Name, Beschreibung, Preis, Preisart, Steuer) ändern sich im Laufe der Zeit. Angebote und Rechnungen sind **rechts- und abrechnungsrelevante Dokumente** — nachträgliche Katalogänderungen dürfen historische Fassungen nicht verändern.

---

## Entscheidung

**Angebote** und **Rechnungen** speichern Produktdaten als **Snapshot** in Positionszeilen.

Beim Anlegen oder Aktualisieren einer Position werden folgende Werte aus dem Produktstamm **kopiert und persistiert**:

- Bezeichnung (`name`)
- Beschreibung
- Einzelpreis netto (Cent)
- Einheit
- Umsatzsteuer-Satz
- Preisart (`einmalig` \| `monatlich`)
- Produkttyp (`paket` \| `dienstleistung`)

Die Referenz `produkt_id` dient der Nachverfolgung; **maßgeblich für Anzeige und Berechnung** sind die Snapshot-Felder.

**Preisänderungen am Produktstamm verändern keine historischen Angebots- oder Rechnungspositionen.**

---

## Begründung

1. **Rechtssicherheit** — angenommene Angebotsversionen und Rechnungen bleiben inhaltlich stabil.
2. **Nachvollziehbarkeit** — erkennbar, welcher Preis zum Zeitpunkt des Verkaufs galt.
3. **Katalogfreiheit** — Produktpreise können angepasst werden, ohne Altdaten zu migrieren.
4. **Konsistenz** — gleiches Prinzip bereits in Angebotsmodul V1 für Positionsfelder etabliert.

---

## Konsequenzen

### Positiv

- Freigegebene und angenommene Versionen sind **eingefroren** — keine rückwirkenden Katalogänderungen.
- Rechnungen können Positionen **1:1 aus Angeboten** übernehmen (weiterer Snapshot-Kopie-Schritt).
- Nur `rabatt_prozent` bleibt pro Position individuell editierbar (Entwurf).

### Aufwand

- RPCs müssen Snapshots serverseitig schreiben — Client sendet nur `produkt_id` + `rabatt_prozent`.
- Produkt-Versionierung (ADR-0004) muss Snapshot-Logik berücksichtigen, sobald implementiert.

### Regeln

| Situation | Verhalten |
| --- | --- |
| Produktpreis geändert | Wirkt nur auf **neue** Positionen |
| Produkt deaktiviert | Historische Positionen bleiben sichtbar |
| Neue Angebotsversion | Snapshots werden aus aktuellem Stamm neu geschrieben (Entwurf) |

---

## Alternativen ( verworfen )

| Alternative | Grund der Ablehnung |
| --- | --- |
| Live-Join auf Produktstamm | Historische Dokumente ändern sich bei Katalogpflege |
| Snapshot nur in PDF | Datenbank und UI wären inkonsistent |
