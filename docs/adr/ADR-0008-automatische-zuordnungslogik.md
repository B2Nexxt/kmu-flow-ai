# ADR-0008: Automatische Zuordnungslogik

**Status:** Angenommen (verbindlich)  
**Datum:** 2026-07-26  
**Bezug:** [`docs/fachkonzept/04-anfrageprozess.md`](../fachkonzept/04-anfrageprozess.md), ADR-0007

---

## Kontext

Digitale Anfragen sollen möglichst automatisch Kunden und Objekten zugeordnet werden — ohne falsche Verknüpfungen bei ähnlichen Adressen oder Namen.

---

## Entscheidung

**Automatische Zuordnung nur bei:**

1. **Mindestens zwei unabhängigen Merkmalen** stimmen überein, **und**
2. **Keine widersprüchlichen** Merkmale, **und**
3. Bei MFH: **Einheit/Gemeinschaftsbereich eindeutig**.

**Sonst:**

| Situation | Aktion |
| --- | --- |
| Ein Treffer / mehrere Möglichkeiten | Vorschlag + **manuelle Bestätigung** |
| Widersprüchliche Daten | Konflikt, **keine automatische Aktion** |
| Kein Treffer | **Neuanlage** Kunde + Objekt + Anfrage |

**Kein Fuzzy-Match ohne Bestätigung.** Entscheidungsgrundlage wird **protokolliert**.

---

## Alternativen ( verworfen )

| Alternative | Grund der Ablehnung |
| --- | --- |
| Automatisch bei gleicher Adresse | Verstößt gegen ADR-0007 |
| Immer manuell | Skaliert nicht; Telefon-Ausnahme bleibt |
| ML-Fuzzy ohne Threshold | Unnachvollziehbar, datenschutzriskant |

---

## Begründung

1. **Zwei unabhängige Merkmale** reduzieren Fehlzuordnung nachvollziehbar.
2. **Protokollierung** erfüllt Audit-Anforderung ([`docs/grundprinzipien.md`](../grundprinzipien.md)).
3. **Neuanlage bei Unsicherheit** ist sicherer als falsche Verknüpfung.

---

## Konsequenzen

### Positiv

- Regelbasierte, erklärbare Automatisierung.
- Büro entlastet bei eindeutigen Fällen.

### Aufwand

- Regel-Engine oder RPC-Logik für Merkmalsprüfung.
- UI für Konflikt- und Vorschlagsfälle.

### Nicht Bestandteil dieser Entscheidung

- Konkrete Merkmalsgewichtung oder Scoring
- OCR / Adressparser-Technologie
- Implementierung in `create_mandant_onboarding` (separater Prozess)

---
