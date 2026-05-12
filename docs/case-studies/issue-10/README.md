# Issue 10 Case Study: Models Catalog Refresh

## Source Material

- Issue: https://github.com/link-assistant/models/issues/10
- Pull request: https://github.com/link-assistant/models/pull/11
- Upstream data: https://models.dev/api.json
- CI/CD templates reviewed:
  - https://github.com/link-foundation/js-ai-driven-development-pipeline-template
  - https://github.com/link-foundation/rust-ai-driven-development-pipeline-template
  - https://github.com/link-foundation/python-ai-driven-development-pipeline-template
  - https://github.com/link-foundation/csharp-ai-driven-development-pipeline-template

The issue had no comments at the time of analysis. PR 11 was a draft with only
the initial task commit and a passing `lint-and-test` check.

## Timeline

- May 12, 2026 18:55 UTC: Branch `issue-10-3bb8667681f8` was prepared with PR
  11.
- May 12, 2026 18:56 UTC: Existing PR check `lint-and-test` passed on the
  initial branch.
- May 12, 2026 19:00 UTC: Local baseline `lint`, `test`, and `build` passed.
  The old tests emitted React `act(...)` warnings for two synchronous header and
  footer assertions.
- May 12, 2026 19:01 UTC: `models.dev/api.json` was downloaded and inspected:
  120 providers and 4,490 models.
- May 12, 2026 19:19 UTC: The replacement UI and generated data path were in
  place and the first focused test pass surfaced a status-label assertion issue,
  which was corrected.

## Requirements

- Add a way to update model data from models.dev.
- Add a manual GitHub Action for data refresh.
- Add a weekly scheduled GitHub Action for data refresh.
- Replace the fake/demo UI with a professional interface.
- Show all models by default in a table/list view.
- Add browser-side search/filtering.
- Allow selecting a model and viewing a dedicated model page.
- Write a detailed project README.
- Compare CI/CD setup against the linked templates and reuse relevant practices.
- Compile issue analysis under `docs/case-studies/issue-10`.
- Preserve enough debugging and validation to identify future data-refresh
  failures.

## Root Causes

- The repository had only a small hand-generated Anthropic subset instead of a
  repeatable models.dev ingestion path.
- The website consumed `.lino` files directly through Vite glob imports, which
  produced one JavaScript chunk per model and did not scale cleanly to thousands
  of models.
- The default UI was a vertical card demo. It did not provide the dense scanning,
  filtering, or dedicated detail workflow expected for a model catalog.
- Workflows lacked a data-refresh job, explicit timeouts, manual dispatch for PR
  checks, build artifacts, and generated-data validation.
- Documentation still described the Vite template instead of this repository.

## Solution

- Added `scripts/update-models-data.mjs` to download models.dev, normalize the
  catalog, generate `website/public/models.json`, and regenerate
  `providers/**/*.lino`.
- Added `npm --prefix website run check:data` so CI can verify that generated
  JSON and Links Notation files are present.
- Replaced direct `.lino` imports in the browser with a single static JSON
  catalog.
- Rebuilt the React app around a searchable table and hash-based model detail
  routes that work on GitHub Pages.
- Added tests for the table view, search behavior, detail navigation, direct
  hash routes, and catalog utility functions.
- Added `Update models.dev data`, a workflow with manual and weekly scheduled
  triggers that refreshes data, validates it, runs tests/build, and opens or
  updates a pull request when data changes.
- Updated PR and deploy workflows with timeouts, concurrency, explicit
  permissions, generated-data validation, and build artifact handling.
- Replaced template README content with project-specific usage and data-refresh
  documentation.

## Template Comparison

Relevant practices reused from the linked templates:

- `workflow_dispatch` support for manual reruns.
- `timeout-minutes` on jobs to avoid hung CI.
- `permissions` blocks scoped to the workflow need.
- `concurrency` groups to avoid stale runs blocking newer runs.
- `npm ci --prefix website` so commands stay explicit and do not depend on the
  runner working directory.
- Build artifacts with `if-no-files-found: error`.
- Generated data validation as a first-class CI step.

Practices not copied:

- Full package release automation and changesets. This repository deploys a
  static website and generated data, not a package release.
- Multi-runtime and multi-OS test matrices. The current blast radius is a Vite
  website, and the existing CI model is a single Ubuntu job.
- Link checking and secret scanning workflows. They are useful follow-ups but
  were outside the direct issue requirements.

No reproducible CI/CD template bug was identified that required opening issues
against the template repositories.

## Follow-Up Risks

- The generated catalog is large. The UI now loads one JSON file, but future
  growth may justify compression, paging, or a generated search index.
- The scheduled update workflow depends on `GITHUB_TOKEN` permissions to create
  or edit pull requests. If repository settings restrict that token, the refresh
  will still validate data but fail at PR creation.
- models.dev can add fields that are not yet displayed. The normalizer preserves
  the fields currently used by the website and Links Notation output.
