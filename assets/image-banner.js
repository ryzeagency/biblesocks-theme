/*
  Image banner video loader (sections/image-banner.liquid).

  The banner's picture is always in the HTML and paints first. The <video>
  has no src and preload="none"; this script gives it one only when:
  - the page has fully loaded and the browser is idle,
  - the banner is on or near the screen,
  - the shopper hasn't asked for reduced motion, Data Saver, or is on 2G.
  Only the video for the current screen size is downloaded. It pauses when
  scrolled away or the tab is hidden, and the pause button stops it for good.
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
      this.toggle = this.querySelector('.image-banner__toggle');
      if (!this.video || REDUCED_MOTION.matches || slowConnection()) return;

      this.visible = false;
      this.pausedByShopper = false;

      this.onBreakpoint = () => this.update();
      this.onVisibility = () => this.update();
      // Pauses a playing video, or plays a paused one (including one whose
      // autoplay the browser blocked: a tap is allowed to start it).
      this.onToggle = () => {
        this.pausedByShopper = !this.video.paused;
        this.update();
      };
      this.onPlaying = () => {
        this.video.classList.add('is-playing');
        this.setPausedState(false);
      };

      this.video.addEventListener('playing', this.onPlaying);
      if (this.toggle) this.toggle.addEventListener('click', this.onToggle);

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
      if (this.toggle) this.toggle.removeEventListener('click', this.onToggle);
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
      this.classList.toggle('has-playable-video', Boolean(src));
      if (!src) {
        video.pause();
        video.classList.remove('is-playing');
        return;
      }

      // Not on screen yet: don't download anything. Off screen or hidden tab: pause.
      if (!this.visible && !video.getAttribute('src')) return;
      if (!this.visible || document.hidden || this.pausedByShopper) {
        video.pause();
        this.setPausedState(this.pausedByShopper);
        return;
      }

      if (video.getAttribute('src') !== src) {
        video.classList.remove('is-playing');
        video.setAttribute('src', src);
        video.preload = 'auto';
      }

      video.muted = true;
      const playing = video.play();
      if (playing && playing.catch) {
        // Autoplay blocked (e.g. iOS Low Power Mode): keep the picture.
        playing.catch(() => this.setPausedState(true));
      }
    }

    setPausedState(paused) {
      this.classList.toggle('is-paused', paused);
      if (!this.toggle) return;
      this.toggle.setAttribute(
        'aria-label',
        paused ? this.toggle.dataset.labelPlay : this.toggle.dataset.labelPause
      );
    }
  }

  customElements.define('image-banner', ImageBanner);
})();
