param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Executable
)

$ErrorActionPreference = "Stop"

$resolvedExecutable = (Resolve-Path -LiteralPath $Executable -ErrorAction Stop).Path
$file = Get-Item -LiteralPath $resolvedExecutable -ErrorAction Stop
if (-not $file.Exists -or $file.Length -lt 2) {
  throw "portable executable is missing or empty"
}
$prefix = [IO.File]::ReadAllBytes($resolvedExecutable)[0..1]
if ($prefix[0] -ne 0x4d -or $prefix[1] -ne 0x5a) {
  throw "portable executable is not a Windows PE file"
}

$thumbprint = $env:FMD_WINDOWS_CERTIFICATE_THUMBPRINT
if (-not $thumbprint) {
  throw "portable signing certificate thumbprint is unavailable"
}

$signToolCommand = Get-Command signtool.exe -ErrorAction SilentlyContinue
if ($signToolCommand) {
  $signTool = $signToolCommand.Source
} else {
  $kitsRoot = Join-Path ${env:ProgramFiles(x86)} "Windows Kits\10\bin"
  $candidates = @(
    Get-ChildItem -Path (Join-Path $kitsRoot "*\x64\signtool.exe") -File -ErrorAction SilentlyContinue |
      Sort-Object -Property FullName -Descending
  )
  if ($candidates.Count -eq 0) {
    throw "signtool.exe was not found in PATH or the Windows 10 SDK"
  }
  $signTool = $candidates[0].FullName
}

$arguments = @("sign", "/sha1", $thumbprint, "/fd", "sha256")
$timestampUrl = $env:FMD_WINDOWS_TIMESTAMP_URL
if ($timestampUrl) {
  $uri = $null
  if (-not [Uri]::TryCreate($timestampUrl, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -ne "https") {
    throw "Windows RFC 3161 timestamp URL must be an absolute HTTPS URL"
  }
  $arguments += @("/tr", $timestampUrl, "/td", "sha256")
}
$arguments += $resolvedExecutable

& $signTool @arguments | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "signtool.exe failed with exit code $LASTEXITCODE"
}

$signature = Get-AuthenticodeSignature -LiteralPath $resolvedExecutable
if (
  $signature.Status -ne "Valid" -or
  -not $signature.SignerCertificate -or
  $signature.SignerCertificate.Thumbprint -ne $thumbprint
) {
  throw "portable executable Authenticode verification failed"
}
