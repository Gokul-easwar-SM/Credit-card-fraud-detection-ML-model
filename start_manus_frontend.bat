@echo off
title FraudSentinel Manus Frontend App
echo ====================================================
echo Starting FraudSentinel Manus Frontend on Port 5173
echo ====================================================
cd /d "%~dp0fraudsentinel-frontend"
npm run dev
pause
