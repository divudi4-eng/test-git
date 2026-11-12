// AudioBook Reader Application
(() => {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // State
  let pdfDoc = null;
  let currentPageNum = 1;
  let totalPages = 0;
  let currentFileName = '';
  let sentences = [];
  let spanRanges = [];
  let currentSentenceIndex = -1;
  let isPlaying = false;
  let isPaused = false;
  let currentUtterance = null;
  let currentAudioEl = null;
  let availableVoices = [];
  let baseFontSize = 1.15;

  // View state: 'original' or 'reader'
  let currentView = localStorage.getItem('ab_view_mode') || 'original';
  let pdfScale = 1.0;
  let originalViewport = null;
  let renderPageTask = null;

  // Sleep Timer state
  let timerRemainingSecs = 0;
  let timerInterval = null;
  let stopAtEndOfPage = false;

  // Settings
  let settings = {
    theme: localStorage.getItem('ab_theme') || 'dark',
    voiceURI: localStorage.getItem('ab_voiceURI') || '',
    rate: parseFloat(localStorage.getItem('ab_rate')) || 1.0,
    pitch: parseFloat(localStorage.getItem('ab_pitch')) || 1.0,
    autoAdvance: localStorage.getItem('ab_autoAdvance') !== 'false',
    fontSize: parseFloat(localStorage.getItem('ab_fontSize')) || 1.15
  };

  // DOM Elements
  const pdfUpload = document.getElementById('pdf-upload');
  const bookTitleEl = document.getElementById('book-title');
  const pageIndicatorEl = document.getElementById('page-indicator');
  const emptyStateEl = document.getElementById('empty-state');
  const loadingStateEl = document.getElementById('loading-state');
  const loadingTextEl = document.getElementById('loading-text');
  const contentContainer = document.getElementById('content-container');
  const pageNavBar = document.getElementById('page-nav-bar');
  const btnPrevPage = document.getElementById('btn-prev-page');
  const btnNextPage = document.getElementById('btn-next-page');
  const inputPageNum = document.getElementById('input-page-num');
  const labelTotalPages = document.getElementById('label-total-pages');

  // Views & Containers
  const originalPdfWrapper = document.getElementById('original-pdf-wrapper');
  const pdfPageContainer = document.getElementById('pdf-page-container');
  const pdfCanvas = document.getElementById('pdf-canvas');
  const pdfTextLayer = document.getElementById('pdf-text-layer');
  const textDisplayEl = document.getElementById('text-display');

  // View Switcher & Zoom
  const btnViewOriginal = document.getElementById('btn-view-original');
  const btnViewReader = document.getElementById('btn-view-reader');
  const zoomControls = document.getElementById('zoom-controls');
  const fontControls = document.getElementById('font-controls');
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomFit = document.getElementById('btn-zoom-fit');
  const btnFontInc = document.getElementById('btn-font-inc');
  const btnFontDec = document.getElementById('btn-font-dec');

  // Player controls
  const btnPlayPause = document.getElementById('btn-play-pause');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const btnStop = document.getElementById('btn-stop');
  const btnPrevSentence = document.getElementById('btn-prev-sentence');
  const btnNextSentence = document.getElementById('btn-next-sentence');
  const progressContainer = document.getElementById('progress-container');
  const progressFill = document.getElementById('progress-fill');

  // Settings & Theme
  const btnSettingsToggle = document.getElementById('btn-settings-toggle');
  const settingsDrawer = document.getElementById('settings-drawer');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const selectVoice = document.getElementById('select-voice');
  const rangeSpeed = document.getElementById('range-speed');
  const labelSpeed = document.getElementById('label-speed');
  const rangePitch = document.getElementById('range-pitch');
  const labelPitch = document.getElementById('label-pitch');
  const toggleAutoAdvance = document.getElementById('toggle-auto-advance');
  const speedPresetButtons = document.querySelectorAll('.btn-preset-speed');
  const btnThemeSelect = document.getElementById('btn-theme-select');
  const themeMenu = document.getElementById('theme-menu');
  const themeItems = document.querySelectorAll('.theme-item');

  // Resume Banner
  const resumeBanner = document.getElementById('resume-banner');
  const resumeText = document.getElementById('resume-text');
  const btnResumeYes = document.getElementById('btn-resume-yes');
  const btnResumeNo = document.getElementById('btn-resume-no');
  let pendingResumeData = null;

  // Sidebar (Chapters & Bookmarks)
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const sidebarDrawer = document.getElementById('sidebar-drawer');
  const btnCloseSidebar = document.getElementById('btn-close-sidebar');
  const tabBtnChapters = document.getElementById('tab-btn-chapters');
  const tabBtnBookmarks = document.getElementById('tab-btn-bookmarks');
  const paneChapters = document.getElementById('pane-chapters');
  const paneBookmarks = document.getElementById('pane-bookmarks');
  const chaptersList = document.getElementById('chapters-list');
  const bookmarksList = document.getElementById('bookmarks-list');
  const btnAddBookmark = document.getElementById('btn-add-bookmark');

  // Sleep Timer
  const btnSleepTimer = document.getElementById('btn-sleep-timer');
  const timerBadge = document.getElementById('badge-timer');
  const timerModalBackdrop = document.getElementById('timer-modal-backdrop');
  const btnCloseTimerModal = document.getElementById('btn-close-timer-modal');
  const timerOptions = document.querySelectorAll('.btn-timer-option');

  // Export Audio
  const btnExportAudio = document.getElementById('btn-export-audio');
  const exportModalBackdrop = document.getElementById('export-modal-backdrop');
  const btnCloseExportModal = document.getElementById('btn-close-export-modal');
  const exportStatusText = document.getElementById('export-status-text');
  const exportSpinner = document.getElementById('export-spinner');
  const exportActions = document.getElementById('export-actions');
  const btnDownloadMp3 = document.getElementById('btn-download-mp3');

  // --------------------------------------------------------------------------
  // Theme Engine
  // --------------------------------------------------------------------------
  function applyTheme(themeName) {
    settings.theme = themeName;
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('ab_theme', themeName);
    themeItems.forEach((btn) => {
      if (btn.dataset.theme === themeName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  btnThemeSelect.addEventListener('click', (e) => {
    e.stopPropagation();
    themeMenu.style.display = themeMenu.style.display === 'none' ? 'flex' : 'none';
  });

  themeItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.theme);
      themeMenu.style.display = 'none';
    });
  });

  document.addEventListener('click', () => {
    themeMenu.style.display = 'none';
  });

  // --------------------------------------------------------------------------
  // View Switcher (Original PDF vs Reader Mode)
  // --------------------------------------------------------------------------
  function setViewMode(mode) {
    currentView = mode;
    localStorage.setItem('ab_view_mode', mode);

    if (mode === 'original') {
      btnViewOriginal.classList.add('active');
      btnViewReader.classList.remove('active');
      zoomControls.style.display = 'flex';
      fontControls.style.display = 'none';

      textDisplayEl.style.display = 'none';
      if (pdfDoc) {
        originalPdfWrapper.style.display = 'flex';
        renderCurrentPageOriginal();
      }
    } else {
      btnViewReader.classList.add('active');
      btnViewOriginal.classList.remove('active');
      zoomControls.style.display = 'none';
      fontControls.style.display = 'flex';

      originalPdfWrapper.style.display = 'none';
      if (pdfDoc) {
        textDisplayEl.style.display = 'block';
        highlightSentence(currentSentenceIndex);
      }
    }
  }

  btnViewOriginal.addEventListener('click', () => setViewMode('original'));
  btnViewReader.addEventListener('click', () => setViewMode('reader'));

  // Zoom handlers for Original PDF
  btnZoomIn.addEventListener('click', () => {
    pdfScale = Math.min(3.5, pdfScale + 0.25);
    renderCurrentPageOriginal();
  });

  btnZoomOut.addEventListener('click', () => {
    pdfScale = Math.max(0.5, pdfScale - 0.25);
    renderCurrentPageOriginal();
  });

  btnZoomFit.addEventListener('click', () => {
    fitPdfToWidth();
    renderCurrentPageOriginal();
  });

  function fitPdfToWidth() {
    if (!originalViewport) return;
    const availableWidth = Math.min(contentContainer.clientWidth - 20, 900);
    pdfScale = availableWidth / originalViewport.width;
  }

  // --------------------------------------------------------------------------
  // Mobile Touch Gestures: Pinch-to-Zoom, Pan, and Double-Tap
  // --------------------------------------------------------------------------
  let touchStartDist = 0;
  let touchStartScale = 1.0;
  let currentPinchFactor = 1.0;
  let isPinching = false;
  let justPinchZoomed = false;
  let lastTapTime = 0;

  function initTouchGestures() {
    if (!originalPdfWrapper) return;

    originalPdfWrapper.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        isPinching = true;
        justPinchZoomed = true;
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchStartScale = pdfScale;
        currentPinchFactor = 1.0;
      } else if (e.touches.length === 1) {
        if (justPinchZoomed) return;
        const now = Date.now();
        if (now - lastTapTime < 350) {
          e.preventDefault();
          handleDoubleTap();
          lastTapTime = 0;
        } else {
          lastTapTime = now;
        }
      }
    }, { passive: false });

    originalPdfWrapper.addEventListener('touchmove', (e) => {
      if (isPinching && e.touches.length === 2) {
        e.preventDefault();
        const currentDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (touchStartDist > 10) {
          currentPinchFactor = currentDist / touchStartDist;
          pdfScale = Math.min(3.5, Math.max(0.5, touchStartScale * currentPinchFactor));
          pdfPageContainer.style.transform = `scale(${currentPinchFactor})`;
        }
      }
    }, { passive: false });

    originalPdfWrapper.addEventListener('touchend', (e) => {
      if (isPinching && e.touches.length < 2) {
        isPinching = false;
        pdfPageContainer.style.transform = '';
        pdfScale = Math.min(3.5, Math.max(0.5, touchStartScale * currentPinchFactor));
        renderCurrentPageOriginal();

        // Lock out double-tap triggers for 500ms after lifting fingers
        setTimeout(() => {
          justPinchZoomed = false;
        }, 500);
      }
    });

    originalPdfWrapper.addEventListener('touchcancel', () => {
      if (isPinching) {
        isPinching = false;
        pdfPageContainer.style.transform = '';
        renderCurrentPageOriginal();
        setTimeout(() => { justPinchZoomed = false; }, 500);
      }
    });
  }

  function handleDoubleTap() {
    if (!originalViewport) return;
    const fitScale = (Math.min(contentContainer.clientWidth - 20, 900)) / originalViewport.width;
    if (pdfScale > fitScale * 1.25) {
      pdfScale = fitScale;
    } else {
      pdfScale = Math.min(3.0, fitScale * 1.75);
    }
    renderCurrentPageOriginal();
  }

  // --------------------------------------------------------------------------
  // Sleep Timer
  // --------------------------------------------------------------------------
  btnSleepTimer.addEventListener('click', () => {
    timerModalBackdrop.style.display = 'flex';
  });

  btnCloseTimerModal.addEventListener('click', () => {
    timerModalBackdrop.style.display = 'none';
  });

  timerModalBackdrop.addEventListener('click', (e) => {
    if (e.target === timerModalBackdrop) {
      timerModalBackdrop.style.display = 'none';
    }
  });

  timerOptions.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mins = btn.dataset.mins;
      setSleepTimer(mins);
      timerModalBackdrop.style.display = 'none';
    });
  });

  function setSleepTimer(mins) {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    stopAtEndOfPage = false;

    if (mins === '0') {
      timerRemainingSecs = 0;
      timerBadge.style.display = 'none';
      return;
    }

    if (mins === 'end_page') {
      stopAtEndOfPage = true;
      timerBadge.textContent = 'End Page';
      timerBadge.style.display = 'inline-block';
      return;
    }

    timerRemainingSecs = parseInt(mins, 10) * 60;
    updateTimerBadge();
    timerBadge.style.display = 'inline-block';

    timerInterval = setInterval(() => {
      timerRemainingSecs--;
      if (timerRemainingSecs <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        timerBadge.style.display = 'none';
        stopSpeaking();
      } else {
        updateTimerBadge();
      }
    }, 1000);
  }

  function updateTimerBadge() {
    const m = Math.floor(timerRemainingSecs / 60);
    const s = timerRemainingSecs % 60;
    timerBadge.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // --------------------------------------------------------------------------
  // MediaSession API (Lock screen & bluetooth headset controls)
  // --------------------------------------------------------------------------
  function updateMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentFileName || 'AudioBook',
        artist: 'AudioBook Reader',
        album: `Page ${currentPageNum} of ${totalPages}`
      });

      navigator.mediaSession.setActionHandler('play', () => togglePlayPause());
      navigator.mediaSession.setActionHandler('pause', () => togglePlayPause());
      navigator.mediaSession.setActionHandler('previoustrack', () => prevSentence());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextSentence());
    }
  }

  // --------------------------------------------------------------------------
  // Voice & Speech Initialization
  // --------------------------------------------------------------------------
  function initVoices() {
    const loadVoices = () => {
      availableVoices = ('speechSynthesis' in window) ? window.speechSynthesis.getVoices() : [];
      selectVoice.innerHTML = '';

      // Option 1: Ultra High Definition Natural Voice (Google HD Online Streaming)
      const hdOption = document.createElement('option');
      hdOption.value = 'hd-natural-google';
      hdOption.textContent = '🌟 Natural Studio Voice (Google HD Online)';
      selectVoice.appendChild(hdOption);

      // Option 2: Default System Voice
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = '📱 Default System Voice (Offline Device)';
      selectVoice.appendChild(defaultOption);

      // Sort voices prioritizing Natural / Google / Enhanced voices
      const sorted = [...availableVoices].sort((a, b) => {
        const aIsNatural = /google|natural|premium|neural|enhanced/i.test(a.name) || /google|natural/i.test(a.voiceURI);
        const bIsNatural = /google|natural|premium|neural|enhanced/i.test(b.name) || /google|natural/i.test(b.voiceURI);
        if (aIsNatural && !bIsNatural) return -1;
        if (!aIsNatural && bIsNatural) return 1;

        if (a.lang.startsWith('en') && !b.lang.startsWith('en')) return -1;
        if (!a.lang.startsWith('en') && b.lang.startsWith('en')) return 1;
        return a.name.localeCompare(b.name);
      });

      // Auto-select HD Natural Voice if no preference is saved yet
      if (!settings.voiceURI) {
        settings.voiceURI = 'hd-natural-google';
        localStorage.setItem('ab_voiceURI', settings.voiceURI);
      }

      if (settings.voiceURI === 'hd-natural-google') {
        hdOption.selected = true;
      } else if (settings.voiceURI === '') {
        defaultOption.selected = true;
      }

      sorted.forEach((voice) => {
        const option = document.createElement('option');
        option.value = voice.voiceURI;
        const isHighQuality = /google|natural|premium|neural|enhanced/i.test(voice.name) || /google|natural/i.test(voice.voiceURI);
        const tag = isHighQuality ? ' ⭐ (Device High Quality)' : '';
        option.textContent = `${voice.name} (${voice.lang})${tag}`;
        if (voice.voiceURI === settings.voiceURI) option.selected = true;
        selectVoice.appendChild(option);
      });
    };

    loadVoices();
    if ('speechSynthesis' in window && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  function restoreSettingsUI() {
    applyTheme(settings.theme);
    setViewMode(currentView);
    rangeSpeed.value = settings.rate;
    labelSpeed.textContent = `${settings.rate.toFixed(2)}x`;
    rangePitch.value = settings.pitch;
    labelPitch.textContent = settings.pitch.toFixed(1);
    toggleAutoAdvance.checked = settings.autoAdvance;
    baseFontSize = settings.fontSize;
    textDisplayEl.style.fontSize = `${baseFontSize}rem`;

    updateSpeedPresetButtons(settings.rate);
  }

  function updateSpeedPresetButtons(activeRate) {
    speedPresetButtons.forEach((btn) => {
      const speed = parseFloat(btn.dataset.speed);
      if (Math.abs(speed - activeRate) < 0.05) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // --------------------------------------------------------------------------
  // PDF Upload & Outline / TOC extraction
  // --------------------------------------------------------------------------
  pdfUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    currentFileName = file.name;
    bookTitleEl.textContent = currentFileName;

    emptyStateEl.style.display = 'none';
    originalPdfWrapper.style.display = 'none';
    textDisplayEl.style.display = 'none';
    loadingStateEl.style.display = 'flex';
    loadingTextEl.textContent = 'Opening PDF document...';

    stopSpeaking();

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
      pdfDoc = await loadingTask.promise;
      totalPages = pdfDoc.numPages;
      currentPageNum = 1;

      inputPageNum.max = totalPages;
      labelTotalPages.textContent = `/ ${totalPages}`;
      pageNavBar.style.display = 'flex';

      loadTableOfContents();
      renderBookmarksList();
      checkResumeState();

      await loadAndDisplayPage(currentPageNum);
    } catch (err) {
      console.error('Error loading PDF:', err);
      alert('Could not parse PDF. Please ensure it is a readable PDF file.');
      loadingStateEl.style.display = 'none';
      emptyStateEl.style.display = 'flex';
    }
  });

  async function loadTableOfContents() {
    chaptersList.innerHTML = '';
    try {
      const outline = await pdfDoc.getOutline();
      if (!outline || !outline.length) {
        chaptersList.innerHTML = '<p class="empty-list-notice">No table of contents in this PDF.</p>';
        return;
      }

      for (const item of outline) {
        const itemEl = document.createElement('div');
        itemEl.className = 'chapter-item';
        itemEl.textContent = item.title;

        itemEl.addEventListener('click', async () => {
          let targetPage = 1;
          if (typeof item.dest === 'string') {
            const dest = await pdfDoc.getDestination(item.dest);
            if (dest) {
              const pageIndex = await pdfDoc.getPageIndex(dest[0]);
              targetPage = pageIndex + 1;
            }
          } else if (Array.isArray(item.dest)) {
            const pageIndex = await pdfDoc.getPageIndex(item.dest[0]);
            targetPage = pageIndex + 1;
          }

          closeSidebar();
          loadAndDisplayPage(targetPage);
        });

        chaptersList.appendChild(itemEl);
      }
    } catch (e) {
      chaptersList.innerHTML = '<p class="empty-list-notice">Could not read chapters.</p>';
    }
  }

  // --------------------------------------------------------------------------
  // Auto-Save & Resume Feature
  // --------------------------------------------------------------------------
  function saveCurrentPosition() {
    if (!currentFileName) return;
    const saveState = {
      page: currentPageNum,
      sentenceIdx: currentSentenceIndex >= 0 ? currentSentenceIndex : 0,
      timestamp: Date.now()
    };
    localStorage.setItem(`ab_save_${currentFileName}`, JSON.stringify(saveState));
  }

  function checkResumeState() {
    const raw = localStorage.getItem(`ab_save_${currentFileName}`);
    if (!raw) return;

    try {
      const data = JSON.parse(raw);
      if (data && (data.page > 1 || data.sentenceIdx > 0)) {
        pendingResumeData = data;
        resumeText.textContent = `Resume reading from Page ${data.page}, sentence ${data.sentenceIdx + 1}?`;
        resumeBanner.style.display = 'flex';
      }
    } catch (e) {}
  }

  btnResumeYes.addEventListener('click', () => {
    resumeBanner.style.display = 'none';
    if (pendingResumeData) {
      loadAndDisplayPage(pendingResumeData.page).then(() => {
        playSentence(pendingResumeData.sentenceIdx);
      });
      pendingResumeData = null;
    }
  });

  btnResumeNo.addEventListener('click', () => {
    resumeBanner.style.display = 'none';
    pendingResumeData = null;
  });

  // --------------------------------------------------------------------------
  // Bookmarks Manager
  // --------------------------------------------------------------------------
  function getBookmarks() {
    if (!currentFileName) return [];
    try {
      return JSON.parse(localStorage.getItem(`ab_bkm_${currentFileName}`) || '[]');
    } catch {
      return [];
    }
  }

  function saveBookmarks(bArray) {
    if (!currentFileName) return;
    localStorage.setItem(`ab_bkm_${currentFileName}`, JSON.stringify(bArray));
    renderBookmarksList();
  }

  btnAddBookmark.addEventListener('click', () => {
    if (!sentences.length) return;
    const bArray = getBookmarks();
    const idx = currentSentenceIndex >= 0 ? currentSentenceIndex : 0;
    const rawItem = sentences[idx];
    const textPreview = (typeof rawItem === 'object' ? rawItem.text : rawItem) || `Page ${currentPageNum}`;

    const newBookmark = {
      id: Date.now(),
      page: currentPageNum,
      sentenceIdx: idx,
      text: textPreview.slice(0, 70) + (textPreview.length > 70 ? '...' : ''),
      created: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    bArray.push(newBookmark);
    saveBookmarks(bArray);

    btnAddBookmark.style.color = 'var(--accent-color)';
    setTimeout(() => { btnAddBookmark.style.color = ''; }, 1200);
  });

  function renderBookmarksList() {
    bookmarksList.innerHTML = '';
    const bArray = getBookmarks();
    if (!bArray.length) {
      bookmarksList.innerHTML = '<p class="empty-list-notice">No bookmarks yet. Tap the bookmark icon to save a place!</p>';
      return;
    }

    bArray.forEach((b) => {
      const item = document.createElement('div');
      item.className = 'bookmark-item';

      const info = document.createElement('div');
      info.className = 'bookmark-info';
      info.innerHTML = `
        <span class="bookmark-title">Page ${b.page} (${b.created})</span>
        <span class="bookmark-preview">${b.text}</span>
      `;
      info.addEventListener('click', () => {
        closeSidebar();
        loadAndDisplayPage(b.page).then(() => {
          playSentence(b.sentenceIdx);
        });
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'bookmark-del';
      delBtn.innerHTML = '&times;';
      delBtn.title = 'Delete bookmark';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const updated = bArray.filter((x) => x.id !== b.id);
        saveBookmarks(updated);
      });

      item.appendChild(info);
      item.appendChild(delBtn);
      bookmarksList.appendChild(item);
    });
  }

  // --------------------------------------------------------------------------
  // Sidebar Handlers
  // --------------------------------------------------------------------------
  btnToggleSidebar.addEventListener('click', openSidebar);
  btnCloseSidebar.addEventListener('click', closeSidebar);
  sidebarBackdrop.addEventListener('click', closeSidebar);

  function openSidebar() {
    sidebarDrawer.classList.add('open');
    sidebarBackdrop.style.display = 'block';
  }

  function closeSidebar() {
    sidebarDrawer.classList.remove('open');
    sidebarBackdrop.style.display = 'none';
  }

  tabBtnChapters.addEventListener('click', () => {
    tabBtnChapters.classList.add('active');
    tabBtnBookmarks.classList.remove('active');
    paneChapters.classList.add('active');
    paneBookmarks.classList.remove('active');
  });

  tabBtnBookmarks.addEventListener('click', () => {
    tabBtnBookmarks.classList.add('active');
    tabBtnChapters.classList.remove('active');
    paneBookmarks.classList.add('active');
    paneChapters.classList.remove('active');
  });

  // --------------------------------------------------------------------------
  // Page Extraction & Rendering
  // --------------------------------------------------------------------------
  let currentPageObject = null;
  let currentPageTextContent = null;

  async function loadAndDisplayPage(pageNum) {
    if (!pdfDoc) return;

    stopSpeaking();
    loadingStateEl.style.display = 'flex';
    loadingTextEl.textContent = `Rendering page ${pageNum} of ${totalPages}...`;
    originalPdfWrapper.style.display = 'none';
    textDisplayEl.style.display = 'none';

    currentPageNum = pageNum;
    inputPageNum.value = pageNum;
    pageIndicatorEl.textContent = `Page ${pageNum} of ${totalPages}`;
    btnPrevPage.disabled = (pageNum <= 1);
    btnNextPage.disabled = (pageNum >= totalPages);

    updateMediaSession();

    try {
      currentPageObject = await pdfDoc.getPage(pageNum);
      originalViewport = currentPageObject.getViewport({ scale: 1.0 });

      // Automatically compute scale to fit screen
      fitPdfToWidth();

      currentPageTextContent = await currentPageObject.getTextContent();

      // Render the original canvas and TextLayer (which extracts and segments sentences)
      await renderCurrentPageOriginal();

      loadingStateEl.style.display = 'none';

      if (currentView === 'original') {
        originalPdfWrapper.style.display = 'flex';
        textDisplayEl.style.display = 'none';
      } else {
        originalPdfWrapper.style.display = 'none';
        textDisplayEl.style.display = 'block';
      }

      contentContainer.scrollTop = 0;
      updateProgress(0);
      saveCurrentPosition();
    } catch (err) {
      console.error(`Error loading page ${pageNum}:`, err);
      loadingStateEl.style.display = 'none';
    }
  }

  // Render the Original PDF Canvas & TextLayer
  async function renderCurrentPageOriginal() {
    if (!currentPageObject || !pdfDoc) return;

    if (renderPageTask) {
      renderPageTask.cancel();
    }

    const viewport = currentPageObject.getViewport({ scale: pdfScale });

    // Size canvas
    pdfCanvas.width = viewport.width;
    pdfCanvas.height = viewport.height;
    pdfPageContainer.style.width = `${viewport.width}px`;
    pdfPageContainer.style.height = `${viewport.height}px`;

    const ctx = pdfCanvas.getContext('2d');
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    renderPageTask = currentPageObject.render(renderContext);

    try {
      await renderPageTask.promise;
    } catch (e) {
      if (e.name === 'RenderingCancelledException') return;
      console.error('Canvas render error:', e);
    }

    // Render TextLayer for selection, clicks, and speech highlighting
    pdfTextLayer.innerHTML = '';
    pdfTextLayer.style.width = `${viewport.width}px`;
    pdfTextLayer.style.height = `${viewport.height}px`;

    try {
      const textLayerTask = window.pdfjsLib.renderTextLayer({
        textContentSource: currentPageTextContent,
        container: pdfTextLayer,
        viewport: viewport,
        textDivs: []
      });

      await textLayerTask.promise;

      // Extract exact spans and map word-by-word to sentences
      mapTextLayerSpansToSentences();
      highlightSentence(currentSentenceIndex);
    } catch (e) {
      console.warn('TextLayer render notice:', e);
    }
  }

  // Maps each span in the PDF text layer with exact character offsets
  function mapTextLayerSpansToSentences() {
    const spans = Array.from(pdfTextLayer.querySelectorAll('span'));
    spanRanges = [];
    if (!spans.length) {
      sentences = [];
      renderReaderSentences([]);
      return;
    }

    // 1. Build continuous page text directly from PDF spans
    let pageText = '';
    spans.forEach((span, i) => {
      const str = span.textContent;
      const startChar = pageText.length;
      pageText += str;
      const endChar = pageText.length;
      spanRanges.push({ span, index: i, startChar, endChar, str });
      if (!str.endsWith(' ') && !str.endsWith('\n')) {
        pageText += ' ';
      }
    });

    // 2. Segment into sentences with exact character offsets
    sentences = [];
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
      let sIdx = 0;
      for (const s of segmenter.segment(pageText)) {
        const trimmed = s.segment.trim();
        if (trimmed.length > 0) {
          sentences.push({
            index: sIdx++,
            text: trimmed,
            startChar: s.index,
            endChar: s.index + s.segment.length
          });
        }
      }
    } else {
      let sIdx = 0;
      let pos = 0;
      const rawList = parseIntoSentences(pageText);
      rawList.forEach((raw) => {
        const found = pageText.indexOf(raw, pos);
        const start = found !== -1 ? found : pos;
        const end = start + raw.length;
        pos = end;
        sentences.push({
          index: sIdx++,
          text: raw,
          startChar: start,
          endChar: end
        });
      });
    }

    // 3. Associate every span on the PDF page with its matching sentence
    spanRanges.forEach((item) => {
      const matchingSentence = sentences.find(
        (s) => item.startChar < s.endChar && item.endChar > s.startChar
      );
      if (matchingSentence) {
        item.span.dataset.sentenceIdx = matchingSentence.index;
      }
      item.span.dataset.startChar = item.startChar;
      item.span.dataset.endChar = item.endChar;

      item.span.addEventListener('click', (e) => {
        e.stopPropagation();
        const sIdx = parseInt(item.span.dataset.sentenceIdx, 10);
        if (!isNaN(sIdx)) {
          playSentence(sIdx);
        }
      });
    });

    renderReaderSentences(sentences);
  }

  function parseIntoSentences(text) {
    if (!text || !text.trim()) return [];
    const clean = text.replace(/\r\n/g, '\n').replace(/\t/g, ' ').trim();
    const segments = clean.match(/[^.!?\n]+[.!?]+(?:\s+|$)|[^\n]+(?:\n+|$)/g) || [clean];
    const result = [];
    segments.forEach((seg) => {
      const trimmed = seg.trim();
      if (trimmed.length > 0) result.push(trimmed);
    });
    return result.length ? result : [clean];
  }

  function renderReaderSentences(list) {
    textDisplayEl.innerHTML = '';
    currentSentenceIndex = -1;

    if (!list.length) {
      textDisplayEl.innerHTML = '<p style="color:var(--text-muted); font-style:italic;">No text found on this page (it might be a scanned image or empty).</p>';
      return;
    }

    list.forEach((sentenceItem, idx) => {
      const sentenceText = typeof sentenceItem === 'object' ? sentenceItem.text : sentenceItem;
      const span = document.createElement('span');
      span.className = 'text-sentence';
      span.dataset.idx = idx;

      // Wrap words inside reader sentence for word-to-word highlight
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        const wordSegmenter = new Intl.Segmenter('en', { granularity: 'word' });
        for (const w of wordSegmenter.segment(sentenceText)) {
          if (w.isWordLike) {
            const wSpan = document.createElement('span');
            wSpan.className = 'reader-word';
            wSpan.dataset.charStart = w.index;
            wSpan.dataset.charEnd = w.index + w.segment.length;
            wSpan.textContent = w.segment;
            span.appendChild(wSpan);
          } else {
            span.appendChild(document.createTextNode(w.segment));
          }
        }
      } else {
        span.textContent = sentenceText;
      }
      span.appendChild(document.createTextNode(' '));

      span.addEventListener('click', () => {
        playSentence(idx);
      });
      textDisplayEl.appendChild(span);
    });
  }

  // Intelligent Pronunciation Normalizer for Math, Equations, Hyphens, Ligatures, and Symbols
  function normalizePronunciation(text) {
    if (!text) return '';
    let s = text;

    // 0. Fix PDF Unicode Ligatures (e.g. "deﬁnite" -> "definite", "ﬂow" -> "flow")
    s = s.replace(/\uFB00/g, 'ff')
         .replace(/\uFB01/g, 'fi')
         .replace(/\uFB02/g, 'fl')
         .replace(/\uFB03/g, 'ffi')
         .replace(/\uFB04/g, 'ffl')
         .replace(/\uFB05/g, 'ft')
         .replace(/\uFB06/g, 'st');

    // Clean smart quotes and typographic dashes
    s = s.replace(/[\u2018\u2019]/g, "'")
         .replace(/[\u201C\u201D]/g, '"')
         .replace(/[\u2013\u2014]/g, ', ')
         .replace(/\u2026/g, '...')
         .replace(/\u2022/g, ', ');

    // 1. Dehyphenate broken words across line breaks (e.g. "divi- sion" -> "division")
    s = s.replace(/(\b[a-zA-Z]+)-\s+([a-zA-Z]+\b)/g, '$1$2');

    // 2. Expand common academic and textbook abbreviations
    s = s.replace(/\be\.g\.,?\s*/gi, 'for example, ');
    s = s.replace(/\bi\.e\.,?\s*/gi, 'that is, ');
    s = s.replace(/\betc\.?\b/gi, 'et cetera');
    s = s.replace(/\bFig\.\s*(\d+)/gi, 'Figure $1');
    s = s.replace(/\bCh\.\s*(\d+)/gi, 'Chapter $1');
    s = s.replace(/\bEq\.\s*(\d+)/gi, 'Equation $1');
    s = s.replace(/\bSec\.\s*(\d+)/gi, 'Section $1');
    s = s.replace(/\bThm\.\s*(\d+)/gi, 'Theorem $1');
    s = s.replace(/\bDef\.\s*(\d+)/gi, 'Definition $1');
    s = s.replace(/\bvs\.?\b/gi, 'versus');
    s = s.replace(/\bDr\.\s+/gi, 'Doctor ');
    s = s.replace(/\bMr\.\s+/gi, 'Mister ');
    s = s.replace(/\bMrs\.\s+/gi, 'Missus ');
    s = s.replace(/\bMs\.\s+/gi, 'Mizz ');
    s = s.replace(/\bProf\.\s+/gi, 'Professor ');

    // 3. Fix Roman numerals in list enumerations (i), (ii), (iii)... so TTS doesn't say "eye eye eye"
    s = s.replace(/\((?:i|I)\)/g, '(1)');
    s = s.replace(/\((?:ii|II)\)/g, '(2)');
    s = s.replace(/\((?:iii|III)\)/g, '(3)');
    s = s.replace(/\((?:iv|IV)\)/g, '(4)');
    s = s.replace(/\((?:v|V)\)/g, '(5)');
    s = s.replace(/\((?:vi|VI)\)/g, '(6)');
    s = s.replace(/\((?:vii|VII)\)/g, '(7)');
    s = s.replace(/\((?:viii|VIII)\)/g, '(8)');
    s = s.replace(/\((?:ix|IX)\)/g, '(9)');
    s = s.replace(/\((?:x|X)\)/g, '(10)');

    // 4. Fractions
    s = s.replace(/½/g, ' one half ');
    s = s.replace(/¼/g, ' one fourth ');
    s = s.replace(/¾/g, ' three fourths ');
    s = s.replace(/⅓/g, ' one third ');
    s = s.replace(/⅔/g, ' two thirds ');
    s = s.replace(/(\b\d+)\/(\d+\b)/g, '$1 over $2');

    // 5. Separate numbers directly glued to algebraic letters (e.g. "7p" -> "7 p", "2q" -> "2 q", "3x" -> "3 x")
    s = s.replace(/\b(\d+)([a-zA-Z])\b/g, '$1 $2');
    s = s.replace(/\b([a-zA-Z])(\d+)\b/g, '$1 $2');

    // 6. Mathematical variables - make standalone 'a' sound like 'ay' instead of 'uh'
    s = s.replace(/\ba\s*=/g, 'ay equals ');
    s = s.replace(/=\s*a\b/g, '= ay');
    s = s.replace(/\bfor a\b/gi, 'for ay');
    s = s.replace(/\bwhere a\b/gi, 'where ay');
    s = s.replace(/\blet a\b/gi, 'let ay');
    s = s.replace(/\bthat a\b/gi, 'that ay');
    s = s.replace(/\bif a\b/gi, 'if ay');
    s = s.replace(/\ba\s*,\s*b\b/g, 'ay, b');
    s = s.replace(/\ba\s+and\s+b\b/gi, 'ay and b');
    s = s.replace(/\ba\s*\+\s*/g, 'ay plus ');

    // 7. Comparison and inequality operators
    s = s.replace(/<=|≤/g, ' is less than or equal to ');
    s = s.replace(/>=|≥/g, ' is greater than or equal to ');
    s = s.replace(/!=|≠/g, ' is not equal to ');
    s = s.replace(/≈|~=/g, ' is approximately equal to ');
    s = s.replace(/\b([a-zA-Z0-9]+)\s*<\s*([a-zA-Z0-9]+)\b/g, '$1 is less than $2');
    s = s.replace(/\b([a-zA-Z0-9]+)\s*>\s*([a-zA-Z0-9]+)\b/g, '$1 is greater than $2');
    s = s.replace(/=/g, ' equals ');

    // 8. Arithmetic operators & symbols
    s = s.replace(/\+/g, ' plus ');
    s = s.replace(/(\b\w+)\s*-\s*(\b\w+)/g, '$1 minus $2');
    s = s.replace(/×/g, ' times ');
    s = s.replace(/÷/g, ' divided by ');
    s = s.replace(/±/g, ' plus or minus ');
    s = s.replace(/%/g, ' percent');
    s = s.replace(/°/g, ' degrees ');
    s = s.replace(/√(\w+)/g, ' square root of $1 ');

    // 9. Greek letters and math symbols
    s = s.replace(/π/g, ' pi ');
    s = s.replace(/θ/g, ' theta ');
    s = s.replace(/α/g, ' alpha ');
    s = s.replace(/β/g, ' beta ');
    s = s.replace(/γ/g, ' gamma ');
    s = s.replace(/λ/g, ' lambda ');
    s = s.replace(/μ/g, ' mu ');
    s = s.replace(/σ/g, ' sigma ');
    s = s.replace(/δ|Δ/g, ' delta ');
    s = s.replace(/∞/g, ' infinity ');
    s = s.replace(/∑/g, ' sum of ');
    s = s.replace(/∫/g, ' integral of ');
    s = s.replace(/∈/g, ' is in ');
    s = s.replace(/∉/g, ' is not in ');

    // 10. Exponents
    s = s.replace(/(\b\w+)²/g, '$1 squared');
    s = s.replace(/(\b\w+)³/g, '$1 cubed');
    s = s.replace(/\^2\b/g, ' squared');
    s = s.replace(/\^3\b/g, ' cubed');
    s = s.replace(/\^(\d+)/g, ' to the power of $1');

    // 11. Add pauses and spacing after glued sentences
    s = s.replace(/([a-zA-Z0-9])\.([A-Z])/g, '$1. $2');

    // Clean whitespace
    s = s.replace(/\s+/g, ' ').trim();
    return s;
  }

  // --------------------------------------------------------------------------
  // Playback Engine & Highlighting
  // --------------------------------------------------------------------------
  function stopAllSpeechAudio() {
    if (currentAudioEl) {
      currentAudioEl.pause();
      currentAudioEl.currentTime = 0;
      currentAudioEl = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  function playSentence(idx) {
    if (idx < 0 || idx >= sentences.length) {
      if (stopAtEndOfPage) {
        stopSpeaking();
        setSleepTimer('0');
        return;
      }

      if (settings.autoAdvance && currentPageNum < totalPages) {
        loadAndDisplayPage(currentPageNum + 1).then(() => {
          playSentence(0);
        });
      } else {
        stopSpeaking();
      }
      return;
    }

    stopAllSpeechAudio();
    currentSentenceIndex = idx;
    highlightSentence(idx);
    updateProgress(idx);
    saveCurrentPosition();

    const sentenceItem = sentences[idx];
    const originalText = typeof sentenceItem === 'object' ? sentenceItem.text : sentenceItem;
    const spokenText = normalizePronunciation(originalText);

    isPlaying = true;
    isPaused = false;
    updatePlayPauseButton(true);

    // MODE A: Natural Studio Voice (Google HD Online streaming)
    if (settings.voiceURI === 'hd-natural-google') {
      const audioUrl = `api/tts-stream?text=${encodeURIComponent(spokenText)}&lang=en`;
      currentAudioEl = new Audio(audioUrl);
      currentAudioEl.playbackRate = settings.rate;

      // Animate word highlighting across the duration
      currentAudioEl.ontimeupdate = () => {
        if (currentAudioEl && currentAudioEl.duration > 0) {
          const ratio = currentAudioEl.currentTime / currentAudioEl.duration;
          const charInOriginal = Math.min(originalText.length - 1, Math.floor(ratio * originalText.length));
          highlightActiveWord(idx, charInOriginal);
        }
      };

      currentAudioEl.onended = () => {
        if (isPlaying && !isPaused) {
          playSentence(currentSentenceIndex + 1);
        }
      };

      currentAudioEl.onerror = () => {
        console.warn('HD Natural Voice streaming failed, falling back to local TTS engine...');
        fallbackToLocalSpeech(spokenText, originalText, idx);
      };

      currentAudioEl.play().catch((err) => {
        console.warn('Audio play prevented or offline, fallback to local TTS:', err);
        fallbackToLocalSpeech(spokenText, originalText, idx);
      });
      return;
    }

    // MODE B: Device Speech Synthesis
    fallbackToLocalSpeech(spokenText, originalText, idx);
  }

  function fallbackToLocalSpeech(spokenText, originalText, idx) {
    if (!('speechSynthesis' in window)) return;
    currentUtterance = new SpeechSynthesisUtterance(spokenText);

    let activeVoice = null;
    if (settings.voiceURI && settings.voiceURI !== 'hd-natural-google') {
      activeVoice = availableVoices.find((v) => v.voiceURI === settings.voiceURI);
    }
    if (!activeVoice && availableVoices.length > 0) {
      activeVoice = availableVoices.find((v) => /google|natural|premium|neural|enhanced/i.test(v.name) && v.lang.startsWith('en')) ||
                    availableVoices.find((v) => v.lang.startsWith('en')) ||
                    availableVoices[0];
    }

    if (activeVoice) {
      currentUtterance.voice = activeVoice;
      currentUtterance.lang = activeVoice.lang;
    } else {
      currentUtterance.lang = 'en-US';
    }

    currentUtterance.rate = settings.rate;
    currentUtterance.pitch = settings.pitch;

    // Word-by-Word karaoke boundary event with proportional ratio mapping
    currentUtterance.onboundary = (event) => {
      if (event.name === 'word') {
        const ratio = event.charIndex / Math.max(1, spokenText.length);
        const charInOriginal = Math.min(originalText.length - 1, Math.floor(ratio * originalText.length));
        highlightActiveWord(idx, charInOriginal);
      }
    };

    currentUtterance.onend = () => {
      if (isPlaying && !isPaused) {
        playSentence(currentSentenceIndex + 1);
      }
    };

    currentUtterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn('SpeechSynthesis error:', e);
      }
    };

    window.speechSynthesis.speak(currentUtterance);
  }

  // Real-time word-to-word highlight
  function highlightActiveWord(sentenceIdx, charInSentence) {
    const sentenceObj = sentences[sentenceIdx];
    if (!sentenceObj) return;

    const sentenceStart = typeof sentenceObj === 'object' ? sentenceObj.startChar : 0;
    const absoluteChar = sentenceStart + charInSentence;

    // 1. Highlight the specific word span on the original PDF TextLayer
    const activeSpanItem = spanRanges.find(
      (item) => item.startChar <= absoluteChar && absoluteChar < item.endChar
    );

    pdfTextLayer.querySelectorAll('.speaking-word').forEach((el) => el.classList.remove('speaking-word'));

    if (activeSpanItem && activeSpanItem.span) {
      activeSpanItem.span.classList.add('speaking-word');
      if (currentView === 'original') {
        smoothScrollInsideContainer(activeSpanItem.span);
      }
    }

    // 2. Highlight word in Reader View
    const currentReaderSentence = textDisplayEl.querySelector(`.text-sentence[data-idx="${sentenceIdx}"]`);
    if (currentReaderSentence) {
      currentReaderSentence.querySelectorAll('.speaking-word').forEach((el) => el.classList.remove('speaking-word'));
      const words = currentReaderSentence.querySelectorAll('.reader-word');
      for (const w of words) {
        const wStart = parseInt(w.dataset.charStart, 10);
        const wEnd = parseInt(w.dataset.charEnd, 10);
        if (wStart <= charInSentence && charInSentence < wEnd) {
          w.classList.add('speaking-word');
          break;
        }
      }
    }
  }

  function highlightSentence(idx) {
    if (idx < 0) return;

    // 1. Highlight in Reader View
    const allReaderSpans = textDisplayEl.querySelectorAll('.text-sentence');
    allReaderSpans.forEach((span) => span.classList.remove('speaking-now'));
    const currentReaderSpan = textDisplayEl.querySelector(`.text-sentence[data-idx="${idx}"]`);
    if (currentReaderSpan) {
      currentReaderSpan.classList.add('speaking-now');
      if (currentView === 'reader') {
        smoothScrollInsideContainer(currentReaderSpan);
      }
    }

    // 2. Highlight all spans belonging to this sentence on Original PDF Canvas TextLayer
    const allPdfSpans = pdfTextLayer.querySelectorAll('.textLayer span');
    allPdfSpans.forEach((span) => {
      span.classList.remove('speaking-sentence');
      span.classList.remove('speaking-now');
      span.classList.remove('speaking-word');
    });

    const activePdfSpans = pdfTextLayer.querySelectorAll(`.textLayer span[data-sentence-idx="${idx}"]`);
    if (activePdfSpans.length) {
      activePdfSpans.forEach((span) => {
        span.classList.add('speaking-sentence');
      });
      if (currentView === 'original') {
        smoothScrollInsideContainer(activePdfSpans[0]);
      }
    }
  }

  // Smooth scroll isolated strictly to contentContainer to prevent top bar movement
  function smoothScrollInsideContainer(targetEl) {
    if (!targetEl || !contentContainer) return;
    const containerRect = contentContainer.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const relativeTop = targetRect.top - containerRect.top;
    const desiredCenter = (containerRect.height / 2) - (targetRect.height / 2);
    const scrollOffset = relativeTop - desiredCenter;
    
    // Only scroll if outside the center focus area
    if (Math.abs(scrollOffset) > 50) {
      contentContainer.scrollBy({ top: scrollOffset, behavior: 'smooth' });
    }
  }

  function updateProgress(idx) {
    if (!sentences.length) {
      progressFill.style.width = '0%';
      return;
    }
    const percent = Math.min(100, Math.max(0, ((idx + 1) / sentences.length) * 100));
    progressFill.style.width = `${percent}%`;
  }

  function togglePlayPause() {
    if (!sentences.length) return;

    if (isPlaying) {
      if (isPaused) {
        isPaused = false;
        updatePlayPauseButton(true);
        if (currentAudioEl && currentAudioEl.src && !currentAudioEl.ended) {
          currentAudioEl.play();
        } else if (currentSentenceIndex >= 0) {
          playSentence(currentSentenceIndex);
        } else {
          playSentence(0);
        }
      } else {
        isPaused = true;
        if (currentAudioEl) {
          currentAudioEl.pause();
        }
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        updatePlayPauseButton(false);
      }
    } else {
      isPlaying = true;
      isPaused = false;
      const startIdx = currentSentenceIndex >= 0 ? currentSentenceIndex : 0;
      playSentence(startIdx);
    }
  }

  function stopSpeaking() {
    stopAllSpeechAudio();
    isPlaying = false;
    isPaused = false;
    currentSentenceIndex = -1;
    updatePlayPauseButton(false);

    textDisplayEl.querySelectorAll('.speaking-now, .speaking-word').forEach((span) => {
      span.classList.remove('speaking-now', 'speaking-word');
    });
    pdfTextLayer.querySelectorAll('.speaking-sentence, .speaking-now, .speaking-word').forEach((span) => {
      span.classList.remove('speaking-sentence', 'speaking-now', 'speaking-word');
    });

    updateProgress(0);
  }

  function prevSentence() {
    if (!sentences.length) return;
    const target = Math.max(0, currentSentenceIndex - 1);
    playSentence(target);
  }

  function nextSentence() {
    if (!sentences.length) return;
    const target = Math.min(sentences.length - 1, currentSentenceIndex + 1);
    playSentence(target);
  }

  function updatePlayPauseButton(speaking) {
    if (speaking) {
      iconPlay.style.display = 'none';
      iconPause.style.display = 'block';
    } else {
      iconPlay.style.display = 'block';
      iconPause.style.display = 'none';
    }
  }

  btnPlayPause.addEventListener('click', togglePlayPause);
  btnStop.addEventListener('click', stopSpeaking);
  btnPrevSentence.addEventListener('click', prevSentence);
  btnNextSentence.addEventListener('click', nextSentence);

  progressContainer.addEventListener('click', (e) => {
    if (!sentences.length) return;
    const rect = progressContainer.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const targetIdx = Math.floor(ratio * sentences.length);
    playSentence(Math.max(0, Math.min(sentences.length - 1, targetIdx)));
  });

  btnPrevPage.addEventListener('click', () => {
    if (currentPageNum > 1) loadAndDisplayPage(currentPageNum - 1);
  });

  btnNextPage.addEventListener('click', () => {
    if (currentPageNum < totalPages) loadAndDisplayPage(currentPageNum + 1);
  });

  inputPageNum.addEventListener('change', () => {
    let num = parseInt(inputPageNum.value, 10);
    if (isNaN(num)) num = 1;
    num = Math.max(1, Math.min(totalPages, num));
    loadAndDisplayPage(num);
  });

  // Font sizing in Reader View
  btnFontInc.addEventListener('click', () => {
    baseFontSize = Math.min(2.0, baseFontSize + 0.1);
    textDisplayEl.style.fontSize = `${baseFontSize}rem`;
    localStorage.setItem('ab_fontSize', baseFontSize);
  });

  btnFontDec.addEventListener('click', () => {
    baseFontSize = Math.max(0.85, baseFontSize - 0.1);
    textDisplayEl.style.fontSize = `${baseFontSize}rem`;
    localStorage.setItem('ab_fontSize', baseFontSize);
  });

  // Settings Panel
  btnSettingsToggle.addEventListener('click', () => {
    const isClosed = settingsDrawer.style.display === 'none' || !settingsDrawer.style.display;
    settingsDrawer.style.display = isClosed ? 'flex' : 'none';
  });

  btnCloseSettings.addEventListener('click', () => {
    settingsDrawer.style.display = 'none';
  });

  selectVoice.addEventListener('change', (e) => {
    settings.voiceURI = e.target.value;
    localStorage.setItem('ab_voiceURI', settings.voiceURI);
    if (isPlaying && !isPaused) playSentence(currentSentenceIndex);
  });

  rangeSpeed.addEventListener('input', (e) => {
    const speed = parseFloat(e.target.value);
    settings.rate = speed;
    labelSpeed.textContent = `${speed.toFixed(2)}x`;
    localStorage.setItem('ab_rate', speed);
    updateSpeedPresetButtons(speed);
    if (currentAudioEl) currentAudioEl.playbackRate = speed;
    if (isPlaying && !isPaused && !currentAudioEl) playSentence(currentSentenceIndex);
  });

  speedPresetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const speed = parseFloat(btn.dataset.speed);
      settings.rate = speed;
      rangeSpeed.value = speed;
      labelSpeed.textContent = `${speed.toFixed(2)}x`;
      localStorage.setItem('ab_rate', speed);
      updateSpeedPresetButtons(speed);
      if (currentAudioEl) currentAudioEl.playbackRate = speed;
      if (isPlaying && !isPaused && !currentAudioEl) playSentence(currentSentenceIndex);
    });
  });

  rangePitch.addEventListener('input', (e) => {
    const pitch = parseFloat(e.target.value);
    settings.pitch = pitch;
    labelPitch.textContent = pitch.toFixed(1);
    localStorage.setItem('ab_pitch', pitch);
    if (isPlaying && !isPaused) playSentence(currentSentenceIndex);
  });

  toggleAutoAdvance.addEventListener('change', (e) => {
    settings.autoAdvance = e.target.checked;
    localStorage.setItem('ab_autoAdvance', settings.autoAdvance);
  });

  // --------------------------------------------------------------------------
  // Export Audio (MP3 Downloader)
  // --------------------------------------------------------------------------
  btnExportAudio.addEventListener('click', async () => {
    if (!sentences.length) {
      alert('No text on this page to export.');
      return;
    }

    exportModalBackdrop.style.display = 'flex';
    exportStatusText.textContent = `Generating MP3 for Page ${currentPageNum}...`;
    exportSpinner.style.display = 'block';
    exportActions.style.display = 'none';

    const fullPageText = sentences.map((s) => (typeof s === 'object' ? s.text : s)).join(' ');
    const safeDocName = (currentFileName || 'audiobook').replace(/\.[^/.]+$/, '');
    const mp3Name = `${safeDocName}_page_${currentPageNum}.mp3`;

    try {
      const response = await fetch('/api/tts-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: fullPageText,
          lang: 'en',
          filename: mp3Name
        })
      });

      if (!response.ok) {
        throw new Error('Server returned error during audio generation');
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);

      exportSpinner.style.display = 'none';
      exportStatusText.textContent = `✅ Ready! File size: ${(blob.size / 1024).toFixed(1)} KB`;

      btnDownloadMp3.href = downloadUrl;
      btnDownloadMp3.download = mp3Name;
      exportActions.style.display = 'block';

      btnDownloadMp3.click();
    } catch (err) {
      console.error(err);
      exportSpinner.style.display = 'none';
      exportStatusText.textContent = '❌ Failed to generate audio. Please try again.';
    }
  });

  btnCloseExportModal.addEventListener('click', () => {
    exportModalBackdrop.style.display = 'none';
  });

  exportModalBackdrop.addEventListener('click', (e) => {
    if (e.target === exportModalBackdrop) {
      exportModalBackdrop.style.display = 'none';
    }
  });

  // Handle mobile screen orientation rotation (only on genuine screen flip)
  let lastOrientationWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    if (Math.abs(window.innerWidth - lastOrientationWidth) > 120) {
      lastOrientationWidth = window.innerWidth;
      if (currentView === 'original' && pdfDoc) {
        fitPdfToWidth();
        renderCurrentPageOriginal();
      }
    }
  });

  // Initialize
  initVoices();
  restoreSettingsUI();
  initTouchGestures();
})();
