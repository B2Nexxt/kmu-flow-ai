# Geschäftsprozesse von KMU Flow AI

Diese Dokumentation beschreibt die vollständigen Geschäftsprozesse von KMU Flow AI.

Alle Prozesse orientieren sich an den Grundprinzipien der Plattform:

- **Beratung vor Software**
- **Mensch entscheidet**
- **KI unterstützt**
- **Automatisierung übernimmt Routinearbeiten**
- **Kritische Entscheidungen werden niemals vollständig automatisiert**

Jeder Geschäftsprozess ist nach demselben Muster dokumentiert:

- Ziel
- Beteiligte Rollen
- Auslöser
- Ablauf
- Entscheidungen
- Automatisierungen
- Ergebnis

---

# Geschäftsprozess 1

## Leadgewinnung

### Ziel

Potenzielle und bestehende Kunden als **einheitliche Mandantendatensätze** erfassen, qualifizieren und in den Beratungsprozess überführen.

### Beteiligte Rollen

- Mandant im Status **Interessent** oder **Aktiver Mandant**
- Plattform-Hauptadmin oder später zuständiger Vertriebsmitarbeiter
- KI (optional für Vorbereitung und Zusammenfassungen)

### Auslöser

- Besuch der Homepage
- Terminanfrage oder Direktbuchung
- Manuelle Anlage eines Mandanten im Plattform-Admin mit Status **Interessent**

### Ablauf

```
Homepage
  → Terminanfrage oder Direktbuchung
  → Mandant wird mit Status „Interessent“ angelegt
  → zuständiger Mitarbeiter wird zugeordnet
  → Terminbestätigung
  → Erinnerungen
  → Beratung
```

**Schritte im Detail:**

1. Der potenzielle Kunde nutzt die **Homepage** und stellt eine Anfrage oder bucht direkt einen Termin.
2. Die Anfrage wird über ein **Homepageformular** erfasst.
3. Im Plattform-Admin wird ein **Mandant** mit Status **Interessent** angelegt.
4. Ein **zuständiger Mitarbeiter** wird zugeordnet.
5. Der Interessent erhält eine **Terminbestätigung**.
6. Das System erzeugt **Erinnerungen** vor dem Termin.
7. Der Prozess mündet in die **Beratung**.

Eine **spätere Kalenderintegration** ergänzt diesen Prozess um Verfügbarkeiten, Synchronisation und automatische Terminzuweisung.

### Entscheidungen

- Welcher Mitarbeiter ist zuständig?
- Ist der Mandant im Status Interessent für eine Beratung geeignet?
- Wird ein Termin bestätigt, verschoben oder abgesagt?

### Automatisierungen

- Erfassung der Homepage-Anfrage
- Anlage des Mandanten mit Status **Interessent**
- Terminbestätigung
- Erinnerungen
- Statusaktualisierung am bestehenden Mandantendatensatz

### Ergebnis

Ein qualifizierter Mandant im Status **Interessent** mit zugeordnetem Mitarbeiter, bestätigtem Termin und vorbereiteter Beratung.

**Hinweis:** „Interessent“ ist kein eigener Datensatztyp, sondern ein Status eines Mandanten. Der Datensatz wird während seines gesamten Lebenszyklus weiterverwendet. Eine Statusänderung erzeugt keinen neuen Datensatz.

---

# Geschäftsprozess 2

## Beratung

### Ziel

Den Bedarf des Interessenten oder Mandanten strukturiert erfassen und die Grundlage für Analyse, Angebot oder weitere Maßnahmen schaffen.

### Beteiligte Rollen

- Interessent oder Mandant
- Berater / Plattform-Mitarbeiter
- KI (Zusammenfassung)

### Auslöser

- Bestätigter Beratungstermin
- Manuelle Anlage einer Beratung im Plattform-Admin
- Follow-up nach vorherigem Vorgang

### Ablauf

```
Beratung
  → Gespräch
  → Gesprächsnotizen
  → KI erstellt Zusammenfassung
  → Mitarbeiter prüft
  → Ergebnis speichern
```

**Mögliche nächste Schritte:**

- Prozessanalyse starten
- Angebot vorbereiten
- Aufgabe anlegen
- weiteren Termin vereinbaren

### Entscheidungen

