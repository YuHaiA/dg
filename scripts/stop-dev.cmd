@echo off
setlocal
set "PORT=5173"

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  taskkill /PID %%P /F >nul 2>nul
  if errorlevel 1 (
    echo Failed to stop process %%P on port %PORT%.
  ) else (
    echo Stopped process %%P on port %PORT%.
  )
  exit /b 0
)

echo No dev server found on port %PORT%.
exit /b 0
