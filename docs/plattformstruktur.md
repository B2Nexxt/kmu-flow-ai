# Plattformstruktur von KMU Flow AI

## Grundstruktur

KMU Flow AI besteht aus **zwei Hauptbereichen**:

1. **Plattform-Admin** für das interne Unternehmen
2. **Mandantenbereich** für die Kundenunternehmen

Der **Mandantenbereich** gliedert sich wiederum in:

- **Mandantenverwaltung** – Verwaltung des eigenen Unternehmens, Verträge, Benutzer und Einstellungen
- **operative Arbeitsplattform** – tägliche Nutzung der gebuchten Module im Kerngeschäft

Diese Trennung stellt sicher, dass interne Steuerung und operativer Mandantenbetrieb klar voneinander unterschieden werden, während beide auf derselben fachlichen Datenbasis arbeiten.

```
KMU Flow AI
├── Plattform-Admin (intern)
└── Mandantenbereich
    ├── Mandantenverwaltung
    └── operative Arbeitsplattform
```

---

## Plattform-Admin

Der Plattform-Admin ist der **interne Steuerungsbereich** von KMU Flow AI. Er dient der Verwaltung von Interessenten, Mandanten, Verträgen, Abrechnung, Modulen und internen Prozessen.

Für Version 1 ist der Zugriff auf den **Plattform-Hauptadmin** ausgelegt. Weitere interne Rollen und feingranulare Berechtigungen folgen später.

### Navigation

| Bereich | Zweck |
| --- | --- |
| **Dashboard** | Übersicht über Interessenten, Mandanten, Verträge, Abonnements und offene Vorgänge |
| **Interessenten** | Verwaltung potenzieller Kunden und Leads |
| **Beratungstermine** | Planung und Nachverfolgung von Beratungsgesprächen |
| **Prozessanalysen** | Dokumentation von Ist-/Soll-Prozessen und Optimierungspotenzialen |
| **Angebote** | Erstellung, Versionierung und Nachverfolgung interner Angebote |
| **Verträge** | Verwaltung verbindlicher Vereinbarungen und Vorlagen |
| **Mandanten** | Anlage, Betreuung und Onboarding von Kundenorganisationen |
| **Abonnements** | Laufende Verträge, Module, Laufzeiten und Abrechnungsintervalle |
| **Rechnungen** | Abrechnung gegenüber Mandanten |
| **Mahnungen** | Bearbeitung überfälliger Zahlungen mit manueller Freigabe |
| **Module** | Verwaltung von Modulen, Listenpreisen und Aktivierungen |
| **Automatisierungen** | Standard- und individuelle Workflows |
| **Interne Mitarbeiter** | spätere Verwaltung interner Benutzer und Rollen |
| **Support** | Bearbeitung von Anfragen und Störungen |
| **Einstellungen** | Plattformweite Konfiguration |

Der Plattform-Admin bildet den **gesamten Lebenszyklus** ab – von der ersten Kontaktaufnahme bis zur laufenden Betreuung und Abrechnung.

---

## Mandantenverwaltung

Die Mandantenverwaltung ist der **administrative Bereich** innerhalb des Mandantenkontos. Hier verwaltet der Mandant seine Organisation, seinen Vertrag mit KMU Flow AI und die grundlegenden Stammdaten.

### Bereiche

| Bereich | Zweck |
| --- | --- |
| **Unternehmensdaten** | Stammdaten des Mandanten und des Hauptunternehmens |
| **Unternehmen und Standorte** | Verwaltung mehrerer Unternehmen, Standorte und Adressen |
| **Geschäftsführer und Ansprechpartner** | Verantwortliche und Kontaktpersonen |
| **Benutzer und Rollen** | Verwaltung von Mandantenbenutzern und Berechtigungen |
| **Gebuchte Module** | Übersicht aktiver Module je Unternehmen oder Standort |
| **Verträge** | Verträge mit KMU Flow AI |
| **Rechnungen von KMU Flow AI** | Abrechnungen des Plattformanbieters an den Mandanten |
| **Dokumente** | Vertrags-, Abrechnungs- und Organisationsunterlagen |
| **Support** | Anfragen an KMU Flow AI |
| **Einstellungen** | Mandantenspezifische Konfiguration |

Die Mandantenverwaltung ist **nicht** die tägliche operative Arbeitsumgebung, sondern die organisatorische und vertragliche Steuerung des Mandanten auf der Plattform.

---

## Operative Arbeitsplattform

Die operative Arbeitsplattform ist der **tägliche Arbeitsbereich** des Mandanten. Sie ist in der ersten Ausbaustufe bewusst auf **kleine Handwerksunternehmen** ausgerichtet.

