from __future__ import annotations

import hashlib
import importlib.util
import io
import json
from copy import deepcopy
from functools import partial
from pathlib import Path
from types import SimpleNamespace

import pytest

from tools.quality import rust_ast

_DIGEST = "0" * 64


def _provenance(artifact: bytes) -> dict[str, object]:
    return {
        "schema_version": 1,
        "analyzer": {
            "name": "rust-quality-analyzer",
            "version": "1.0.0",
            "abi_version": 1,
        },
        "artifact": {
            "path": "dist/rust_quality_analyzer.wasm",
            "sha256": hashlib.sha256(artifact).hexdigest(),
            "target": "wasm32-wasip1",
        },
        "build": {
            "rustc": rust_ast._RUSTC_VERSION,
            "syn": "2.0.119",
            "proc_macro2": "1.0.107",
            "cargo_lock_sha256": _DIGEST,
            "source_sha256": _DIGEST,
            "path_remapping": deepcopy(rust_ast._PATH_REMAP_CONTRACT),
        },
    }


def _fixture_source_digest(root: Path) -> str:
    relative_paths = sorted(
        (
            "Cargo.toml",
            "Cargo.lock",
            "build.py",
            "rust-toolchain.toml",
            *(path.relative_to(root).as_posix() for path in (root / "src").rglob("*.rs")),
        )
    )
    digest = hashlib.sha256()
    for relative in relative_paths:
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update((root / relative).read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def _write_analyzer(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    artifact: bytes,
    provenance: dict[str, object] | None = None,
) -> tuple[Path, Path]:
    artifact_path = tmp_path / "dist" / "rust_quality_analyzer.wasm"
    provenance_path = tmp_path / "provenance.json"
    artifact_path.parent.mkdir()
    artifact_path.write_bytes(artifact)
    (tmp_path / "Cargo.toml").write_text("[package]\nname = 'fixture'\n", encoding="utf-8")
    cargo_lock = b"version = 4\n"
    (tmp_path / "Cargo.lock").write_bytes(cargo_lock)
    (tmp_path / "build.py").write_text("# deterministic build recipe\n", encoding="utf-8")
    (tmp_path / "rust-toolchain.toml").write_text('[toolchain]\nchannel = "1.97.1"\n', encoding="utf-8")
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "lib.rs").write_text("pub fn measured() {}\n", encoding="utf-8")
    if provenance is None:
        provenance = _provenance(artifact)
        build = provenance["build"]
        assert isinstance(build, dict)
        build["cargo_lock_sha256"] = hashlib.sha256(cargo_lock).hexdigest()
        build["source_sha256"] = _fixture_source_digest(tmp_path)
    provenance_path.write_text(
        json.dumps(provenance),
        encoding="utf-8",
    )
    monkeypatch.setattr(rust_ast, "_ANALYZER_ROOT", tmp_path)
    monkeypatch.setattr(rust_ast, "_ARTIFACT_PATH", artifact_path)
    monkeypatch.setattr(rust_ast, "_PROVENANCE_PATH", provenance_path)
    return artifact_path, provenance_path


class _FakeWasmtimeError(Exception):
    pass


class _FakeTrap(_FakeWasmtimeError):
    pass


class _FakeExitTrap(_FakeWasmtimeError):
    def __init__(self, code: int) -> None:
        super().__init__(f"exit status {code}")
        self.code = code


class _FakeConfig:
    consume_fuel = False

    def __init__(self, state: dict[str, object]) -> None:
        state["config"] = self


class _FakeEngine:
    def __init__(self, state: dict[str, object], config: _FakeConfig) -> None:
        state["engine_config"] = config


class _FakeStore:
    def __init__(self, state: dict[str, object], _engine: _FakeEngine) -> None:
        state["store"] = self
        self._state = state
        self.wasi: _FakeWasiConfig | None = None

    def set_limits(self, **limits: int) -> None:
        self._state["limits"] = limits

    def set_fuel(self, fuel: int) -> None:
        self._state["fuel"] = fuel

    def set_wasi(self, wasi: _FakeWasiConfig) -> None:
        self.wasi = wasi


class _FakeWasiConfig:
    stdin_file = ""
    stdout_file = ""
    stderr_file = ""

    def __init__(self, state: dict[str, object]) -> None:
        self._state = state

    def inherit_env(self) -> None:
        self._state["inherited_env"] = True

    def preopen_dir(self, *_args) -> None:
        self._state["preopened"] = True


