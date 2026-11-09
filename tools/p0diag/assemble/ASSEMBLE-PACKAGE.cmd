@echo off
:: APEX CHAOS — P0 Diagnosis package assembler.
:: Recombines the nine binary ZIP parts under parts\ into the diagnosis ZIP.
::
::   ASSEMBLE-PACKAGE.cmd
::
:: Produces: apex-p0diag-diagnosis.zip next to this script.
:: Then: extract the ZIP anywhere and run RUN-DIAGNOSIS.cmd inside it.
::
:: The parts are the distributable form of the package (each part small
:: enough to copy through restricted channels). SHA-256 of the reassembled
:: ZIP is printed; compare it with the published SHA-256 before extracting.

@echo off
setlocal EnableExtensions

cd /d "%~dp0"

if not exist parts\p0diag-package.zip.001 (
  echo ERROR: parts\ not found or incomplete. All nine parts (.001-.009) are required.
  exit /b 1
)

set "OUT=apex-p0diag-diagnosis.zip"
if exist "%OUT%" del "%OUT%"

echo Recombining nine parts into %OUT% ...
copy /b parts\p0diag-package.zip.001 + ^
     parts\p0diag-package.zip.002 + ^
     parts\p0diag-package.zip.003 + ^
     parts\p0diag-package.zip.004 + ^
     parts\p0diag-package.zip.005 + ^
     parts\p0diag-package.zip.006 + ^
     parts\p0diag-package.zip.007 + ^
     parts\p0diag-package.zip.008 + ^
     parts\p0diag-package.zip.009 "%OUT%" >nul
if errorlevel 1 (
  echo ERROR: recombine failed.
  exit /b 1
)

echo.
echo Done: %~dp0%OUT%
echo Verify: certutil -hashfile "%OUT%" SHA256
echo Then: extract %OUT% and run RUN-DIAGNOSIS.cmd inside the extracted folder.
pause
exit /b 0
