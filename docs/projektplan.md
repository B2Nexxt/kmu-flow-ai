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

### Sprint 2 – Zugang & Mandantenverwaltung (Abgeschlossen)

**Umgesetzt:**

- Plattform-Admin-Bereich für den Plattform-Hauptadmin unter `/admin`
- Plattform-Admin-Dashboard mit Kennzahlenkarten für Mandanten, Interessenten, Angebote, Verträge und aktive Abonnements
- Echte Kennzahlen für **Mandanten** und **Interessenten** aus Supabase (`organizations`, gefiltert nach Status)
- Schnellaktion **Mandant anlegen** im Adminbereich
- 6-stufiger Einrichtungsassistent für neue Mandanten unter `/admin/mandanten/neu`
- Speicherung von Mandanten in Supabase (`organizations`) inkl. Status, Stammdaten, Vertrags-/Preisangaben
- Speicherung von Ansprechpartnern, optionaler Bankverbindungen, Modulen und Automatisierungen
- Geschäftsführer-Logik (GF = HA oder getrennte Personen mit Position „Geschäftsführer“)
- Mandantenakte unter `/admin/mandanten/[id]` mit Laden echter Daten aus Supabase
- Supabase-Anbindung (Publishable Key im Browser, Service Role serverseitig)
- Datenmodell auf bestehender Tabelle `organizations` (keine parallele `mandanten`-Tabelle)
- Einheitlicher Mandantendatensatz mit Status **Interessent** / **Aktiver Mandant**

**Die sechs Schritte des Einrichtungsassistenten:**

1. **Unternehmensdaten** – Firmenname, Rechtsform, Adresse, Kontaktdaten
2. **Geschäftsführer und Ansprechpartner** – Ansprechpersonen mit optionaler Zusammenführung
3. **Bank- und Steuerdaten** – Steuer- und Registerangaben sowie Bankverbindung
4. **Module und Preis** – Modulauswahl, Preisfelder und Monatspreisberechnung
5. **Automatisierungen** – Standard- und individuelle Automatisierungen
6. **Prüfen und anlegen** – Zusammenfassung, Validierung und atomare Speicherung in Supabase

**Funktionsumfang des Onboardings (produktiv):**

- Der 6-stufige Mandanten-Onboarding-Assistent funktioniert produktiv (Navigation, Validierung, Speichern).
- Mandanten werden in Supabase in der Tabelle `organizations` gespeichert.
- Ansprechpartner werden in `ansprechpartner` gespeichert.
- Die Geschäftsführer-Logik ist umgesetzt (eine Person mit beiden Rollen oder getrennte Datensätze).
- Bankverbindungen werden optional in `bankverbindungen` gespeichert.
- Module und Automatisierungen werden in `organization_modules` bzw. `organization_automatisierungen` gespeichert.
- Die Mandantenakte lädt echte Daten aus Supabase.
- Das Admin-Dashboard zeigt echte Kennzahlen für Mandanten und Interessenten aus Supabase.

**Noch nicht umgesetzt (aus ursprünglichem Sprint-2-Scope, später):**

- Login, Abmelden und geschützte Seiten für den Plattform-Admin
- Ersten Kundenbenutzer einladen
- Rollen Kunden-Admin und Mitarbeiter im Kundenportal
- Weitere Plattform-Admin-Benutzer und feingranulare Plattform-Berechtigungen

**Architektur-Hinweise (unverändert):**

- Für Version 1 ist genau ein Plattform-Hauptadmin vorgesehen.
- Rollen und Berechtigungen sollen später zentral verwaltet werden, nicht fest in einzelnen Seiten verankert sein.

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
- Mandanten-Dashboard mit Kennzahlen und letzten Aktivitäten (UI-Prototyp)
- Angebotsformular mit Positionen, Umsatzsteuer, Validierung und Vorschau
- Supabase-Anbindung und Verbindungstest unter `/test`
- Plattform-Admin-Dashboard unter `/admin` mit echten Kennzahlen für Mandanten und Interessenten
- 6-stufiger Mandanten-Onboarding-Assistent unter `/admin/mandanten/neu` (produktiv)
- Validierung aller relevanten Pflichtfelder inkl. E-Mail, IBAN/BIC und Geschäftsführer-Logik
- Atomare Mandantenanlage über Server Action und RPC `create_mandant_onboarding`
- Speicherung in Supabase: `organizations`, `ansprechpartner`, `bankverbindungen`, `organization_modules`, `organization_automatisierungen`
- Mandantenakte unter `/admin/mandanten/[id]` mit echten Daten und Erfolgsmeldung nach Anlage
- Einheitlicher Mandantendatensatz mit Status Interessent / Aktiver Mandant
- Projektdokumentation in `docs/`
- **Sprint 2 – Zugang & Mandantenverwaltung** (Mandanten-Onboarding und Admin-Dashboard)

### In Arbeit

- **Sprint 3 – Angebotsmanagement**
  - Angebote speichern
  - PDF-Erzeugung
  - Angebotsliste

### Als Nächstes

1. **Mandantenakte bearbeiten** – bestehende Mandantendaten in der Akte ändern und speichern
2. Statuswechsel Interessent → Aktiver Mandant in der Mandantenakte
3. Plattform-Admin-Login und geschützter Adminbereich
4. Ersten Kundenbenutzer einladen
