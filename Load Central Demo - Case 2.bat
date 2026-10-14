@echo off
rem Central Team Desk demo, case 2: administrator + one user who is only a line manager.
title Team Desk central demo - case 2
cd /d "%~dp0"
set /p ADMIN=Your administrator email (press Enter if you have not registered one yet): 
if "%ADMIN%"=="" (node scripts\seed-central.js --scenario lm %*) else (node scripts\seed-central.js --scenario lm --admin-email "%ADMIN%" %*)
pause
