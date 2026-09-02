@echo off
setlocal
if exist "%~dp0.venv\Scripts\python.exe" (
  "%~dp0.venv\Scripts\python.exe" "%~dp0tools\control.py" %*
  exit /b %errorlevel%
)
where py >nul 2>nul
if %errorlevel% equ 0 (
  py -3 "%~dp0tools\control.py" %*
) else (
  python "%~dp0tools\control.py" %*
)
exit /b %errorlevel%
