/* RETIRE – seamless share flow
   Mobile: saves to Photos via share sheet, then opens X app
   Desktop: auto-downloads PNG and opens x.com
*/
(() => {
    const BTN_ID = 'share-x';
    const TARGET = '#hp-xwrap';
    const CAPTURE_BG = '#000';
  
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    const isIpadOS = !isIOS && /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    const isMobile = isIOS || isAndroid || isIpadOS;
  
    async function capture(el) {
      const prevBg = el.style.backgroundColor;
      el.style.backgroundColor = CAPTURE_BG;
  
      const canvas = await html2canvas(el, {
        backgroundColor: CAPTURE_BG,
        scale: Math.min(3, Math.max(2, window.devicePixelRatio || 1)),
        useCORS: true
      });
  
      el.style.backgroundColor = prevBg;
  
      return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/png', 0.95));
    }
  
    function download(blob, name) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
  
    function openX() {
      // Opens X app or web fallback
      const intent = isMobile ? 'https://x.com/intent/tweet' : 'https://x.com/intent/tweet';
      window.open(intent, '_blank', 'noopener,noreferrer');
    }
  
    async function handleShare() {
      const btn = document.getElementById(BTN_ID);
      const target = document.querySelector(TARGET);
      if (!btn || !target) return;
      if (btn.__busy) return;
      btn.__busy = true;
  
      const orig = btn.textContent;
  
      try {
        const blob = await capture(target);
        if (!blob) throw new Error('No image');
        const file = new File([blob], 'retire-results.png', { type: 'image/png' });
  
        // Mobile flow
        if (
          isMobile &&
          typeof navigator.canShare === 'function' &&
          navigator.canShare({ files: [file] }) &&
          typeof navigator.share === 'function'
        ) {
          try {
            await navigator.share({ files: [file] });
          } catch (err) {
            console.warn('Share canceled or failed:', err);
          }
          // Always open X after share (even if canceled)
          setTimeout(openX, 500);
        } 
        else {
          // Desktop fallback
          download(blob, 'retire-results.png');
          openX();
        }
  
        btn.textContent = 'Shared ✅';
        setTimeout(() => (btn.textContent = orig), 1500);
      } catch (err) {
        console.error(err);
        btn.textContent = 'Share failed';
        setTimeout(() => (btn.textContent = orig), 1500);
      } finally {
        btn.__busy = false;
      }
    }
  
    document.addEventListener('DOMContentLoaded', () => {
      const btn = document.getElementById(BTN_ID);
      if (btn) btn.addEventListener('click', handleShare, { passive: true });
    });
  })();
  