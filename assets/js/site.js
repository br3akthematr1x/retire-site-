// Hero video: audio ONLY plays when the user clicks the button.
// No auto-unmute attempts, ever.

document.addEventListener('DOMContentLoaded', async () => {
  const video = document.getElementById('heroVideo');
  const muteBtn = document.getElementById('muteToggle');
  const hint = document.getElementById('unmuteHint');

  if (!video || !muteBtn) return;

  // Always start muted
  video.muted = true;

  // Try to autoplay (muted). If it can't, that's fine—the frame still shows the poster/video.
  try { await video.play(); } catch (_) {}

  // UI: start in muted state
  updateBtn(true);
  if (hint) hint.hidden = false;

  // The ONLY way to enable audio is via this click.
  muteBtn.addEventListener('click', async () => {
    if (video.muted) {
      video.muted = false;          // enable sound
      try { await video.play(); } catch (_) {}
      if (hint) hint.hidden = true; // hide the hint once sound is enabled
      updateBtn(false);
    } else {
      video.muted = true;           // re-mute
      updateBtn(true);
      if (hint) hint.hidden = false; // optionally show hint again
    }
  });

  // (Optional) tapping the hint also unmutes
  if (hint) {
    hint.addEventListener('click', async () => {
      video.muted = false;
      try { await video.play(); } catch (_) {}
      hint.hidden = true;
      updateBtn(false);
    });
  }

  function updateBtn(isMuted) {
    muteBtn.textContent = isMuted ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-label', isMuted ? 'Unmute video' : 'Mute video');
    muteBtn.title = isMuted ? 'Unmute' : 'Mute';
  }
});

