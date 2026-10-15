# Web interface

React application for both the event player flow and protected administration interface.

```sh
npm install
npm run dev
```

The development server proxies API, health and uploaded file requests through
the local application at `http://localhost:8088`. Override this with
`API_PROXY_TARGET` when another local address is required.

Quality checks:

```sh
npm run lint
npm run test
npm run build
```
