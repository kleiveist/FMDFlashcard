---
Cover: '[[IDBS01-ExamL1-01.png]]'
Section: IUFS
Rank: SE1
Projekt: IDBS01
Task: ToDoList
Stratus: Progress
Stratus_: 🔵
Prio: 1
Text: Exam Lektion 1 als 20 Aufgaben
Ergebnis: 0 | 🚫 Nicht begonnen
Prozent: 0% | ⚪ 0
MuiChoi: 0
TextA1: 0
TextA2: 0
TransA3: 0
tags:
- IDBS01-ExamL1
- IUFS
- SE1
- IDBS01
- ToDoList
link1: '[[IDBS01-ExamL1]]'
---

```bash
VAULT_PATH="@vault_path"
NOTE_PATH="@note_path"
NOTE_DIR="$(dirname "$NOTE_PATH")"

echo "Vault: $VAULT_PATH"
echo "Note : $NOTE_PATH"
echo "Dir  : $NOTE_DIR"

cd "$VAULT_PATH/$NOTE_DIR"
PyObisExam --90
```
# 📄 Klausursimulation  
**IU-Klausur: Relationale Datenbanken & SQL**  
**Dauer:** 60–90 Minuten  **Maximale Punktzahl:** 45 Punkte  

---
# 📍 Abschnitt 1 – Multiple-Choice (7 × 3 Punkte = 21 Punkte)
#card
**1.** Welche Aussage beschreibt referentielle Integrität korrekt?  
A) Datentypen passen automatisch zueinander  
B) Fremdschlüssel müssen auf existierende Primärschlüssel verweisen  
C) NULL-Werte sind grundsätzlich verboten  
D) Tabellen ohne Fremdschlüssel benötigen keine Schlüsselprüfung  
-b
#
#card
**2.** Welche Operation gehört zur DML?  
A) CREATE TABLE  
B) INSERT  
C) GRANT  
D) ALTER TABLE  
-c
#
#card
**3.** Was trifft auf eine 1:N-Beziehung zu?  
A) Beide Seiten haben genau einen Datensatz  
B) Die Seite „N“ enthält einen Fremdschlüssel  
C) Es entsteht zwingend eine Zwischentabelle  
D) Beide Tabellen enthalten denselben Primärschlüssel  
-b
#
#card
**4.** Welche Aussage zu SQL-Abfragen ist korrekt?  
A) DISTINCT erzeugt immer zusätzliche Zeilen  
B) WHERE filtert nach der Gruppierung  
C) GROUP BY fasst Zeilen anhand gemeinsamer Attributwerte zusammen  
D) ORDER BY darf nur bei Zahlenwerten genutzt werden  
-c
#
#card
**5.** Welche Normalform entfernt transitive Abhängigkeiten?  
A) 1. Normalform  
B) 2. Normalform  
C) 3. Normalform  
D) Keine Normalform kümmert sich um Abhängigkeiten  
-c
#
#card
**6.** Welche JOIN-Art liefert alle linken Datensätze und passende rechte?  
A) INNER JOIN  
B) NATURAL JOIN  
C) LEFT JOIN  
D) USING JOIN  
-c
#
#card
**7.** Welche Aussage zu NoSQL-Systemen (Document Stores) trifft zu?  
A) Sie erfordern streng atomare Attribute  
B) Sie speichern strukturierte Dokumente wie JSON  
C) Sie unterstützen ausschließlich ACID-Transaktionen  
D) Sie benötigen zwingend fest definierte Schemata  
-b
#
---
# 📍 Abschnitt 2 – Begriffsdefinition (6 Punkte)

**8.** Definieren Sie den Begriff *Fremdschlüssel* eindeutig und geben Sie ein Beispiel in Tabellenform.  
**Tabellenformat:**  

| KUNDE        | Attribut |
| ------------ | -------- |
| KundeID (PK) | Name     |

| ADRESSE        | Attribut     |
| -------------- | ------------ |
| AdresseID (PK) | KundeID (FK) |

---

# 📍 Abschnitt 3 – Erläuterungsfrage (8 Punkte)

**9.** Erläutern Sie prägnant die Unterschiede zwischen der **1. Normalform** und der **3. Normalform**.  
Gehen Sie auf Zweck, typische Datenprobleme und die jeweilige Struktur ein.  



---

# 📍 Abschnitt 4 – Anwendungsfrage (10 Punkte)

**10.** Gegeben ist folgende Tabelle **RECHNUNG**:

| RechnungID | KundeID | Betrag |
| ---------- | ------- | ------ |
| 1          | 1       | 100.5  |
| 2          | 1       | 250    |
| 3          | 2       | 75.99  |

Formulieren Sie eine SQL-Abfrage, die **alle Rechnungen mit einem Betrag größer als 100** ausgibt.  
Es sollen die Spalten `RechnungID`, `KundeID` und `Betrag` ausgegeben und das Ergebnis **nach Betrag absteigend** sortiert werden.

---

# 🏆 Bewertungsschema

