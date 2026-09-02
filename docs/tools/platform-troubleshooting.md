# Platform Build Troubleshooting

Always start with a read-only diagnosis and plan:

```bash
./control tauri doctor
./control tauri build --target <target> --dry-run
```

## Linux

DEB, RPM, and AppImage require WebKitGTK 4.1, GTK3, AppIndicator, librsvg, OpenSSL, `patchelf`, and the relevant package tools. Use the Ubuntu 22.04 release runner for the declared glibc baseline. Artifact collection fails when `dpkg-deb` or `rpm` cannot verify metadata.

AppImage must remain executable. Install a verified local build with `./control tauri install-appimage --dry-run` followed by the real command.

## Windows

MSI/NSIS require the MSVC toolchain and WebView2 packaging support on a native Windows host. The portable ZIP is built from the same clean native release executable. A Linux `cargo-xwin` executable is experimental evidence only and cannot replace the MSI/NSIS matrix.

If signing is configured, confirm certificate import succeeded and inspect `Get-AuthenticodeSignature` evidence. The release manifest must stay `unsigned` until that verification succeeds.

## macOS

Build `aarch64-apple-darwin` on Apple Silicon and `x86_64-apple-darwin` on an Intel runner. Preserve executable modes when archiving `.app`. Verify DMGs with `hdiutil verify`, app metadata with `Info.plist`, and code signatures with `codesign --verify --deep --strict`.

Ad-hoc signing is permitted for unsigned CI evidence but is not Developer ID signing. Notarization remains `not-notarized` until Apple submission, stapling, and validation all succeed.

## Stale or duplicate artifacts

Native builds clean only the selected target's known output directories and record a build boundary. `release collect` rejects files older than that marker, duplicate glob matches, empty packages, symlinked paths, and unexpected names. Remove the affected target output and rebuild; never create a replacement placeholder file.
