$configFile = Join-Path $PSScriptRoot "github_config.json"
$config = Get-Content $configFile -Raw | ConvertFrom-Json
$owner = $config.owner
$repo = $config.repo
$token = $config.token
$branch = if ($config.branch) { $config.branch } else { "main" }

$headers = @{
    "Authorization" = "Bearer $token"
    "Accept" = "application/vnd.github.v3+json"
    "User-Agent" = "Arzaq-Upload-Bot"
}

$exclude = @("github_config.json", "sync_github.ps1", ".git", ".gemini")

function Upload-File($file, $workspaceDir) {
    $relPath = $file.FullName.Substring($workspaceDir.Length).TrimStart("\", "/").Replace("\", "/")
    $encodedPath = ($relPath.Split('/') | ForEach-Object { [Uri]::EscapeDataString($_) }) -join '/'

    $sha = $null
    try {
        $existing = Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repo/contents/$encodedPath" -Headers $headers -Method Get -ErrorAction Stop
        $sha = $existing.sha
    } catch {}

    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    $base64 = [System.Convert]::ToBase64String($bytes)

    if ($sha) {
        $jsonBody = "{""message"":""Auto-update $relPath"",""content"":""$base64"",""branch"":""$branch"",""sha"":""$sha""}"
    } else {
        $jsonBody = "{""message"":""Add $relPath"",""content"":""$base64"",""branch"":""$branch""}"
    }

    try {
        Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repo/contents/$encodedPath" -Headers $headers -Method Put -Body ([System.Text.Encoding]::UTF8.GetBytes($jsonBody)) -ContentType "application/json" -ErrorAction Stop | Out-Null
        return $true
    } catch {
        Write-Host "   Failed to upload $relPath : $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

$workspaceDir = $PSScriptRoot

Write-Host "==================================================="
Write-Host "  Auto GitHub Sync - Watching for file changes..."
Write-Host "  Repository: $owner/$repo"
Write-Host "  Watching: $workspaceDir"
Write-Host "  Press Ctrl+C to stop."
Write-Host "==================================================="
Write-Host ""

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $workspaceDir
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true
$watcher.NotifyFilter = [System.IO.NotifyFilters]::LastWrite -bor [System.IO.NotifyFilters]::FileName

$pendingFiles = [System.Collections.Generic.HashSet[string]]::new()
$lastUploadTime = [DateTime]::MinValue
$debounceSeconds = 8

$action = {
    $filePath = $Event.SourceEventArgs.FullPath
    
    # Skip excluded files/folders
    foreach ($ex in @("github_config.json", "sync_github.ps1", ".git", ".gemini", ".zip")) {
        if ($filePath -like "*$ex*") { return }
    }
    
    if (Test-Path $filePath -PathType Leaf) {
        $global:pendingFiles.Add($filePath) | Out-Null
        Write-Host "[Changed] $($Event.SourceEventArgs.Name)" -ForegroundColor Yellow
    }
}

Register-ObjectEvent $watcher Changed -Action $action | Out-Null
Register-ObjectEvent $watcher Created -Action $action | Out-Null

Write-Host "Watching for changes... (uploads happen $debounceSeconds seconds after last change)" -ForegroundColor Cyan

try {
    while ($true) {
        Start-Sleep -Seconds 2
        
        if ($pendingFiles.Count -gt 0) {
            $now = [DateTime]::UtcNow
            $diff = ($now - $lastUploadTime).TotalSeconds
            
            if ($diff -ge $debounceSeconds) {
                $filesToUpload = @($pendingFiles)
                $pendingFiles.Clear()
                
                Write-Host ""
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Uploading $($filesToUpload.Count) file(s) to GitHub..." -ForegroundColor Cyan
                
                $success = 0
                foreach ($fp in $filesToUpload) {
                    if (-not (Test-Path $fp -PathType Leaf)) { continue }
                    $f = Get-Item $fp -ErrorAction SilentlyContinue
                    if (-not $f) { continue }
                    Write-Host "  -> $($f.Name)" -NoNewline
                    $ok = Upload-File $f $workspaceDir
                    if ($ok) {
                        Write-Host " [OK]" -ForegroundColor Green
                        $success++
                    }
                }
                
                $lastUploadTime = [DateTime]::UtcNow
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Done! $success file(s) uploaded to https://github.com/$owner/$repo" -ForegroundColor Green
                Write-Host ""
            }
        }
    }
} finally {
    $watcher.Dispose()
    Write-Host "Watcher stopped."
}