| Abschnitt | Punkte | Erreicht |
|----------|--------|----------|
| MC       | 21     |          |
| Text1    | 6      |          |
| Text2    | 8      |          |
| Transfer | 10     |          |
| **Gesamt** | **45** |          |

**Gesamtpunktzahl:** ____ / 45  
**Prozent:** ____ %  
**IU-Note:** ____  
**Bestanden:** □ Ja □ Nein

---

# ✏️ Zusatz: Prüfzeit-Check (8 Wörter/Minute)

Zur Selbstkontrolle bitte eine eigene Musterlösung im umgangssprachlichen Stil erstellen und prüfen, ob:

- Abschnitt 2 ≤ 90 Wörter  
- Abschnitt 3 ≤ 90 Wörter  
- Abschnitt 4 ≤ 90 Wörter  

---
# 📄 Klausursimulation  
**IU-Klausur: Relationale Datenbanken – Grundlagen & Operationen**  
**Dauer:** 60–90 Minuten  **Maximale Punktzahl:** 45 Punkte  

---

# 📍 Abschnitt 1 – Multiple-Choice (7 × 3 Punkte = 21 Punkte)

**1.** Was beschreibt eine Relation im relationalen Modell am treffendsten?  
A) Eine Menge von Tabellen ohne Attribute  
B) Eine Tabelle mit gleich strukturierten Datensätzen  
C) Eine Beziehung zwischen zwei Tabellen  
D) Eine Liste unterschiedlicher Datentypen  

**2.** Welche Aussage über Primärschlüssel ist korrekt?  
A) Sie dürfen doppelte Werte enthalten  
B) Sie dürfen NULL-Werte enthalten  
C) Sie identifizieren Datensätze eindeutig  
D) Sie werden automatisch als Fremdschlüssel verwendet  

**3.** Welcher Schritt gehört systematisch zum Suchen von Datensätzen?  
A) Löschen aller unbenutzten Fremdschlüssel  
B) Identifikation relevanter Relationen  
C) Automatisches Umwandeln aller Datentypen  
D) Erstellen neuer Beziehungstabellen  

**4.** Welche Aussage zu Fremdschlüsseln ist richtig?  
A) Ein Fremdschlüssel darf nicht auf einen Primärschlüssel zeigen  
B) Ein Fremdschlüssel muss eindeutig sein  
C) Ein Fremdschlüssel verweist auf einen Primärschlüssel einer anderen Tabelle  
D) Fremdschlüssel können nicht NULL sein  

**5.** Welche Beziehung beschreibt eine 1:1-Verknüpfung?  
A) Ein Kunde hat mehrere Rechnungsadressen  
B) Ein Kunde hat genau eine Heimadresse  
C) Viele Kunden teilen viele Adressen  
D) Jede Adresse gehört zu keinem Kunden  

**6.** Welche SQL-Komponente gehört zur DDL?  
A) INSERT  
B) UPDATE  
C) CREATE TABLE  
D) DROP VIEW  

**7.** Welche Operation wird beim Löschen von Datensätzen zwingend verlangt?  
A) Ignorieren referentieller Integrität  
B) Bestimmen aller abhängigen Fremdschlüssel  
C) Ersetzen aller Werte durch NULL  
D) Automatisches Zusammenführen von Tabellen  

---

# 📍 Abschnitt 2 – Begriffsdefinition (6 Punkte)

**8.** Definieren Sie präzise den Begriff *Datensatz* und geben Sie zusätzlich ein Beispiel in Tabellenform mit zwei Attributen.  

**Beispieltabelle:**  

| KUNDE   | Attribut |
| ------- | -------- |
| KundeID | Name     |

---

# 📍 Abschnitt 3 – Erläuterungsfrage (8 Punkte)

**9.** Erläutern Sie das Vorgehen beim **Löschen eines Kunden** aus einem relationalen Datenbanksystem.  
Gehen Sie auf alle notwendigen Schritte ein.  

---

# 📍 Abschnitt 4 – Anwendungsfrage (10 Punkte)
**10.** Gegeben ist folgendes Datenschema:

**Tabelle KUNDE**  
| KundeID | Name |

**Tabelle ADRESSE**  
| AdresseID | KundeID | Ort |

**Tabelle RECHNUNG**  
| RechnungID | KundeID | Betrag |

Formulieren Sie eine SQL-Abfrage, die alle **KundeID** ausgibt,  
für die sowohl in der Tabelle `ADRESSE` als auch in der Tabelle `RECHNUNG` mindestens ein Eintrag existiert.

Verwenden Sie dazu **eine Unterabfrage mit `IN`** und **keinen JOIN**.

---

# 🏆 Bewertungsschema

| Abschnitt  | Punkte | Erreicht |
| ---------- | ------ | -------- |
| MC         | 21     |          |
| Text1      | 6      |          |
| Text2      | 8      |          |
| Transfer   | 10     |          |
| **Gesamt** | **45** |          |

**Gesamtpunktzahl:** ____ / 45  
**Prozent:** ____ %  
**IU-Note:** ____  
**Bestanden:** □ Ja □ Nein
