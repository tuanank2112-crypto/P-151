<#
Shared Windows fallback for the AI hook logger.

The normal path uses scripts/log_hook.py. This fallback keeps Codex and
Copilot logging functional on Windows machines that have PowerShell but do not
have a registered Python interpreter (for example, when only py.exe is on PATH).
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Tool = "unknown"
)

function Read-JsonStdin {
    $stream = [Console]::OpenStandardInput()
    $memory = New-Object System.IO.MemoryStream
    $stream.CopyTo($memory)
    return [Text.Encoding]::UTF8.GetString($memory.ToArray()).Trim()
}

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [string]$WorkingDirectory
    )

    try {
        if ($WorkingDirectory) {
            $result = & git -C $WorkingDirectory @Arguments 2>$null
        } else {
            $result = & git @Arguments 2>$null
        }
        if ($LASTEXITCODE -ne 0) {
            return ""
        }
        return (($result | Out-String).Trim())
    } catch {
        return ""
    }
}

function Limit-Text {
    param(
        [AllowNull()]
        [object]$Value,
        [int]$Length
    )

    if ($null -eq $Value) {
        return ""
    }
    $text = [string]$Value
    if ($text.Length -gt $Length) {
        return $text.Substring(0, $Length)
    }
    return $text
}

function Get-PropertyValue {
    param(
        [object]$Object,
        [string]$Name
    )

    if ($null -eq $Object) {
        return $null
    }
    return $Object.PSObject.Properties[$Name].Value
}

function First-NonEmpty {
    param([object[]]$Values)

    foreach ($value in $Values) {
        if ($null -ne $value -and -not [string]::IsNullOrEmpty([string]$value)) {
            return $value
        }
    }
    return $null
}

$raw = Read-JsonStdin
if ([string]::IsNullOrWhiteSpace($raw)) {
    exit 0
}

try {
    $data = $raw | ConvertFrom-Json
} catch {
    exit 0
}

if ($Tool -match '^--tool=(.+)$') {
    $Tool = $Matches[1]
}
$Tool = $Tool.ToLowerInvariant()

$event = [string](Get-PropertyValue $data "hook_event_name")
if ([string]::IsNullOrEmpty($event)) {
    $event = [string](Get-PropertyValue $data "event")
}
$sessionCwd = [string](Get-PropertyValue $data "cwd")

if ($Tool -eq "unknown") {
    if (Get-PropertyValue $data "transcript_path") {
        $Tool = "codex"
    } elseif (Get-PropertyValue $data "workspace_roots") {
        $Tool = "cursor"
    } elseif (Get-PropertyValue $data "toolName") {
        $Tool = "copilot"
    } elseif ($event -match "^(Before|After|Session|Pre|Notification)") {
        $Tool = "gemini"
    } elseif ($event) {
        $Tool = "claude"
    }
}

$origin = Invoke-Git -Arguments @("remote", "get-url", "origin") -WorkingDirectory $sessionCwd
if ([string]::IsNullOrWhiteSpace($origin)) {
    exit 0
}

$repo = ($origin.TrimEnd("/", "\") -split "/")[-1]
if ($repo.EndsWith(".git", [StringComparison]::OrdinalIgnoreCase)) {
    $repo = $repo.Substring(0, $repo.Length - 4)
}

$repoRoot = Invoke-Git -Arguments @("rev-parse", "--show-toplevel") -WorkingDirectory $sessionCwd
if ([string]::IsNullOrWhiteSpace($repoRoot)) {
    $repoRoot = $sessionCwd
}

$configuredDir = $env:AI_LOG_DIR
if ([string]::IsNullOrWhiteSpace($configuredDir)) {
    $configuredDir = ".ai-log"
}
if ([IO.Path]::IsPathRooted($configuredDir)) {
    $logDir = $configuredDir
} elseif ($repoRoot) {
    $logDir = Join-Path $repoRoot $configuredDir
} else {
    $logDir = $configuredDir
}
$logFile = Join-Path $logDir "session.jsonl"

$prompt = Limit-Text (Get-PropertyValue $data "prompt") 1000
$toolInput = Get-PropertyValue $data "tool_input"
$toolResponse = Limit-Text (Get-PropertyValue $data "tool_response") 500
$responseSummary = Limit-Text (Get-PropertyValue $data "response_summary") 500
$toolArgs = Get-PropertyValue $data "toolArgs"
$filesContext = Get-PropertyValue $data "attachments"

if ($Tool -eq "claude") {
    if ($event -ne "UserPromptSubmit" -and $toolInput) {
        $claudePrompt = First-NonEmpty @(
            (Get-PropertyValue $toolInput "prompt"),
            (Get-PropertyValue $toolInput "content")
        )
        $prompt = Limit-Text $claudePrompt 1000
    }
} elseif ($Tool -eq "gemini" -and $event -eq "BeforeAgent") {
    $prompt = Limit-Text (Get-PropertyValue $data "prompt") 1000
} elseif ($Tool -eq "copilot") {
    $toolName = [string](Get-PropertyValue $data "toolName")
} elseif ($Tool -eq "codex") {
    $turnId = [string](Get-PropertyValue $data "turn_id")
    $transcriptPath = [string](Get-PropertyValue $data "transcript_path")
}

$hasPayload = $prompt -or $toolInput -or $toolResponse -or $responseSummary -or $toolArgs -or $filesContext
$lifecycleEvents = @("Stop", "stop", "SessionEnd", "sessionEnd", "AfterModel")
if (-not $hasPayload -and $lifecycleEvents -notcontains $event) {
    exit 0
}

$base = [ordered]@{
    ts = [DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(7)).ToString("o")
    tool = $Tool
    event = $event
    session_id = [string](First-NonEmpty @(
        (Get-PropertyValue $data "session_id"),
        (Get-PropertyValue $data "conversation_id"),
        (Get-PropertyValue $data "generation_id")
    ))
    model = [string](Get-PropertyValue $data "model")
    repo = $repo
    branch = Invoke-Git -Arguments @("rev-parse", "--abbrev-ref", "HEAD") -WorkingDirectory $sessionCwd
    commit = Invoke-Git -Arguments @("rev-parse", "--short", "HEAD") -WorkingDirectory $sessionCwd
    student = Invoke-Git -Arguments @("config", "user.email") -WorkingDirectory $sessionCwd
    prompt = $prompt
}

if ($Tool -eq "codex") {
    $base.turn_id = $turnId
    $base.transcript_path = $transcriptPath
} elseif ($Tool -eq "claude") {
    $base.tool_name = [string](Get-PropertyValue $data "tool_name")
    $base.tool_input = if ($event -ne "UserPromptSubmit") { $toolInput } else { $null }
    $base.tool_response = $toolResponse
} elseif ($Tool -eq "copilot") {
    $base.tool_name = $toolName
    $base.tool_args = $toolArgs
} elseif ($Tool -eq "cursor") {
    $base.files_context = $filesContext
} elseif ($Tool -eq "gemini") {
    $base.response_summary = $responseSummary
}

New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$line = $base | ConvertTo-Json -Compress -Depth 10
[IO.File]::AppendAllText($logFile, $line + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
[ordered]@{ status = "logged" } | ConvertTo-Json -Compress
