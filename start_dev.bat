@echo off
setlocal ENABLEDELAYEDEXPANSION
set SCRIPT_DIR=%~dp0

echo Starting ConRumbo backend on http://127.0.0.1:8000 ...
start "ConRumbo Backend" cmd /k "cd /d "%SCRIPT_DIR%backend" && python app.py"

echo Starting ConRumbo frontend on http://127.0.0.1:3000 ...
start "ConRumbo Frontend" cmd /k "cd /d "%SCRIPT_DIR%frontend" && python -m http.server 3000"

echo.
echo Backend:  http://127.0.0.1:8000
echo Frontend: http://127.0.0.1:3000
echo Use Ajustes -> Servidor to point frontend to backend IP: http://<IP-PC>:8000
echo.
endlocal
