#!/bin/bash
# Doppelklick-Start für macOS: Datenbank, Demoverein, Backend und App
cd "$(dirname "$0")" || exit 1

if ! docker info >/dev/null 2>&1; then
  echo "[!] Docker Desktop läuft nicht. Bitte starten und diese Datei erneut öffnen."
  read -r -p "Enter zum Beenden …"
  exit 1
fi

echo "[1/4] Bausteine prüfen …" && pnpm install --silent \
  && echo "[2/4] Datenbank starten …" && pnpm db:up \
  && echo "[3/4] Demoverein aktualisieren …" && pnpm db:reset >/dev/null \
  && echo "[4/4] Backend und App starten … (App: http://localhost:8081, E-Mails: http://localhost:8025)" && pnpm dev \
  || { echo "[!] Fehler – bitte Meldung lesen oder an Claude schicken."; read -r -p "Enter zum Beenden …"; }
