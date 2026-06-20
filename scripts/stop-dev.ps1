$port = 5173
$connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
$processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique

if (-not $processIds) {
  Write-Host "No dev server found on port $port."
  exit 0
}

foreach ($processId in $processIds) {
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $processId -Force
    Write-Host "Stopped process $processId ($($process.ProcessName)) on port $port."
  }
}
