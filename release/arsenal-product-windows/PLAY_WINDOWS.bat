@echo off
title APEX CHAOS - Arsenal Battle
cd /d "%~dp0"
echo Starting Arsenal Battle product server...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
if errorlevel 1 (
  echo.
  echo The server failed to start. See the message above.
  pause
)
