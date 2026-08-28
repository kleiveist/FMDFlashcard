from __future__ import annotations

import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

from tools.core.filesystem import (
    atomic_write_text,
    ensure_directory,
    safe_join,
    validate_root,
)

REPORT_DIR_NAME = ".report"


def clean_reports(root: Path) -> bool:
    state_root = Path(root).absolute()
    try:
        state_root.lstat()
    except FileNotFoundError:
        return False
    state_root = validate_root(state_root)
    report_dir = state_root / REPORT_DIR_NAME
    try:
        report_dir.lstat()
    except FileNotFoundError:
        return False
    report_dir = safe_join(state_root, REPORT_DIR_NAME, require_exists=True)
    shutil.rmtree(report_dir)
    return True


def write_test_report(root: Path, payload: dict[str, Any], mode: str) -> list[Path]:
    state_root = Path(root).absolute()
    if state_root.exists():
        state_root = validate_root(state_root)
    else:
        state_root = ensure_directory(state_root.parent, state_root.name)
    report_dir = ensure_directory(state_root, REPORT_DIR_NAME)

    generated_at = datetime.now().astimezone()
    enriched_payload = dict(payload)
    enriched_payload["generated_at"] = generated_at.isoformat(timespec="seconds")

    suite = _slug(str(enriched_payload.get("suite_selection", "all")))
    status = _slug(str(enriched_payload.get("overall", "unknown"))).lower()
    timestamp = generated_at.strftime("%Y%m%d-%H%M%S")
    basename = f"test-report-{timestamp}-suite-{suite}-{status}"

    paths: list[Path] = []
    for report_format in _expand_mode(mode):
        if report_format == "md":
            path = _unique_path(report_dir / f"{basename}.md")
            atomic_write_text(path, _render_markdown(enriched_payload), root=state_root)
            paths.append(path)
        elif report_format == "json":
            path = _unique_path(report_dir / f"{basename}.json")
            atomic_write_text(
                path,
                json.dumps(enriched_payload, indent=2, sort_keys=True) + "\n",
                root=state_root,
            )
            paths.append(path)
    return paths


def _expand_mode(mode: str) -> list[str]:
    normalized = mode.lower()
    if normalized in {"md", "markdown"}:
        return ["md"]
    if normalized == "json":
        return ["json"]
    if normalized == "all":
        return ["md", "json"]
    raise ValueError(f"unsupported report mode: {mode}")


def _unique_path(path: Path) -> Path:
    if not path.exists():
        return path
    for counter in range(2, 1000):
        candidate = path.with_name(f"{path.stem}-{counter}{path.suffix}")
        if not candidate.exists():
            return candidate
    raise OSError(f"could not find free report filename for {path.name}")


def _slug(value: str) -> str:
    normalized = value.strip().lower().replace(" ", "-")
    chars = [
        char if char.isalnum() or char in {"-", "_"} else "-" for char in normalized
    ]
    slug = "".join(chars).strip("-")
    return slug or "unknown"


def _cell(value: Any) -> str:
    text = "" if value is None else str(value)
    return text.replace("|", "\\|").replace("\n", " ")


def _code_block(text: str) -> list[str]:
    if not text.strip():
        return []
    fence = "```"
    if fence in text:
        fence = "~~~"
    return [f"{fence}text", text.rstrip(), fence]


def _render_markdown(payload: dict[str, Any]) -> str:
    results = payload.get("results", [])
    bootstrap = payload.get("bootstrap", {})

    lines: list[str] = [
        "# 🧪 Project Tooling Test Report",
        "",
        "## 📋 Summary",
        "",
        f"- Generated: `{payload.get('generated_at', '')}`",
        f"- Command: `{payload.get('command', '')}`",
        f"- Suite selection: `{payload.get('suite_selection', '')}`",
        f"- Expanded suites: `{', '.join(payload.get('expanded_suites', []))}`",
        f"- No start: `{payload.get('no_start', False)}`",
        f"- Overall status: `{payload.get('overall', '')}`",
        "",
    ]

    if bootstrap and bootstrap.get("status") != "SKIP":
        lines.extend(
            [
                "## 🧩 Service Bootstrap",
                "",
                "| Step | Status | Duration | Message |",
                "| --- | --- | ---: | --- |",
                (
                    f"| `{_cell(bootstrap.get('name'))}` | `{_cell(bootstrap.get('status'))}` | "
                    f"{_cell(bootstrap.get('duration_seconds'))}s | {_cell(bootstrap.get('message'))} |"
                ),
                "",
            ]
        )
        _append_detail_section(lines, "🔎 Service bootstrap details", bootstrap)

    lines.extend(
        [
            "## ✅ Suite Results",
            "",
            "| Suite | Status | Duration | Message |",
            "| --- | --- | ---: | --- |",
        ]
    )
    for result in results:
        lines.append(
            f"| `{_cell(result.get('name'))}` | `{_cell(result.get('status'))}` | "
            f"{_cell(result.get('duration_seconds'))}s | {_cell(result.get('message'))} |"
        )
    lines.append("")

    for result in results:
        _append_detail_section(
            lines, f"🔎 Suite details: {result.get('name', 'unknown')}", result
        )

    return "\n".join(lines).rstrip() + "\n"


def _append_detail_section(lines: list[str], title: str, item: dict[str, Any]) -> None:
    has_details = item.get("exit_code") is not None or any(
        item.get(key)
        for key in (
            "command",
            "cwd",
            "detail",
            "stdout",
            "stderr",
            "stdout_tail",
            "stderr_tail",
        )
    )
    if not has_details:
        return

    lines.extend([f"## {title}", ""])
    if item.get("command"):
        lines.append(f"- Command: `{item['command']}`")
    if item.get("cwd"):
        lines.append(f"- Working directory: `{item['cwd']}`")
    if item.get("exit_code") is not None:
        lines.append(f"- Exit code: `{item['exit_code']}`")
    if item.get("detail"):
        lines.append(f"- Detail: {item['detail']}")

    stdout = item.get("stdout") or item.get("stdout_tail")
    stderr = item.get("stderr") or item.get("stderr_tail")
    if stdout:
        lines.extend(["", "### 📤 stdout", ""])
        lines.extend(_code_block(str(stdout)))
    if stderr:
        lines.extend(["", "### ⚠️ stderr", ""])
        lines.extend(_code_block(str(stderr)))
    lines.append("")
