# ===== Checkup: Was ist installiert? =====
# (läuft in jedem Terminal, auch fish)

echo "=== Shell ==="
echo "$SHELL"
echo

echo "=== PATH (wichtig für rustc/cargo/node) ==="
echo "$PATH" | tr ':' '\n' | nl | sed -n '1,25p'
echo

echo "=== Grundtools ==="
for c in git curl file pkg-config cmake make gcc g++; do
  if command -v "$c" >/dev/null 2>&1; then
    echo "OK  $c -> $(command -v $c)"
  else
    echo "MISS $c"
  fi
done
echo

echo "=== Rust (rustup) ==="
if command -v rustup >/dev/null 2>&1; then
  rustup --version
  rustup show active-toolchain || true
else
  echo "MISS rustup"
fi
if command -v rustc >/dev/null 2>&1; then rustc -V; else echo "MISS rustc"; fi
if command -v cargo >/dev/null 2>&1; then cargo -V; else echo "MISS cargo"; fi
echo

echo "=== Node / npm ==="
if command -v node >/dev/null 2>&1; then node -v; else echo "MISS node"; fi
if command -v npm  >/dev/null 2>&1; then npm -v;  else echo "MISS npm"; fi
if command -v pnpm >/dev/null 2>&1; then pnpm -v; else echo "INFO pnpm nicht installiert"; fi
echo

echo "=== Tauri-Dependencies (Arch/CachyOS Pakete) ==="
for p in gtk3 webkit2gtk libappindicator-gtk3 librsvg openssl; do
  if pacman -Q "$p" >/dev/null 2>&1; then
    echo "OK  $p -> $(pacman -Q $p)"
  else
    echo "MISS $p"
  fi
done
echo

echo "=== Optional: SQLite CLI ==="
if command -v sqlite3 >/dev/null 2>&1; then sqlite3 --version; else echo "INFO sqlite3 nicht installiert"; fi
