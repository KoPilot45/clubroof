@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Clubroof

echo ==============================================
echo   Clubroof wird gestartet
echo ==============================================
echo.

rem 1. Docker Desktop muss laufen (Datenbank)
docker info >nul 2>&1
if errorlevel 1 (
  echo [!] Docker Desktop laeuft nicht.
  echo     Bitte Docker Desktop starten, warten bis "Engine running" angezeigt wird,
  echo     und diese Datei danach erneut doppelklicken.
  echo.
  pause
  exit /b 1
)

echo [1/4] Bausteine pruefen ...
call pnpm install --silent
if errorlevel 1 goto fehler

echo [2/4] Datenbank starten ...
call pnpm db:up
if errorlevel 1 goto fehler

echo [3/4] Demoverein aktualisieren ...
call pnpm db:reset >nul
if errorlevel 1 goto fehler

echo [4/4] Backend und App starten ...
echo.
echo   Die App oeffnet sich gleich im Browser (http://localhost:8081).
echo   E-Mails der App (Einladungen, Passwort vergessen): http://localhost:8025
echo   Anmelden: trainer@sv-gruen-weiss.example / clubroof-demo
echo   Zum Beenden dieses Fenster schliessen oder Strg + C druecken.
echo.
call pnpm dev
goto ende

:fehler
echo.
echo [!] Es ist ein Fehler aufgetreten. Bitte Meldung oben lesen oder an Claude schicken.
echo.
pause
exit /b 1

:ende
endlocal
