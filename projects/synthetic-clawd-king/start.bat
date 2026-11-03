@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js LTS first.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 exit /b 1
)
call npm run dev -- --open
