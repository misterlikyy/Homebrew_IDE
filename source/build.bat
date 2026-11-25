@echo off
setlocal
cd /d "%~dp0"
title Building IDE-beta.exe

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get the LTS version from https://nodejs.org, then run this file again.
  pause
  exit /b 1
)

echo Close IDE-beta.exe if it is open before replacing the Desktop copy.

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
if defined DESK copy /y "dist\IDE-beta.exe" "%DESK%\IDE-beta.exe" >nul

echo.
echo Done. IDE-beta.exe is a finished app, no install and no Node.js needed to run it.
if defined DESK echo A copy is on your Desktop: %DESK%\IDE-beta.exe
echo Build again after changing the app source.
pause
