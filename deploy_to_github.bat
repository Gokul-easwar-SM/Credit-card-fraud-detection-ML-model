@echo off
title Push FraudSentinel to GitHub for Render Deployment
echo ====================================================
echo  FraudSentinel - GitHub Push Helper for Render
echo ====================================================
echo.
echo Make sure you have created an empty repository on GitHub first!
echo (e.g., https://github.com/Navitha22007/FraudSentinel)
echo.
set /p REPO_URL="Enter your GitHub Repository URL: "

if "%REPO_URL%"=="" (
    echo Error: Repository URL cannot be empty.
    pause
    exit /b
)

echo.
echo Setting up remote and pushing to branch 'main'...
git remote remove origin 2>nul
git remote add origin %REPO_URL%
git branch -M main
git push -u origin main

if %ERRORLEVEL% equ 0 (
    echo.
    echo ====================================================
    echo  SUCCESS! Code pushed to GitHub!
    echo ====================================================
    echo Now open Render Dashboard (https://dashboard.render.com):
    echo 1. Click 'Blueprints' -> 'New Blueprint Instance'.
    echo 2. Select this repository.
    echo 3. Click 'Apply' to deploy both Backend and Frontend!
    echo ====================================================
) else (
    echo.
    echo Error during push. Please check your GitHub permissions and URL.
)

pause
