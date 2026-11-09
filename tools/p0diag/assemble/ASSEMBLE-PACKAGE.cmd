@echo off
REM ===========================================================================
REM  APEX CHAOS - P0 diagnosis package assembler
REM
REM  The release ZIP is split into parts and stored in the repository itself,
REM  because the release-asset upload host is blocked from the build machine.
REM  This script puts the parts back together, verifies the SHA-256, and opens
REM  the folder. Double-click it; nothing else is required.
REM ===========================================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"

title APEX CHAOS - assemble diagnosis package

echo.
echo  APEX CHAOS - P0 diagnosis assembler
echo  -----------------------------------
echo.

set "PARTS=parts"
set "OUT=APEX-CHAOS-P0-Diagnosis-44ba89c-fixed.zip"
set "EXPECT=8fbf345eee46f6f7a1eb460ac99ad31f38a9e062a822d6de103129362399fec8"

if not exist "%PARTS%" (
  echo  ERROR: the "parts" folder is missing next to this script.
  echo         Re-download the folder as a whole, not just the .cmd file.
  echo.
  pause
  exit /b 1
)

echo  Checking parts...
set /a COUNT=0
for %%F in ("%PARTS%\part-*.bin") do set /a COUNT+=1
if "%COUNT%"=="0" (
  echo  ERROR: no part-*.bin files found in "%PARTS%".
  echo.
  pause
  exit /b 1
)
echo  Found %COUNT% part(s).

if exist "%OUT%" del /q "%OUT%"

echo  Joining...
for /f "delims=" %%F in ('dir /b /on "%PARTS%\part-*.bin"') do (
  echo    + %%F
  if not exist "%OUT%" (
    copy /b "%PARTS%\%%F" "%OUT%" >nul
  ) else (
    copy /b "%OUT%"+"%PARTS%\%%F" "%OUT%" >nul
  )
)

if not exist "%OUT%" (
  echo  ERROR: the join produced no output file.
  pause
  exit /b 1
)

echo.
echo  Verifying SHA-256...
where certutil >nul 2>nul
if errorlevel 1 goto :noverify

for /f "skip=1 tokens=* delims=" %%H in ('certutil -hashfile "%OUT%" SHA256') do (
  if not defined GOT set "GOT=%%H"
)
set "GOT=!GOT: =!"
echo  expected: %EXPECT%
echo  actual  : !GOT!
if /i "!GOT!"=="%EXPECT%" (
  echo  SHA-256 MATCH - the package is intact.
) else (
  echo.
  echo  WARNING: the SHA-256 does not match. A part is probably corrupt or
  echo  missing. Re-download the parts folder and run this again.
  echo.
  pause
  exit /b 1
)
goto :done

:noverify
echo  certutil not available; skipping the integrity check.

:done
echo.
echo  Done. The package is:
echo    %CD%\%OUT%
echo.
echo  Next: right-click that file, Extract All, then double-click
echo        RUN-DIAGNOSIS.cmd inside the extracted folder.
echo.
start "" "%CD%"
pause
exit /b 0
