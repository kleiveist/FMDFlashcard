from __future__ import annotations

import ntpath
import os
import re
import shutil
import signal
import subprocess
import sys
import threading
import time
from collections.abc import Mapping, Sequence
from pathlib import Path

_DEFAULT_OUTPUT_LIMIT = 64 * 1024
_CMD_METACHARACTER = re.compile(r'[&|<>()^%!"\r\n]')


def prepare_command(
    command: list[str],
    *,
    environment: Mapping[str, str] | None = None,
) -> list[str]:
    """Return a subprocess-safe command on every supported host.

    Node.js exposes npm, npx, and local package binaries as ``.cmd`` launchers
    on Windows. CreateProcess cannot execute those scripts directly, so route
    only that launcher type through the system command interpreter.
    """

    if sys.platform != "win32" or not command:
        return command
    if not command[0].lower().endswith((".cmd", ".bat")):
        return command

    unsafe = next((part for part in command if _CMD_METACHARACTER.search(part)), None)
    if unsafe is not None:
        raise ValueError(
            "Windows batch command contains unsafe cmd.exe metacharacters."
        )
    del environment  # Ambient COMSPEC/SystemRoot values are not a trust anchor.
    command_processor = _windows_system_command_processor()
    if (
        not ntpath.isabs(command_processor)
        or ntpath.basename(command_processor).casefold() != "cmd.exe"
        or _CMD_METACHARACTER.search(command_processor)
    ):
        raise ValueError("COMSPEC must identify an absolute, canonical cmd.exe path.")
    # Keep the batch path and its arguments separate. Pre-serializing them
    # makes Python quote the serialized value a second time using C-runtime
    # rules that cmd.exe does not decode. `call` makes a quoted launcher path
    # unambiguous when it contains spaces.
    return [command_processor, "/d", "/s", "/c", "call", *command]


def _windows_system_command_processor() -> str:
    """Resolve cmd.exe through the OS API, never through ambient variables."""

    import ctypes

    capacity = 32768
    buffer = ctypes.create_unicode_buffer(capacity)
    try:
        length = ctypes.windll.kernel32.GetSystemDirectoryW(buffer, capacity)
    except (AttributeError, OSError) as exc:
        raise ValueError(
            "Windows system directory could not be resolved safely."
        ) from exc
    if not isinstance(length, int) or length <= 0 or length >= capacity:
        raise ValueError("Windows system directory could not be resolved safely.")
    command_processor = ntpath.normpath(ntpath.join(buffer.value, "cmd.exe"))
    if (
        not ntpath.isabs(command_processor)
        or ntpath.basename(command_processor).casefold() != "cmd.exe"
        or _CMD_METACHARACTER.search(command_processor)
    ):
        raise ValueError("Windows system command processor path is unsafe.")
    return command_processor


def safe_platform_environment(source: Mapping[str, str]) -> dict[str, str]:
    """Keep locale hints while deriving Windows process variables from the OS."""

    environment = {
        key: value
        for key in ("LANG", "LC_ALL", "LC_CTYPE")
        if (value := source.get(key))
    }
    if os.name != "nt":
        return environment
    command_processor = _windows_system_command_processor()
    system_root = ntpath.dirname(ntpath.dirname(command_processor))
    environment.update(
        {
            "COMSPEC": command_processor,
            "SYSTEMROOT": system_root,
            "WINDIR": system_root,
            "PATHEXT": ".COM;.EXE;.BAT;.CMD",
        }
    )
    return environment


