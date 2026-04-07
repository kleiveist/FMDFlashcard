
In dem Bereich

| Makedown Viwe | Makedwond Hybrit Edit Mode |
| --- | --- |
| ```<section class=​"database-block" data-md-block-control=​"true">​flex``` | ```<div class=​"markdown-hybrid-block markdown-hybrid-block-database-block" data-md-block-kind=​"database-block" data-md-block-index=​"2" data-md-block-id=​"2">​…​</div>``` |

Beide Abschnitte müssen einmal Übeaerbeitet und angelichen werden
- dabei ist wichtig ddas die From udn Positzion der Icons Felder und Button Gleich ist und regeln folgt


| Name [Textfeld] | Quelle: aktueller Ordner | View | Sortiren (Icon) | Filtern  (Icon) | Eigenschaften  (Icon) | Suche |
| --- | --- | --- | --- | --- | --- | --- |
| Freischriebar | Dropdwon | Dropdwon | Dropdwon | Dropdwon | Dropdwon | Freischriebar |
| `<input class=​"database-block-title-input" placeholder=​"Database Name" data-md-block-control=​"true" type=​"text" value=​"Database">​Event` | `<button type=​"button" class=​"database-block-toolbar-button database-block-source-button" aria-expanded=​"false" data-md-block-control=​"true">​Quelle: aktueller Ordner​</button>​flexEvent` | `<select class=​"database-block-view-select">​…​</select>​Event` | `<button type=​"button" class=​"database-block-toolbar-button database-block-toolbar-button-compactable" aria-expanded=​"false" aria-label=​"Sortieren" title=​"Sortieren" data-md-block-control=​"true">​flexEvent` | `<button type=​"button" class=​"database-block-toolbar-button database-block-toolbar-button-compactable" aria-expanded=​"false" aria-label=​"Filtern" title=​"Filtern" data-md-block-control=​"true">​flexEvent` | `<button type=​"button" class=​"database-block-toolbar-button database-block-toolbar-button-compactable" aria-expanded=​"false" aria-label=​"Eigenschaften" title=​"Eigenschaften" data-md-block-control=​"true">​…​</button>​flexEvent` | `<input class=​"database-block-search" placeholder=​"Suche" data-md-block-control=​"true" type=​"search" value>​Event` |

- Quelle: aktueller Ordner  soll nur noch Quelle lauten der Button soll sich Verkleine endsprechend der Textlänge 
- Alle Icon Button soll immer Icons Buttoen sein egasl wie Grosß oder kelin das feld ist 
- Das Such Feld Soll ein Suchen Button Werden Das suche Feld kommt dan beim klicken auf dem Button per Dropdwon Linksbündig nach links aufklappend um nicht aus dem feld zu verschwinden der rand das Dropdwon menüs endet recht an der Button kantr 
Alle ZUsaäliche Optzionenn Die aus dem Standerd abwesien wie in der Tabelle kommen ein Feld darunter Dazu Zälen:

| Was | Code |
| --- | --- |
| Dropdwon Kanban board Grupbay Optzionen | `<select class=​"database-block-view-select">​…​</select>​Event` |
| Timeline Optzinen Button mit Dropdwon | `<button type=​"button" class=​"database-block-toolbar-button" aria-expanded=​"false" data-md-block-control=​"true">​Timeline Optionen​</button>​flexEvent` |
| Project Optzinen Button mit Dropdwon | `<button type=​"button" class=​"database-block-toolbar-button" aria-expanded=​"false" data-md-block-control=​"true">​Project Optionen​</button>​flexEvent` |
| Pie Optionen  Button mit Dropdwon | `<button type=​"button" class=​"database-block-toolbar-button" aria-expanded=​"false" data-md-block-control=​"true">​Pie Optionen​</button>​flexEvent` |
Dise Sollen Unterhab Der Vier Button   Sortiren (Icon) | Filtern  (Icon) | Eigenschaften  (Icon) | Suche 
Ligen und fest dort Bleien 

---

In dem Step sollen Jetzt auch Der Bereich Name Kein Txtz feld mehr sein sondern ein Ein Anklickbarer Name 
- Klickt man in diesen so Wird ein DorpDown Menü aufgeklppt in dem Falls nach rechtsc damit es nicht aus den Database Bereich verwschident 
- Dort Kann man nun Viwe hinzufügen in dem man ein name Gibt Namen sind Also Auch Viwe Speicherungen 
- eine Viwe Speicherung Speichert Alle Filter Sortung Eigeschaft Zusäliche Optionen und den letzt Viwe Modus 
Alles Gespeichtern Viwes sind in dem Dorpdown menü anklickbar und werden dadruch geladen diese sind dan von der Aktzenfabe farblich makrit damit man weis welchen man grade angeklcikt hat 
- Schlsie man das Dorp Dowen Menü Wird einen Der Namen Angezigt der Ankcikbar sit udn Das Drwopdoen meüe Öffent 
in den DorpDown ist ein Crart Vwie Button in den man den neuen gewümnsthen namen eintagen kann 

----

Nächste Umbau ist das Eigenschaf müssen wider für jeden Viwe typen einer hab eines Viwe Gelten denn die Speicherung soll für einen Vwie gelten egal welchen vwie modus 
innahb eines Viwe Namens 
- wächselt man ein Vwie namen so kann man dort allse Eingaschftn fiterung sortirung neu vergebn diese weden dann für den Viwe vergebn 
WICHTI NICHT FÜR DEN VIWE MODIES WIE Tabel KABAN TIMLINE ECT... 

----

Also Eintliche Sortiugn filterung Eingschaft auswhal prof Viwe name 

::::
title: Database
source:
  type: current-folder
view:
  type: table
  timelineMode: date
  ganttZoom: month
  pieAggregate: count
fields: []
columns:
  - Dateiname
  - Dateipfad
propertiesByView:
  table:
    - Dateiname
    - Dateipfad
  kanban: []
  gantt: []
  project: []
  pie: []
filters:
  op: and
  rules: []
sort: []
options:
  editable: false
  showSearch: true
  showToolbar: true
::::


