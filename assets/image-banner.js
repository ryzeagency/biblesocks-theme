/*
  Image banner video loader (sections/image-banner.liquid).

  The banner's picture is always in the HTML and paints first. The <video>
  has no src and preload="none"; this script gives it one only when:
  - the page has fully loaded and the browser is idle,
  - the banner is on or near the screen,
  - the shopper hasn't asked for reduced motion, Data Saver, or is on 2G.
  Only the video for the current screen size is downloaded. It loops with no
  controls, and pauses while scrolled away or while the tab is hidden.
*/
(() => {
  if (customElements.get('image-banner')) return;

  const MOBILE = window.matchMedia('(max-width: 749px)');
  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

  const slowConnection = () => {
    const connection = navigator.connection;
    if (!connection) return false;
    return connection.saveData === true || /(^|-)2g$/.test(connection.effectiveType || '');
  };

  // Resolves after the window load event, then once the browser is idle.
  const pageSettled = new Promise((resolve) => {
    const idle = () => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => resolve(), { timeout: 2000 });
      } else {
        setTimeout(resolve, 200);
      }
    };
    if (document.readyState === 'complete') idle();
    else window.addEventListener('load', idle, { once: true });
  });

  class ImageBanner extends HTMLElement {
    connectedCallback() {
      this.video = this.querySelector('.image-banner__video');
      if (!this.video || REDUCED_MOTION.matches || slowConnection()) return;

      this.visible = false;

      this.onBreakpoint = () => this.update();
      this.onVisibility = () => this.update();
      this.onPlaying = () => this.video.classList.add('is-playing');

      this.video.addEventListener('playing', this.onPlaying);

      pageSettled.then(() => {
        if (!this.isConnected) return;
        MOBILE.addEventListener('change', this.onBreakpoint);
        document.addEventListener('visibilitychange', this.onVisibility);
        this.observer = new IntersectionObserver(
          (entries) => {
            this.visible = entries[entries.length - 1].isIntersecting;
            this.update();
          },
          { rootMargin: '200px 0px' }
        );
        this.observer.observe(this);
      });
    }

    disconnectedCallback() {
      if (!this.video) return;
      if (this.observer) this.observer.disconnect();
      MOBILE.removeEventListener('change', this.onBreakpoint);
      document.removeEventListener('visibilitychange', this.onVisibility);
      this.video.removeEventListener('playing', this.onPlaying);
      this.video.pause();
    }

    currentSource() {
      const { srcDesktop, srcMobile } = this.video.dataset;
      return (MOBILE.matches ? srcMobile : srcDesktop) || '';
    }

    update() {
      const video = this.video;
      const src = this.currentSource();

      // This screen size has no video (e.g. a phone with only a mobile image):
      // show the picture and stop any video that was running.
      if (!src) {
        video.pause();
        video.classList.remove('is-playing');
        return;
      }

      // Not on screen yet: don't download anything. Off screen or hidden tab: pause.
      if (!this.visible && !video.getAttribute('src')) return;
      if (!this.visible || document.hidden) {
        video.pause();
        return;
      }

      if (video.getAttribute('src') !== src) {
        video.classList.remove('is-playing');
        video.setAttribute('src', src);
        video.preload = 'auto';
      }

      video.muted = true;
      const playing = video.play();
      // Autoplay blocked (e.g. iOS Low Power Mode): the picture stays.
      if (playing && playing.catch) playing.catch(() => {});
    }
  }

  customElements.define('image-banner', ImageBanner);
})();
