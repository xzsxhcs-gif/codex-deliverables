@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo 需要 Python 3.10 或更新版本：https://www.python.org/downloads/
  echo 安装时勾选 Add Python to PATH，然后重新打开本脚本。
  goto :failed
)
python -c "import sys; sys.exit(int(sys.version_info[:2] < (3,10)))"
if errorlevel 1 (
  echo 当前 Python 版本过旧，需要 Python 3.10 或更新版本。
  goto :failed
)
where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo 未找到 FFmpeg。请从 https://ffmpeg.org/download.html 安装，并将 bin 目录加入 PATH。
  goto :failed
)
where ffprobe >nul 2>nul
if errorlevel 1 (
  echo 未找到 ffprobe，请将完整 FFmpeg 工具的 bin 目录加入 PATH。
  goto :failed
)

if not exist ".venv\Scripts\python.exe" (
  python -m venv .venv
  if errorlevel 1 goto :failed
)
set "FILM_PY=%CD%\.venv\Scripts\python.exe"
"%FILM_PY%" -c "import numpy, scipy, PIL, playwright" >nul 2>nul
if errorlevel 1 (
  echo 正在安装本工程的免费 Python 依赖……
  "%FILM_PY%" -m pip install -r "source\requirements.txt"
  if errorlevel 1 goto :failed
)
echo 正在检查 Playwright Chromium 浏览器；首次使用可能需要下载。
"%FILM_PY%" -m playwright install chromium
if errorlevel 1 goto :failed

"%FILM_PY%" "source\prepare_music.py"
if errorlevel 1 goto :failed
"%FILM_PY%" "source\render_film.py" %*
if errorlevel 1 goto :failed
echo.
echo 完成。请查看上方显示的输出文件位置。
if "%~1"=="" pause
exit /b 0

:failed
echo.
echo 未完成渲染。请根据上面的错误修复环境后重试；已完成的渲染分段会保留。
pause
exit /b 1
