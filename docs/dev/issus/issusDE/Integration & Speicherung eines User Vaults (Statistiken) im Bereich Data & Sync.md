#31
## Master Issue (DE): Integration & Speicherung eines **User Vaults** (Statistiken) im Bereich **Data & Sync**
### Kontext / Motivation
Aktuell existiert in **Settings → Data & Sync** bereits ein Platzhalter-Bereich, jedoch sind alle Funktionen inaktiv:
- **Vault & Index**
- **Data & Sync** (Placeholder)
    - Local Storage Path
    - Export / Import (JSON)
    - Sync Provider (Coming later)
Ziel ist die Einführung eines **User Vaults** (rein für **User-Statistiken / Fortschritt / Lernhistorie**) mit **lokaler Speicherung**, sodass Statistiken beim Vault-Wechsel zuverlässig **wieder geladen** werden können. Cloud-Sync bleibt vorerst offline, die Struktur soll aber vorbereitet werden.

---

### Zielbild
Ein **User Vault** ist ein lokaler Datenbereich, der:
- **User-Statistiken** (und zukünftig weitere App-Daten) enthält
- **portabel** ist (replizierbar/backupfähig)
- beim Wechsel zwischen Vaults **wiederverwendbar** ist
- wahlweise **automatisch** im Vault-Root oder in einem **frei wählbaren Pfad** abgelegt werden kann

---

## Anforderungen
### A) Speicheroptionen (User Vault Location)
In **Settings → Data & Sync** sollen folgende Optionen verfügbar sein:
1. **Auto (recommended):** Speichern im aktuellen Vault-Root als Ordner:
    - `<VAULT_ROOT>/user/`
    - Der Ordner ist nur nutzbar, wenn der Vault-Pfad verfügbar/gewählt ist.
2. **Custom path:** User Vault in einem frei gewählten Pfad (z. B. außerhalb des Vaults)
3. **Cloud / Sync Provider:** UI bereits sichtbar, aber **deaktiviert** (Coming later)
**Wichtig:** Wenn ein Pfad gewählt wurde, muss das System so strukturiert sein, dass dieser User Vault **replizierbar** ist (z. B. Backup/Copy auf anderes Gerät), sodass beim erneuten Auswählen/Laden die Statistiken wieder vorhanden sind.

---

### B) Struktur im User Vault
Innerhalb des User-Ordners sollen **Profile** gespeichert und wieder ladbar sein:
- `<USER_VAULT>/profiles/<DATE>_<USER_NAME>/...`
Beispiel:
- `user/profiles/2026-01-14_MeinLoard/`
Zweck:
- Mehrere User/Profile pro Installation möglich
- Profile eindeutig (Datum + Name)

---

### C) Verhalten beim Vault-Wechsel
- Beim Wechsel des **Markdown Vaults** dürfen Statistiken **nicht verloren gehen**.
- Wenn **Auto-Mode** aktiv ist:
    - User Vault ist an den jeweiligen Vault gekoppelt (`<VAULT_ROOT>/user/`)
    - Beim Öffnen eines Vaults: automatisch dort nach User-Profil(en) suchen und laden
- Wenn **Custom path** aktiv ist:
    - User Vault ist unabhängig vom Vault-Pfad
    - Wechsel des Vaults ändert nicht den User Vault Pfad; Statistiken bleiben identisch, sofern Nutzer das so konfiguriert

---

### D) Export / Import (JSON)
Im Bereich **Export / Import (JSON)** soll das Feature für User Vault Daten vorbereitet/implementiert werden:
- **Export JSON**: Export der User-Statistiken (Scope: aktuelles Profil oder gesamter User Vault)
- **Import JSON**: Import in ein Profil (mit klarer Merge/Overwrite-Strategie)
Hinweis: Das UI existiert bereits als Platzhalter; jetzt soll es funktional für User Vault Daten werden.

---

## UI/UX Anforderungen (Settings → Data & Sync)
Ergänzungen/Umstrukturierung in **Data & Sync**:
- Abschnitt **User Vault**
    - Radio/Select: `Auto (Vault/user)` vs. `Custom path`
    - Anzeige des aktiven Pfads (read-only + “Change” Button bei Custom)
    - Statusanzeige: `Found profiles: n`, `Active profile: ...`
    - Aktionen:
        - `Create Profile` (Name eingeben; Datum automatisch)
        - `Load Profile` (Dropdown / Liste)
- Abschnitt **Export / Import (JSON)**
    - `Export current profile`
    - `Export all profiles`
    - `Import` (File picker)
- Abschnitt **Sync Provider (Coming later)** bleibt sichtbar, aber disabled.

---

## Technische Akzeptanzkriterien
1. **Persistenz:** Statistiken bleiben nach App-Restart erhalten.
2. **Deterministische Pfade:**
    - Auto-Mode speichert immer in `<VAULT_ROOT>/user/`
    - Custom-Mode speichert immer im gewählten Pfad
3. **Profil-Lebenszyklus:**
    - Profil anlegen, laden, wechseln
    - Profilverzeichnis nach Schema `<DATE>_<USER_NAME>` wird korrekt erzeugt
4. **Vault-Wechsel:**
    - Auto-Mode: User Vault ändert sich mit Vault
    - Custom-Mode: User Vault bleibt gleich
5. **Replizierbarkeit:** Kopieren des User Vault Ordners auf ein anderes Gerät erlaubt Wiederherstellung (via Custom path oder durch Ablegen in Vault-Root).
6. **Cloud-Sync:** sichtbar aber inaktiv; keine versteckten Calls.

---

## Implementierungs-Notizen / Hinweise
- User Vault enthält nur **App-Daten** (Statistiken), keine Markdown-Inhalte.
- Keine Cloud-Funktionalität implementieren, aber die Settings-Struktur so planen, dass “Sync Provider” später ergänzt werden kann.
- Pfad-/Dateioperationen müssen OS-kompatibel sein (Windows/macOS/Linux).

---

## Tasks / Sub-Issues (Vorschlag)
1. **Settings UI: Data & Sync → User Vault Sektion** (Auto/Custom, Pfad-Handling)
2. **User Vault Storage Layer** (Ordnerstruktur, Profile, CRUD)
3. **Load-on-start + Vault switch logic**
4. **Export/Import JSON für User Vault**
5. **Tests / QA** (Pfadwechsel, Vaultwechsel, Profilwechsel, Import/Export)

---

Wenn du willst, kann ich als nächsten Schritt daraus auch direkt **Issue-Templates** (Checkboxen, Labels, Prioritäten, Definition of Done) im GitHub-Stil formatieren, passend zu eurem Repo-Workflow.
