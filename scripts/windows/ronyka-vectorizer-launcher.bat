@echo off
setlocal
TITLE Starting Ronyka Vectorizer

:: Change to the project root relative to this script.
cd /d "%~dp0..\.."
if errorlevel 1 (
    echo Could not locate the Ronyka project directory.
    pause
    exit /b 1
)

if not exist "vectorizer\package.json" (
    echo Could not locate vectorizer\package.json.
    pause
    exit /b 1
)

:: Compare the installed vectorizer version with the version published on GitHub.
echo Checking for a newer Ronyka Vectorizer version...
powershell -NoProfile -Command "$ErrorActionPreference = 'Stop'; try { $local = [version]((Get-Content -Raw 'vectorizer/package.json' | ConvertFrom-Json).version); $remote = [version]((Invoke-RestMethod 'https://raw.githubusercontent.com/jbarreto/image-panel-splitter/main/vectorizer/package.json').version); if ($remote -gt $local) { Write-Host ('Vectorizer update available: v{0} -> v{1}' -f $local, $remote); exit 10 }; Write-Host ('Ronyka Vectorizer is up to date: v{0}' -f $local); exit 0 } catch { Write-Warning ('Could not check for vectorizer updates: ' + $_.Exception.Message); exit 20 }"
set "UPDATE_STATUS=%errorlevel%"

:: Update the complete project when GitHub publishes a newer vectorizer version.
if "%UPDATE_STATUS%"=="10" (
    echo Installing the new Ronyka Vectorizer version...
    call npm run update
    if errorlevel 1 (
        echo The update failed. The Vectorizer was not started.
        pause
        exit /b 1
    )
    call npm --prefix vectorizer ci
    if errorlevel 1 (
        echo The Vectorizer dependency installation failed.
        pause
        exit /b 1
    )
) else if not "%UPDATE_STATUS%"=="0" (
    echo Continuing with the installed Vectorizer version.
)

:: Install locked vectorizer dependencies for a fresh or incomplete installation.
if not exist "vectorizer\node_modules" (
    echo Installing Ronyka Vectorizer dependencies...
    call npm --prefix vectorizer ci
    if errorlevel 1 (
        echo The Vectorizer dependency installation failed.
        pause
        exit /b 1
    )
)

:: Reuse an existing Vectorizer server when one is already responding.
curl -fsS http://localhost:4174/ >nul 2>&1
if not errorlevel 1 (
    echo The Ronyka Vectorizer server is already running.
    goto :open_browser
)

:: Start npm in a separate terminal so this launcher can continue.
echo Starting the Ronyka Vectorizer server...
start "Ronyka Vectorizer Server" cmd /k "npm --prefix vectorizer start"

:: Wait up to 30 seconds for the Vectorizer server to become available.
echo Waiting for the Vectorizer server...
for /l %%I in (1,1,30) do (
    curl -fsS http://localhost:4174/ >nul 2>&1
    if not errorlevel 1 goto :open_browser
    timeout /t 1 /nobreak >nul
)

echo The Ronyka Vectorizer server did not start within 30 seconds.
pause
exit /b 1

:open_browser
:: Open the Vectorizer in the default Windows browser.
echo Opening Ronyka Vectorizer...
start "" "http://localhost:4174/"

endlocal
exit /b 0