class _FakeStart:
    def __init__(self, state: dict[str, object], parameters: int, result: str) -> None:
        self._state = state
        self._parameters = parameters
        self._result = result

    def type(self, _store: _FakeStore) -> SimpleNamespace:
        return SimpleNamespace(params=[object()] * self._parameters, results=[])

    def __call__(self, store: _FakeStore) -> None:
        assert store.wasi is not None
        self._state["stdin"] = Path(store.wasi.stdin_file).read_text(encoding="utf-8")
        stdout_path = Path(store.wasi.stdout_file)
        stderr_path = Path(store.wasi.stderr_file)
        if self._result == "trap":
            raise _FakeTrap("all fuel consumed")
        if self._result == "exit":
            stderr_path.write_text("invalid Rust syntax at line 1\n", encoding="utf-8")
            raise _FakeExitTrap(2)
        stdout_path.write_text('{"functions": [], "scopes": []}\n', encoding="utf-8")
        stderr_path.write_text("", encoding="utf-8")


class _FakeInstance:
    def __init__(self, start: _FakeStart, exports_start: bool) -> None:
        self._start = start
        self._exports_start = exports_start

    def exports(self, _store: _FakeStore) -> dict[str, object]:
        return {"_start": self._start} if self._exports_start else {}


class _FakeLinker:
    def __init__(
        self,
        state: dict[str, object],
        instance: _FakeInstance,
        _engine: _FakeEngine,
        instantiate_result: str,
    ) -> None:
        self._state = state
        self._instance = instance
        self._instantiate_result = instantiate_result
        state["linker"] = self

    def define_wasi(self) -> None:
        self._state["wasi_defined"] = True

    def instantiate(self, _store: _FakeStore, _module: object) -> _FakeInstance:
        if self._instantiate_result == "trap":
            raise _FakeTrap("all fuel consumed")
        return self._instance


def _fake_module(state: dict[str, object], fail: bool, _engine: _FakeEngine, artifact: bytes) -> object:
    state["artifact"] = artifact
    if fail:
        raise _FakeWasmtimeError("corrupt module")
    return object()


def _fake_runtime(
    *,
    exports_start: bool = True,
    module_error: bool = False,
    start_parameters: int = 0,
    start_result: str = "success",
    instantiate_result: str = "success",
) -> tuple[SimpleNamespace, dict[str, object]]:
    state: dict[str, object] = {"inherited_env": False, "preopened": False}
    start = _FakeStart(state, start_parameters, start_result)
    instance = _FakeInstance(start, exports_start)
    runtime = SimpleNamespace(
        Config=partial(_FakeConfig, state),
        Engine=partial(_FakeEngine, state),
        Store=partial(_FakeStore, state),
        WasiConfig=partial(_FakeWasiConfig, state),
        Linker=partial(_FakeLinker, state, instance, instantiate_result=instantiate_result),
        Module=partial(_fake_module, state, module_error),
        WasmtimeError=_FakeWasmtimeError,
        Trap=_FakeTrap,
        ExitTrap=_FakeExitTrap,
    )
    return runtime, state


