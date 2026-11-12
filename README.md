# 🎧 AudioBook Reader App

A modern, mobile-friendly web app to upload PDFs and listen to them like an audiobook with original PDF layout rendering, live sentence highlighting, voice selection, speed controls, sleep timer, chapters, bookmarks, and MP3 export.

## ✨ Features
- **📄 Original PDF Look (Default View)**: Renders the genuine PDF document with its full visual design, typography, illustrations, charts, and multi-column layouts using high-definition canvas rendering.
- **✨ Real-Time Highlighting on the Original Page**: Sentences on the authentic PDF page illuminate with a golden highlight in sync with the audio narration.
- **🔍 Zoom & Fit-to-Width**: Zoom in, zoom out, or auto-fit the original PDF page to your phone screen.
- **📖 Dual-Mode Switcher**: Toggle anytime between **"📄 Original"** (true PDF visual look) and **"📖 Text"** (clean reflowed reader mode for small screens).
- **Audiobook Controls**: Play, Pause, Resume, Stop, Next/Previous sentence.
- **Click to Read**: Tap on any sentence or word on the original PDF page to jump narration straight to it.
- **🌙 Sleep Timer**: Set a timer for 5 min, 15 min, 30 min, 45 min, 1 hour, or **End of Current Page** with live countdown badge.
- **🔖 Auto-Save & Bookmarks**: Automatically remembers your exact page and sentence; prompts you to resume where you left off. Bookmark favorite passages with one tap.
- **📑 Chapters & Table of Contents**: Slides open an outline drawer displaying all PDF chapters for instant jumping.
- **🎨 Reading Themes**: Switch between **Dark**, **OLED Black** (AMOLED battery saver), **Sepia / Warm Paper**, **Midnight Blue**, and **Light Mode**.
- **💾 Export to MP3**: Convert and download the current page or passage as a real `.mp3` audio file to listen offline in any media player.
- **🎧 Lock Screen & Bluetooth Headset Controls**: Supports the `MediaSession` API for control from phone lock screen and earbuds.
- **Zero Package Installations**: Runs 100% locally with Python's built-in web server.

## 🚀 How to Run
In Termux:
```bash
python3 server.py
```
Then open [http://localhost:8080](http://localhost:8080) in your phone's browser.
