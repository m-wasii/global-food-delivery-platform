# Create an isolated Eatwave writer worktree from origin/main.
# Usage: .\scripts\new-worktree.ps1 feat/delivery-lifecycle

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Branch
)

$ErrorActionPreference = 'Stop'
$root = (git rev-parse --show-toplevel)
if ($LASTEXITCODE -ne 0 -or -not $root) {
    throw 'Run this script from inside the Eatwave repository.'
}
Set-Location $root

git check-ref-format --branch $Branch
if ($LASTEXITCODE -ne 0) {
    throw "Invalid branch name: $Branch"
}

$folder = ($Branch -replace '[\\/]+', '-').Trim('-')
$worktreePath = Join-Path $root ".worktrees\$folder"

if (Test-Path $worktreePath) {
    throw "Worktree path already exists: $worktreePath"
}

git show-ref --verify --quiet "refs/heads/$Branch"
if ($LASTEXITCODE -eq 0) {
    throw "Local branch already exists: $Branch. Use a new unique branch name."
}

git fetch origin main
if ($LASTEXITCODE -ne 0) {
    throw 'git fetch origin main failed.'
}

New-Item -ItemType Directory -Force -Path (Split-Path $worktreePath -Parent) | Out-Null
git worktree add $worktreePath -b $Branch origin/main
if ($LASTEXITCODE -ne 0) {
    throw "git worktree add failed for branch '$Branch'."
}

Write-Output "Worktree created: $((Resolve-Path $worktreePath).Path)"
Write-Output 'Next: move the assigned writer agent root into this directory before editing.'
Write-Output 'Then create a worktree-specific .env with unique DB/Redis/API/web ports.'
