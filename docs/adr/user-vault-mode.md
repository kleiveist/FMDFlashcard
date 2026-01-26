# User Vault Mode Unterschiede

## Zweck
Dieses Dokument erklaert den Unterschied zwischen den drei User Vault Modes und wann welcher Modus sinnvoll ist.

## Ueberblick
Der User Vault Mode bestimmt, **wo** die Nutzer- und Profil-Daten gespeichert werden und wie sie sich beim Wechsel des Vaults verhalten.

## Auto (Vault/user)
**Was passiert:**
- Die Daten werden **im aktuellen Vault** unter `user/` gespeichert.
- Jeder Vault verwaltet seine Profile und Statistiken separat.

**Wann sinnvoll:**
- Wenn du fuer jedes Projekt/Vault getrennte Fortschritte moechtest.
- Wenn unterschiedliche Vaults unabhaengige Lern- oder Arbeitskontexte sind.

**Konsequenz:**
- Beim Vault-Wechsel wechseln auch die Profile/Stats automatisch mit.

## Custom path
**Was passiert:**
- Die Daten werden in einem **festen Ordner ausserhalb** des Vaults gespeichert.
- Die Profile bleiben **gleich**, auch wenn du den Vault wechselst.

**Wann sinnvoll:**
- Wenn du eine zentrale Profile- und Statistiksammlung fuer mehrere Vaults willst.
- Wenn du haeufig zwischen Vaults wechselst, aber denselben Nutzerprofil-Kontext beibehalten willst.

**Konsequenz:**
- Profile/Stats sind vault-unabhaengig und bleiben stabil, egal welcher Vault aktiv ist.

## Sync provider
**Was passiert:**
- Geplant fuer eine **Synchronisation ueber einen Provider** (z. B. Cloud-Storage).
- Aktuell nur Platzhalter, je nach Feature-Flag deaktiviert.

**Wann sinnvoll (zukuenftig):**
- Wenn Profile und Statistiken ueber mehrere Geraete synchron gehalten werden sollen.

**Konsequenz:**
- Solange deaktiviert, gibt es **keine** Initialisierung oder Netzwerkaufrufe.

## Kurzvergleich
- **Auto (Vault/user):** Daten bleiben pro Vault getrennt.
- **Custom path:** Daten bleiben zentral und vault-unabhaengig.
- **Sync provider:** Zukunftsoption fuer Synchronisation, aktuell nicht aktiv.
