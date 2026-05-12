# Models

Models is a generated AI model catalog backed by
[models.dev](https://models.dev/api.json). The repository keeps the model data
as Links Notation files under `providers/` and publishes a searchable React
website from `website/`.

## What Is Included

- `providers/<provider>/models/*.lino`: canonical generated Links Notation
  records for each provider model.
- `website/public/models.json`: normalized catalog consumed by the browser UI.
- `website/`: Vite and React app with the searchable table and model detail
  pages.
- `.github/workflows/update-models.yml`: manual and weekly refresh workflow for
  pulling the latest data from models.dev.

## Local Development

Install dependencies and run the website:

```sh
npm ci --prefix website
npm --prefix website run dev
```

Run the same checks used by CI:

```sh
npm --prefix website run check:data
npm --prefix website run lint
npm --prefix website run test
npm --prefix website run build
```

## Updating Model Data

Refresh the generated catalog from models.dev:

```sh
npm --prefix website run update:data
```

The update script downloads `https://models.dev/api.json`, writes normalized
browser data to `website/public/models.json`, and regenerates the Links Notation
files under `providers/`. The GitHub Actions workflow `Update models.dev data`
runs the same command manually through `workflow_dispatch` and automatically
once per week, then opens or updates a pull request when data changes.

## Website Behavior

The default page shows a table of every model in the catalog. Search filters in
the browser across model name, model id, provider, family, modality, status, and
capability fields. Selecting a model opens a dedicated hash route that works on
GitHub Pages without server-side routing, for example:

```text
#/models/anthropic/claude-sonnet-4-5
```

## Data Source

The upstream source is the public models.dev API. Generated files are committed
so the website can deploy as a static site and reviewers can inspect the exact
Links Notation records that back the UI.
