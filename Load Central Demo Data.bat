@echo off
rem Adds demo accounts and reportees to the running CENTRAL Team Desk (Windows).
title Team Desk central demo data
cd /d "%~dp0"
node scripts\seed-central.js %*
pause
