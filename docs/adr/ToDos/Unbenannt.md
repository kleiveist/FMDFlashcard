Der Abschnitt soll etwas überarbeitet werden


`<div class=​"exam-selected-order" role=​"list" aria-label=​"Selected exam files">​flex `

es soll nun auch möglich sein das man Exam horizontal anordnet die Anordnung horizontal hat nur auf Nested Button Auswirkungen alles anderen 
  
Sequential + internal shuffle 
Sequential
Fully mixed
haben weiterhin die gleich logig auch wenn welche Exam.md übereinander liegen 

---


| Exam Anordnung1 | Exam Anordnung2 | Exam Anordnung2 | Auswirkung verhalten | Task  | Poin  |
| --------------- | --------------- | --------------- | -------------------- | ----- | ----- |
| Exam2.md        | Exam3.md        | Exam3.md        | ineinander gesetzte  | ((=)) | ((=)) |
|                 |                 |                 |                      |       |       |
bei Nested Exam1.md wird mit Exam2.md und Exam3.md ineinander veschacht gestartet also gleiche logig wie jtzt schon vohandne keine verändrung der logig 

| Exam Anordnung1 | Exam Anordnung2 | Auswirkung verhalten                       | Task  | Poin  |
| --------------- | --------------- | ------------------------------------------ | ----- | ----- |
| Exam1.md        |                 |                                            |       |       |
| +               |                 | Exam1.md wird mit<br>Exam2.md Nacheinander |       |       |
| Exam2.md        | Exam3.md        | ineinander gesetzte                        | ((=)) | ((=)) |
bei Nested Exam1.md wird mit Exam2.md (wobei Exam2.md  ineinander veschacht  mit Exam3.md gestartet wird )   nacheinacder also addirt von Task anzhal und Punkte anzahl mit Porfil möglich Profil wird verdoppelt von Punkte jeh nach anzahl der Tajks 



| Exam Anordnung1 | Exam Anordnung2 | Exam Anordnung3 | Task  | Poin  |
| --------------- | --------------- | --------------- | ----- | ----- |
| Exam1.md        |                 |                 |       |       |
| +               |                 |                 |       |       |
| Exam2.md        | Exam3.md        |                 | ((=)) | ((=)) |
| +               |                 |                 |       |       |
| Exam6.md        | Exam8.md        | Exam4.md        | ((=)) | ((=)) |
|                 |                 |                 |       |       |
bei Nested Exam1.md wird mit Exam2.md (wobei Exam2.md  ineinander veschacht  mit Exam3.md gestartet wird ) und mit  Exam1.md  (wobei Exam8.md und Exam4.md ineinander veschacht  mit Exam6.md  gestartet wird )
nacheinacder also addiert von Task anzahl und Punkte anzahl mit Profil möglich Profil wird verdoppelt von Punkte jeh nach anzahl der Tajks 

in
<div class=​"exam-selected-order" role=​"list" aria-label=​"Selected exam files">​flex
die verschibung der Blöcke soll <button type=​"button" class=​"exam-selected-chip" draggable=​"true" role=​"listitem" title=​"Exam/​IDBS01-TestCN.md" aria-pressed=​"false">​flexEvent

soll Smother erfolgen per Drag and Drp oder mit anklicken udn an geüschter setelle abtzt gleich logig wie jetzt auch schon nur das es Horizontal möglich ist 

hozital aber erstma nur maxmal 3 eben 


die Datstellung sonn jetzt eindeutige sein also besser animirt und schoner dastelleun wo man wie welche nbuton veschibt 
