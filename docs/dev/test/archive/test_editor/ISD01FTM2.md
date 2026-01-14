\#exam
📍 Abschnitt 1: Multiple Choice (m1)


1) [m1] Welche Aussage beschreibt am präzisesten den Begriff „Relation“ im relationalen Datenmodell?

a) Eine einzelne Zeile in einer Tabelle (ein Datensatz)

b) Eine gesamte Tabelle mit gleich strukturierten Datensätzen

c) Eine einzelne Spalte in einer Tabelle (ein Attribut)

d) Ein SQL-Statement zum Abfragen von Daten

\-b


---


2) Welche Eigenschaft muss ein Primärschlüssel in einer relationalen Tabelle erfüllen?


a) Er darf NULL-Werte enthalten, wenn ein Default definiert ist


b) Er muss eindeutig sein und darf nicht NULL sein


c) Er ist immer ein zusammengesetzter Schlüssel aus mehreren Spalten


d) Er referenziert immer einen Primärschlüssel in einer anderen Tabelle


\-b


---


3) [m1] Wie wird eine N:M-Beziehung (Viele-zu-Viele) in relationalen Datenbanken typischerweise umgesetzt?

a) Durch einen Fremdschlüssel in einer der beiden Tabellen

b) Durch das Duplizieren der Datensätze in beiden Tabellen

c) Durch eine zusätzliche Beziehungstabelle mit Fremdschlüsseln

d) Durch ein CHECK-Constraint auf beiden Tabellen

\-c


---


4) [m1] Welche SQL-Komponente gehört primär zur Data Manipulation Language (DML)?

a) CREATE TABLE

b) INSERT

c) GRANT

d) DROP TABLE

\-b


---


5) [m1] Welche Aussage trifft auf Views (Sichten) in relationalen Datenbanken am ehesten zu?

a) Ein View speichert eigene Daten physisch dauerhaft

b) Ein View ist eine gespeicherte SELECT-Abfrage und verhält sich wie eine virtuelle Tabelle

c) Ein View kann nur mit ALTER TABLE erzeugt werden

d) Ein View ist ausschließlich für Schreiboperationen gedacht

\-b


---


📍 Abschnitt 1: True/False mit m1-Auswahl + Statement


6) [tf]

Quest: Die referenzielle Integrität wird in relationalen Datenbanken durch Fremdschlüsselbeziehungen abgesichert.
a) True

b) False

c) Nur bei NoSQL-Systemen zutreffend

d) Nur wenn keine NULL-Werte erlaubt sind

\-a


Statement:
Eine Fremdschlüsselspalte darf nur Werte enthalten, die als Primärschlüsselwert in der referenzierten Tabelle existieren.
\-true


---


7) [tf]

Quest: Transaktionen dienen dazu, mehrere SQL-Operationen als eine atomare Einheit auszuführen.
a) True

b) False

c) Nur für SELECT-Abfragen relevant

d) Nur bei Einzelbenutzerbetrieb notwendig

\-a


Statement:
Bei einem Fehler innerhalb einer Transaktion können bereits ausgeführte Änderungen mit ROLLBACK vollständig rückgängig gemacht werden.
\-true


---


📍 Abschnitt 2: Begriffsdefinitionen (qa)


8) [qa] Definieren Sie den Begriff „Datenbankmanagementsystem (DBMS)“ und grenzen Sie ihn von „Datenbank“ sowie „Datenbanksystem“ ab.

Antwort:


- Ein DBMS ist Software zur Verwaltung von Datenbanken: es steuert Zugriff, Abfragen, Sicherheit, Integrität und Wiederherstellung.
- Eine Datenbank ist der persistente Datenbestand (strukturierte Daten) auf einem Speichermedium.
- Ein Datenbanksystem ist die Kombination aus Datenbank und DBMS als Gesamtsystem.
- Typische DBMS-Aufgaben sind Mehrbenutzerbetrieb, Konsistenzsicherung und Zugriffskontrolle.


---


📍 Abschnitt 3: Erläuterungsfrage (qa)


9) [qa] Erläutern Sie, wie 1:N- und N:M-Beziehungen aus einem konzeptionellen Modell in ein relationales Schema übertragen werden. Gehen Sie dabei auf Primär- und Fremdschlüssel sowie Integritätsaspekte ein. Strukturieren Sie Ihre Antwort in Absätze und Unterpunkte.

