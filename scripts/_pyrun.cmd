@echo off
REM Cross-platform Python launcher for AI log hooks (Windows cmd.exe).
REM Tries the project venv, py -3, python and python3 in order, then falls
REM back to the PowerShell logger when the AI log hook is the only script.
REM Exits 0 silently if no runtime is found - hooks must never block the AI tool.

set "SCRIPT_DIR=%~dp1"
set "SCRIPT_NAME=%~nx1"

if exist "%~dp0..\.venv\Scripts\python.exe" goto run_venv

where py >nul 2>nul
if errorlevel 1 goto try_python
py -3 -c "import sys" >nul 2>nul
if errorlevel 1 goto try_python
py -3 %*
exit /b %ERRORLEVEL%

 :try_python
where python >nul 2>nul
if errorlevel 1 goto try_python3
python -c "import sys" >nul 2>nul
if errorlevel 1 goto try_python3
python %*
exit /b %ERRORLEVEL%

 :try_python3
where python3 >nul 2>nul
if errorlevel 1 goto fallback
python3 -c "import sys" >nul 2>nul
if errorlevel 1 goto fallback
python3 %*
exit /b %ERRORLEVEL%

 :run_venv
"%~dp0..\.venv\Scripts\python.exe" %*
exit /b %ERRORLEVEL%

 :fallback
if /I not "%SCRIPT_NAME%"=="log_hook.py" exit /b 0
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%log_hook.ps1"
exit /b %ERRORLEVEL%
