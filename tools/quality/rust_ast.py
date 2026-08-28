from __future__ import annotations

import hashlib
import importlib
import importlib.metadata
import json
import re
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from types import ModuleType
from typing import Any


class RustSyntaxError(ValueError):
    pass


_ANALYZER_ROOT = Path(__file__).with_name("rust_analyzer")
_ARTIFACT_RELATIVE_PATH = "dist/rust_quality_analyzer.wasm"
_ARTIFACT_PATH = _ANALYZER_ROOT / _ARTIFACT_RELATIVE_PATH
_PROVENANCE_PATH = _ANALYZER_ROOT / "provenance.json"

_SCHEMA_VERSION = 1
_ANALYZER_NAME = "rust-quality-analyzer"
_ANALYZER_VERSION = "1.0.0"
_ABI_VERSION = 1
_TARGET = "wasm32-wasip1"
WASMTIME_VERSION = "47.0.1"
_RUSTC_VERSION = "rustc 1.97.1 (8bab26f4f 2026-07-14)"
_PATH_REMAP_CONTRACT = {
    "version": 1,
    "transport": "CARGO_ENCODED_RUSTFLAGS",
    "precedence": "broad-roots-first-specific-roots-last",
    "user_home": "/user-home",
    "source_root": "/workspace/rust-quality-analyzer",
    "cargo_home": "/cargo-home",
    "cargo_target": "/cargo-target",
    "rust_sysroot": "/rust-toolchain",
    "dependency_root_template": "/cargo-sources/<name>-<version>-<source-sha256-12>",
}
_DIGEST_PATTERN = re.compile(r"[0-9a-f]{64}", re.ASCII)

_MEMORY_LIMIT_BYTES = 128 * 1024 * 1024
_FUEL_LIMIT = 100_000_000
_RESOURCE_COUNT_LIMIT = 1


@dataclass(frozen=True, slots=True)
class _ExecutionResult:
    exit_code: int
    stdout: str
    stderr: str


@dataclass(frozen=True, slots=True)
class _ExpectedDigests:
    artifact: str
    cargo_lock: str
    source: str