def run_bounded(
    command: Sequence[str],
    *,
    cwd: Path,
    env: Mapping[str, str],
    check: bool = False,
    capture_output: bool = True,
    text: bool = True,
    timeout: int,
    shell: bool = False,
    stdin: int = subprocess.DEVNULL,
    output_limit: int = _DEFAULT_OUTPUT_LIMIT,
) -> subprocess.CompletedProcess[str]:
    """Run a shell-free command with bounded output and process-group cleanup."""

    if check or not capture_output or not text or shell or stdin != subprocess.DEVNULL:
        raise ValueError("Bounded commands require the fixed safe subprocess policy.")
    if not command or any(not isinstance(part, str) or not part for part in command):
        raise ValueError("Bounded command arguments must be non-empty strings.")
    if output_limit < 1024:
        raise ValueError("Bounded command output limit must be at least 1024 bytes.")

    prepared = tuple(prepare_command(list(command), environment=env))
    popen_options: dict[str, object] = {}
    if os.name == "nt":
        popen_options["creationflags"] = getattr(
            subprocess,
            "CREATE_NEW_PROCESS_GROUP",
            0,
        ) | getattr(subprocess, "CREATE_SUSPENDED", 0x00000004)
    else:
        popen_options["start_new_session"] = True

    process: subprocess.Popen[bytes] | None = None
    windows_job: int | None = None
    streams: tuple[object | None, object | None] = (None, None)
    readers: list[threading.Thread] = []
    buffers = [bytearray(), bytearray()]
    totals = [0, 0]
    try:
        if os.name == "nt":
            windows_job = _create_windows_kill_job()
        process = subprocess.Popen(
            prepared,
            cwd=cwd,
            env=dict(env),
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            shell=False,
            text=False,
            **popen_options,
        )
        streams = (process.stdout, process.stderr)
        if windows_job is not None:
            _assign_windows_job(windows_job, process)
            _resume_windows_process(process.pid)

        def drain(index: int) -> None:
            stream = streams[index]
            if stream is None:  # pragma: no cover - PIPE contract
                return
            try:
                while chunk := stream.read(8192):  # type: ignore[union-attr]
                    totals[index] += len(chunk)
                    buffers[index].extend(chunk)
                    overflow = len(buffers[index]) - output_limit
                    if overflow > 0:
                        del buffers[index][:overflow]
            except (OSError, ValueError):
                return

        for index in range(2):
            reader = threading.Thread(target=drain, args=(index,), daemon=True)
            readers.append(reader)
            reader.start()

        timed_out = False
        try:
            returncode = process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            timed_out = True
            _terminate_process_group(process)
            returncode = process.wait()
        else:
            _terminate_remaining_group(process)
    finally:
        active_exception = sys.exc_info()[0] is not None
        cleanup_errors: list[BaseException] = []
        if windows_job is not None:
            # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE removes every descendant,
            # including children surviving the command leader.
            try:
                _close_windows_handle(windows_job)
            except BaseException as exc:  # noqa: BLE001 - cleanup must continue
                cleanup_errors.append(exc)
            windows_job = None
        if process is not None:
            try:
                if process.poll() is None:
                    _terminate_process_group(process)
            except BaseException as exc:  # noqa: BLE001 - cleanup must continue
                cleanup_errors.append(exc)
        for reader in readers:
            try:
                reader.join(timeout=0.2)
            except BaseException as exc:  # noqa: BLE001 - cleanup must continue
                cleanup_errors.append(exc)
        for stream in streams:
            if stream is not None:
                try:
                    stream.close()  # type: ignore[union-attr]
                except BaseException as exc:  # noqa: BLE001 - cleanup must continue
                    cleanup_errors.append(exc)
        for reader in readers:
            try:
                reader.join(timeout=1)
            except BaseException as exc:  # noqa: BLE001 - cleanup must continue
                cleanup_errors.append(exc)
        if cleanup_errors and not active_exception:
            raise cleanup_errors[0]

    stdout = _render_bounded_output(buffers[0], totals[0], output_limit)
    stderr = _render_bounded_output(buffers[1], totals[1], output_limit)
    if timed_out:
        raise subprocess.TimeoutExpired(
            prepared,
            timeout,
            output=stdout,
            stderr=stderr,
        )
    return subprocess.CompletedProcess(prepared, returncode, stdout, stderr)


def _terminate_process_group(process: subprocess.Popen[bytes]) -> None:
    if os.name == "nt":
        try:
            process.send_signal(getattr(signal, "CTRL_BREAK_EVENT", signal.SIGTERM))
            process.wait(timeout=0.2)
            return
        except (OSError, subprocess.TimeoutExpired):
            process.kill()
            process.wait(timeout=1)
            return
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    except PermissionError:
        if _process_group_has_live_member(process.pid):
            raise
        return
    try:
        process.wait(timeout=0.2)
    except subprocess.TimeoutExpired:
        pass
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    except PermissionError:
        if _process_group_has_live_member(process.pid):
            raise
    if process.poll() is None:
        process.kill()
        process.wait()


def _terminate_remaining_group(process: subprocess.Popen[bytes]) -> None:
    if os.name == "nt":
        return
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    except PermissionError:
        if _process_group_has_live_member(process.pid):
            raise
        return
    time.sleep(0.02)
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    except PermissionError:
        if _process_group_has_live_member(process.pid):
            raise


