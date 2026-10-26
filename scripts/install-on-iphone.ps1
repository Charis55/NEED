# PowerShell script to auto-detect iPhone and install Need.ipa
Write-Host "Monitoring USB for Apple iPhone..."

$maxAttempts = 60 # Check for up to 2 minutes
$installed = $false

for ($i = 0; $i -lt $maxAttempts; $i++) {
    $appleLine = & "usbipd" list | Select-String "05ac|Apple" | Where-Object { $_ -notmatch "Persisted:" -and $_ -match "^\s*(\d+-\d+)" }
    if ($appleLine) {
        if ($appleLine.Line -match "^\s*(\d+-\d+)") {
            $busId = $matches[1]
            Write-Host "Found Apple device on Bus $busId!"
            Write-Host "Attaching to WSL..."
            & "usbipd" attach --wsl --busid $busId --auto-attach 2>$null
            Start-Sleep -Seconds 2
            
            Write-Host "Triggering deployment in WSL..."
            $deployResult = wsl bash -c "bash /home/Charis/projects/Need/scripts/deploy-need-ios.sh"
            Write-Host $deployResult
            
            if ($deployResult -match "ALL DONE|COMPLETE|Installed on") {
                $installed = $true
                break
            }
        }
    }
    Start-Sleep -Seconds 2
}

if (-not $installed) {
    Write-Host "No Apple device was connected within the timeout period."
}
