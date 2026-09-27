$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptRoot '..\..')
$faqPath = Join-Path $scriptRoot 'faq_component_cases.jsonl'
$e2ePath = Join-Path $scriptRoot 'e2e_product_flow_cases.jsonl'
$manifestPath = Join-Path $scriptRoot 'dataset_manifest.yaml'
$businessReviewPath = Join-Path $scriptRoot 'business_review_v0.3.md'
$reviewLogPath = Join-Path $scriptRoot 'review_log.md'
$checksumPath = Join-Path $scriptRoot 'FROZEN_CHECKSUMS.sha256'
$knowledgeManifestPath = Join-Path $repoRoot 'knowledge\manifest.yaml'
$canonicalRoot = Join-Path $repoRoot 'knowledge\canonical'

function Read-JsonLines {
    param([Parameter(Mandatory = $true)][string]$Path)

    $items = @()
    $lineNumber = 0
    foreach ($line in Get-Content -LiteralPath $Path -Encoding utf8) {
        $lineNumber++
        if ([string]::IsNullOrWhiteSpace($line)) {
            continue
        }
        try {
            $items += $line | ConvertFrom-Json
        }
        catch {
            throw "Invalid JSON in $Path at line $lineNumber`: $($_.Exception.Message)"
        }
    }
    return $items
}

function Assert-Unique {
    param(
        [Parameter(Mandatory = $true)]$Values,
        [Parameter(Mandatory = $true)][string]$Label
    )

    $duplicates = @($Values | Group-Object | Where-Object Count -gt 1)
    if ($duplicates.Count -gt 0) {
        throw "$Label contains duplicate IDs: $($duplicates.Name -join ', ')"
    }
}

$faqCases = @(Read-JsonLines -Path $faqPath)
$e2eCases = @(Read-JsonLines -Path $e2ePath)

if ($faqCases.Count -ne 50) {
    throw "Expected 50 FAQ cases, found $($faqCases.Count)."
}
if ($e2eCases.Count -ne 30) {
    throw "Expected 30 E2E cases, found $($e2eCases.Count)."
}

$faqIds = @($faqCases | ForEach-Object case_id)
$e2eIds = @($e2eCases | ForEach-Object flow_case_id)
Assert-Unique -Values $faqIds -Label 'FAQ catalog'
Assert-Unique -Values $e2eIds -Label 'E2E catalog'

$validReasonCodes = @(
    'pii_or_account_specific',
    'legal_or_compensation_escalation',
    'unsupported_intent',
    'intent_unresolved',
    'no_eligible_source',
    'source_conflict',
    'source_expired_or_unknown',
    'system_error',
    'emergency_or_life_safety',
    'reviewer_rejected_draft'
)
$expectedBehaviorByScenario = @{
    answerable = 'answer_with_citation'
    clarification = 'clarification_required'
    escalation = 'escalate'
}
$allowedMissingContextByIntent = @{
    'I-01' = @('card_type', 'request_type', 'property_type', 'unit_type_when_limit_is_relevant')
    'I-02' = @('parking_card_or_parking_service', 'facility_type', 'monthly_or_casual', 'vehicle_type', 'time_window_when_casual')
    'I-03' = @('amenity_type', 'amenity_variant_when_relevant', 'age_or_height_when_safety_relevant')
    'I-04' = @('moving_or_construction', 'property_type', 'building_or_area_when_relevant', 'work_type_when_construction_schedule_is_asked', 'requested_day_or_time_when_schedule_is_asked')
    'I-05' = @('rule_topic', 'apartment_commercial_or_villa_scope', 'general_rule_or_case_specific_decision')
}
$faqRequiredFields = @(
    'case_id', 'title', 'intent_id', 'scenario_type', 'query', 'context',
    'expected_behavior', 'gold_sources', 'prohibited_source_sections',
    'must_include_facts', 'must_not_include', 'expected_reason_code',
    'risk_tags', 'review_status'
)