def _process_group_has_live_member(group_id: int) -> bool:
    """Fail closed unless a POSIX process listing proves the group is empty."""

    ps = shutil.which("ps", path=os.defpath)
    if ps is None:
        return True
    environment = {"LC_ALL": "C", "PATH": os.defpath}
    try:
        completed = subprocess.run(
            [ps, "-ax", "-o", "pgid=", "-o", "stat="],
            check=False,
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=2,
            env=environment,
        )
    except (OSError, subprocess.TimeoutExpired):
        return True
    if completed.returncode != 0:
        return True
    for line in completed.stdout.splitlines():
        fields = line.split()
        if len(fields) < 2:
            continue
        try:
            observed_group = int(fields[0])
        except ValueError:
            continue
        if observed_group == group_id and not fields[1].startswith("Z"):
            return True
    return False


def _create_windows_kill_job() -> int:
    """Create a non-inheritable Windows Job Object with kill-on-close policy."""

    import ctypes
    from ctypes import wintypes

    class _IoCounters(ctypes.Structure):
        _fields_ = (
            ("ReadOperationCount", ctypes.c_ulonglong),
            ("WriteOperationCount", ctypes.c_ulonglong),
            ("OtherOperationCount", ctypes.c_ulonglong),
            ("ReadTransferCount", ctypes.c_ulonglong),
            ("WriteTransferCount", ctypes.c_ulonglong),
            ("OtherTransferCount", ctypes.c_ulonglong),
        )

    class _BasicLimitInformation(ctypes.Structure):
        _fields_ = (
            ("PerProcessUserTimeLimit", ctypes.c_longlong),
            ("PerJobUserTimeLimit", ctypes.c_longlong),
            ("LimitFlags", wintypes.DWORD),
            ("MinimumWorkingSetSize", ctypes.c_size_t),
            ("MaximumWorkingSetSize", ctypes.c_size_t),
            ("ActiveProcessLimit", wintypes.DWORD),
            ("Affinity", ctypes.c_size_t),
            ("PriorityClass", wintypes.DWORD),
            ("SchedulingClass", wintypes.DWORD),
        )

    class _ExtendedLimitInformation(ctypes.Structure):
        _fields_ = (
            ("BasicLimitInformation", _BasicLimitInformation),
            ("IoInfo", _IoCounters),
            ("ProcessMemoryLimit", ctypes.c_size_t),
            ("JobMemoryLimit", ctypes.c_size_t),
            ("PeakProcessMemoryUsed", ctypes.c_size_t),
            ("PeakJobMemoryUsed", ctypes.c_size_t),
        )

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    create_job = kernel32.CreateJobObjectW
    create_job.argtypes = (ctypes.c_void_p, wintypes.LPCWSTR)
    create_job.restype = wintypes.HANDLE
    set_information = kernel32.SetInformationJobObject
    set_information.argtypes = (
        wintypes.HANDLE,
        ctypes.c_int,
        ctypes.c_void_p,
        wintypes.DWORD,
    )
    set_information.restype = wintypes.BOOL

    handle = create_job(None, None)
    if not handle:
        raise ctypes.WinError(ctypes.get_last_error())
    information = _ExtendedLimitInformation()
    information.BasicLimitInformation.LimitFlags = 0x00002000
    if not set_information(
        handle,
        9,
        ctypes.byref(information),
        ctypes.sizeof(information),
    ):
        error = ctypes.get_last_error()
        _close_windows_handle(int(handle))
        raise ctypes.WinError(error)
    return int(handle)


def _assign_windows_job(
    handle: int,
    process: subprocess.Popen[bytes],
) -> None:
    """Assign a newly started process to the private kill-on-close job."""

    import ctypes
    from ctypes import wintypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    assign = kernel32.AssignProcessToJobObject
    assign.argtypes = (wintypes.HANDLE, wintypes.HANDLE)
    assign.restype = wintypes.BOOL
    process_handle = getattr(process, "_handle", None)
    if process_handle is None or not assign(handle, process_handle):
        raise ctypes.WinError(ctypes.get_last_error())