- Ist eine Prozessanalyse erforderlich?
- Soll ein Angebot vorbereitet werden?
- Welche nächsten Schritte werden vereinbart?
- Wird die KI-Zusammenfassung übernommen oder angepasst?

### Automatisierungen

- KI erstellt Gesprächszusammenfassung
- Aufgabenanlage
- Terminvorschläge
- Statusaktualisierung der Beratung

### Ergebnis

Eine dokumentierte Beratung mit geprüftem Ergebnis und klar definierten nächsten Schritten.

---

# Geschäftsprozess 3

## Prozessanalyse

### Ziel

Bestehende Abläufe verstehen, Optimierungspotenziale identifizieren und eine fundierte Grundlage für Angebot und Umsetzung schaffen.

### Beteiligte Rollen

- Berater / Analysemitarbeiter
- Interessent oder Mandant
- KI (Unterstützung bei Strukturierung und Text)

### Auslöser

- Ergebnis einer Beratung
- Expliziter Analyseauftrag
- Vorbereitung eines Angebots

### Ablauf

```
Ist-Prozess
  ↓
Probleme
  ↓
Soll-Prozess
  ↓
Automatisierungsmöglichkeiten
  ↓
Business Case
  ↓
Maßnahmen
  ↓
Angebot
```

**Formen der Dokumentation:**

- **Text** für fachliche Beschreibung
- **Diagramm** für visuelle Prozessdarstellung
- **KI-Unterstützung** für Entwürfe und Strukturierung
- **ROI-Berechnung** als Teil des Business Case

### Entscheidungen

- Welche Problemstellen sind relevant?
- Welche Maßnahmen werden empfohlen?
- Welche Automatisierungen sind sinnvoll?
- Wird ein Angebot erstellt?

### Automatisierungen

- KI-Vorschläge für Soll-Prozesse
- Vorlagen für Business Case
- Aufgaben aus Maßnahmen ableiten
- Angebotsentwurf aus Analyse erzeugen

### Ergebnis

Eine abgeschlossene Prozessanalyse mit Ist-/Soll-Bild, Business Case und Grundlage für ein Angebot.

---

# Geschäftsprozess 4

## Angebot

### Ziel

Ein strukturiertes, versioniertes und nachvollziehbares Angebot erstellen, freigeben und bis zur Annahme begleiten.

### Beteiligte Rollen

- Plattform-Hauptadmin oder Vertrieb
- Interessent oder Mandant
- KI (Angebotsentwurf)

### Auslöser

- Abgeschlossene Beratung
- Abgeschlossene Prozessanalyse
- Manuelle Angebotsanlage

### Ablauf

```
Angebot erstellen
  ↓
Versionen
  ↓
Versenden
  ↓
Annahme
  ↓
Vertrag
  ↓
Projekt
  ↓
Mandant
```

### Besonderheiten

- **Versionierung:** Änderungen erzeugen neue Angebotsversionen
- **Freigabe:** Angebote werden vor Versand geprüft
- **Historie:** Alle Versionen bleiben nachvollziehbar
- Die **letzte angenommene Version** bildet die Vertragsgrundlage

### Entscheidungen

- Ist das Angebot fachlich und wirtschaftlich korrekt?
- Wird das Angebot freigegeben und versendet?
- Nimmt der Kunde das Angebot an, lehnt ab oder verhandelt nach?

### Automatisierungen

- Angebotsentwurf aus Anfrage oder Analyse
- PDF-Erzeugung
- Versand nach Freigabe
- Statusverfolgung

### Ergebnis

Ein angenommenes Angebot als Grundlage für Vertrag, Projekt und Mandanten-Onboarding.

---

# Geschäftsprozess 5

## Vertragsprozess

### Ziel

Aus einem angenommenen Angebot einen verbindlichen Vertrag erzeugen, prüfen und aktivieren.

### Beteiligte Rollen

- Plattform-Hauptadmin oder Verantwortlicher
- Mandant / Unterzeichner
- KI (optional für Entwurf)

### Auslöser

- Annahme eines Angebots
- Vertragsänderung oder Verlängerung

### Ablauf

```
Vertragsvorlage
  ↓
automatisch befüllen
  ↓
Prüfung
  ↓
digitale oder manuelle Unterschrift
  ↓
Vertrag aktiv
  ↓
Mandanten-Onboarding
```

