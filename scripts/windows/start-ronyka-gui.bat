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
powershell -NoProfile -Command "$ErrorActionPreference = 'Stop'; try { $local = [version]((Get-Content -Raw 'package.json' | ConvertFrom-Json).version); $remote = [version]((Invoke-RestMethod 'https://raw.githubusercontent.com/jbarreto/image-panel-splitter/main/package.json').version); if ($remote -gt $local) { Write-Host ('Update available: v{0} -> v{1}' -f $local, $remote); exit 10 }; Write-Host ('Already up to date: v{0}' -f $local); exit 0 } catch { Write-Warning ('Could not check for updates: ' + $_.Exception.Message); exit 20 }"
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

:: Start the GUI whether the installation was current or just updated.
echo Starting the Ronyka Panel Splitter GUI...
call npm run gui

if errorlevel 1 (
    echo The GUI stopped with an error.
    pause
    exit /b 1
)

endlocal
