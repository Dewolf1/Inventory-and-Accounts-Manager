@echo off
title Spy Garments Wholesale System
setlocal

:: Get the current directory
set "DIR=%~dp0"

echo.
echo  =========================================
echo    SPY GARMENTS WHOLESALE SYSTEM
echo  =========================================
echo.
echo  Launching the application...
echo.

:: Try opening in Microsoft Edge "App Mode" for a software-like feel
:: We use the full local path which is more reliable than the file:/// protocol in batch
start "" msedge --app="%DIR%index.html"

:: Check if the previous command succeeded. 
:: If Edge isn't found or fails, we fall back to the default browser.
if %ERRORLEVEL% NEQ 0 (
    echo  Edge App Mode failed, opening in default browser...
    start "" "%DIR%index.html"
)

echo  Application launched successfully!
echo  This window will close in 3 seconds.

timeout /t 3 > nul
exit