def _mapping(value: object, expected_keys: frozenset[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != expected_keys:
        raise RustSyntaxError(f"Rust WASI analyzer provenance has an invalid {label}")
    return value


def _exact(value: object, expected: object, label: str) -> None:
    if type(value) is not type(expected) or value != expected:
        raise RustSyntaxError(f"Rust WASI analyzer provenance has an invalid {label}")


def _digest(value: object, label: str) -> str:
    if not isinstance(value, str) or _DIGEST_PATTERN.fullmatch(value) is None:
        raise RustSyntaxError(f"Rust WASI analyzer provenance has an invalid {label}")
    return value


def _unique_object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result: dict[str, object] = {}
    for key, value in pairs:
        if key in result:
            raise RustSyntaxError("Rust WASI analyzer provenance contains duplicate fields")
        result[key] = value
    return result


def _read_provenance() -> dict[str, Any]:
    try:
        raw = _PROVENANCE_PATH.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise RustSyntaxError("Rust WASI analyzer provenance is missing") from exc
    except (OSError, UnicodeError) as exc:
        raise RustSyntaxError(f"Rust WASI analyzer provenance could not be read: {exc}") from exc
    try:
        value = json.loads(raw, object_pairs_hook=_unique_object)
    except json.JSONDecodeError as exc:
        raise RustSyntaxError("Rust WASI analyzer provenance is invalid JSON") from exc
    return _mapping(
        value,
        frozenset({"schema_version", "analyzer", "artifact", "build"}),
        "document",
    )


def _validate_provenance(provenance: dict[str, Any]) -> _ExpectedDigests:
    _exact(provenance["schema_version"], _SCHEMA_VERSION, "schema version")
    analyzer = _mapping(
        provenance["analyzer"],
        frozenset({"name", "version", "abi_version"}),
        "analyzer record",
    )
    _exact(analyzer["name"], _ANALYZER_NAME, "analyzer name")
    _exact(analyzer["version"], _ANALYZER_VERSION, "analyzer version")
    _exact(analyzer["abi_version"], _ABI_VERSION, "ABI version")

    artifact = _mapping(
        provenance["artifact"],
        frozenset({"path", "sha256", "target"}),
        "artifact record",
    )
    _exact(artifact["path"], _ARTIFACT_RELATIVE_PATH, "artifact path")
    _exact(artifact["target"], _TARGET, "artifact target")
    artifact_digest = _digest(artifact["sha256"], "artifact SHA-256")

    build = _mapping(
        provenance["build"],
        frozenset(
            {
                "rustc",
                "syn",
                "proc_macro2",
                "cargo_lock_sha256",
                "source_sha256",
                "path_remapping",
            }
        ),
        "build record",
    )
    _exact(build["rustc"], _RUSTC_VERSION, "rustc version")
    _exact(build["syn"], "2.0.119", "syn version")
    _exact(build["proc_macro2"], "1.0.107", "proc-macro2 version")
    _exact(build["path_remapping"], _PATH_REMAP_CONTRACT, "path-remapping contract")
    return _ExpectedDigests(
        artifact_digest,
        _digest(build["cargo_lock_sha256"], "Cargo.lock SHA-256"),
        _digest(build["source_sha256"], "source SHA-256"),
    )


def _build_input_paths() -> tuple[tuple[str, Path], ...]:
    fixed = ("build.py", "Cargo.toml", "Cargo.lock", "rust-toolchain.toml")
    rust_sources = tuple(path.relative_to(_ANALYZER_ROOT).as_posix() for path in (_ANALYZER_ROOT / "src").rglob("*.rs"))
    if not rust_sources:
        raise RustSyntaxError("Rust WASI analyzer build inputs contain no Rust sources")
    relative_paths = sorted((*fixed, *rust_sources))
    return tuple((relative, _ANALYZER_ROOT / relative) for relative in relative_paths)


def _read_build_inputs() -> tuple[tuple[str, bytes], ...]:
    inputs: list[tuple[str, bytes]] = []
    for relative, path in _build_input_paths():
        try:
            content = path.read_bytes()
        except FileNotFoundError as exc:
            raise RustSyntaxError(f"Rust WASI analyzer build input is missing: {relative}") from exc
        except OSError as exc:
            raise RustSyntaxError(f"Rust WASI analyzer build input could not be read: {relative}: {exc}") from exc
        inputs.append((relative, content))
    return tuple(inputs)


def _source_digest(inputs: tuple[tuple[str, bytes], ...]) -> str:
    digest = hashlib.sha256()
    for relative, content in inputs:
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(content)
        digest.update(b"\0")
    return digest.hexdigest()


def _verify_build_inputs(expected: _ExpectedDigests) -> None:
    inputs = _read_build_inputs()
    cargo_lock = next(content for relative, content in inputs if relative == "Cargo.lock")
    if hashlib.sha256(cargo_lock).hexdigest() != expected.cargo_lock:
        raise RustSyntaxError("Rust WASI analyzer Cargo.lock failed SHA-256 verification")
    if _source_digest(inputs) != expected.source:
        raise RustSyntaxError("Rust WASI analyzer source failed SHA-256 verification")


def _validated_artifact() -> bytes:
    expected = _validate_provenance(_read_provenance())
    _verify_build_inputs(expected)
    try:
        artifact = _ARTIFACT_PATH.read_bytes()
    except FileNotFoundError as exc:
        raise RustSyntaxError("Rust WASI analyzer artifact is missing") from exc
    except OSError as exc:
        raise RustSyntaxError(f"Rust WASI analyzer artifact could not be read: {exc}") from exc
    actual_digest = hashlib.sha256(artifact).hexdigest()
    if actual_digest != expected.artifact:
        raise RustSyntaxError("Rust WASI analyzer artifact failed SHA-256 verification")
    return artifact


def _load_wasmtime() -> ModuleType:
    try:
        runtime = importlib.import_module("wasmtime")
    except ImportError as exc:
        raise RustSyntaxError(
            "the Rust WASI analyzer runtime is unavailable; run 'python tools/control.py install'"
        ) from exc
    try:
        installed_version = importlib.metadata.version("wasmtime")
    except importlib.metadata.PackageNotFoundError as exc:
        raise RustSyntaxError("the Rust WASI analyzer runtime has no installed distribution metadata") from exc
    if installed_version != WASMTIME_VERSION:
        raise RustSyntaxError(f"the Rust WASI analyzer requires Wasmtime {WASMTIME_VERSION}, found {installed_version}")
    return runtime


def _captured_text(path: Path, stream: str) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""
    except (OSError, UnicodeError) as exc:
        raise RustSyntaxError(f"Rust WASI analyzer {stream} could not be read: {exc}") from exc


def _bounded_store(runtime: ModuleType) -> tuple[Any, Any]:
    try:
        config = runtime.Config()
        config.consume_fuel = True
        engine = runtime.Engine(config)
        store = runtime.Store(engine)
        store.set_limits(
            memory_size=_MEMORY_LIMIT_BYTES,
            instances=_RESOURCE_COUNT_LIMIT,
            tables=_RESOURCE_COUNT_LIMIT,
            memories=_RESOURCE_COUNT_LIMIT,
        )
        store.set_fuel(_FUEL_LIMIT)
    except (AttributeError, TypeError, runtime.WasmtimeError) as exc:
        raise RustSyntaxError(f"Rust WASI analyzer runtime is incompatible: {exc}") from exc
    return engine, store


def _wasi_linker(runtime: ModuleType, engine: Any, store: Any, paths: tuple[Path, Path, Path]) -> Any:
    stdin_path, stdout_path, stderr_path = paths
    try:
        wasi = runtime.WasiConfig()
        wasi.stdin_file = str(stdin_path)
        wasi.stdout_file = str(stdout_path)
        wasi.stderr_file = str(stderr_path)
        store.set_wasi(wasi)
        linker = runtime.Linker(engine)
        linker.define_wasi()
    except (AttributeError, TypeError, runtime.WasmtimeError) as exc:
        raise RustSyntaxError(f"Rust WASI analyzer runtime is incompatible: {exc}") from exc
    return linker


def _start_export(runtime: ModuleType, engine: Any, store: Any, linker: Any, artifact: bytes) -> Any:
    try:
        module = runtime.Module(engine, artifact)
    except runtime.WasmtimeError as exc:
        raise RustSyntaxError(f"Rust WASI analyzer artifact is invalid: {exc}") from exc
    try:
        instance = linker.instantiate(store, module)
        start = instance.exports(store)["_start"]
        if not callable(start):
            raise KeyError("_start")
        function_type = start.type(store)
        if function_type.params or function_type.results:
            raise TypeError("_start must not accept parameters or return values")
    except (
        AttributeError,
        KeyError,
        TypeError,
        runtime.WasmtimeError,
        runtime.Trap,
    ) as exc:
        if isinstance(exc, runtime.Trap):
            raise RustSyntaxError(f"Rust WASI analyzer resource trap: {exc}") from exc
        raise RustSyntaxError(f"Rust WASI analyzer ABI is incompatible: {exc}") from exc
    return start


def _invoke(runtime: ModuleType, start: Any, store: Any) -> int:
    try:
        start(store)
    except BaseException as exc:
        if isinstance(exc, (KeyboardInterrupt, SystemExit)) or not isinstance(
            exc, Exception
        ):
            raise
        exit_trap = getattr(runtime, "ExitTrap", None)
        if isinstance(exit_trap, type) and isinstance(exc, exit_trap):
            code = getattr(exc, "code", None)
            if isinstance(code, int):
                return code
            raise RustSyntaxError(
                f"Rust WASI analyzer execution failed: {exc}"
            ) from exc
        trap = getattr(runtime, "Trap", None)
        if isinstance(trap, type) and isinstance(exc, trap):
            raise RustSyntaxError(f"Rust WASI analyzer resource trap: {exc}") from exc
        wasmtime_error = getattr(runtime, "WasmtimeError", None)
        if isinstance(exc, TypeError) or (
            isinstance(wasmtime_error, type) and isinstance(exc, wasmtime_error)
        ):
            raise RustSyntaxError(f"Rust WASI analyzer execution failed: {exc}") from exc
        raise
    return 0


def _execute(artifact: bytes, text: str) -> _ExecutionResult:
    runtime = _load_wasmtime()
    engine, store = _bounded_store(runtime)

    with tempfile.TemporaryDirectory(prefix="rust-quality-analyzer-") as directory:
        root = Path(directory)
        paths = root / "stdin", root / "stdout", root / "stderr"
        try:
            paths[0].write_bytes(text.encode("utf-8", errors="strict"))
        except (OSError, UnicodeError) as exc:
            raise RustSyntaxError(f"Rust WASI analyzer input could not be prepared: {exc}") from exc
        linker = _wasi_linker(runtime, engine, store, paths)
        start = _start_export(runtime, engine, store, linker, artifact)
        return _ExecutionResult(
            _invoke(runtime, start, store),
            _captured_text(paths[1], "stdout"),
            _captured_text(paths[2], "stderr"),
        )


def analyze_tree(text: str) -> dict[str, Any]:
    result = _execute(_validated_artifact(), text)
    if result.exit_code != 0:
        detail = result.stderr.strip() or result.stdout.strip()
        raise RustSyntaxError(detail or f"Rust WASI analyzer exited with {result.exit_code}")
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise RustSyntaxError("Rust WASI analyzer returned invalid JSON") from exc
    if not isinstance(payload, dict):
        raise RustSyntaxError("Rust WASI analyzer returned an invalid payload")
    return payload


def _read_stdin_utf8() -> str:
    binary = getattr(sys.stdin, "buffer", None)
    if binary is None:
        return sys.stdin.read()
    return binary.read().decode("utf-8", errors="strict")


def _write_utf8(stream: Any, text: str) -> None:
    binary = getattr(stream, "buffer", None)
    if binary is None:
        stream.write(text)
        stream.flush()
        return
    binary.write(text.encode("utf-8", errors="strict"))
    binary.flush()


def main() -> int:
    try:
        payload = analyze_tree(_read_stdin_utf8())
    except (OSError, UnicodeError, RustSyntaxError) as exc:
        _write_utf8(sys.stderr, f"{exc}\n")
        return 2
    _write_utf8(sys.stdout, f"{json.dumps(payload, ensure_ascii=False, sort_keys=True)}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
