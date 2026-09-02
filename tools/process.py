"""Shell-free subprocess primitives shared by tooling commands."""

from __future__ import annotations

import ntpath
import os
import shlex
import shutil
import subprocess
import sys
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class CommandResult:
    command: tuple[str, ...]
    cwd: Path
    returncode: int
    stdout: str = ""
    stderr: str = ""
    dry_run: bool = False


class CommandRunner:
    """Small compatibility facade for command modules that need only an exit code."""

    def __init__(
        self,
        *,
        dry_run: bool = False,
        env: Mapping[str, str] | None = None,
    ) -> None:
        self.dry_run = dry_run
        self.env = env

    def run(self, command: Sequence[str], *, cwd: Path) -> int:
        print(f"$ {command_string(command)}")
        result = run_command(
            command,
            cwd=cwd,
            dry_run=self.dry_run,
            env=self.env,
            capture_output=False,
        )
        return result.returncode


def command_string(command: Sequence[str]) -> str:
    if os.name == "nt":
        return subprocess.list2cmdline(list(command))
    return shlex.join(command)


def _windows_command_processor() -> str:
    system_root = os.environ.get("SystemRoot", r"C:\Windows")
    command_processor = ntpath.normpath(ntpath.join(system_root, "System32", "cmd.exe"))
    if (
        not ntpath.isabs(command_processor)
        or ntpath.basename(command_processor).casefold() != "cmd.exe"
    ):
        raise ValueError("Windows command processor path is invalid")
    return command_processor


def prepare_command(command: Sequence[str]) -> list[str]:
    """Prepare an argv list without enabling a command shell.

    Windows package-manager shims are batch files. They are routed through the
    operating-system command processor only after rejecting cmd metacharacters.
    """

    prepared = list(command)
    if not prepared or any(not isinstance(part, str) or not part for part in prepared):
        raise ValueError("command arguments must be non-empty strings")
    if sys.platform != "win32" or not prepared[0].casefold().endswith((".cmd", ".bat")):
        return prepared
    metacharacters = set('&|<>()^%!"\r\n')
    if any(any(character in metacharacters for character in part) for part in prepared):
        raise ValueError("Windows batch command contains unsafe metacharacters")
    return [_windows_command_processor(), "/d", "/s", "/c", "call", *prepared]


def run_command(
    command: Sequence[str],
    *,
    cwd: Path,
    dry_run: bool = False,
    env: Mapping[str, str] | None = None,
    capture_output: bool = True,
    timeout: float | None = None,
) -> CommandResult:
    """Run one command and preserve its exact exit status."""

    argv = tuple(command)
    resolved_cwd = Path(cwd).resolve()
    if dry_run:
        return CommandResult(argv, resolved_cwd, 0, dry_run=True)
    try:
        completed = subprocess.run(
            prepare_command(argv),
            cwd=resolved_cwd,
            env=dict(env) if env is not None else None,
            stdin=subprocess.DEVNULL if capture_output else None,
            capture_output=capture_output,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            check=False,
            shell=False,
        )
    except FileNotFoundError as exc:
        return CommandResult(argv, resolved_cwd, 127, stderr=str(exc))
    except OSError as exc:
        return CommandResult(argv, resolved_cwd, 126, stderr=str(exc))
    except subprocess.TimeoutExpired as exc:
        stdout = exc.stdout if isinstance(exc.stdout, str) else ""
        stderr = exc.stderr if isinstance(exc.stderr, str) else ""
        return CommandResult(argv, resolved_cwd, 124, stdout=stdout, stderr=stderr)
    return CommandResult(
        argv,
        resolved_cwd,
        completed.returncode,
        stdout=completed.stdout or "",
        stderr=completed.stderr or "",
    )


def is_process_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except OSError:
        return False
    return True


def process_group_id(pid: int) -> int | None:
    if os.name == "nt":
        return pid
    try:
        return os.getpgid(pid)
    except OSError:
        return None


def process_start_token(pid: int) -> str | None:
    """Return an OS-derived identity that changes when a PID is reused."""

    if sys.platform.startswith("linux"):
        try:
            boot_id = Path("/proc/sys/kernel/random/boot_id").read_text(encoding="ascii").strip()
            stat_text = (Path("/proc") / str(pid) / "stat").read_text(encoding="ascii")
            fields = stat_text.rsplit(") ", 1)[1].split()
            start_ticks = fields[19]
        except (IndexError, OSError, UnicodeError):
            return None
        return f"linux:{boot_id}:{start_ticks}"

    if os.name == "nt":
        powershell = shutil.which("pwsh") or shutil.which("powershell.exe")
        if powershell is None:
            return None
        query = [
            powershell,
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            f'(Get-CimInstance Win32_Process -Filter "ProcessId = {pid}").CreationDate',
        ]
    else:
        ps = shutil.which("ps")
        if ps is None:
            return None
        query = [ps, "-p", str(pid), "-o", "lstart="]
    result = run_command(query, cwd=Path.cwd())
    token = result.stdout.strip()
    return f"{sys.platform}:{token}" if result.returncode == 0 and token else None


def read_process_argv(pid: int) -> tuple[str, ...] | None:
    if sys.platform.startswith("linux"):
        try:
            raw = (Path("/proc") / str(pid) / "cmdline").read_bytes()
        except OSError:
            return None
        values = tuple(part.decode("utf-8", errors="replace") for part in raw.split(b"\0") if part)
        return values or None

    if os.name == "nt":
        powershell = shutil.which("pwsh") or shutil.which("powershell.exe")
        if powershell is None:
            return None
        query = [
            powershell,
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            f'(Get-CimInstance Win32_Process -Filter "ProcessId = {pid}").CommandLine',
        ]
        posix = False
    else:
        ps = shutil.which("ps")
        if ps is None:
            return None
        query = [ps, "-p", str(pid), "-o", "command="]
        posix = True
    result = run_command(query, cwd=Path.cwd())
    if result.returncode != 0 or not result.stdout.strip():
        return None
    try:
        return tuple(shlex.split(result.stdout.strip(), posix=posix))
    except ValueError:
        return None