### Besonderheiten

- **Versionierung** von Verträgen und Vorlagen
- Verknüpfung mit **Dokumenten**
- Unterstützung für **digitale oder manuelle Unterschrift**

### Entscheidungen

- Ist der Vertrag inhaltlich korrekt?
- Wird der Vertrag freigegeben?
- Wurde der Vertrag wirksam unterzeichnet?

### Automatisierungen

- Automatisches Befüllen aus Angebot
- Dokumentenerstellung
- Statuswechsel nach Unterschrift
- Start des Onboarding-Prozesses

### Ergebnis

Ein aktiver Vertrag als Grundlage für Abonnement, Module und Mandanten-Onboarding.

---

# Geschäftsprozess 6

## Mandanten-Onboarding

### Ziel

Einen neuen Mandanten vollständig einrichten und für den laufenden Betrieb vorbereiten.

### Beteiligte Rollen

- Plattform-Hauptadmin
- später erster Kunden-Admin

### Auslöser

- Aktiver Vertrag nach Angebotsannahme
- Manuelle Anlage durch den Plattform-Hauptadmin

### Ablauf

Der Plattform-Hauptadmin richtet den Mandanten über einen **6-stufigen Einrichtungsassistenten** ein:

1. **Unternehmensdaten**
2. **Geschäftsführer und Ansprechpartner**
3. **Bank- und Steuerdaten**
4. **Module und Preise**
5. **Automatisierungen**
6. **Prüfen und Mandant anlegen**

### Speicherablauf (Phase 2)

1. Benutzer füllt den Assistenten aus und bestätigt die Angaben.
2. Beim Klick auf **Mandant anlegen** erfolgt eine **vollständige Validierung**.
3. Die Daten werden **atomar in Supabase** gespeichert (Mandant, Unternehmen, Ansprechpartner, optionale Bankverbindung, Module, Automatisierungen).
4. Die Anwendung leitet auf `/admin/mandanten/[id]?created=true` weiter.
5. Die Mandantenakte zeigt einmalig: **„Mandant wurde erfolgreich angelegt.“**

**Geschäftsführer-Logik beim Speichern:**

- Checkbox **nicht** gesetzt: Hauptansprechpartner ist Pflicht; Geschäftsführer optional (nur speichern, wenn ausgefüllt).
- Checkbox **gesetzt**: Geschäftsführer ist Pflicht; **eine Person** erhält beide Rollen (Geschäftsführer und Hauptansprechpartner), Position „Geschäftsführer“ – **kein doppelter Datensatz**.

**Fehlerbehandlung:**

- Bei Validierungs- oder Speicherfehlern: **keine Weiterleitung**, Formularwerte bleiben erhalten.
- Keine automatische Löschung bei Fehlern; Teilspeicherung wird durch Transaktion vermieden.

**Hinweis:** „Interessent“ ist kein eigener Datensatztyp, sondern ein Status eines Mandanten. Der Datensatz wird während seines gesamten Lebenszyklus weiterverwendet. Eine Statusänderung erzeugt keinen neuen Datensatz.

### Entscheidungen

- Welche Module werden aktiviert?
- Welche Preise und Rabatte gelten?
- Welche Automatisierungen werden vorgesehen?
- Sind alle Angaben geprüft und korrekt?

### Automatisierungen

- Preisberechnung im Assistenten
- Vorbereitung von Standardautomatisierungen
- spätere automatische Anlage von Mandant, Vertrag und Abonnement

### Ergebnis

Ein vollständig eingerichteter Mandant mit Unternehmensdaten, Ansprechpartnern, Modulen, Preisen und vorbereiteten Automatisierungen.

---

# Geschäftsprozess 7

## Laufender Betrieb

### Ziel

Den Mandanten im Alltag bei der Nutzung der Plattform unterstützen und operative Geschäftsprozesse ermöglichen.

### Beteiligte Rollen

- Kunden-Admin
- Mitarbeiter des Mandanten
- KI (Assistenz im Arbeitsalltag)

### Auslöser

- Abgeschlossenes Mandanten-Onboarding
- Tägliche operative Tätigkeiten

### Ablauf

