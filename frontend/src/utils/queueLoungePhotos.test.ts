import { queueLoungePhotos } from './queueLoungePhotos';

test('paints first two src immediately and queues the rest until load', () => {
  document.body.innerHTML = `
    <ul>
      <li><img data-src="/a.jpg" alt="a" /></li>
      <li><img data-src="/b.jpg" alt="b" /></li>
      <li><img data-src="/c.jpg" alt="c" /></li>
    </ul>
  `;
  const root = document.querySelector('ul') as HTMLElement;
  const stop = queueLoungePhotos(root);
  const imgs = Array.from(root.querySelectorAll('img'));
  expect(imgs).toHaveLength(3);
  expect(imgs[0].getAttribute('src')).toBe('/a.jpg');
  expect(imgs[1].getAttribute('src')).toBe('/b.jpg');
  expect(imgs[2].getAttribute('src')).toBeNull();
  imgs[0].dispatchEvent(new Event('load'));
  expect(imgs[2].getAttribute('src')).toBe('/c.jpg');
  stop();
});
