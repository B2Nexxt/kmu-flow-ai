# ADR-0007: Kunden- und Objektmodell

**Status:** Angenommen (verbindlich)  
**Datum:** 2026-07-26  
**Bezug:** [`docs/fachkonzept/03-kunden-und-objektmodell.md`](../fachkonzept/03-kunden-und-objektmodell.md)

---

## Kontext

Handwerksbetriebe bedienen mehrere Kunden, Objekte und Wohneinheiten an derselben Adresse. Adressgleichheit wird oft fälschlich mit Identität verwechselt — mit Datenschutz- und Zuordnungsrisiken (Mieterwechsel).

---

## Entscheidung

1. **Kundenakte** ist zentraler Einstieg.
2. **Ein Kunde kann mehrere Objekte** besitzen oder beauftragen.
3. **Mehrfamilienhäuser** erfordern verpflichtend **Einheit oder Gemeinschaftsbereich**.
4. **Keine Verknüpfung allein anhand der Adresse** — gleiche Adresse ≠ gleicher Kunde.
5. **Technische Objektdaten** und **personenbezogene Vorgänge** getrennt behandeln.
6. **Mieterwechsel:** physische Einheit bleibt; Vorgänge des Vormieters nicht automatisch dem Nachmieter zuordnen.

---

## Alternativen ( verworfen )

| Alternative | Grund der Ablehnung |
| --- | --- |
| Adresse als Primärschlüssel | Mieterwechsel, MFH, verschiedene Auftraggeber |
| Ein Objekt pro Kunde erzwingen | Mehrobjektkunden (Haus + Halle) |
| Automatische Zusammenführung bei gleichem Namen | Homonyme, Tippfehler, Datenschutz |

---

## Begründung

1. **Datenschutz** — Personenbezogene Historie nur im richtigen Kontext.
2. **MFH-Realität** — Einheit ist Pflicht für eindeutige Leistungserbringung.
3. **Auditierbarkeit** — Vorgänge explizit zugeordnet, nicht inferiert.

---

## Konsequenzen

### Positiv

- Klare Regeln für Anfrage-Zuordnung (siehe ADR-0008).
- Wiederverwendung technischer Objektdaten ohne Preisgabe personenbezogener Vorgänge.

### Aufwand

- Datenmodell mit Kunde, Objekt, Einheit (noch nicht technisch festgelegt).
- UI: Kundenakte mit explizit zugeordneten Objekten/Vorgängen.

### Nicht Bestandteil dieser Entscheidung

- ~~SQL-Tabellen und FK-Design~~ → **ersetzt durch** [ADR-0013](./ADR-0013-technisches-kunden-objekt-vorgangsmodell.md) (Zielmodell; Implementierung offen)
- Integration mit `customers` im Plattform-CRM — siehe ADR-0013 Migrationsfolgen
- Geocoding / Adressvalidierung

---
