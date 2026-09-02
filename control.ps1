$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$controlScript = Join-Path $repoRoot "tools/control.py"

if (Get-Command py -ErrorAction SilentlyContinue) {
    & py -3 $controlScript @args
} else {
    & python $controlScript @args
}
exit $LASTEXITCODE
