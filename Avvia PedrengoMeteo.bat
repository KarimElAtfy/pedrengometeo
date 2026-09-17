@echo off
title PedrengoMeteo
cd /d "%~dp0"

echo.
echo   PedrengoMeteo
echo   ----------------------------------------
echo   Avvio del sito in corso.
echo   Lascia aperta questa finestra mentre lo usi.
echo   Per chiudere il sito, chiudi questa finestra.
echo.

start "" /min cmd /c "python -m http.server 8791 --bind 127.0.0.1"

rem attesa breve perche il server sia pronto prima di aprire il browser
timeout /t 2 /nobreak >nul

start "" http://127.0.0.1:8791/

echo   Aperto su http://127.0.0.1:8791/
echo.
echo   Se il browser non si e' aperto da solo, copia
echo   questo indirizzo nella barra:  http://127.0.0.1:8791/
echo.
pause