Der Mandant arbeitet im **Kundenportal** mit der Plattform und erstellt unter anderem:

- **Kunden**
- **Angebote**
- **Rechnungen**
- **Dokumente**

Die **KI unterstützt** den Arbeitsalltag durch Entwürfe, Zusammenfassungen und Vorschläge.

### Entscheidungen

- Welche Vorgänge werden freigegeben?
- Welche KI-Entwürfe werden übernommen?
- Welche Dokumente und Rechnungen werden versendet?

### Automatisierungen

- Angebotsentwürfe
- Dokumentenzuordnung
- Aufgaben und Erinnerungen
- KI-Zusammenfassungen

### Ergebnis

Ein produktiv arbeitender Mandant mit dokumentierten Vorgängen und unterstützten Geschäftsprozessen.

---

# Geschäftsprozess 8

## Wiederkehrende Rechnungen

### Ziel

Wiederkehrende Leistungen zuverlässig abrechnen und den Zahlungsstatus nachvollziehbar machen.

### Beteiligte Rollen

- Plattform-Hauptadmin oder Buchhaltung
- Mandant als Rechnungsempfänger
- System

### Auslöser

- Aktives Abonnement
- Fälliger Rechnungslauf
- Vertraglich vereinbartes Abrechnungsintervall

### Ablauf

```
Abonnement
  ↓
Rechnungslauf
  ↓
Rechnung erzeugen
  ↓
PDF
  ↓
E-Mail
  ↓
Zahlungsstatus überwachen
```

**Wichtig:** Rechnungen dürfen **automatisch erstellt** werden.

### Entscheidungen

- Wird die Rechnung vor Versand geprüft (falls vorgesehen)?
- Ist die Rechnung korrekt und vollständig?
- Wurde die Zahlung erfasst?

### Automatisierungen

- Rechnungslauf
- Rechnungserstellung
- PDF-Erzeugung
- E-Mail-Versand
- Statusüberwachung

### Ergebnis

Eine erstellte und versendete Rechnung mit nachvollziehbarem Zahlungsstatus.

---

# Geschäftsprozess 9

## Mahnprozess

### Ziel

Überfällige Zahlungen strukturiert bearbeiten, ohne kritische Entscheidungen zu automatisieren.

### Beteiligte Rollen

- Mitarbeiter / Buchhaltung
- Plattform-Hauptadmin
- Mandant

### Auslöser

- Überfällige Rechnung
- Erreichen einer Mahnstufe

### Ablauf

```
Rechnung fällig
  ↓
System erkennt Überfälligkeit
  ↓
Aufgabe: "Zahlung prüfen"
  ↓
Mitarbeiter prüft Zahlung
  ↓
Entscheidung: bezahlt oder nicht bezahlt
  ↓
Zahlungserinnerung
  ↓
1. Mahnung
  ↓
2. Mahnung
  ↓
letzte Mahnung
  ↓
Nachfrist
  ↓
Aufgabe: "Vertrag und Zugang prüfen"
  ↓
Mensch entscheidet
  ↓
optional: Vertrag kündigen
  ↓
optional: Zugang sperren
```

### Ausdrückliche Regeln

- **Mahnungen werden niemals automatisch versendet.**
- **Kündigungen erfolgen niemals automatisch.**
- **Sperrungen erfolgen niemals automatisch.**
- **Daten werden niemals automatisch gelöscht.**

### Entscheidungen

- Wurde die Zahlung eingegangen?
- Wird eine Erinnerung oder Mahnung versendet?
- Ist nach der letzten Mahnung eine Vertragsprüfung erforderlich?
- Wird der Vertrag gekündigt oder der Zugang gesperrt?

### Automatisierungen

- Erkennung von Überfälligkeit
- Aufgabenanlage
- Vorbereitung von Mahnungen
- Statusaktualisierung

### Ergebnis

Ein nachvollziehbar bearbeiteter Mahnfall mit dokumentierten Entscheidungen und ggf. Folgemaßnahmen.

---

# Geschäftsprozess 10

## Dokumentenverwaltung

### Ziel

Dokumente sicher, versioniert und berechtigungsgerecht verwalten.

### Beteiligte Rollen

- Plattform-Mitarbeiter
- Kunden-Admin
- Mitarbeiter des Mandanten

### Auslöser

