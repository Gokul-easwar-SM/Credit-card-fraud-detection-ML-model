@echo off
title FraudSentinel Backend API (In-Memory Fast Engine)
echo ====================================================
echo Starting FraudSentinel FastAPI Backend on Port 8000
echo Storage Mode: Fast In-Memory Store (Zero Database Locks)
echo ====================================================
cd /d "%~dp0backend"
call "..\.venv\Scripts\activate.bat"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
