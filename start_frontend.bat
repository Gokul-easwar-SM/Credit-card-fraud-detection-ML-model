@echo off
title FraudSentinel Frontend App
echo ====================================================
echo Starting FraudSentinel React + Vite Frontend on Port 5173
echo ====================================================
cd /d "%~dp0fraudsentinel-frontend"
npm run dev
pause
