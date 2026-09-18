export function queueLoungePhotos(root: ParentNode | null): () => void {
  if (!root) {
    return () => undefined;
  }
  const imgs = Array.from(root.querySelectorAll('img[data-src]')) as HTMLImageElement[];
  let next = Math.min(2, imgs.length);
  let stopped = false;

  const start = (img: HTMLImageElement | undefined, eager: boolean) => {
    if (!img) return;
    const src = img.getAttribute('data-src');
    if (!src) return;
    if (eager) {
      img.setAttribute('fetchpriority', 'high');
      img.loading = 'eager';
    } else {
      img.loading = 'lazy';
    }
    const onDone = () => {
      img.removeEventListener('load', onDone);
      img.removeEventListener('error', onDone);
      if (stopped) return;
      if (next < imgs.length) {
        const n = next;
        next += 1;
        start(imgs[n], false);
      }
    };
    img.addEventListener('load', onDone);
    img.addEventListener('error', onDone);
    if (img.getAttribute('src') !== src) {
      img.src = src;
    }
    if (img.complete && img.naturalWidth > 0) {
      onDone();
    }
  };

  start(imgs[0], true);
  start(imgs[1], true);

  return () => {
    stopped = true;
  };
}