- Upload eines Dokuments
- Vertrag, Projekt, Beratung oder Rechnung erzeugt Dokumentbedarf
- Wiedervorlage fällig

### Ablauf

```
Dokument hochladen
  ↓
Versionierung
  ↓
Berechtigungen
  ↓
Archivierung
  ↓
Wiedervorlagen
```

### Entscheidungen

- Wer darf das Dokument sehen oder bearbeiten?
- Wird eine neue Version freigegeben?
- Wird das Dokument archiviert?

### Automatisierungen

- Automatische Zuordnung zu Vorgängen
- Wiedervorlagen
- Versionsverwaltung
- Archivierung statt Löschung

### Ergebnis

Ein sicher verwaltetes Dokument mit klarer Version, Berechtigung und Nachverfolgbarkeit.

---

# Geschäftsprozess 11

## Projekte

### Ziel

Angenommene Leistungen strukturiert umsetzen und Fortschritt transparent machen.

### Beteiligte Rollen

- Berater / Projektleiter
- Mandant
- Mitarbeiter beider Seiten

### Auslöser

- Angenommenes Angebot
- Vertraglicher Umsetzungsauftrag

### Ablauf

```
Projekt
  ↓
Aufgaben
  ↓
Verantwortliche
  ↓
Status
  ↓
Abschluss
```

### Entscheidungen

- Wer ist verantwortlich?
- Ist eine Aufgabe abgeschlossen?
- Wird das Projekt erfolgreich beendet oder verlängert?

### Automatisierungen

- Aufgaben aus Angebot oder Analyse erzeugen
- Erinnerungen
- Statusaktualisierung
- Dokumentenverknüpfung

### Ergebnis

Ein abgeschlossenes oder fortgeführtes Projekt mit dokumentiertem Ergebnis.

---

# Geschäftsprozess 12

## Kontinuierliche Optimierung

### Ziel

Mandanten langfristig bei der Digitalisierung begleiten und Prozesse fortlaufend verbessern.

### Beteiligte Rollen

- Berater
- Plattform-Hauptadmin
- Mandant

### Auslöser

- Abschluss eines Projekts
- Veränderte Geschäftsanforderungen
- Neue Optimierungsmöglichkeiten

### Ablauf

```
Nach jedem abgeschlossenen Projekt:
  Beratung
    ↓
  Analyse
    ↓
  Verbesserung
    ↓
  neue Automatisierungen
    ↓
  weitere Projekte
    ↓
  langfristige Kundenbetreuung
```

KMU Flow AI begleitet den Kunden **kontinuierlich** bei der Digitalisierung. Die Plattform ist nicht nur für den Projektstart gedacht, sondern für fortlaufende Verbesserung.

### Entscheidungen

- Welche Prozesse sollen erneut analysiert werden?
- Welche Automatisierungen werden aktiviert?
- Wird ein neues Angebot oder Projekt gestartet?

### Automatisierungen

- Vorschläge aus Projektergebnissen
- Wiedervorlagen für Reviews
- Aufgaben für Folgeberatungen

### Ergebnis

Ein langfristig betreuter Mandant mit kontinuierlich verbesserten Prozessen und wachsendem Automatisierungsgrad.

---

## Zusammenfassung

Die Geschäftsprozesse von KMU Flow AI bilden einen **durchgängigen Lebenszyklus** ab – von der ersten Kontaktaufnahme über Beratung, Analyse, Angebot und Vertrag bis hin zu Onboarding, laufendem Betrieb, Abrechnung, Mahnwesen und kontinuierlicher Optimierung.

Alle Prozesse beruhen auf denselben Grundprinzipien:

- **Beratung steht im Mittelpunkt**
- **Software unterstützt den Prozess**
- **KI erstellt Entwürfe, Menschen entscheiden**
- **Routine wird automatisiert, Kritisches wird freigegeben**
- **Daten bleiben nachvollziehbar und erhalten**

Die dokumentierten Prozesse sind bewusst **modular und erweiterbar**. Sie können später durch zusätzliche Module, Schnittstellen und Rollen ergänzt werden – ohne das Grundprinzip der Plattform zu verändern.

Diese Dokumentation ist die fachliche Referenz für Produktentwicklung, Datenmodellierung und technische Umsetzung.
