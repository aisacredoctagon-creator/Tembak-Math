@echo off
rem Menjalankan Math Gun Runner: server lokal + buka browser. Tutup jendela ini untuk berhenti.
cd /d "%~dp0"
set PORT=8000
set PY=python
where python >nul 2>nul || set PY=py
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:%PORT%"
echo Math Gun Runner berjalan di http://localhost:%PORT%
echo Tutup jendela ini untuk menghentikan server.
%PY% -m http.server %PORT%
pause
