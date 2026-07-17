# Datenmodell KMU Flow AI

## Grundprinzip

Das fachliche Datenmodell von KMU Flow AI beschreibt die zentralen Geschäftsobjekte der Plattform und ihre Beziehungen zueinander. Es bildet die Grundlage für Beratung, Vertrieb, Vertragswesen, Abrechnung und laufenden Mandantenbetrieb.

Die wichtigsten Grundsätze:

- Ein **Mandant** ist die übergeordnete Geschäftsbeziehung zu einem Kunden.
- Ein Mandant kann **mehrere Unternehmen** besitzen.
- Ein Unternehmen kann **mehrere Standorte** besitzen.
- **Personen**, **Benutzer**, **Verträge** und **Dokumente** werden als eigenständige Objekte modelliert und nicht vermischt.

Diese Trennung ermöglicht flexible Mandantenstrukturen, klare Verantwortlichkeiten und eine spätere technische Abbildung in Datenbank, Berechtigungen und Workflows.

---

# Domänenmodell

Übersicht der Hauptobjekte und ihrer fachlichen Beziehungen:

```
                                    ┌─────────────┐
                                    │  Beratung   │
                                    └──────┬──────┘
                                           │
┌──────────┐    besitzt    ┌──────────────▼──────────────┐    führt zu    ┌────────────────┐
│ Mandant  │──────────────►│        Unternehmen          │───────────────►│ Prozessanalyse │
└────┬─────┘               └──────────────┬──────────────┘                └───────┬────────┘
     │                                    │                                       │
     │                                    │ hat                                   │ erzeugt
     │                                    ▼                                       ▼
     │                          ┌─────────────────┐                        ┌─────────────┐
     │                          │    Standorte    │                        │   Angebot   │
     │                          └────────┬────────┘                        └──────┬──────┘
     │                                   │                                          │
     │                                   │                                          │ Versionen
     │                                   │                                          ▼
     │                          ┌────────▼────────┐                        ┌─────────────┐
     │                          │ Modulaktivierung│◄─────── gehört zu ─────│   Vertrag   │
     │                          └────────┬────────┘                        └──────┬──────┘
     │                                   │                                          │
     │                                   │ basiert auf                              │ enthält
     │                                   ▼                                          ▼
     │                          ┌─────────────────┐                        ┌──────────────────┐
     │                          │     Module      │                        │ Vertragsposition │
     │                          └─────────────────┘                        └────────┬─────────┘
     │                                                                                │
     │ hat                                                                            │ bildet Grundlage für
     ▼                                                                                ▼
┌─────────────┐                                                              ┌───────────────┐
│ Abonnement  │─────────────────────────────────────────────────────────────►│  Rechnungen   │
└──────┬──────┘                                                              └───────┬───────┘
       │                                                                              │
       │ nutzt                                                                        │ verwendet
       ▼                                                                              ▼
┌─────────────────┐                                                          ┌──────────────────┐
│ Rechnungsprofil │                                                          │ Rechnungsempfänger│
└─────────────────┘                                                          └──────────────────┘

┌──────────┐    kann sein    ┌──────────┐    verknüpft mit    ┌──────────┐
│  Person  │────────────────►│ Benutzer │────────────────────►│ Mandant  │
└────┬─────┘                 └──────────┘                     └──────────┘
     │
     │ Rollen: Geschäftsführer, Gesellschafter, Ansprechpartner usw.
     │
     ▼
┌──────────┐    erzeugt    ┌──────────┐    enthält    ┌──────────┐
│  Angebot │──────────────►│ Projekt  │──────────────►│ Aufgabe  │
└──────────┘               └──────────┘               └──────────┘

┌──────────┐
│ Dokument │──── verknüpft mit Mandant, Unternehmen, Vertrag, Projekt, Beratung usw.
└──────────┘
```

---

## Mandant

### Zweck

Der Mandant bildet die **Geschäftsbeziehung** zwischen KMU Flow AI und einem Kunden ab. Er ist die oberste Organisationseinheit auf Kundenseite.

### Verantwortlichkeiten

- Bündelung aller Unternehmen, Standorte und Verträge eines Kunden
- Verwaltung von Modulen, Abonnements und Abrechnung
- Zuordnung von Benutzern und Ansprechpartnern
- Abbildung des gesamten Kundenlebenszyklus

