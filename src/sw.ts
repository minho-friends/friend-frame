export const serviceWorkerModuleResponseBody = `
  importScripts(
    'https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js'
  );
  workbox.setConfig({
    debug: true,  // FIXME: experimental.
  });
  workbox.loadModule('workbox-routing');
  workbox.loadModule('workbox-strategies');
  workbox.loadModule('workbox-broadcast-update');

  workbox.routing.registerRoute(
    ({url}) => [
      'openapi.map.naver.com',
      'nrbe.map.naver.net',
      'oapi.map.naver.com',
    ].includes(url.hostname),
    new workbox.strategies.NetworkOnly(),
  );

  // FIXME: POST doesn't covered on workbox.
  workbox.routing.registerRoute(
    'http://localhost:8787/ajax/get_map_data.cm',
    new workbox.strategies.StaleWhileRevalidate({
      plugins: [new workbox.broadcastUpdate.BroadcastUpdatePlugin()],
      matchOptions: {
        ignoreVary: true,
        ignoreMethod: true,
      },
    }),
    'POST'
  );

  workbox.routing.registerRoute(
    ({url}) => url.pathname.startsWith('/'),
    new workbox.strategies.StaleWhileRevalidate({
      plugins: [new workbox.broadcastUpdate.BroadcastUpdatePlugin()],
      matchOptions: {
        ignoreVary: true,  // FIXME: experimental.
        ignoreMethod: true,  // FIXME: experimental.
      },
    }),
  );

  addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    }
  });
`;

export const serviceWorkerModuleResposneHeaders = (() => {
  const _ = new Headers();
  _.set('Content-Type', 'text/javascript');
  _.set('Cache-Control', `max-age=${60 * 60 * 1}`);
  // NOTE: kill switch of service worker.
  _.set('Clear-Site-Data', '');
  return _;
})();


export const serviceWorkerInstallerModule = `
  <script type="module">
    import {Workbox} from 'https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-window.prod.mjs';

    if ('serviceWorker' in navigator) {
      const wb = new Workbox((new URL('/sw.js', (new URL(location.href)).origin)).href);

      wb.addEventListener('waiting', (event) => {
        wb.addEventListener('controlling', () => {
          window.location.reload();
        });
        wb.messageSkipWaiting();
      });
  
      wb.register();
    }
  </script>
`;