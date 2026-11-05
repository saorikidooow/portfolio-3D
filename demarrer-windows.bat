@echo off
REM Double-cliquez sur ce fichier pour ouvrir la galerie sous Windows.
cd /d "%~dp0"
set PORT=8765
echo Galerie : http://localhost:%PORT%   -   Administration : http://localhost:%PORT%/admin/
echo Fermez cette fenetre pour arreter.
start "" "http://localhost:%PORT%/"
where py >nul 2>nul && (py -m http.server %PORT%) || (python -m http.server %PORT%)
pause
