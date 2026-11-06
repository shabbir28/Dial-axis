@echo off
cd /d "%~dp0"
echo DialAxis - http://localhost:5100
echo Keep this window open. Press Ctrl+C to stop.
node backend\src\index.js
pause
