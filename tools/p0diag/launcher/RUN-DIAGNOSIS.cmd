@echo off
REM ===========================================================================
REM  APEX CHAOS - P0 performance diagnosis
REM  Double-click this file. Nothing else is required.
REM  It opens a browser, plays one CRYSTALA vs FROST match by itself, and saves
REM  one JSON report. Do not click the game while it runs (2-4 minutes).
REM ===========================================================================
setlocal
cd /d "%~dp0"

REM node.exe lives in runtime\ when the full package is used, otherwise it is
REM expected on PATH. Auto-detect, so the same file works either way.

title APEX CHAOS P0 diagnosis

if not exist "runtime\node.exe" (
  where node >nul 2>nul || (
    echo.
    echo  ERROR: no Node runtime found. Re-extract the ZIP completely.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo  APEX CHAOS - P0 performance diagnosis
echo  -------------------------------------
echo  A browser window will open and the game will play a scripted match.
echo  Leave this window open. It closes by itself when the report is saved.
echo.

if exist "runtime\node.exe" (
  "runtime\node.exe" "tools\p0diag\p0run.mjs"
) else (
  node "tools\p0diag\p0run.mjs"
)

set RC=%ERRORLEVEL%
echo.
if "%RC%"=="0" (
  echo  Finished. The report is in:  tools\p0diag\results\
  echo  Send that JSON file back.
) else (
  echo  The run did not finish ^(exit %RC%^).
  echo  Look for the reason above, then try again.
)
echo.
pause
exit /b %RC%