foreach ($case in $faqCases) {
    foreach ($field in $faqRequiredFields) {
        if ($case.PSObject.Properties.Name -notcontains $field) {
            throw "FAQ case $($case.case_id) is missing required field $field."
        }
    }
    if ($case.review_status -ne 'frozen') {
        throw "FAQ case $($case.case_id) has an unexpected review_status."
    }
    if (-not $expectedBehaviorByScenario.ContainsKey([string]$case.scenario_type)) {
        throw "FAQ case $($case.case_id) has an invalid scenario_type."
    }
    if ($case.expected_behavior -ne $expectedBehaviorByScenario[[string]$case.scenario_type]) {
        throw "FAQ case $($case.case_id) has an expected_behavior inconsistent with scenario_type."
    }
    if (@($case.must_not_include).Count -eq 0) {
        throw "FAQ case $($case.case_id) must define negative gold criteria."
    }
    if ($case.scenario_type -ne 'clarification' -and @($case.must_include_facts).Count -eq 0) {
        throw "FAQ case $($case.case_id) must define positive gold facts."
    }
    if ($case.scenario_type -eq 'answerable' -and @($case.gold_sources).Count -eq 0) {
        throw "Answerable FAQ case $($case.case_id) has no gold source."
    }
    if ($case.scenario_type -eq 'clarification') {
        if (@($case.context.missing).Count -eq 0) {
            throw "Clarification FAQ case $($case.case_id) has no missing context field."
        }
        foreach ($missingField in @($case.context.missing)) {
            if ($missingField -notin $allowedMissingContextByIntent[[string]$case.intent_id]) {
                throw "Clarification FAQ case $($case.case_id) uses out-of-contract missing field $missingField."
            }
        }
        if (@($case.expected_clarification_fields).Count -ne @($case.context.missing).Count) {
            throw "Clarification FAQ case $($case.case_id) has inconsistent expected clarification fields."
        }
        foreach ($missingField in @($case.context.missing)) {
            if ($missingField -notin @($case.expected_clarification_fields)) {
                throw "Clarification FAQ case $($case.case_id) does not request missing field $missingField."
            }
        }
        if (@($case.gold_sources).Count -gt 0) {
            throw "Clarification FAQ case $($case.case_id) must not preselect a gold source."
        }
    }
    if ($case.scenario_type -eq 'escalation') {
        if ([string]::IsNullOrWhiteSpace([string]$case.expected_reason_code)) {
            throw "Escalation FAQ case $($case.case_id) has no expected reason code."
        }
        if ($case.expected_reason_code -notin $validReasonCodes) {
            throw "FAQ case $($case.case_id) has an unknown expected reason code."
        }
    }
}

$intentCounts = @{}
foreach ($intent in @('I-01', 'I-02', 'I-03', 'I-04', 'I-05')) {
    $intentCounts[$intent] = @($faqCases | Where-Object intent_id -eq $intent).Count
    if ($intentCounts[$intent] -ne 10) {
        throw "Expected 10 FAQ cases for $intent, found $($intentCounts[$intent])."
    }
}

$answerableCount = @($faqCases | Where-Object scenario_type -eq 'answerable').Count
$clarificationCount = @($faqCases | Where-Object scenario_type -eq 'clarification').Count
$escalationCount = @($faqCases | Where-Object scenario_type -eq 'escalation').Count
if ($answerableCount -ne 40 -or $clarificationCount -ne 5 -or $escalationCount -ne 5) {
    throw "FAQ scenario distribution mismatch: answerable=$answerableCount clarification=$clarificationCount escalation=$escalationCount."
}

