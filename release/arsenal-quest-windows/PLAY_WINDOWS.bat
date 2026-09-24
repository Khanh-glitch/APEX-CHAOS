@echo off
title APEX CHAOS - Arsenal Quest
cd /d "%~dp0"
echo Starting Arsenal Quest playable server...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
if errorlevel 1 (
  echo.
  echo The server failed to start. See the message above.
  pause
)