Antwort:


1. Übertragung von 1:N-Beziehungen


- Der Primärschlüssel der „1“-Tabelle wird als Fremdschlüssel in der „N“-Tabelle gespeichert.
- Dadurch kann jeder Datensatz der „N“-Tabelle eindeutig einem Datensatz der „1“-Tabelle zugeordnet werden.


2. Übertragung von N:M-Beziehungen


- N:M wird durch eine zusätzliche Beziehungstabelle aufgelöst.
- Diese Beziehungstabelle enthält typischerweise zwei Fremdschlüssel (jeweils auf die Primärschlüssel der beteiligten Tabellen).
  —


3. Integritätsaspekte


- Referenzielle Integrität stellt sicher, dass jeder Fremdschlüsselwert in der referenzierten Tabelle existiert.
- Optional werden Lösch-/Änderungsregeln (z. B. ON DELETE CASCADE) definiert.


Beispiel:


- Kunde (KundeID PK) und Bestellung (BestellungID PK, KundeID FK) bilden eine 1:N-Beziehung; KundeID steht in Bestellung als Fremdschlüssel.


---


📍 Abschnitt 4: Anwendungsfrage mit Code (cld)


10) [cld] Mini-Use-Case: In einem Onlineshop sollen „Artikel“ und „Film“ verknüpft werden. Ein Entwickler hat eine View für „sofort verfügbare Filme“ gebaut, aber die SQL-Definition ist fehlerhaft (Join-Logik und Filter). Ergänzen Sie die Lücken so, dass:


- ein INNER JOIN über ArtikelID erfolgt,
- nur Filme mit Verfuegbarkeit = 'sofort' erscheinen,
- das Ergebnis nach Name aufsteigend sortiert wird,
- die View Name, Preis, Regisseur, Verfuegbarkeit ausgibt.


Fehlerhaftes Snippet (zu korrigieren/zu vervollständigen):


```
CREATE VIEW %%ViewName%% AS
SELECT %%Spalte1%%, %%Spalte2%%, %%Spalte3%%, %%Spalte4%%
FROM %%TabelleLinks%% `INNER JOIN` %%TabelleRechts%%
%%JoinKlausel%% %%JoinBedingung%%
`WHERE` %%FilterBedingung%%
`ORDER BY` %%SortierSpalte%% %%SortierRichtung%%;
```


Hinweise:


- Setzen Sie als View-Namen einen sprechenden Namen.
- Wählen Sie für %%JoinKlausel%% entweder `ON` oder `USING` passend zur Join-Bedingung.
- Die Filterbedingung soll exakt auf Verfügbarkeit „sofort“ prüfen.


Antwort:


1. Korrekte View-Definition (strukturierte Lösung)


- View-Name: ViewSofortVerfuegbareFilme
- SELECT-Spalten: Name, Preis, Regisseur, Verfuegbarkeit
- Join: Artikel INNER JOIN Film ON Artikel.ArtikelID = Film.ArtikelID
  —


2. Muster-SQL (ausformuliert)


```
CREATE VIEW ViewSofortVerfuegbareFilme AS
SELECT Artikel.Name, Artikel.Preis, Film.Regisseur, Artikel.Verfuegbarkeit
FROM Artikel INNER JOIN Film
ON Artikel.ArtikelID = Film.ArtikelID
WHERE Artikel.Verfuegbarkeit = 'sofort'
ORDER BY Artikel.Name ASC;
```


3. Kernaussagen + kurzes Beispiel


- Ein INNER JOIN liefert nur Datensätze, die das Join-Kriterium erfüllen; dadurch werden nur verknüpfte Artikel/Filme ausgegeben.
- WHERE filtert vor der Sortierung und reduziert die Ergebnismenge auf „sofort verfügbare“ Datensätze.
- ORDER BY sorgt für reproduzierbare Ausgabe; hier alphabetisch nach Name.
  Beispiel:
- Ein Film mit Artikel.Verfuegbarkeit = 'sofort' erscheint in der View; ein Film „in 3 Tagen“ wird ausgeschlossen.


---


\#examend


\`\`

