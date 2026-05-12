# Models Website

React and Vite frontend for the generated AI model catalog.

## Commands

```sh
npm ci
npm run dev
npm run lint
npm run test
npm run build
```

The app reads `public/models.json`, which is generated from the repository root
with:

```sh
npm run update:data
```

Run `npm run check:data` to verify that the committed JSON catalog and
`providers/**/*.lino` files are present and consistent enough for the website to
build.
