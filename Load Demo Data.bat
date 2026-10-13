@echo off
rem Adds demo reportees to the running Team Desk (Windows). Double-click while Team Desk is running.
title Team Desk demo data
cd /d "%~dp0"
node scripts\seed-demo.js %*
pause
