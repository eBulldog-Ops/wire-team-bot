# wire-apps-js-sdk dependency

The bot depends on [wire-apps-js-sdk](https://github.com/wireapp/wire-apps-js-sdk). The SDK is **not** published to npm; it must be built from source (`npm run build:setup && npm run build`).

## Recommended: fork + submodule

**Use this when** you need to pin a specific commit and/or maintain patches (e.g. TypeScript types, Composite/Reaction support) in your own fork.

1. **Fork** `wireapp/wire-apps-js-sdk` to your GitHub org/user (e.g. `yourorg/wire-apps-js-sdk`).

2. **Remove the in-repo SDK folder from git** (keep the folder on disk until the submodule is in place, or remove it and add the submodule in one go):
   ```bash
   git rm -r --cached wire-apps-js-sdk   # stop tracking
   # If you want to delete the folder from disk too:
   # rm -rf wire-apps-js-sdk
   ```

3. **Add your fork as a submodule** (same path so `file:./wire-apps-js-sdk` in package.json still works):
   ```bash
   git submodule add https://github.com/YOUR_ORG/wire-apps-js-sdk.git wire-apps-js-sdk
   ```
   Or use upstream if you don't need a fork:
   ```bash
   git submodule add https://github.com/wireapp/wire-apps-js-sdk.git wire-apps-js-sdk
   ```

4. **Commit** the new `.gitmodules` and the submodule reference:
   ```bash
   git add .gitmodules wire-apps-js-sdk
   git commit -m "chore: use wire-apps-js-sdk as git submodule"
   ```

5. **Clone flow** for others / CI:
   ```bash
   git clone --recurse-submodules https://github.com/YOUR_ORG/wire-team-bot.git
   cd wire-team-bot && npm install
   ```
   Or if already cloned without submodules:
   ```bash
   git submodule update --init --recursive
   npm install
   ```

6. **Dockerfile** must fetch submodules before `npm install`. Two options:
   - **Option A (recommended):** Ensure submodules are checked out *before* building the image (e.g. in CI run `git submodule update --init --recursive` before `docker build`). Then the build context contains the full `wire-apps-js-sdk` directory and the existing `COPY wire-apps-js-sdk ./wire-apps-js-sdk` works.
   - **Option B:** In the Dockerfile, copy `.git` and `.gitmodules` and run `git submodule update --init --recursive` before `npm install`. That requires `.git` in the build context (often done in CI; avoid excluding it via `.dockerignore` for the submodule to resolve).

## Alternative: git dependency (no submodule)

**Use this when** you don't want a submodule and are okay with npm installing the SDK from GitHub (and running its build in postinstall).

1. **Remove the SDK folder** from the repo (and from disk if you like):
   ```bash
   git rm -r --cached wire-apps-js-sdk
   rm -rf wire-apps-js-sdk
   ```

2. **In package.json**, replace the file dependency with a git dependency:
   ```json
   "wire-apps-js-sdk": "github:wireapp/wire-apps-js-sdk#main"
   ```
   Or pin to a tag/commit:
   ```json
   "wire-apps-js-sdk": "github:wireapp/wire-apps-js-sdk#v0.0.1"
   ```
   If you use a fork:
   ```json
   "wire-apps-js-sdk": "github:YOUR_ORG/wire-apps-js-sdk#main"
   ```

3. **Keep a postinstall** that builds the SDK (npm does not run the SDK's build when installing from git). The SDK will be in `node_modules/wire-apps-js-sdk`:
   ```json
   "postinstall": "cd node_modules/wire-apps-js-sdk && npm run build:setup && npm run build"
   ```
   Remove the `sdk:setup` script that references `./wire-apps-js-sdk`, or point it at `node_modules/wire-apps-js-sdk`.

4. **Dockerfile**: no need to COPY the SDK; `npm install` will fetch it. Ensure `package.json` and `package-lock.json` are copied before `RUN npm install`.

5. **Caveat**: `build:setup` runs `npm install` and proto generation inside the SDK. It can be slow and may have platform-specific steps. If that causes issues, prefer the submodule approach and build the submodule in a known path.

## Summary

| Approach            | Pros                                      | Cons                                      |
|---------------------|-------------------------------------------|-------------------------------------------|
| **Fork + submodule**| Pin exact commit; patch in fork; clear ownership | Clone needs `--recurse-submodules`; Docker must handle submodules |
| **Git dependency**  | No submodule; npm fetches SDK             | Postinstall builds in node_modules; build:setup can be heavy |

Recommendation: **fork + submodule** for a cleaner, reproducible setup and the ability to maintain SDK patches in your fork.
