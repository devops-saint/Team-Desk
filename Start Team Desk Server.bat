@echo off
rem Starts the CENTRAL (multi-user) Team Desk on this machine (Windows).
title Team Desk server
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 18 or newer is required. Install it from https://nodejs.org & pause & exit /b 1)
node server\central.js %*
pause