def test_validated_artifact_requires_exact_provenance_and_hash(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    artifact = b"verified wasm"
    _write_analyzer(monkeypatch, tmp_path, artifact)

    assert rust_ast._validated_artifact() == artifact


@pytest.mark.parametrize(
    "mutate",
    [
        lambda value: value.update(schema_version=2),
        lambda value: value.update(unexpected=True),
        lambda value: value["analyzer"].update(abi_version=2),
        lambda value: value["analyzer"].update(version="1.0.1"),
        lambda value: value["artifact"].update(path="other.wasm"),
        lambda value: value["artifact"].update(target="wasm32-unknown-unknown"),
        lambda value: value["build"].update(rustc="1.97.1 (missing-prefix)"),
        lambda value: value["build"].update(rustc="1.97.0 (old)"),
        lambda value: value["build"].update(rustc="rustc 1.97.1 (000000000 2026-07-14)"),
        lambda value: value["build"].update(syn="2.0.120"),
        lambda value: value["build"]["path_remapping"].update(version=2),
        lambda value: value["build"].pop("source_sha256"),
    ],
    ids=[
        "schema",
        "unknown-field",
        "abi",
        "analyzer-version",
        "artifact-path",
        "target",
        "rustc-prefix",
        "rustc",
        "rustc-commit",
        "syn",
        "path-remapping",
        "missing-field",
    ],
)
def test_provenance_rejects_unknown_missing_or_unexpected_values(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, mutate
) -> None:
    artifact = b"verified wasm"
    provenance = deepcopy(_provenance(artifact))
    mutate(provenance)
    _write_analyzer(monkeypatch, tmp_path, artifact, provenance)

    with pytest.raises(rust_ast.RustSyntaxError, match="provenance"):
        rust_ast._validated_artifact()


def test_provenance_rejects_duplicate_fields(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    artifact_path, provenance_path = _write_analyzer(monkeypatch, tmp_path, b"wasm")
    del artifact_path
    provenance_path.write_text('{"schema_version": 1, "schema_version": 1}', encoding="utf-8")

    with pytest.raises(rust_ast.RustSyntaxError, match="duplicate"):
        rust_ast._validated_artifact()


def test_artifact_hash_mismatch_is_controlled(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    artifact_path, _provenance_path = _write_analyzer(monkeypatch, tmp_path, b"original")
    artifact_path.write_bytes(b"modified")

    with pytest.raises(rust_ast.RustSyntaxError, match="SHA-256 verification"):
        rust_ast._validated_artifact()


def test_cargo_lock_drift_is_rejected(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    _write_analyzer(monkeypatch, tmp_path, b"wasm")
    (tmp_path / "Cargo.lock").write_bytes(b"version = 3\n")

    with pytest.raises(rust_ast.RustSyntaxError, match="Cargo.lock failed SHA-256"):
        rust_ast._validated_artifact()


@pytest.mark.parametrize(
    "drift",
    ["modify", "add", "build-script"],
    ids=["content", "path-set", "build-recipe"],
)
def test_source_drift_is_rejected(monkeypatch: pytest.MonkeyPatch, tmp_path: Path, drift: str) -> None:
    _write_analyzer(monkeypatch, tmp_path, b"wasm")
    if drift == "build-script":
        (tmp_path / "build.py").write_text("# drifted build recipe\n", encoding="utf-8")
    else:
        path = tmp_path / "src" / ("lib.rs" if drift == "modify" else "added.rs")
        path.write_text("pub fn drifted() {}\n", encoding="utf-8")

    with pytest.raises(rust_ast.RustSyntaxError, match="source failed SHA-256"):
        rust_ast._validated_artifact()


@pytest.mark.parametrize("missing", ["provenance", "artifact"])
def test_missing_analyzer_files_are_controlled(monkeypatch: pytest.MonkeyPatch, tmp_path: Path, missing: str) -> None:
    artifact_path, provenance_path = _write_analyzer(monkeypatch, tmp_path, b"wasm")
    (provenance_path if missing == "provenance" else artifact_path).unlink()

    with pytest.raises(rust_ast.RustSyntaxError, match=f"{missing} is missing"):
        rust_ast._validated_artifact()


def test_wasmtime_runtime_requires_exact_distribution_version(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    runtime = object()
    monkeypatch.setattr(rust_ast.importlib, "import_module", lambda _name: runtime)
    monkeypatch.setattr(rust_ast.importlib.metadata, "version", lambda _name: "48.0.0")

    with pytest.raises(rust_ast.RustSyntaxError, match="requires Wasmtime 47\\.0\\.1, found 48\\.0\\.0"):
        rust_ast._load_wasmtime()


def test_wasmtime_runtime_accepts_exact_distribution_version(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    runtime = object()
    monkeypatch.setattr(rust_ast.importlib, "import_module", lambda _name: runtime)
    monkeypatch.setattr(rust_ast.importlib.metadata, "version", lambda _name: rust_ast.WASMTIME_VERSION)

    assert rust_ast._load_wasmtime() is runtime


def test_wasi_execution_is_sandboxed_and_resource_bounded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    runtime, state = _fake_runtime()
    monkeypatch.setattr(rust_ast, "_load_wasmtime", lambda: runtime)

    result = rust_ast._execute(b"wasm", "fn measured() {}")

    assert result.exit_code == 0
    assert json.loads(result.stdout) == {"functions": [], "scopes": []}
    assert state["stdin"] == "fn measured() {}"
    assert state["artifact"] == b"wasm"
    assert state["config"].consume_fuel is True
    assert state["fuel"] == rust_ast._FUEL_LIMIT
    assert state["limits"] == {
        "memory_size": 128 * 1024 * 1024,
        "instances": 1,
        "tables": 1,
        "memories": 1,
    }
    assert state["inherited_env"] is False
    assert state["preopened"] is False


def test_corrupt_module_is_reported_without_a_traceback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    runtime, _state = _fake_runtime(module_error=True)
    monkeypatch.setattr(rust_ast, "_load_wasmtime", lambda: runtime)

    with pytest.raises(rust_ast.RustSyntaxError, match="artifact is invalid: corrupt module"):
        rust_ast._execute(b"not wasm", "")


def test_missing_start_export_is_an_abi_error(monkeypatch: pytest.MonkeyPatch) -> None:
    runtime, _state = _fake_runtime(exports_start=False)
    monkeypatch.setattr(rust_ast, "_load_wasmtime", lambda: runtime)

    with pytest.raises(rust_ast.RustSyntaxError, match="ABI is incompatible"):
        rust_ast._execute(b"wasm", "")


def test_start_export_signature_is_an_abi_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    runtime, _state = _fake_runtime(start_parameters=1)
    monkeypatch.setattr(rust_ast, "_load_wasmtime", lambda: runtime)

    with pytest.raises(rust_ast.RustSyntaxError, match="ABI is incompatible"):
        rust_ast._execute(b"wasm", "")


def test_resource_trap_is_controlled(monkeypatch: pytest.MonkeyPatch) -> None:
    runtime, _state = _fake_runtime(start_result="trap")
    monkeypatch.setattr(rust_ast, "_load_wasmtime", lambda: runtime)

    with pytest.raises(rust_ast.RustSyntaxError, match="resource trap: all fuel consumed"):
        rust_ast._execute(b"wasm", "")


def test_resource_trap_is_controlled_without_exit_trap(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    runtime, _state = _fake_runtime(start_result="trap")
    del runtime.ExitTrap
    monkeypatch.setattr(rust_ast, "_load_wasmtime", lambda: runtime)

    with pytest.raises(rust_ast.RustSyntaxError, match="resource trap: all fuel consumed"):
        rust_ast._execute(b"wasm", "")


def test_resource_trap_during_instantiation_is_controlled(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    runtime, _state = _fake_runtime(instantiate_result="trap")
    monkeypatch.setattr(rust_ast, "_load_wasmtime", lambda: runtime)

    with pytest.raises(rust_ast.RustSyntaxError, match="resource trap: all fuel consumed"):
        rust_ast._execute(b"wasm", "")


def test_analyzer_exit_uses_stderr_and_cli_exit_two(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setattr(rust_ast, "_validated_artifact", lambda: b"wasm")
    runtime, _state = _fake_runtime(start_result="exit")
    monkeypatch.setattr(rust_ast, "_load_wasmtime", lambda: runtime)
    monkeypatch.setattr(rust_ast.sys, "stdin", io.StringIO("fn measured( {"))

    assert rust_ast.main() == 2
    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err == "invalid Rust syntax at line 1\n"


def test_successful_cli_normalizes_json(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    monkeypatch.setattr(rust_ast, "_validated_artifact", lambda: b"wasm")
    runtime, _state = _fake_runtime()
    monkeypatch.setattr(rust_ast, "_load_wasmtime", lambda: runtime)
    monkeypatch.setattr(rust_ast.sys, "stdin", io.StringIO("fn measured() {}"))

    assert rust_ast.main() == 0
    captured = capsys.readouterr()
    assert captured.out == '{"functions": [], "scopes": []}\n'
    assert captured.err == ""


@pytest.mark.skipif(
    not rust_ast._ARTIFACT_PATH.is_file() or importlib.util.find_spec("wasmtime") is None,
    reason="checked-in WASI analyzer and Wasmtime runtime are required",
)
def test_checked_in_analyzer_smoke() -> None:
    payload = rust_ast.analyze_tree("fn measured() {}\n")

    assert payload["functions"][0]["symbol"] == "measured"
    assert payload["scopes"][0]["kind"] == "function"


@pytest.mark.skipif(
    not rust_ast._ARTIFACT_PATH.is_file() or importlib.util.find_spec("wasmtime") is None,
    reason="checked-in WASI analyzer and Wasmtime runtime are required",
)
def test_checked_in_analyzer_fuel_limit_is_enforced(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    artifact = rust_ast._validated_artifact()
    monkeypatch.setattr(rust_ast, "_FUEL_LIMIT", 1)

    with pytest.raises(rust_ast.RustSyntaxError, match="resource trap"):
        rust_ast._execute(artifact, "fn measured() {}\n")


@pytest.mark.skipif(
    not rust_ast._ARTIFACT_PATH.is_file() or importlib.util.find_spec("wasmtime") is None,
    reason="checked-in WASI analyzer and Wasmtime runtime are required",
)
def test_checked_in_analyzer_accepts_large_realistic_input() -> None:
    source = " " * (512 * 1024) + "fn measured() {}\n"

    payload = rust_ast.analyze_tree(source)

    assert payload["functions"][0]["symbol"] == "measured"


@pytest.mark.skipif(
    not rust_ast._ARTIFACT_PATH.is_file() or importlib.util.find_spec("wasmtime") is None,
    reason="checked-in WASI analyzer and Wasmtime runtime are required",
)
def test_checked_in_analyzer_rejects_input_at_fuel_boundary() -> None:
    source = " " * (1024 * 1024) + "fn measured() {}\n"

    with pytest.raises(rust_ast.RustSyntaxError, match="resource trap"):
        rust_ast.analyze_tree(source)
