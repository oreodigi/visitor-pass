@echo off
setlocal
cd /d "%~dp0"

if not exist ".env" (
  echo Missing .env file.
  echo Copy env.example to .env and fill APP_URL, RUNNER_TOKEN, and EVENT_ID.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing runner dependencies. This runs only once.
  npm install
  if errorlevel 1 (
    echo Dependency install failed.
    pause
    exit /b 1
  )
)

npm start
pause
