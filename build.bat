@echo off
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Get the LTS version from https://nodejs.org then run this again.
  pause
  exit /b 1
)
call npm install
call npm run dist
echo.
echo Done. Your app is in the "dist" folder: IDE.exe
pause