Ziel ist eine einfache, verständliche Struktur für typische Abläufe wie Anfrage, Angebot, Auftrag, Termin, Leistung und Rechnung.

### Dashboard

Übersicht über offene Anfragen, Angebote, Aufträge, Termine, Rechnungen und Aufgaben.

### Kunden

Verwaltung von Firmenkunden, Privatkunden, Ansprechpartnern, Adressen und Kundenhistorie.

### Anfragen

Erfassung neuer Kundenanfragen, Besichtigungen, Rückfragen und Terminwünsche.

### Angebote

Angebotsentwürfe, Versionen, Versand, Annahme, Ablehnung und Ablauf.

### Aufträge

Aus angenommenen Angeboten entstehende Aufträge mit Leistungsort, Status, Mitarbeitern und Terminen.

### Termine

Kundentermine, Baustellentermine, Mitarbeiterzuordnung und Kalender.

### Leistungen

Leistungskatalog, Material, Arbeitsstunden, Einheiten und Preise.

### Leistungsnachweise

Dokumentation erbrachter Leistungen mit Zeiten, Material, Fotos, Kundensignatur und Abnahme.

### Rechnungen

Einmalige Rechnungen, Teilrechnungen, Abschlagsrechnungen, Schlussrechnungen, Korrekturen und Zahlungsstatus.

### Dokumente

Angebote, Aufträge, Fotos, Aufmaße, Leistungsnachweise, Rechnungen und weitere Unterlagen.

### Aufgaben

Interne Aufgaben mit Verantwortlichen, Fälligkeiten und Status.

### Automatisierungen

Wiederkehrende Verwaltungsprozesse und Workflows im Mandantenbetrieb.

### KI-Assistent

Unterstützung bei Anfrageanalyse, Angebotstexten, Leistungsbeschreibungen und Zusammenfassungen. Die KI erstellt Entwürfe; Entscheidungen trifft der Mensch.

---

## Hauptprozess für Handwerksunternehmen

Die operative Arbeitsplattform unterstützt den typischen Ablauf kleiner Handwerksbetriebe:

```
Kundenanfrage
  → Besichtigung oder Beratung
  → Angebot
  → Annahme
  → Auftrag
  → Terminplanung
  → Leistungserbringung
  → Leistungsnachweis
  → Rechnung
  → Zahlungsprüfung
```

Dieser Prozess bildet die **fachliche Leitlinie** für die erste operative Version. Die Module der Arbeitsplattform sind entlang dieses Ablaufs angeordnet.

---

## Rollen

Im Mandantenbereich werden beispielhaft folgende Rollen unterschieden:

| Rolle | Typische Aufgaben |
| --- | --- |
| **Mandanten-Hauptadmin** | Gesamtverwaltung, Benutzer, Einstellungen, Verträge |
| **Büro / Verwaltung** | Kunden, Anfragen, Angebote, Dokumente, Aufgaben |
| **Vertrieb** | Anfragen, Angebote, Kundenkommunikation |
| **Bau- oder Projektleitung** | Aufträge, Termine, Leistungsnachweise, Koordination |
| **Monteur / ausführender Mitarbeiter** | Termine, Leistungen, Leistungsnachweise, Fotos |
| **Buchhaltung** | Rechnungen, Zahlungsstatus, Dokumente |

Die **genaue Rechteverwaltung** folgt später und wird zentral modelliert – nicht fest in einzelnen Seiten verankert.

---

## Entwicklungspriorität

Die erste operative Version konzentriert sich auf die Module, die für kleine Handwerksunternehmen den größten unmittelbaren Nutzen bieten:

1. **Kunden**
2. **Anfragen**
3. **Angebote**
4. **Aufträge**
5. **Termine**
6. **Leistungsnachweise**
7. **Rechnungen**

**Spätere Ausbaustufen** umfassen unter anderem:

- Prozessanalyse
- komplexe Automatisierungen
- weitere Branchen und Mandantentypen
- erweiterte Rollen und Berechtigungen
- Kalender- und Schnittstellenintegration

Die Plattformstruktur ist bewusst so angelegt, dass der Handwerksfokus der ersten Version später um weitere Branchen und Module erweitert werden kann, ohne die Grundarchitektur zu verändern.

---

## Zusammenfassung

KMU Flow AI trennt klar zwischen **interner Plattformsteuerung** und **mandantenseitiger Nutzung**. Innerhalb des Mandantenbereichs werden **Verwaltung** und **operative Arbeit** voneinander getrennt.

Die aktuelle Entwicklungspriorität liegt auf einer schlanken, handwerksorientierten Arbeitsplattform. Der Plattform-Admin und die dokumentierten Geschäftsprozesse bilden gleichzeitig die übergeordnete Struktur für Beratung, Vertrag, Onboarding und langfristige Kundenbetreuung.
