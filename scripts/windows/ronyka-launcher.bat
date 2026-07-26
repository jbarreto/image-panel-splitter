@echo off
setlocal
TITLE Starting Ronyka Panel Splitter

:: Change to the project root relative to this script.
cd /d "%~dp0..\.."
if errorlevel 1 (
    echo Could not locate the Ronyka Panel Splitter project directory.
    pause
    exit /b 1
)

:: Compare the installed version with the version published on GitHub.
echo Checking for a newer Ronyka Panel Splitter version...
powershell -NoProfile -Command "$ErrorActionPreference = 'Stop'; try { $local = [version]((Get-Content -Raw 'package.json' | ConvertFrom-Json).version); $remote = $null; for ($attempt = 1; $attempt -le 3 -and $null -eq $remote; $attempt++) { try { $cacheBust = [DateTime]::UtcNow.Ticks; $url = 'https://raw.githubusercontent.com/jbarreto/image-panel-splitter/main/package.json?cacheBust=' + $cacheBust; $remote = [version]((Invoke-RestMethod -Uri $url -Headers @{ 'Cache-Control' = 'no-cache'; 'Pragma' = 'no-cache' }).version) } catch { if ($attempt -eq 3) { throw }; Start-Sleep -Seconds 2 } }; if ($remote -gt $local) { Write-Host ('Update available: v{0} -> v{1}' -f $local, $remote); exit 10 }; Write-Host ('Already up to date: v{0}' -f $local); exit 0 } catch { Write-Warning ('Could not check for updates: ' + $_.Exception.Message); exit 20 }"
set "UPDATE_STATUS=%errorlevel%"

:: Download and install only when GitHub reports a newer version.
if "%UPDATE_STATUS%"=="10" (
    echo Installing the new version...
    call npm run update
    if errorlevel 1 (
        echo The update failed. The GUI was not started.
        pause
        exit /b 1
    )
) else if not "%UPDATE_STATUS%"=="0" (
    echo Continuing with the installed version.
)

:: Reuse an existing GUI server when one is already responding.
curl -fsS http://localhost:4173/ >nul 2>&1
if not errorlevel 1 (
    echo The GUI server is already running.
    goto :open_browser
)

:: Start npm in a separate terminal so this launcher can continue.
echo Starting the Ronyka Panel Splitter GUI server...
start "Ronyka Panel Splitter Server" cmd /k "npm run gui"

:: Wait up to 30 seconds for the GUI server to become available.
echo Waiting for the GUI server...
for /l %%I in (1,1,30) do (
    curl -fsS http://localhost:4173/ >nul 2>&1
    if not errorlevel 1 goto :open_browser
    timeout /t 1 /nobreak >nul
)

echo The GUI server did not start within 30 seconds.
pause
exit /b 1

:open_browser
:: Open the GUI in the default Windows browser.
echo Opening the Ronyka Panel Splitter GUI...
start "" "http://localhost:4173/"

endlocal
exit /b 0
