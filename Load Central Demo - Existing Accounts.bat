@echo off
rem Central Team Desk demo for accounts that already exist: gives one of the two demo teams to an existing line manager.
title Team Desk central demo - existing accounts
cd /d "%~dp0"
echo Demo team 1: Asha, Rohan, Neha, Priya, Vikram, Arjun
echo Demo team 2: Divya, Karthik, Sneha, Ananya, Farhan, Nikhil
set /p ADMIN=Administrator email: 
set DS=1
set /p DS=Which demo team, 1 or 2? 
set /p LM=Line manager email to give it to: 
node scripts\seed-central.js --admin-email "%ADMIN%" --dataset %DS% --email "%LM%" %*
pause
