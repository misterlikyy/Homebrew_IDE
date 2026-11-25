@echo off
setlocal
cd /d "%~dp0"
title Building ide-alpha-4.exe

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get the LTS version from https://nodejs.org, then run this file again.
  pause
  exit /b 1
)

echo Close ide-alpha-4.exe if it is open before replacing the Desktop copy.

if not exist "node_modules\electron-builder" (
  echo Installing the build tools. This only happens the first time.
  call npm install --no-audit --no-fund
  if errorlevel 1 ( echo The install failed. Check your internet connection. & pause & exit /b 1 )
) else (
  echo Build tools are already installed, skipping.
)

echo Building the app. This takes a minute or two...
call npm run dist
if errorlevel 1 (
  echo The build failed. Send me the last lines above.
  pause
  exit /b 1
)

set "DESK="
for /f "delims=" %%D in ('powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"') do set "DESK=%%D"
if defined DESK copy /y "dist\ide-alpha-4.exe" "%DESK%\ide-alpha-4.exe" >nul

echo.
echo Done. ide-alpha-4.exe is a finished app, no install and no Node.js needed to run it.
if defined DESK echo A copy is on your Desktop: %DESK%\ide-alpha-4.exe
echo You only need to build again when I send you a new alpha version.
pause
