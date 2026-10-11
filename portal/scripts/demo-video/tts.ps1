# Vietnamese narration for the demo video with the offline Windows voice "Microsoft An" (vi-VN, OneCore).
# Usage: powershell -File tts.ps1 -JsonPath narration.json -OutDir <dir>
# Writes <dir>/<id>.wav for every line and <dir>/durations.json ({id: seconds}). Nothing leaves the machine.
param([string]$JsonPath, [string]$OutDir)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(-1) | Out-Null; $task.Result }

$voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.Language -eq 'vi-VN' } | Select-Object -First 1
if (-not $voice) { throw "No vi-VN voice installed (Settings > Time & language > Speech > add Vietnamese)." }

# One voice for everyone; characters differ by pitch and pace so dialogue is easy to follow
$style = @{
    "Thuyết minh"         = @(1.0, 1.0)
    "Cư dân Minh Anh"     = @(1.18, 1.05)
    "Tiếp nhận Thu Trang" = @(1.1, 1.05)
    "Kỹ thuật Hùng"       = @(0.72, 1.0)
    "Thủ kho Minh Kho"    = @(0.8, 1.0)
    "Ban quản lý Long"    = @(0.66, 0.95)
}

$items = Get-Content -Raw -Encoding UTF8 $JsonPath | ConvertFrom-Json
New-Item -ItemType Directory -Force $OutDir | Out-Null
$durations = [ordered]@{}
foreach ($it in $items) {
    $synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
    $synth.Voice = $voice
    $s = $style[$it.speaker]; if (-not $s) { $s = @(1.0, 1.0) }
    $synth.Options.AudioPitch = [double]$s[0]
    $synth.Options.SpeakingRate = [double]$s[1]
    $stream = Await ($synth.SynthesizeTextToStreamAsync($it.text)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
    $size = [uint32]$stream.Size
    $reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
    $null = Await ($reader.LoadAsync($size)) ([uint32])
    $bytes = New-Object byte[] $size
    $reader.ReadBytes($bytes)
    [System.IO.File]::WriteAllBytes((Join-Path $OutDir ($it.id + ".wav")), $bytes)
    $byteRate = [BitConverter]::ToUInt32($bytes, 28)
    $durations[$it.id] = [math]::Round(($size - 44) / $byteRate, 3)
    Write-Output ("{0,-8} {1,6:N2}s  {2}" -f $it.id, $durations[$it.id], $it.speaker)
}
# UTF-8 without BOM: Set-Content -Encoding UTF8 (PowerShell 5.1) adds a BOM that JSON.parse rejects
[System.IO.File]::WriteAllText((Join-Path $OutDir "durations.json"), ($durations | ConvertTo-Json), (New-Object System.Text.UTF8Encoding($false)))