### Status

Jeder Mandant besitzt genau **einen Status**, der seine aktuelle Phase im Lebenszyklus beschreibt.

**Grundsatz:** „Interessent“ ist **kein eigener Datensatztyp**, sondern ein **Status** eines Mandanten. Der Datensatz wird während seines gesamten Lebenszyklus weiterverwendet. Eine Statusänderung erzeugt **keinen neuen Datensatz**.

Status im MVP:

| Status | Bedeutung |
| --- | --- |
| **Interessent** | Potenzieller Kunde im Vertriebs- oder Beratungsprozess |
| **Aktiver Mandant** | Kunde mit laufendem oder vorbereitetem Mandantenverhältnis |

Später erweiterbar um unter anderem:

- Qualifiziert
- Angebot erstellt
- Angebot angenommen
- Pausiert
- Gekündigt
- Archiviert

Ein Interessent wird durch **Änderung des Status** zum aktiven Mandanten. Dabei bleiben alle vorhandenen Stammdaten, Verknüpfungen und die Mandantenakte unverändert am selben Datensatz erhalten.

### Technische Abbildung (MVP Phase 2)

Das Onboarding nutzt das **bestehende Multi-Tenant-Modell** und erzeugt keine parallele `mandanten`-Tabelle.

| Bestehende / erweiterte Tabelle | Zweck |
| --- | --- |
| **organizations** | Mandant inkl. Status, Vertrags-/Preisangaben und Stammdaten des Hauptunternehmens (MVP) |
| **organization_members** | Plattform-Benutzer mit Login und Rolle (unverändert) |
| **customers** | Operative Kunden des Mandanten im CRM (unverändert, kein Mandant) |
| **ansprechpartner** | Personen mit Rollenflags (`ist_geschaeftsfuehrer`, `ist_hauptansprechpartner`) |
| **bankverbindungen** | Optionale Bankverbindung (0 oder 1 pro Anlage) |
| **organization_modules** | Zuordnung ausgewählter Module |
| **organization_automatisierungen** | Zuordnung ausgewählter Automatisierungen |

Die Anlage erfolgt **atomar** über eine PostgreSQL-Funktion (`create_mandant_onboarding`), die in `organizations` schreibt. Die zurückgegebene ID ist die `organizations.id`.

### Beziehungen

Ein Mandant:

- besitzt **mehrere Unternehmen**
- schließt **mehrere Verträge**
- kann **mehrere Abonnements** haben
- verfügt über **Benutzer**, **Dokumente**, **Beratungen**, **Projekte** und **Rechnungen**
- wird im **Plattform-Admin** angelegt und betreut

---

## Unternehmen

### Zweck

Ein Unternehmen repräsentiert eine **juristische oder wirtschaftliche Einheit** innerhalb eines Mandanten.

### Eigenschaften

- Ein Mandant kann **mehrere Unternehmen** besitzen.
- Es kann ein **Hauptunternehmen** definiert werden.
- **Unternehmensbeziehungen** können abgebildet werden, z. B. Muttergesellschaft, Tochtergesellschaft oder verbundenes Unternehmen.

### Beziehungen

Ein Unternehmen:

- gehört zu genau **einem Mandanten**
- besitzt **mehrere Standorte**
- kann **mehrere Personen** in unterschiedlichen Rollen haben
- kann in **einem oder mehreren Verträgen** vorkommen
- kann **Module** und **Rechnungsprofile** eigenständig nutzen

---

## Standorte

### Zweck

Standorte beschreiben die **räumliche oder organisatorische Präsenz** eines Unternehmens.

### Standorttypen

- **Hauptsitz**
- **Niederlassung**
- **Filiale**
- **Werk**
- **Lager**
- **Rechnungsadresse**

### Beziehungen

Ein Standort:

- gehört zu genau **einem Unternehmen**
- kann als **Rechnungs- oder Lieferadresse** dienen
- kann für **Modulaktivierungen** relevant sein
- kann in **Verträgen**, **Rechnungen** und **Dokumenten** referenziert werden

---

## Personen

### Zweck

Personen sind **natürliche Kontakte**, unabhängig davon, ob sie einen Systemzugang besitzen.

### Rollen

Eine Person kann eine oder mehrere Rollen besitzen, unter anderem:

- **Geschäftsführer**
- **Gesellschafter**
- **wirtschaftlich Berechtigte**
- **Ansprechpartner**

### Eigenschaften

- Eine Person kann **mehrere Rollen** gleichzeitig haben.
- Eine Person kann mit **mehreren Unternehmen** oder Standorten verknüpft sein.
- Eine Person kann optional ein **Benutzerkonto** besitzen.

---

## Benutzer

### Zweck

Benutzer repräsentieren den **Zugang zur Plattform** für eine Person.

### Grundsatz

**Person** und **Benutzerkonto** sind getrennte Objekte.

- Eine **Person** beschreibt die fachliche Identität.
- Ein **Benutzer** beschreibt Login, Rolle und Berechtigungen.

### Eigenschaften

- Ein Benutzer gehört zu **genau einer Person**.
- Ein Benutzer kann einem **Mandanten** zugeordnet sein.
- Rollen wie **Kunden-Admin** oder **Mitarbeiter** werden am Benutzer bzw. in der zentralen Berechtigungsverwaltung abgebildet.

---

## Verträge

### Zweck

Verträge bilden die **verbindliche Grundlage** für Module, Preise, Laufzeiten und Abrechnung.

### Eigenschaften

- Ein Mandant kann **mehrere Verträge** besitzen.
- Ein Vertrag kann **mehrere Unternehmen** umfassen.
- Verträge besitzen **Versionen**.
- **Vertragsvorlagen** werden ebenfalls versioniert.

### Beziehungen

Ein Vertrag:

- basiert auf der **letzten angenommenen Angebotsversion**
- enthält **Vertragspositionen**
- kann **Abonnements** und **Rechnungen** auslösen
- ist mit **Dokumenten** verknüpfbar

---

## Angebote

### Zweck

Angebote beschreiben den **vorvertraglichen Leistungs- und Preisvorschlag** für einen Interessenten oder Mandanten.

### Eigenschaften

- Angebote besitzen **Versionen**.
- Änderungen erzeugen eine neue Version statt eine stillschweigende Überschreibung.
- Die **letzte angenommene Version** bildet die Grundlage für den Vertrag.

### Beziehungen

Ein Angebot kann entstehen aus:

- einer **Beratung**
- einer **Prozessanalyse**
- einer manuellen Erstellung im Plattform-Admin

### Technische Abbildung (V1)

Die PostgreSQL-Tabellen, Constraints und Versionslogik sind in [`docs/angebote-datenmodell.md`](./angebote-datenmodell.md) beschrieben (Migration `supabase/migrations/20260717200000_angebote_v1.sql`).

---

## Module

### Zweck

Module sind die **funktionalen Bausteine** der Plattform, die mandantenspezifisch aktiviert und abgerechnet werden.

### Eigenschaften

- Module besitzen **Listenpreise**.
- **Individuelle Rabatte** sind möglich.
- Module können **je Unternehmen oder Standort unterschiedlich aktiviert** werden.

### Beziehungen

Ein Modul wird über **Modulaktivierungen** mit Mandant, Unternehmen oder Standort verknüpft und fließt in **Verträge**, **Abonnements** und **Rechnungen** ein.

---

## Abonnements

### Zweck

Abonnements beschreiben den **laufenden wirtschaftlichen Bezug** eines Mandanten zu gebuchten Leistungen.

### Eigenschaften

- **Laufzeiten**
- **Kündigung**
- **Verlängerung**
- **Abrechnungsintervalle**

### Beziehungen

Ein Abonnement:

- basiert auf einem **Vertrag**
- nutzt **Rechnungsprofile**
- kann **Module** und Preise abbilden
- ist Grundlage für wiederkehrende **Rechnungen**

---

## Rechnungen

### Zweck

Rechnungen bilden **forderungsrelevante Abrechnungen** gegenüber Mandanten oder externen Empfängern ab.

### Eigenschaften

- **Mehrere Rechnungsprofile** pro Mandant oder Unternehmen möglich
- **Mehrere Rechnungsempfänger** möglich
- **Externe Provider** können Rechnungsempfänger sein
- Unterstützung für:
  - **Teilrechnungen**
  - **Abschlagsrechnungen**
  - **Schlussrechnungen**
  - **Gutschriften**
  - **Korrekturen**

### Beziehungen

Eine Rechnung:

