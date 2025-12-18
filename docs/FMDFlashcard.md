Wir bauen ein **lokales, Markdown-basiertes Flashcard-System mit Spaced Repetition**, ähnlich vom Konzept her zu **Obsidian**, aber mit **echtem Lern-Modus**.

Kurz und präzise:

---

## Projektziel (Kernidee)

Ein **Open-Source Flashcard-Programm**, das:
- vorhandene **Markdown-Dateien** nutzt (keine neuen Dateiformate)
- Karten **automatisch aus Präfixen** erzeugt    
- **Spaced Repetition (SRS)** integriert
- **lokal-first** arbeitet
- später **Desktop, Web und App** synchronisieren kann
---
## Was das Programm konkret kann
### 1. Vault-Konzept (wie Obsidian)
- Ein Vault = normaler Ordner
- Enthält:
    - Markdown-Dateien (`.md`)
    - einen versteckten Ordner `.flashcards/` für App-Daten
---
### 2. Karten aus Markdown (keine Extra-Dateien)
Beispiel:
```md
#card
Was ist eine TCP-Verbindung?
#endcard
```

Oder Multiple Choice:
```md
#card
A) UDP
B) TCP
C) ICMP

-B
#endcard
```

➡ Das Programm **liest** das, erstellt intern Karten, **ändert aber die MD-Dateien nicht**.

---
### 3. Karten-Typen (kombinierbar)
- Frage–Antwort
- Multiple Choice
- Zuordnung
- Lückentext (freie Eingabe, Groß/Kleinschreibung optional)
- Mischformen in einer Karte

Alles gesteuert über **konfigurierbare Präfixe / Regex**.

---
### 4. Spaced Repetition
- Karten haben:    
    - Fälligkeitsdatum
    - Schwierigkeitsfaktor
    - Wiederholungs-Historie
- Lernbuttons:
    - Nochmal
    - Schwer
    - Okay
    - Leicht
- Algorithmus: **SM-2-ähnlich**, lokal gespeichert
    

---
### 5. Moderne Oberfläche
- Desktop-App:
    - React + TypeScript
    - Tauri (leichtgewichtig, kein Electron)
- Funktionen:
    - Vault auswählen
    - Karten filtern (Ordner / Tags / Typ)
    - Lernmodus
    - Einstellungen (Präfixe, SRS, Stacking)
---
### 6. Zukunft: Sync (nicht jetzt, aber vorbereitet)
- Local-first bleibt
- Später:
    - Heimnetz (z. B. Web-UI)
    - Weltweit (Server)
- Gleicher Core für:
    - Desktop
    - Web
    - Mobile App
---
## Aktueller Stand
- Ziel & Architektur sind klar
- Tech-Stack ist installiert (Rust, Node, Tauri-Deps)
- Nächster Schritt wäre **Projekt anlegen und Grundstruktur bauen**

---
## Nächster logischer Schritt (wenn du bereit bist)
1. Tauri + React + TypeScript Projekt erzeugen
2. Leere App starten (`npm run tauri dev`)
3. Danach:
    - Vault auswählen
    - Markdown scannen
    - erste Karte anzeigen

Wenn du willst, sage **„Wir starten jetzt mit Schritt 1“**, dann gehen wir **kontrolliert, Schritt für Schritt** weiter.