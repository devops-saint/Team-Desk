@echo off
rem Team Desk launcher for Windows. Double-click to start.
title Team Desk
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or newer is required. Install it from https://nodejs.org and try again.
  pause
  exit /b 1
)
node server\server.js %*
if errorlevel 1 pause
