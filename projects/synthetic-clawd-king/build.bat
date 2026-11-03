@echo off
cd /d "%~dp0"
if not exist node_modules (
  call npm ci
  if errorlevel 1 exit /b 1
)
call npm run build:standalone
if errorlevel 1 exit /b 1
echo Built game: dist\Synthetic-Clawd-King.html
pause
