@echo off
setlocal
set "PORT=5173"

netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo Dev server is already running on port %PORT%.
  exit /b 0
)

if exist node_modules\.bin\vite.cmd (
  call node_modules\.bin\vite.cmd --host 0.0.0.0 --port %PORT%
) else (
  call npm run dev
)
