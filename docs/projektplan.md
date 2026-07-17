# KMU Flow AI

## Vision

KMU Flow AI ist eine KI-gestützte Plattform für Prozessoptimierung und Automatisierung im Mittelstand. Das Ziel ist, wiederkehrende Geschäftsprozesse zu vereinfachen, manuelle Arbeit zu reduzieren und Unternehmen eine zentrale Oberfläche für Kundenverwaltung, Angebots- und Rechnungswesen sowie intelligente Automatisierung zu bieten.

## Zielgruppe

Kleine und mittlere Unternehmen (KMU), die ihre internen Abläufe digitalisieren, Geschäftsprozesse effizienter gestalten und moderne KI-Funktionen ohne komplexe Enterprise-Software nutzen möchten.

## Ziele

- **Kunden verwalten** – zentrale Verwaltung von Kundendaten und Kontakten
- **Angebote erstellen** – strukturierte Angebotserstellung mit Positionen, Steuern und Vorschau
- **Rechnungen erstellen** – Rechnungsstellung auf Basis bestehender Angebote und Prozesse
- **Prozesse automatisieren** – wiederkehrende Aufgaben reduzieren und Workflows vereinfachen
- **KI-Assistent integrieren** – intelligente Unterstützung bei täglichen Geschäftsaufgaben

## Technologie

| Bereich | Technologie |
| --- | --- |
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Backend & Datenbank | Supabase, PostgreSQL |
| Deployment | Vercel (geplant) |

## Onboarding & Zugang

Es gibt **keine öffentliche Selbstregistrierung**. Der Zugang zur Plattform erfolgt ausschließlich über einen geführten Vertriebs- und Onboarding-Prozess:

1. Ein Interessent bucht zuerst einen Beratungstermin.
2. Nach der Beratung erhält er ein Angebot.
3. Erst nach dem Kauf legt der Plattform-Admin das Kundenunternehmen an.
4. Der Plattform-Admin legt den ersten Benutzer des Kunden an oder lädt ihn ein.
5. Der Kunde kann sich danach nur noch anmelden.
6. Weitere Benutzer können später durch einen berechtigten Kunden-Admin eingeladen werden.

## Rollen

### Plattform-Rollen

Für die erste Version gibt es genau **einen Plattform-Hauptadmin** mit vollständigem Zugriff auf alle Plattformfunktionen.

Weitere Plattform-Admin-Benutzer und feingranulare Berechtigungen werden zunächst **nicht** umgesetzt. Die Architektur soll aber so vorbereitet werden, dass später zusätzliche Plattform-Rollen wie **Vertrieb**, **Buchhaltung**, **Support**, **Technik** und **Berater** ergänzt werden können.

Rollen und Berechtigungen dürfen nicht fest über einzelne Seiten verteilt werden, sondern sollen später **zentral verwaltet** werden.

| Rolle | Beschreibung | Version 1 |
| --- | --- | --- |
| **Plattform-Hauptadmin** | Vollständiger Zugriff auf die Plattform, Anlage von Mandanten und Einladung erster Benutzer | Umsetzung |
| **Weitere Plattform-Rollen** | Vertrieb, Buchhaltung, Support, Technik, Berater | Später |

### Mandanten-Rollen

Auf Mandantenebene bleiben **Kunden-Admin** und **Mitarbeiter** als Rollen bestehen.

| Rolle | Beschreibung |
| --- | --- |
| **Kunden-Admin** | Verwaltet das eigene Unternehmen und kann weitere Benutzer einladen |
| **Mitarbeiter** | Nutzt die Plattform im Rahmen der vergebenen Berechtigungen |

Das Kundenportal und der Kunden-Login sind noch **nicht** umgesetzt.

## Projektphasen

### Sprint 1 – Grundlage

- Entwicklungsumgebung einrichten
- Dashboard erstellen
- Angebotsformular entwickeln
- Datenbankstruktur definieren

### Sprint 2 – Zugang & Mandantenverwaltung

**Geplant:**

- Login
- Abmelden
- Geschützte Seiten
- Plattform-Admin-Bereich für den Plattform-Hauptadmin
- Kundenunternehmen manuell anlegen
- Ersten Kundenbenutzer einladen
- Rollen: Plattform-Hauptadmin, Kunden-Admin und Mitarbeiter
- Zentrale Vorbereitung für spätere Rollen- und Berechtigungsverwaltung
- Keine weiteren Plattform-Admin-Benutzer in Version 1
- Keine feingranularen Plattform-Berechtigungen in Version 1

**Aktueller Stand im Plattform-Admin-Bereich:**

- Plattform-Admin-Dashboard unter `/admin`
- Kennzahlenkarten für Mandanten, Interessenten, Angebote, Verträge und aktive Abonnements
- Schnellaktionen im Adminbereich:
  - Neuer Interessent
  - Neuer Mandant
  - Angebot erstellen
  - Beratung planen
  - Module verwalten
- 6-stufiger Einrichtungsassistent für neue Mandanten unter `/admin/mandanten/neu`

**Die sechs Schritte des Einrichtungsassistenten:**

1. **Unternehmensdaten** – Firmenname, Rechtsform, Adresse, Kontaktdaten
2. **Geschäftsführer und Ansprechpartner** – Ansprechpersonen mit optionaler Zusammenführung
3. **Bank- und Steuerdaten** – Steuer- und Registerangaben sowie Bankverbindung
4. **Module und Preis** – Modulauswahl, Preisfelder und Monatspreisberechnung
5. **Automatisierungen** – Standard- und individuelle Automatisierungen
6. **Prüfen und anlegen** – Zusammenfassung und Bestätigung

**Hinweise zum aktuellen Prototyp:**

- Der Assistent ist als Prototyp vollständig navigierbar.
- Die Eingaben werden aktuell noch nicht über mehrere Schritte gespeichert.
- Schritt 6 verwendet noch Beispieldaten.
- Die echte Datenbankanbindung und Mandantenanlage folgen als Nächstes.
- Für die erste Version gibt es genau einen Plattform-Hauptadmin.
- Weitere Plattform-Admin-Rollen und feinere Berechtigungen werden später ergänzt.

### Sprint 3 – Angebotsmanagement

- Angebote speichern
- PDF-Erzeugung
- Angebotsliste

### Sprint 4 – Rechnungswesen

- Rechnungen erstellen
- E-Rechnung
- Zahlungen verwalten

### Sprint 5 – KI & Automatisierung

- KI-Assistent
- Automatisierungen

## Aktueller Stand

### Erledigt

- Next.js-Projekt mit App Router
- Gemeinsames Layout mit Sidebar für den Mandantenbereich
- Mandanten-Dashboard mit Kennzahlen und letzten Aktivitäten
- Angebotsformular mit Positionen, Umsatzsteuer, Validierung und Vorschau
- Supabase-Anbindung vorbereitet und Verbindungstest unter `/test`
- Plattform-Admin-Dashboard unter `/admin`
- 6-stufiger Einrichtungsassistent für neue Mandanten als navigierbarer Prototyp
- Projektdokumentation in `docs/projektplan.md`

### In Arbeit

- Sprint 2: Zugang & Mandantenverwaltung
- Plattform-Admin-Bereich und Mandanten-Einrichtungsassistent
- Vorbereitung der Datenbankanbindung für Mandanten

### Als Nächstes

1. Eingaben des Assistenten zwischen den Schritten speichern
2. Datenmodell für Geschäftsführer, Ansprechpartner, Bankdaten, Module, Preise und Automatisierungen erweitern
3. Mandanten wirklich in Supabase anlegen
4. Hauptadmin-Login und geschützten Adminbereich umsetzen