$linkedCount = 0
$clarificationFlowCount = 0
$diagnosticFields = @(
    'intent_correct', 'context_behavior_correct', 'safety_behavior_correct',
    'reason_code_correct', 'source_correct', 'citation_correct',
    'critical_facts_complete', 'no_unsupported_claim',
    'human_control_correct', 'terminal_state_correct'
)
$e2eRequiredFields = @(
    'flow_case_id', 'title', 'base_faq_case_id', 'flow_groups',
    'evaluation_mode', 'operator_actions', 'expected_state_sequence',
    'critical_checkpoints', 'expected_terminal_state',
    'expected_reason_code', 'post_terminal_expectation',
    'diagnostic_applicability', 'review_status'
)
foreach ($flow in $e2eCases) {
    foreach ($field in $e2eRequiredFields) {
        if ($flow.PSObject.Properties.Name -notcontains $field) {
            throw "E2E case $($flow.flow_case_id) is missing required field $field."
        }
    }
    if ($flow.review_status -ne 'frozen') {
        throw "E2E case $($flow.flow_case_id) has an unexpected review_status."
    }
    if (@($flow.operator_actions).Count -eq 0 -or @($flow.expected_state_sequence).Count -eq 0 -or @($flow.critical_checkpoints).Count -eq 0) {
        throw "E2E case $($flow.flow_case_id) has an empty execution contract."
    }
    foreach ($group in @($flow.flow_groups)) {
        if ($group -notin @('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I')) {
            throw "E2E case $($flow.flow_case_id) references invalid flow group $group."
        }
    }
    if ($null -ne $flow.base_faq_case_id -and -not [string]::IsNullOrWhiteSpace([string]$flow.base_faq_case_id)) {
        $linkedCount++
        if ($flow.base_faq_case_id -notin $faqIds) {
            throw "E2E case $($flow.flow_case_id) references missing FAQ case $($flow.base_faq_case_id)."
        }
    }
    if ($flow.expected_terminal_state -notin @('answered', 'escalated')) {
        throw "E2E case $($flow.flow_case_id) has invalid expected_terminal_state."
    }
    if ($flow.expected_terminal_state -notin @($flow.expected_state_sequence)) {
        throw "E2E case $($flow.flow_case_id) never reaches its expected terminal state."
    }
    if ($flow.expected_terminal_state -eq 'escalated') {
        if ([string]::IsNullOrWhiteSpace([string]$flow.expected_reason_code)) {
            throw "Escalated E2E case $($flow.flow_case_id) has no expected reason code."
        }
        if ($flow.expected_reason_code -notin $validReasonCodes) {
            throw "E2E case $($flow.flow_case_id) has an unknown expected reason code."
        }
    }
    if ($flow.expected_terminal_state -eq 'answered' -and $null -ne $flow.expected_reason_code) {
        throw "Answered E2E case $($flow.flow_case_id) must not have an escalation reason code."
    }

    $actions = @($flow.operator_actions)
    $answeredActions = @('resident_submits_query', 'system_answers_with_citation')
    $clarificationActions = @('resident_submits_query', 'system_requests_clarification', 'resident_provides_context', 'system_answers_with_citation')
    $retryAnsweredActions = @('resident_submits_query', 'system_encounters_recoverable_error', 'resident_retries_query', 'system_answers_with_citation')
    $escalationActions = @('resident_submits_query', 'system_detects_low_confidence_or_risk', 'system_escalates_to_bql')
    $unresolvedEscalationActions = @('resident_submits_query', 'system_requests_clarification', 'resident_provides_unhelpful_context', 'system_detects_low_confidence_or_risk', 'system_escalates_to_bql')

    $actionSignature = $actions -join '|'
    $answeredSignature = $answeredActions -join '|'
    $clarificationSignature = $clarificationActions -join '|'
    $retryAnsweredSignature = $retryAnsweredActions -join '|'
    $escalationSignature = $escalationActions -join '|'
    $unresolvedEscalationSignature = $unresolvedEscalationActions -join '|'

    if ($flow.expected_terminal_state -eq 'escalated') {
        if ($actionSignature -ne $escalationSignature -and $actionSignature -ne $unresolvedEscalationSignature) {
            throw "Escalated E2E case $($flow.flow_case_id) has an invalid resident/BQL action contract: $actionSignature"
        }
        if ('bql_inbox_receives_ticket' -notin @($flow.critical_checkpoints)) {
            throw "Escalated E2E case $($flow.flow_case_id) does not verify BQL Inbox handoff."
        }
    }
    else {
        if ($actionSignature -eq $clarificationSignature) {
            $clarificationFlowCount++
        }
        elseif ($actionSignature -ne $answeredSignature -and $actionSignature -ne $retryAnsweredSignature) {
            throw "Answered E2E case $($flow.flow_case_id) has an invalid resident action contract: $actionSignature"
        }
        if ('answer_has_valid_document_id_and_section_id' -notin @($flow.critical_checkpoints)) {
            throw "Answered E2E case $($flow.flow_case_id) does not verify document_id and section_id citations."
        }
    }

    foreach ($diagnostic in $diagnosticFields) {
        if ($flow.diagnostic_applicability.PSObject.Properties.Name -notcontains $diagnostic) {
            throw "E2E case $($flow.flow_case_id) is missing diagnostic $diagnostic."
        }
        if ($flow.diagnostic_applicability.$diagnostic -notin @('required', 'not_applicable')) {
            throw "E2E case $($flow.flow_case_id) has an invalid applicability value for $diagnostic."
        }
    }

    foreach ($referenceField in @('fixture_faq_case_id', 'follow_up_gold_case_id')) {
        $referenceValue = $flow.$referenceField
        if ($null -ne $referenceValue -and -not [string]::IsNullOrWhiteSpace([string]$referenceValue)) {
            if ($referenceValue -notin $faqIds) {
                throw "E2E case $($flow.flow_case_id) has invalid $referenceField reference: $referenceValue."
            }
        }
    }
}
if ($linkedCount -ne 20) {
    throw "Expected 20 linked E2E cases, found $linkedCount."
}
if ($clarificationFlowCount -ne 5) {
    throw "Expected 5 clarification E2E flows, found $clarificationFlowCount."
}