def _resume_windows_process(pid: int) -> None:
    """Resume the sole primary thread after race-free Job Object assignment."""

    import ctypes
    from ctypes import wintypes

    class _ThreadEntry32(ctypes.Structure):
        _fields_ = (
            ("dwSize", wintypes.DWORD),
            ("cntUsage", wintypes.DWORD),
            ("th32ThreadID", wintypes.DWORD),
            ("th32OwnerProcessID", wintypes.DWORD),
            ("tpBasePri", wintypes.LONG),
            ("tpDeltaPri", wintypes.LONG),
            ("dwFlags", wintypes.DWORD),
        )

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    snapshot_threads = kernel32.CreateToolhelp32Snapshot
    snapshot_threads.argtypes = (wintypes.DWORD, wintypes.DWORD)
    snapshot_threads.restype = wintypes.HANDLE
    first_thread = kernel32.Thread32First
    first_thread.argtypes = (wintypes.HANDLE, ctypes.POINTER(_ThreadEntry32))
    first_thread.restype = wintypes.BOOL
    next_thread = kernel32.Thread32Next
    next_thread.argtypes = (wintypes.HANDLE, ctypes.POINTER(_ThreadEntry32))
    next_thread.restype = wintypes.BOOL
    open_thread = kernel32.OpenThread
    open_thread.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)
    open_thread.restype = wintypes.HANDLE
    resume_thread = kernel32.ResumeThread
    resume_thread.argtypes = (wintypes.HANDLE,)
    resume_thread.restype = wintypes.DWORD

    snapshot = snapshot_threads(0x00000004, 0)
    invalid_handle = ctypes.c_void_p(-1).value
    if not snapshot or int(snapshot) == invalid_handle:
        raise ctypes.WinError(ctypes.get_last_error())
    thread_id: int | None = None
    try:
        entry = _ThreadEntry32()
        entry.dwSize = ctypes.sizeof(entry)
        found = bool(first_thread(snapshot, ctypes.byref(entry)))
        while found:
            if int(entry.th32OwnerProcessID) == pid:
                thread_id = int(entry.th32ThreadID)
                break
            found = bool(next_thread(snapshot, ctypes.byref(entry)))
    finally:
        _close_windows_handle(int(snapshot))
    if thread_id is None:
        raise OSError("Suspended Windows process has no discoverable primary thread.")

    thread = open_thread(0x0002, False, thread_id)
    if not thread:
        raise ctypes.WinError(ctypes.get_last_error())
    previous_suspend_count: int | None = None
    resume_error = 0
    try:
        previous_suspend_count = int(resume_thread(thread))
        resume_error = ctypes.get_last_error()
    finally:
        _close_windows_handle(int(thread))
    if previous_suspend_count == 0xFFFFFFFF:
        raise ctypes.WinError(resume_error)
    if previous_suspend_count != 1:
        raise OSError(
            "Windows primary thread had an unexpected suspension count; "
            "execution was refused."
        )


def _close_windows_handle(handle: int) -> None:
    """Close one native handle; closing the Job Object kills its process tree."""

    import ctypes
    from ctypes import wintypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    close = kernel32.CloseHandle
    close.argtypes = (wintypes.HANDLE,)
    close.restype = wintypes.BOOL
    if not close(handle):
        raise ctypes.WinError(ctypes.get_last_error())


def _render_bounded_output(buffer: bytearray, total: int, limit: int) -> str:
    rendered = bytes(buffer).decode("utf-8", errors="replace")
    if total <= limit:
        return rendered
    return f"<output truncated; retained last {limit} bytes>\n{rendered}"


def _linux_process_start_token(pid: int) -> str | None:
    try:
        stat = (Path("/proc") / str(pid) / "stat").read_text(encoding="utf-8")
        boot_id = (
            Path("/proc/sys/kernel/random/boot_id").read_text(encoding="utf-8").strip()
        )
    except OSError:
        return None
    command_end = stat.rfind(")")
    fields = stat[command_end + 2 :].split() if command_end >= 0 else []
    if len(fields) <= 19 or not boot_id:
        return None
    return f"linux:{boot_id}:{fields[19]}"


def _process_start_query(pid: int) -> tuple[list[str], str] | None:
    if os.name == "nt":
        powershell = (
            shutil.which("powershell.exe")
            or shutil.which("powershell")
            or shutil.which("pwsh")
        )
        if powershell is None:
            return None
        script = (
            f"$p = Get-Process -Id {pid} -ErrorAction SilentlyContinue; "
            "if ($null -ne $p) { $p.StartTime.ToUniversalTime().Ticks }"
        )
        return [
            powershell,
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            script,
        ], "windows"

    ps = shutil.which("ps")
    return (
        ([ps, "-p", str(pid), "-o", "lstart="], sys.platform)
        if ps is not None
        else None
    )


def process_start_token(pid: int) -> str | None:
    """Return an OS-scoped process creation marker suitable for PID-reuse checks."""

    if pid <= 0:
        return None
    if sys.platform.startswith("linux"):
        token = _linux_process_start_token(pid)
        if token is not None:
            return token

    query = _process_start_query(pid)
    if query is None:
        return None
    command, prefix = query
    try:
        completed = subprocess.run(command, text=True, capture_output=True, check=False)
    except OSError:
        return None
    value = completed.stdout.strip()
    return f"{prefix}:{value}" if completed.returncode == 0 and value else None
