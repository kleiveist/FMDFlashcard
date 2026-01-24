<!-- AUTO-GENERATED:backlink START -->
[← Back](de.md)
<!-- AUTO-GENERATED:backlink END -->
# FMD Syntax-Referenz (Kurz-Codes)

Diese Datei beschreibt die Kurz-Codes, die der Parser für **Exam**- und **Flashcard**-Inhalte erkennt.
Ziel: Einheitliche Syntax für Aufgaben- und Kartentypen (m1, m2, tf, qa, cl, cd, cld) inkl. Container (#exam/#card).

---

## 1) Container-Codes (Blöcke)

### `e` — Exam-Container
Markiert einen Bereich als **Exam-Session**.

**Start / Ende**

```md
#exam
... Inhalt ...
#examend
Regeln

#exam und #examend stehen jeweils allein in einer Zeile.

Innerhalb des Exam-Containers entstehen interaktive Aufgaben über Exam-Tasks (ea) (Nummerierung).

Freitext zwischen Aufgaben ist erlaubt (z. B. Hinweise, Bewertung, Tabellen).

ea — Exam-Task (nummerierte Aufgabe)
Jede Aufgabe beginnt mit einer Nummer und läuft bis zum nächsten Abbruchkriterium.

Gültige Starts (Beispiele)

md
Code kopieren
1) Prompt ...
2. Prompt ...
**3)** Prompt ...
-4. Prompt ...
Abbruch / Ende einer Aufgabe
Eine Aufgabe endet, wenn eines davon auftritt:

Eine Zeile, die genau --- enthält (Composite/Separator)

Die nächste nummerierte Aufgabe startet (z. B. 5) / 6.)

#examend

Empfehlung

Pro ea genau ein Interaktionstyp (qa/tf/m1/m2/cl/cd/cld), um Auswertung konsistent zu halten.

Wenn du mischen musst: nutze --- als klaren Trenner zwischen Teilaufgaben.

f — Flashcard-Container
Deklariert eine klassische Karte (auch innerhalb eines Exams möglich).

Start / Ende

md
Code kopieren
#card
... Karteninhalt ...
#
Regeln

#card und # stehen jeweils allein in einer Zeile.

Innerhalb eines #card können Interaktionen stehen (qa/tf/m1/m2/cl/cd/cld).

Mehrere Interaktionen in einer Karte nur als Composite mit --- (falls im UI/Scoring unterstützt).

2) Interaktionstypen (Kurz-Codes)
qa — Answer Marker (Q/A)
Kennzeichnet den Beginn der offiziellen Musterlösung. Alles ab Marker-Zeile bis zum Blockende wird als Antwort gespeichert.

Typische Marker

Answer:

Antwort:

weitere Sprachen sind möglich, wenn in der App-Liste enthalten

Beispiel

md
Code kopieren
#card
Erkläre das Prinzip der geringsten Privilegien.
Antwort:
1. Rechte nur nach Bedarf vergeben.
2. Rollen sauber trennen.
#
Wichtig

Marker muss am Zeilenanfang stehen (optional mit Formatierung wie **Antwort:**).

Alles danach (inkl. Zeilenumbrüche) gehört zur Lösung.

tf — True/False
Zwei-Button-Interaktion. Die Lösung steht als Marker auf der nächsten nicht-leeren Zeile.

Beispiel

md
Code kopieren
#card
Aussage: Der HTTP-Statuscode 404 bedeutet "Not Found".
-true
#
Regeln

Marker beginnt mit - und dann true oder false (ggf. auch lokalisierte Varianten).

Leerzeilen zwischen Prompt und Marker sind erlaubt, der Marker muss aber als nächste nicht-leere Zeile kommen.

m1 — Multiple Choice (Single Answer)
Genau eine richtige Antwort.

Beispiel

md
Code kopieren
#card
Welche Schicht gehört zum OSI-Modell Layer 4?
a) Physical
b) Transport
c) Application
-b
#
Regeln

Optionen als a) ..., b) ..., c) ... usw.

Genau eine korrekte Markierung: -a / -b / -c / ...

Mindestens 2 Optionen empfohlen.

m2 — Multiple Choice (Multi Answer)
Mehrere richtige Antworten (mindestens zwei Marker).

Beispiel

md
Code kopieren
#card
Welche sind HTTP-Methoden?
a) GET
b) POST
c) PING
d) PUT
-a
-b
-d
#
Regeln

Optionen wie bei m1

Mindestens zwei korrekte Marker -x (z. B. -a und -d)

cl — Cloze (Typed Blanks)
Lückentext mit freier Eingabe. Lösungen stehen in %...%.

Beispiel

md
Code kopieren
#card
Die Hauptstadt von Frankreich ist %Paris%.
#
Regeln

Jedes %...% erzeugt ein Eingabefeld.

Inhalt in %...% ist die Lösung (typisch: trim + case-normalisiert).

cd — Cloze (Drag Tokens)
Drag/Drop-Tokens mit `"..."`. Das Token selbst ist die Lösung.

Beispiel

md
Code kopieren
#card
Ordne zu: HTTP ist ein "application-layer" Protokoll.
#
Regeln

Tokens werden mit `"token"` markiert.

UI kann Tokens als “Tokenbank” / Drag-Elemente darstellen (je nach Implementierung).

cld — Kombiniert (Typed Blanks + Drag Tokens)
Kombiniert cl und cd in einem Cloze-Block.

Beispiel

md
Code kopieren
#card
Die API liefert %JSON% und verwendet typischerweise "GET" für das Abrufen von Ressourcen.
#
Regeln

%...% für Typed Blanks

`"token"` für Drag Tokens

Geeignet für Code-/Konfig-Aufgaben, bei denen sowohl Einsetzen als auch Tippen sinnvoll ist.

3) Composite / Trennzeichen
--- — Separator
Trennt Teilblöcke innerhalb eines #card oder beendet einen ea-Task-Teil.

Beispiel (Composite in einer Karte)

md
Code kopieren
#card
Teil A (TF):
Die Erde ist ein Planet.
-true
---
Teil B (QA):
Antwort: Kurze Begründung ...
#
Hinweis
Wenn Composite im UI nicht vollständig unterstützt ist, nutze lieber separate Aufgaben.
```
