<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# iOS App Deployment Rule
- **Mandatory On-Device Installation**: Whenever an IPA is built or signed after changes to the codebase, assets, or native iOS configuration, **ALWAYS automatically install the freshly signed IPA on Charis's connected iPhone** (`ideviceinstaller install /home/Charis/projects/Need/xtool/Need.ipa`).
- Do not ask the user for permission to install or stop at merely building/signing; always complete the install cycle and confirm 100% completion.
