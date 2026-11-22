@echo off
title FraudSentinel - Bank-Side Real-Time Fraud Prevention System
echo ======================================================================
echo    Starting FraudSentinel (Backend API + React/Vite Frontend)
echo ======================================================================
echo.
echo 1. Launching FastAPI Backend on http://localhost:8000 ...
start "FraudSentinel Backend API" cmd /k "cd /d %~dp0backend && call ..\.venv\Scripts\activate.bat && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 3 /nobreak >nul

echo 2. Launching React + Vite Frontend on http://localhost:5173 ...
start "FraudSentinel Frontend" cmd /k "cd /d %~dp0fraudsentinel-frontend && npm run dev"

echo.
echo ======================================================================
echo  FraudSentinel is starting up!
echo.
echo  - Frontend Portal:        http://localhost:5173
echo  - Bank Switch Simulator:  http://localhost:5173/simulator
echo  - Analyst Radar / Live:   http://localhost:5173/analyst/live
echo  - Backend API & Docs:     http://localhost:8000/docs
echo.
echo  Analyst Login: analyst / analyst123
echo ======================================================================
timeout /t 5 >nul
start http://localhost:5173/analyst/live
start http://localhost:5173/simulator
