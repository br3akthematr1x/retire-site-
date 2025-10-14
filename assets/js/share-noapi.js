(() => {
    // --- Fixed tweet text (no other prefill) ---
    const TWEET_TEXT = 'Get your calculation done at www.retireyourbloodline.com $RETIRE @thelastplaysol';
  
    // Prefer an explicit ID; otherwise fall back to the right-hand card in the active holdings panel
    function getResultsCard() {
      const byId = document.getElementById('hp-results');
      if (byId) return byId;
      const active = document.querySelector('.rp-panel[data-panel="holdings"].rp-panel-active');
      if (!active) return null;
      const cards = active.querySelectorAll('.rp-grid > .rp-card');
      return cards && cards[1] ? cards[1] : null; // right-hand card is the Results card
    }
  
    async function captureResultsPngBlob() {
      // Ensure html2canvas is present (it’s also loaded via <script>, but this guards races)
      if (typeof html2canvas === 'undefined') {
        await import('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
      }
      const card = getResultsCard();
      if (!card) throw new Error('Could not find the Results section to capture.');
  
      // High-DPI capture with solid black bg so seams never show
      const scale = Math.min(2, (window.devicePixelRatio || 1) * 1.5);
      const canvas = await html2canvas(card, {
        backgroundColor: '#000000',
        scale,
        useCORS: true,
        logging: false
      });
      return await new Promise(res => canvas.toBlob(res, 'image/png', 1));
    }
  
    // Mobile: use Web Share API with files — when user picks Twitter/X app,
    // the image is attached automatically in the composer.
    async function tryWebShareWithImage(blob) {
      try {
        if (!('share' in navigator)) return false;
        const file = new File([blob], 'retire-results.png', { type: 'image/png' });
        if ('canShare' in navigator && !navigator.canShare({ files: [file], text: TWEET_TEXT })) return false;
        await navigator.share({ files: [file], text: TWEET_TEXT });
        return true;
      } catch {
        return false; // not supported or user cancelled
      }
    }
  
    // Desktop fallback: download the image and open the X composer with our fixed text.
    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    }
  
    function openTweetIntent() {
      const url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(TWEET_TEXT);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => {
        alert('Image downloaded.\nAttach it in the tweet composer (click the image button or drag the PNG).');
      }, 300);
    }
  
    async function onShareClick(e) {
      e.preventDefault();
      const btn = e.currentTarget;
      const old = btn.textContent;
      btn.disabled = true; btn.textContent = 'Preparing…';
  
      try {
        const blob = await captureResultsPngBlob();
  
        // 1) Mobile (native app via share sheet) → auto-attaches image + our fixed text
        if (await tryWebShareWithImage(blob)) {
          btn.textContent = old; btn.disabled = false;
          return;
        }
  
        // 2) Desktop (or unsupported mobile browsers) → download + open composer with fixed text
        downloadBlob(blob, 'retire-results.png');
        openTweetIntent();
  
      } catch (err) {
        console.error(err);
        alert(err.message || 'Unable to prepare the screenshot.');
      } finally {
        btn.textContent = old; btn.disabled = false;
      }
    }
  
    // Delegate (works even if the button is rendered later)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#hp-share');
      if (btn) onShareClick(e);
    });
  })();
  