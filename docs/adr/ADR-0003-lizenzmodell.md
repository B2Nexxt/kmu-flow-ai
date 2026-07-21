# ADR-0003: Lizenzmodell über Produkte und Paketbestandteile

**Status:** Angenommen (verbindlich)  
**Datum:** 2026-07-21  
**Bezug:** [`docs/produktarchitektur.md`](../produktarchitektur.md), [`docs/plattformmodule-katalog.md`](../plattformmodule-katalog.md)

---

## Kontext

Aktuell wählt das Mandanten-Onboarding Plattformmodule direkt über Checkboxen (`MODULE_OPTIONS`) und persistiert Freitext in `organization_modules.modul`. Das widerspricht dem SaaS-ERP-Prozess, in dem Lizenzen aus **gekauften Produkten** entstehen.

---

## Entscheidung

Nach **Vertragsannahme** (auf Basis einer angenommenen Angebotsversion) erfolgt die Lizenzaktivierung über folgende Kette:

```
Produkte (Paket-Positionen im Angebot)
    ↓
Paketbestandteile (produkt_plattformmodule)
    ↓
Plattformmodule
    ↓
organization_modules (lizenz_status, aktiviert_am, …)
```

**Keine direkte Modulauswahl mehr im Onboarding.**

Dienstleistungs-Produkte lösen **keine** Plattform-Lizenzierung aus.

Mehrere Pakete im Angebot: **Vereinigungsmenge** aller enthaltenen Plattformmodule.

---

## Begründung

1. **Prozesskette** — Produkte → Angebote → Verträge → Lizenzen (nicht umgekehrt).
2. **Eine Wahrheitsquelle** — `organization_modules` spiegelt gekauften Funktionsumfang, nicht manuelle Admin-Auswahl.
3. **Keine doppelte Pflege** — Modulnamen und -preise nicht in `organization_modules` duplizieren.
4. **Feature-Gates** — prüfen `organization_modules.lizenz_status = aktiv` + `plattformmodule.technischer_schluessel`.

---

## Konsequenzen

### Positiv

- Lizenzumfang ist **auditierbar** aus Angebot/Vertrag ableitbar.
- Upgrades/Downgrades über Angebots- und Vertragsänderungen modellierbar.
- Klare Trennung: Verkauf (Produkte) vs. Nutzung (Plattformmodule).

### Aufwand

- RPC für Lizenz-Aktivierung aus angenommenem Angebot (Phase G).
- Onboarding-UI und `create_mandant_onboarding` umstellen (Phase G) — **Ist bleibt bis dahin unverändert**.
- Backfill bestehender Freitext-`organization_modules` → `plattformmodul_id`.

### `lizenz_status`

| Wert | Bedeutung |
| --- | --- |
| `geplant` | Vorgemerkt, noch nicht nutzbar |
| `aktiv` | Mandant darf Funktion nutzen |
| `pausiert` | Temporär gesperrt |
| `gekündigt` | Beendet |

---

## Alternativen ( verworfen )

| Alternative | Grund der Ablehnung |
| --- | --- |
| Direkte Modulauswahl im Onboarding (Ist) | Umgeht Produkt-/Angebotskette; bleibt nur bis Phase G |
| Lizenz aus Mandanten-Gesamtpreis ableiten | Kein produktbasierter Funktionsumfang |
| Plattformmodule als Angebotspositionen | Vermischt Verkauf und technische Lizenz |