- bezieht sich auf **Verträge**, **Abonnements** oder **Projekte**
- nutzt ein **Rechnungsprofil**
- richtet sich an einen oder mehrere **Rechnungsempfänger**
- kann mit **Dokumenten** und **Zahlungsvorgängen** verknüpft sein

---

## Dokumente

### Zweck

Dokumente sind die **zentrale Ablage** für vertrags-, projekt- und prozessrelevante Unterlagen.

### Eigenschaften

- **Versionierung**
- **Rollenberechtigungen**
- **Benutzerberechtigungen**
- **Ablaufdaten**
- **Wiedervorlagen**

### Beziehungen

Dokumente können verknüpft sein mit:

- Mandanten
- Unternehmen
- Verträgen
- Angeboten
- Projekten
- Beratungen
- Rechnungen

Nicht jeder Benutzer darf jedes Dokument sehen.

---

## Beratung

### Zweck

Beratungen sind **eigenständige Vorgänge** im Vertriebs- und Analyseprozess.

### Eigenschaften

- **Beratungstermine**
- **Mitarbeiterzuordnung**
- **Ergebnisse**
- **nächste Schritte**

### Beziehungen

Eine Beratung kann führen zu:

- **Prozessanalyse**
- **Angebot**
- **Projekt**
- **Dokumenten**

---

## Prozessanalyse

### Zweck

Die Prozessanalyse dokumentiert den **Ist-Zustand** und den **Soll-Zustand** betrieblicher Abläufe.

### Eigenschaften

- **Ist-Prozess**
- **Soll-Prozess**
- **Problemstellen**
- **Automatisierungspotenzial**
- **Business Case**

### Beziehungen

Eine Prozessanalyse kann:

- aus einer **Beratung** entstehen
- ein **Angebot** erzeugen
- in ein **Projekt** überführt werden
- **Dokumente** und **Aufgaben** hervorbringen

---

## Projekte

### Zweck

Projekte bilden die **Umsetzung angenommener Leistungen** ab.

### Eigenschaften

- **Aufgaben**
- **Verantwortliche**
- **Status**
- **Termine**

### Beziehungen

Ein Projekt:

- entsteht aus einem **angenommenen Angebot**
- kann **Aufgaben** und **Dokumente** enthalten
- kann **Rechnungen** und **Automatisierungen** auslösen

---

## Homepage

### Zweck

Die Homepage ist der **öffentliche Einstiegspunkt** für Interessenten.

### Eigenschaften

- **Terminanfrage**
- **Direktbuchung**
- **Mitarbeiterzuordnung**
- **spätere Kalenderintegration**

### Beziehungen

Anfragen und Termine aus der Homepage können führen zu:

- **Interessenten**
- **Beratungen**
- **Beratungsterminen**
- internen **Aufgaben**

---

## KI

### Zweck

KI unterstützt Mitarbeiter bei der Vorbereitung und Strukturierung von Inhalten.

### Grundsätze

- KI erstellt **Entwürfe**
- Der **Mensch entscheidet**
- Keine autonomen Entscheidungen bei kritischen Vorgängen

### Einsatzbereiche

- **Vertrieb**
- **Prozessanalyse**
- **Angebotsentwürfe**
- **Automatisierungsvorschläge**
- **Zusammenfassungen**

KI-Ergebnisse sind stets als Vorschläge zu verstehen und werden fachlich geprüft, bevor sie übernommen werden.

---

## Zukünftige Erweiterungen

Das fachliche Datenmodell ist so angelegt, dass spätere Erweiterungen möglich sind, unter anderem:

- **Bankschnittstellen**
- **Kalender**
- **Digitale Signaturen**
- **E-Rechnung**
- **SEPA**
- **API**
- **Mobile App**

Diese Erweiterungen werden ergänzt, sobald die fachliche Entscheidung dokumentiert und das bestehende Domänenmodell entsprechend erweitert wurde.

---

## Hinweis zur technischen Umsetzung

Dieses Dokument beschreibt **ausschließlich die fachliche Struktur** von KMU Flow AI.

Es enthält bewusst **keine SQL-Befehle** und **keine technische Implementierung**. Die technische Abbildung in Tabellen, APIs und Services erfolgt separat auf Basis dieses fachlichen Datenmodells und der dokumentierten Produktentscheidungen.