$answeredTerminalCount = @($e2eCases | Where-Object expected_terminal_state -eq 'answered').Count
$escalatedTerminalCount = @($e2eCases | Where-Object expected_terminal_state -eq 'escalated').Count
if ($answeredTerminalCount -ne 20 -or $escalatedTerminalCount -ne 10) {
    throw "E2E terminal distribution mismatch: answered=$answeredTerminalCount escalated=$escalatedTerminalCount."
}

$coveredReasonCodes = @(
    $e2eCases |
        Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_.expected_reason_code) } |
        ForEach-Object expected_reason_code |
        Sort-Object -Unique
)
foreach ($reasonCode in $validReasonCodes) {
    if ($reasonCode -notin $coveredReasonCodes) {
        throw "Canonical reason code $reasonCode has no E2E coverage."
    }
}

$canonicalFiles = @{}
$knownSectionIds = @{}
$canonicalPaths = @(Get-ChildItem -LiteralPath $canonicalRoot -Filter '*.md' -File)
if ($canonicalPaths.Count -ne 21) {
    throw "Expected 21 canonical knowledge files, found $($canonicalPaths.Count)."
}
foreach ($file in $canonicalPaths) {
    $canonicalText = Get-Content -LiteralPath $file.FullName -Encoding utf8 -Raw
    $canonicalFiles[$file.BaseName] = $canonicalText
    foreach ($match in [regex]::Matches($canonicalText, '(?m)^#{2,3}\s+([A-Z0-9-]+)\s+\u2014')) {
        $knownSectionIds[$match.Groups[1].Value] = $true
    }
}

foreach ($case in $faqCases) {
    foreach ($source in @($case.gold_sources)) {
        if (-not $canonicalFiles.ContainsKey([string]$source.document_id)) {
            throw "FAQ case $($case.case_id) references missing document $($source.document_id)."
        }
        $canonicalText = $canonicalFiles[[string]$source.document_id]
        foreach ($sectionId in @($source.section_ids)) {
            $escaped = [regex]::Escape([string]$sectionId)
            if ($canonicalText -notmatch "(?m)^#{2,3}\s+$escaped\s+\u2014") {
                throw "FAQ case $($case.case_id) references missing section $sectionId in $($source.document_id)."
            }
        }
    }
    foreach ($sectionId in @($case.prohibited_source_sections)) {
        if (-not $knownSectionIds.ContainsKey([string]$sectionId)) {
            throw "FAQ case $($case.case_id) references unknown prohibited section $sectionId."
        }
    }
}

