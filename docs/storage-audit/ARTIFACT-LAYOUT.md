# Arsenal acceptance artifact layout

The acceptance workflow retains all tests and its browser evidence under `arsenal-product-acceptance`. It uploads the production build once as `arsenal-product-build`, and the Windows launcher shell, SHA marker, checksums and standalone restoration script as `arsenal-product-windows-launcher`. Both build and acceptance evidence use the repository default retention until durable accepted-evidence preservation is available. Diagnostics alone use 7 days. Localization evidence remains unchanged: it can contain unique acceptance screenshots, so shortening it without an archive is not safe.

To reconstruct, download the build and launcher artifacts from the **same run** into separate directories. Run:

```sh
node <launcher-dir>/restore-launcher.mjs restore <build-dir> <launcher-dir> <new-output-dir>
```

The script verifies the SHA-256 manifest for all build and launcher files, preserves `app/ARSENAL_BUILD_SHA.txt`, refuses an existing output directory, and checks the reconstructed app. The workflow runs the reconstructed launcher with PowerShell and verifies its SHA and key HTTP responses. If staging or verification does not succeed, the workflow uploads the original launcher as `arsenal-product-windows-fallback` to avoid losing files. The fallback can duplicate dist by design.

Consumers of the old mixed `arsenal-product-acceptance` artifact must migrate to the split names. No in-repository `actions/download-artifact` reference to that artifact was found, but external consumers are unknown and require owner validation. Older artifacts and their original contents are unchanged.
