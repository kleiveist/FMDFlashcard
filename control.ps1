$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$controlScript = Join-Path $repoRoot "tools/control.py"
$venvPython = Join-Path $repoRoot ".venv/Scripts/python.exe"

if (Test-Path -LiteralPath $venvPython -PathType Leaf) {
    & $venvPython $controlScript @args
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3 $controlScript @args
} else {
    & python $controlScript @args
}
exit $LASTEXITCODE