$datasetManifest = Get-Content -LiteralPath $manifestPath -Encoding utf8 -Raw
$knowledgeManifest = Get-Content -LiteralPath $knowledgeManifestPath -Encoding utf8 -Raw
if ($datasetManifest -notmatch 'knowledge_pack_revision:\s+"1\.18"') {
    throw 'Dataset manifest does not reference Knowledge Pack revision 1.18.'
}
if ($datasetManifest -notmatch '(?m)^\s+dataset_revision:\s+"0\.3"\s*$') {
    throw 'Dataset manifest is not at revision 0.3.'
}
if ($datasetManifest -notmatch '(?m)^\s+approval_scope:\s+BTC_MVP_Evaluation\s*$') {
    throw 'Dataset manifest approval_scope is not BTC_MVP_Evaluation.'
}
if ($datasetManifest -notmatch '(?m)^\s+valid_business_terminal_states:\s+\["answered",\s*"escalated"\]\s*$') {
    throw 'Dataset manifest does not define answered/escalated as the only business terminal states.'
}
if ($datasetManifest -notmatch '(?m)^\s+status:\s+Frozen\s*$' -or
    $datasetManifest -notmatch '(?m)^\s+current_status:\s+Frozen\s*$') {
    throw 'Dataset manifest is not frozen.'
}
if ($knowledgeManifest -notmatch 'canonical_revision:\s+"1\.18"') {
    throw 'Knowledge manifest is not at revision 1.18.'
}

if (-not (Test-Path -LiteralPath $businessReviewPath)) {
    throw 'Frozen dataset is missing business_review_v0.3.md.'
}
$businessReview = Get-Content -LiteralPath $businessReviewPath -Encoding utf8 -Raw
if ($businessReview -notmatch '\*\*Decision:\*\* `APPROVED`' -or
    $businessReview -notmatch '\*\*Freeze state:\*\* `Frozen`') {
    throw 'Business review does not contain an APPROVED/Frozen record.'
}

if (-not (Test-Path -LiteralPath $reviewLogPath)) {
    throw 'Frozen dataset is missing review_log.md.'
}
$reviewLog = Get-Content -LiteralPath $reviewLogPath -Encoding utf8 -Raw
if ($reviewLog -notmatch 'EVAL-REVIEW-004' -or $reviewLog -notmatch 'Decision:\*\* APPROVED') {
    throw 'Review log does not contain the freeze approval entry.'
}

if (-not (Test-Path -LiteralPath $checksumPath)) {
    throw 'Frozen dataset is missing FROZEN_CHECKSUMS.sha256.'
}
$checksumEntries = @()
foreach ($checksumLine in Get-Content -LiteralPath $checksumPath -Encoding utf8) {
    if ([string]::IsNullOrWhiteSpace($checksumLine) -or $checksumLine.StartsWith('#')) {
        continue
    }
    if ($checksumLine -notmatch '^([0-9a-fA-F]{64})  (.+)$') {
        throw "Invalid checksum entry: $checksumLine"
    }
    $expectedHash = $Matches[1].ToUpperInvariant()
    $relativePath = $Matches[2]
    $checksumEntries += $relativePath
    $targetPath = Join-Path $repoRoot $relativePath
    if (-not (Test-Path -LiteralPath $targetPath)) {
        throw "Checksum target does not exist: $relativePath"
    }
    $actualHash = (Get-FileHash -LiteralPath $targetPath -Algorithm SHA256).Hash
    if ($actualHash -ne $expectedHash) {
        throw "Checksum mismatch: $relativePath"
    }
}
if ($checksumEntries.Count -ne 8) {
    throw "Expected 8 checksum targets, found $($checksumEntries.Count)."
}
if (@($checksumEntries | Sort-Object -Unique).Count -ne 8) {
    throw 'Checksum file contains duplicate targets.'
}
if ('evals/golden/FROZEN_CHECKSUMS.sha256' -in $checksumEntries) {
    throw 'Checksum file must not hash itself.'
}

Write-Output 'Golden dataset validation passed.'
Write-Output "FAQ cases: $($faqCases.Count)"
Write-Output "E2E cases: $($e2eCases.Count)"
Write-Output "Linked E2E cases: $linkedCount"
Write-Output "FAQ distribution: answerable=$answerableCount clarification=$clarificationCount escalation=$escalationCount"
Write-Output "E2E terminals: answered=$answeredTerminalCount escalated=$escalatedTerminalCount"
Write-Output "Canonical reason-code coverage: $($coveredReasonCodes.Count)/$($validReasonCodes.Count)"
Write-Output 'Freeze status: Frozen (approval and checksums verified)'
Write-Output 'Summary: PASS (All checksums verified, 50 FAQ cases valid, 30 E2E cases valid)'
