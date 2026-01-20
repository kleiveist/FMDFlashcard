<!-- AUTO-GENERATED:backlink START -->
[← Back](dev.md)
<!-- AUTO-GENERATED:backlink END -->
# Windows developer setup (PowerShell, run from source)

This guide describes a “fast start” flow for running the desktop app locally **on Windows** using **PowerShell**.

Notes:
- Commands below assume **Windows 10/11** with **winget** available.
- If you just installed Git/Python, **close and reopen** PowerShell so PATH updates apply.

---

## 1) Install Python + Git & check versions

### 1.1 Verify winget exists
```powershell
winget --version
```

### 1.2 Install Git for Windows
```powershell
winget install -e --id Git.Git --source winget
```

### 1.3 Install Python (recommended: 3.12)
```powershell
winget install -e --id Python.Python.3.12 --source winget
```

### 1.4 Restart PowerShell, then verify versions
```powershell
git --version
py -V
python --version
pip --version
```

If `git` or `python` is “not recognized”, close the terminal and open it again.

---

## 2) Clone the repo & switch to a standard project directory

```powershell
# Standard project directory:
$Projects = Join-Path $HOME "Projects"
New-Item -ItemType Directory -Force -Path $Projects | Out-Null
Set-Location $Projects
```
### Clone repository (replace URL if needed)
```powershell
git clone https://github.com/kleiveist/FMDFlashcard.git
```
```powershell
Set-Location .\FMDFlashcard
```
---

## 3) Control script (doctor / health check)

```powershell
py -3 .\tools\control.py --doctor
```

---

## 4) Install & setup

```powershell
py -3 .\tools\control.py --install
```

---

## 5) Tauri

```powershell
py -3 .\tools\control.py --tauri
```

---

## 6) Start

```powershell
py -3 .\tools\control.py --start
```

---

## 7) Build (release bundles / native packaging)

```powershell
Set-Location (Join-Path $HOME "Projects\FMDFlashcard")
py -3 .\tools\control.py --build
```

---

## If something fails

### Re-run the health check
```powershell
py -3 .\tools\control.py --doctor
```

### Confirm PATH / command discovery
```powershell
where.exe git
where.exe py
where.exe python
```

### Common Windows-specific fixes
- **Terminal says Git installed but `git` not found:** reopen PowerShell (PATH refresh).
- **`python` opens Microsoft Store:** Settings → Apps → Advanced app settings → App execution aliases → disable `python.exe` / `python3.exe`.
- **Installer prompts for admin:** run PowerShell “As Administrator” for the install step(s) only.
- **Tauri/toolchain errors:** you may need a supported **Node.js + pnpm** toolchain for the desktop build.
  - Install Node.js LTS:
    ```powershell
    winget install -e --id OpenJS.NodeJS.LTS --source winget
    ```
  - Enable pnpm via Corepack:
    ```powershell
    corepack enable
    corepack prepare pnpm@latest --activate
    node -v
    pnpm -v
    ```
- If you are behind a **proxy / SSL inspection** device and `winget` fails with certificate errors, prefer the `--source winget` flag and ensure system time/date is correct.

