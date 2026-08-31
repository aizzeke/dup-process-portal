@echo off
cd /d "%~dp0"

where python >nul 2>nul
if not errorlevel 1 goto use_python

where conda >nul 2>nul
if not errorlevel 1 goto use_conda

where py >nul 2>nul
if not errorlevel 1 goto use_py

echo Python/Conda was not found in PATH.
pause
exit /b 1

:use_conda
call conda activate base
python -m http.server 8080
exit /b

:use_python
python -m http.server 8080
exit /b

:use_py
py -m http.server 8080
exit /b
