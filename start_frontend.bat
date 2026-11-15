@echo off
title FraudSentinel Frontend App
echo ====================================================
echo Starting FraudSentinel React + Vite Frontend on Port 5173
echo ====================================================
if exist "%~dp0fraudsentinel-frontend" (
    cd /d "%~dp0fraudsentinel-frontend"
) else (
    cd /d "%~dp0frontend"
)
npm run dev
pause
