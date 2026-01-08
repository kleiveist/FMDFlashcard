← Back to [FMDFlashcard/docs/user/examples/index.md](Examplesindex.md)

| Beschreibung                            | Syntax start                                                         | Sytax end                                        | Relewant für           | Aktion                                                                                                 | kürzel |
| --------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------ | ------ |
|                                         |                                                                      | WICHTIG #                                        | gilt nicht wenn        | # Überstich <br>## überschrift                                                                         |        |
|                                         |                                                                      |                                                  | e = exam               | f = flashcard                                                                                          |        |
| Examen-Blog (Container)                 | #exam                                                                | #examend                                         | e-page<br>Exam-Modus   | - Datei/Abschnitt als **Exam-Content** markieren- Inhalte **nicht als Flashcards**                     | e      |
| Examen-Aufgabenblock                    | - Start Aufgabe  Nummerierung, <br>1.   2)   2.)    1.2.3 <br>n = 99 | ---  <br>1.2.3<br>#                              | e-page<br>Exam-Modus   | Aufgabe als Exam-Item                                                                                  | ea     |
| Flashcard-Blog (Card-Block / Container) | #card                                                                | #                                                | f-pages Flashcard-Scan | - Block als Flashcard-Item <br>                                                                        | f      |
| Antwort-Marker (Q/A-Teil)               | Answer:{text}<br>Antwort: {text}<br>answertocken:{text}              | ---  <br>#                                       | e-page <br>f-pages     | - Alles nach Marker als **Antworttext** speichern; Zeilenumbrüche beibehalten.                         | qa     |
| True/False-Marker <br>(2-Button-Karte)  | true/false? {text}<br>-true or<br>-false                             | ---  <br>#                                       | e-page <br>f-pages     | - UI: **2 Buttons (True/False)**- Validierung: Marker muss auf **nächster nicht-leerer Zeile** stehen. | tf     |
| Multiple Choice (Single-Answer)         | - Options-Labels im Block,<br>`a)` `b)` `c)` …                       | aswahl endet mit<br>-a)<br>blog mit <br>#<br>--- | e-page <br>f-pages     | - UI: Auswahl Single Marker mindestens 1<br>-x = 1<br>-a)                                              | m1     |
| Multiple Choice <br>(Multi-Answer)      | - Options-Labels im Block,<br>`a)` `b)` `c)` …                       | aswahl endet mit<br>-a)<br>blog mit <br>#<br>--- | e-page <br>f-pages     | Auswahl Multi Anzahl Marker mindestens 2<br>-x < 2<br>-a)<br>-b)                                       | m2     |
| Cloze Lückentext:                       | -Typed blanks: `%%...%%` innerhalb                                   | ---  <br>#                                       | e-page <br>f-pages     | für Backticks- Validierung: jedes `%%...%%` enthält Text.                                              | cl     |
| Cloze <br>Drag Tokens)                  | des Texts- Drag tokens: ``token``                                    | ---  <br>#                                       | e-page <br>f-pages     | - UI: Eingabefelder für ``token`` + Drag/Drop                                                          | cd     |
| Cloze Lückentext +Drag Tokens           | Typed blanks: `%%...%%` + tokens: ``token``innerhalb                 | ---  <br>#                                       | e-page <br>f-pages     | - UI: Eingabefelder  ``token`` und Drag/Drop<br> Backticks- Validierung: jedes `%%...%%`               | cld    |
## **Kombinierung Tabelle** 
Legende: 💠 problemlos · ❕ mit Beachtung · ⚠️ mit Einschränkungen · ❌ nicht möglich

|     | e   | ea  | f   | qa  | tf  | m1  | m2  | cl  | cd  | cld |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| e   | ❌   | 💠  | ❌   | ❕   | ❕   | ❕   | ❕   | ❕   | ❕   | ❕   |
| ea  | 💠  | ❌   | ❌   | 💠  | 💠  | 💠  | 💠  | 💠  | 💠  | 💠  |
| f   | ❌   | ❌   | ❌   | 💠  | 💠  | 💠  | 💠  | 💠  | 💠  | 💠  |
| qa  | ❕   | 💠  | 💠  | 💠  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| tf  | ❕   | 💠  | 💠  | ⚠️  | 💠  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| m1  | ❕   | 💠  | 💠  | ⚠️  | ⚠️  | 💠  | ❕   | ⚠️  | ⚠️  | ⚠️  |
| m2  | ❕   | 💠  | 💠  | ⚠️  | ⚠️  | ❕   | 💠  | ⚠️  | ⚠️  | ⚠️  |
| cl  | ❕   | 💠  | 💠  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | 💠  | 💠  | ❕   |
| cd  | ❕   | 💠  | 💠  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | 💠  | 💠  | ❕   |
| cld | ❕   | 💠  | 💠  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ❕   | ❕   | 💠  |

---
### Kurzregeln je Kürzel (Begründung für ❕/⚠️)

| Kürzel | Status | Hinweis                                                                                                                                                                   |
| ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| e      | ❕      | Innerhalb `#exam … #examend` sind Kartentypen **nur sinnvoll innerhalb** eines Aufgabenblocks (`ea`). Außerhalb davon: typischerweise **Freitext/ignored**.               |
| ea     | 💠     | Aufgabenblock kann **genau einen** Interaktionstyp enthalten (qa/tf/m1/m2/cl/cd). Mehrere Typen in _einer_ Aufgabe nur als Composite (dann wie unten ⚠️).                 |
| f      | 💠     | `#card … #` kann qa/tf/m1/m2/cl/cd tragen. Mehrere Typen in _einem_ `#card` nur als Composite (⚠️).                                                                       |
| qa     | ⚠️     | Sobald qa mit interaktiven Typen gemischt wird (tf/m1/m2/cl/cd), sind Antworten häufig **nicht mehr sauber automatisch prüfbar** → ggf. nur Selbstkontrolle/Teil-Scoring. |
| tf     | ⚠️     | Gemischt mit m1/m2/cl/cd erfordert pro Part **eigene UI/Logik** (Multi-Widget Composite). Wenn nicht implementiert: Einschränkung oder Fallback.                          |
| m1     | ❕      | m1+m2 ist möglich, aber **nur als getrennte Parts** (klare Marker je Part).                                                                                               |
| m2     | ❕      | analog m2+m1.                                                                                                                                                             |
| cl     | 💠     | cl+cd ist problemlos (Cloze-Text kann beides enthalten). Mit anderen Typen nur als Composite (⚠️).                                                                        |
| cd     | 💠     | wie cl.                                                                                                                                                                   |
| cld    |        | wie cl + cd                                                                                                                                                               |
|        |        |                                                                                                                                                                           |


