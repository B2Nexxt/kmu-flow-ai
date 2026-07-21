# ADR-0004: Produkt-Versionierung (Vorbereitung)

**Status:** Angenommen (Konzept) — **noch keine Implementierung**  
**Datum:** 2026-07-21  
**Bezug:** [`docs/produktarchitektur.md`](../produktarchitektur.md), ADR-0002 (Snapshot-Prinzip)

---

## Kontext

Produktpreise, -beschreibungen und Paketbestandteile ändern sich über die Zeit. Das Snapshot-Prinzip (ADR-0002) schützt historische Angebote und Rechnungen. Für **künftige** Stammdatenpflege soll erkennbar sein, welche Produktfassung zu welchem Zeitpunkt gültig war — analog zu Angebotsversionen.

---

## Entscheidung

**Produkte sollen später versionierbar sein.**

Vorzusehen (Konzept, noch nicht implementiert):

| Feld | Zweck |
| --- | --- |
| `version` | Fortlaufende oder semantische Versionsnummer je Produkt |
| `gueltig_ab` | Start der Gültigkeit dieser Produktfassung |
| `gueltig_bis` | Ende der Gültigkeit (nullable = unbefristet aktiv) |

Neue Angebotspositionen referenzieren die **zum Erstellungszeitpunkt gültige** Produktfassung und snapshotten deren Werte.

---

## Begründung

1. **Nachvollziehbare Preishistorie** — welcher Listenpreis wann galt, ohne Altdaten zu überschreiben.
2. **Paketbestandteile über Zeit** — Funktionsumfang eines Pakets kann sich ändern; alte Verträge bleiben korrekt.
3. **Konsistenz mit Angebotsversionierung** — gleiches Denkmodell auf Stammdatenebene.
4. **Snapshot-Kompatibilität** — Snapshots speichern Werte der gültigen Fassung; Version-ID optional in Positionen.

---

## Konsequenzen

### Jetzt (Phase C und folgend)

- Schema-Design für `produkte` soll Versionierungsfelder **vorsehen**, aber **nicht sofort implementieren**.
- Erste Implementierung: einfacher Produktstamm ohne Versionen; Snapshots wie ADR-0002.
- Keine Migration oder UI für Produktversionen, bis Phase C abgeschlossen.

### Später (wenn implementiert)

- Admin-UI: neue Produktfassung anlegen statt bestehende überschreiben.
- RPC: bei Positionsanlage gültige Fassung zum `now()` auflösen.
- Deaktivierung über `gueltig_bis` statt Hard-Delete.

### Offen

- Granularität: Version pro Produkt vs. globaler Katalog-Release.
- Ob Paketbestandteile pro Version oder separat versioniert werden.
- Auswirkung auf Abonnements (Phase E).

---

## Alternativen ( verworfen )

| Alternative | Grund der Ablehnung |
| --- | --- |
| Produktstamm ohne Versionierung dauerhaft | Preis-/Paketänderungen überschreiben Stamm; Snapshots allein reichen für Pflege-UI nicht |
| Sofortige Implementierung | Blockiert Phase C; Snapshot-Prinzip deckt V1 ab |
