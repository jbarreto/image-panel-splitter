@echo off
TITLE Ronyka Launcher

:: Check whether the local server is already responding.
curl -sI http://localhost:4173/ >nul 2>&1

:: If curl succeeded, the server is already running.
if %errorLevel% == 0 (
    echo The server is already running. Opening the browser...
    goto :open_chrome
)

:: Start the server in a separate terminal using the companion script.
echo The server is not running. Starting Ronyka Panel Splitter...
start "Ronyka Server" "%~dp0start-ronyka.bat"

:: Allow the server time to start.
timeout /t 3 /nobreak >nul

:open_chrome
:: Open the local GUI in Google Chrome.
echo Opening Google Chrome...
start chrome "http://localhost:4173/"

:: Close this launcher window.
exit
