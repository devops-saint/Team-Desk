@echo off
rem Central Team Desk demo, case 1: administrator + one user who is line manager AND people manager.
title Team Desk central demo - case 1
cd /d "%~dp0"
set /p ADMIN=Your administrator email (press Enter if you have not registered one yet): 
if "%ADMIN%"=="" (node scripts\seed-central.js --scenario both %*) else (node scripts\seed-central.js --scenario both --admin-email "%ADMIN%" %*)
pause
