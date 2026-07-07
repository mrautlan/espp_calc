# Handoff: Rechner-Tab Redesign „1c — Geführt" (IBM ESPP Navigator)

## Ziel

Den **Rechner-Tab** von stonks.mraut.de (Repo: `mrautlan/espp_calc`) auf das Design „1c" umbauen:
Die Eingabe ist ein natürlicher Satz mit klickbaren Werten, das Ergebnis ist ein
4-Karten-Geldfluss (Einsatz → Aktien → Verkauf → Gewinn). Alle bestehenden Features
bleiben erhalten — sie werden nur neu angeordnet.

**Nur der Rechner-Tab wird umgebaut.** Die anderen Tabs bleiben funktional unverändert;
einzige Ausnahme: die Tab-Navigation wird auf 4 Einträge gestrafft (siehe unten).

## Über die Design-Dateien

`ESPP Rechner 1c Prototyp.dc.html` (+ `support.js`, im selben Ordner öffnen) ist eine
**Design-Referenz in HTML** — ein funktionierender Prototyp, der Look und Verhalten zeigt.
Er ist NICHT zum direkten Kopieren gedacht. Aufgabe: dieses Design in der bestehenden
Vanilla-JS-Codebasis (public/index.html, style.css, app.js, js/*) nachbauen und an die
**echte, vorhandene Logik** anschließen. Der Prototyp enthält eine vereinfachte Kopie der
Rechenlogik und Demo-Daten für den Historisch-Modus — beides im echten Code NICHT
übernehmen, dort existieren `calculateESPP()` (app.js), `js/tax.js`, echte Kursdaten und
der pdf.js-Parser bereits.

## Fidelity

**High-fidelity.** Farben, Typografie, Abstände und Copy aus dem Prototyp exakt übernehmen.

## Was erhalten bleiben MUSS (bestehende Features → neuer Ort)

| Bestehendes Feature | Neuer Ort im 1c-Design |
|---|---|
| Slider Bruttogehalt | Satz-Token „6.000 €" → Popover mit Slider + Zahlenfeld |
| Slider Sparquote (1–10 %, zeigt €/Monat) | Satz-Token „10 %" → Popover (zeigt „= 600 € / Monat") |
| Haltedauer | Satz-Token „12 Monaten" → Popover (1–120 Monate) |
| Verkaufskurs (USD, mit Live-Kurs-Button) | Satz-Token „$320" → Popover mit „Auf Live-Kurs setzen" |
| Prognose/Historisch (bisher Select UND Toggle — doppelt) | EIN Textlink unter dem Satz: „lieber mit echten Kursen seit meinem Beitritt rechnen" / „zurück zur Prognose". Im Historisch-Modus wechselt der Satz („…spare 10 % seit Jan. 2022…") und die Token-Akzentfarbe wird blau |
| ESPP-Beitrittsdatum (historisch) | Satz-Token „Jan. 2022" → Popover mit Jahr- und Monats-Slider |
| Steuerjahr, Grenzsteuersatz, Kirchensteuer, Soli | Einklappbares Panel „Steuerprofil: 35 % · Kirche 9 % · CapTrader — anpassen" |
| Verkaufsweg/Broker (CapTrader / EquatePlus / dt. Broker) | dito, Select im Panel |
| Kaufkurs + USD/EUR-Wechselkurs (live) | dito, mit LIVE-Badge-Button |
| PDF-Gehaltsabrechnung-Upload (pdf.js, lokal) | Button unten im Einstellungs-Panel; Erfolgsmeldung als grüne Zeile darunter |
| Reset | Button „Zurücksetzen" im Einstellungs-Panel |
| KPI-Kacheln + Donut + Sticky-Ergebnisleiste (bisher 3× dasselbe) | ERSETZT durch die 4 Flow-Karten — das Ergebnis erscheint nur noch 1× |
| Kauf-/Verkaufs-Aufschlüsselung | Button „Detaillierte Aufschlüsselung ansehen" → 2 Tabellen-Karten (Kauf / Verkauf & Steuern) |
| Günstigerprüfung-Hinweis | Info-Box in der Aufschlüsselung (nur wenn aktiv) |
| Steuer-Falle deutscher Broker (§ 43a Abs. 2 EStG) | Gelbe Warn-Box in der Aufschlüsselung (nur bei Broker = deutsch) |
| Sofort-Hebel, Break-even, Freibetrag-Nutzung | 1 Textzeile unter den Flow-Karten (3 Stats, title-Tooltips) |
| Datenschutz-Hinweise (bisher 2× lang) | 1 Zeile ganz unten: „Simulation · keine Steuer- oder Anlageberatung · alle Daten bleiben in Deinem Browser" |
| Zustand merken | localStorage wie bisher |

**Tab-Navigation straffen:** `Rechner · Portfolio · Ziel · Wissen` — „Anleitung" und
„Steuern" werden als Unterseiten/Abschnitte eines „Wissen"-Tabs zusammengelegt
(bestehender Inhalt bleibt, nur die Navigationsebene ändert sich).

## Screens / Layout

### Header (unverändert schlicht)
- Höhe: padding 14px 28px, border-bottom 1px rgba(255,255,255,.06)
- Logo-Kachel 30×30, radius 8, bg rgba(74,222,128,.1), border rgba(74,222,128,.3), Pfeil ↗ in #4ade80
- Titel „IBM ESPP" Outfit 600 15px weiß
- Tabs: Inter 500 13px, aktiv: bg rgba(255,255,255,.08) + weiß, radius 8, padding 7px 14px; inaktiv #8b949e
- Rechts: Live-Kurs „● IBM $272.24 −0,9 %" (Punkt #22c55e, Kurs #e6edf3, negativ #f87171)

### Rechner-Inhalt
- Container: max-width 1040px, zentriert, padding 52px 40px 60px
- **Satz:** Outfit 500 27px, line-height 2, Farbe #8b949e, zentriert.
  Tokens: Farbe #e6edf3, bg rgba(74,222,128,.08), border-bottom 2px dashed rgba(74,222,128,.5),
  padding 1px 8px, radius 6px, cursor pointer, white-space nowrap.
  Historisch-Modus: Grün-Töne durch Blau ersetzen (rgba(88,166,255,…)).
- **Unterzeile:** Inter 400 13px #8b949e, zentriert: „Steuerprofil: 35 % · Kirche 9 % · CapTrader — anpassen · lieber mit echten Kursen…". Links: #4ade80 bzw. #58a6ff mit 1px dashed border-bottom.
- **Popover:** absolut unter dem Token, zentriert; 280–320px breit; bg #161b22, border rgba(255,255,255,.15), radius 12, padding 16, shadow 0 12px 32px rgba(0,0,0,.55). Inhalt: Label + Zahlenfeld (rechtsbündig) oben, Range-Slider (accent-color #4ade80), Min/Max-Beschriftung 10.5px #6b7280, optional 1 Hinweiszeile 11px. Klick außerhalb schließt.
- **Einstellungs-Panel** (auf „anpassen"): Karte bg #161b22, border rgba(255,255,255,.1), radius 14, padding 22px 24px; 3-spaltiges Grid (gap 18px 24px): Steuerjahr (Select), Grenzsteuersatz (Slider 14–45 %), Kirchensteuer (Select 0/8/9), Soli (Select), Broker (Select), Kaufkurs USD + FX (2 Zahlenfelder + LIVE-Badge). Darunter, durch Linie getrennt: PDF-Upload-Button, Erklärtext, Reset-Button. Alle Felder: `width:100%; min-width:0` (Overflow-Schutz).
- **Flow-Karten:** Grid `1fr 26px 1fr 26px 1fr 26px 1.2fr`, Pfeile → in #4b5563 mittig.
  Karte: bg #161b22, border rgba(255,255,255,.08), radius 12, padding 16.
  Aufbau: Label (Inter 500 11px, uppercase, letter-spacing .06em, #8b949e) →
  Wert (Outfit 600 22px #e6edf3) → Subtext (Inter 11.5px/1.5 #8b949e) →
  Fortschrittsbalken unten (5px, radius 3, track rgba(255,255,255,.08); Breite = Wert relativ zum Maximum der Kette, min 2 %).
  Karte 1 „DU ZAHLST NETTO" (Balken #8b949e), Karte 2 „DU BEKOMMST AKTIEN FÜR" (#58a6ff), Karte 3 „VERKAUF BRINGT NETTO" (#58a6ff),
  Karte 4 „DEIN GEWINN": bg rgba(74,222,128,.07), border rgba(74,222,128,.35), Wert Outfit 700 30px #4ade80.
  Bei Verlust: „DEIN VERLUST", alles in #f87171 / rgba(248,113,113,…).
- **Stats-Zeile:** zentriert, gap 40px, Inter 13px #8b949e, Werte 600 #e6edf3; native title-Tooltips.
- **Aufschlüsselung:** Toggle-Button (Ghost, #4ade80, border rgba(74,222,128,.35), radius 8, padding 9px 18px). Inhalt: 2 Karten nebeneinander („1 · Kauf — n Monatskäufe" / „2 · Verkauf & Steuern — Broker"), Zeilen Inter 12.5px, Trennlinien rgba(255,255,255,.06), Werte rechtsbündig 600; Steuern/Gebühren in #fbbf24, Gewinnzeilen in Akzentfarbe. Darunter situative Info-Boxen (Günstigerprüfung grün, Broker-Falle gelb rgba(251,191,36,.06)/.25, Transfer-Empfehlung + Sparer-Pauschbetrag neutral).
- **Fußzeile:** Inter 11.5px #4b5563, zentriert.

## Interaktionen

- Token-Klick öffnet/schließt Popover; nur eins gleichzeitig offen; `mousedown` außerhalb schließt. Slider/Feld aktualisieren die Berechnung sofort (input-Event).
- Moduswechsel tauscht Satz + Akzentfarbe; im Historisch-Modus Badge „HISTORISCH" + Link „zurück zur Prognose".
- „anpassen"/„schließen" toggelt das Panel; „Aufschlüsselung ansehen/ausblenden" toggelt die Details.
- Alle Werte + Modus in localStorage persistieren und beim Laden wiederherstellen.
- Übergänge dezent (~150ms ease) oder keine; kein Glow, keine Glas-Effekte, keine Donut-Chart mehr.

## Design-Tokens

- Hintergrund Seite #0d1117 · Karten/Popover #161b22
- Text: primär #e6edf3 · sekundär #8b949e · schwach #6b7280 · schwächst #4b5563 · weiß #fff (Titel)
- Akzent Grün #4ade80 (Prognose, Gewinn, Aktionen) · Blau #58a6ff (Historisch, Zwischenwerte) · Gelb #fbbf24 (Steuern/Warnungen) · Rot #f87171 (Verlust/negativ) · Live-Grün #22c55e
- Borders: rgba(255,255,255,.06/.08/.1/.15) · Grün-Borders rgba(74,222,128,.3/.35/.5)
- Radius: 6 (Tokens) · 8 (Buttons/Inputs) · 10 (Info-Boxen) · 12 (Karten/Popover) · 14 (Panels)
- Schrift: **Outfit** (Titel, Zahlen) + **Inter** (Fließtext) — liegen bereits unter `public/vendor/fonts/`
- Größen: Satz 27px · Kartenwert 22px · Gewinn 30px · Karten-Label 11px uppercase · Body 12.5–13px · Hinweise 11–11.5px

## Hinweise zur Umsetzung im Repo

- `calculateESPP()`, `js/tax.js`, `js/constants.js`, Kurs-/FX-Fetch und pdf.js-Parser unverändert weiterverwenden — nur die DOM-Verdrahtung (`elements`-Map in app.js) auf die neuen Elemente umstellen.
- Der Prototyp rundet EUR-Beträge in den Flow-Karten auf ganze €; in der Aufschlüsselung 2 Nachkommastellen (de-DE-Format).
- Break-even wird per Bisektion über den Verkaufskurs gefunden (Gewinn = 0).
- Balkenbreiten: `max(2, min(100, wert / max(kette) * 100))`.

## Dateien im Paket

- `ESPP Rechner 1c Prototyp.dc.html` — interaktiver Referenz-Prototyp (im Browser öffnen, `support.js` muss daneben liegen)
- `support.js` — Runtime für den Prototyp (nicht Teil des Designs)
