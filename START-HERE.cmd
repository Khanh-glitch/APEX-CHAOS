@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title APEX CHAOS - one-click diagnosis
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0START-HERE.ps1"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo [APEX CHAOS] The diagnosis did not complete. Read the error above.
  echo No changes were made to the installed game.
  pause
)
exit /b %RC%
