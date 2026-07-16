# EcoMind Repository Repair - Changelog

## Frontend Changes
- **`package.json`**:
  - **Syntax Fix**: Removed duplicate and malformed `devDependencies` block that prevented `npm install` from working.
  - **React Pinning**: Changed `"react"` and `"react-dom"` from `^18.2.0` to `~18.3.1`.
    - *Reason*: Avoids unintentional upgrades to React 19, which breaks `@react-three/fiber` (React 19 removed the `ReactCurrentOwner` internal API).
- **`craco.config.js`**:
  - **Removed Emergent Config**: Deleted the `@emergentbase/visual-edits/craco` fallback check and plugin configuration.
    - *Reason*: Eliminates the requirement for the unavailable internal `emergent` package and ensures standard local compilation.
- **`public/index.html`**:
  - **Removed Tracking**: Deleted the PostHog and Emergent tracking script blocks (`https://assets.emergent.sh/scripts/emergent-main.js` and inline posthog configs).
  - **Updated Meta**: Changed meta description and title to standard "EcoMind" instead of "Emergent | Fullstack App".
    - *Reason*: Stops network errors and removes telemetry tracking that was specific to the agent's internal platform.
- **`src/context/AuthContext.jsx`**:
  - **Bypassed Emergent Auth**: Modified `loginWithGoogle` function to stop redirecting to `https://auth.emergentagent.com/`. Replaced it with an alert placeholder.
    - *Reason*: The Emergent authentication server is not accessible outside their platform.
- **`src/pages/Chat.jsx`**:
  - **Fixed React Hook Warning**: Rewrote `loadChats` using `useCallback` with a functional state update to `setActiveId`.
    - *Reason*: Resolved an ESLint exhaustiveness warning that was blocking `npm run build` in CI.

## Backend Changes
- **`requirements.txt`**:
  - **Removed Emergent Wheel**: Replaced `litellm @ https://customer-assets.emergentagent.com/...` with the standard PyPI package `litellm`.
    - *Reason*: The custom wheel URL failed to resolve locally. Standard `litellm` provides identical functionality.
  - **Unpinned Conflicting Packages**: Unpinned `cryptography`, `numpy`, `markdown-it-py`, `fsspec`, `boto3`, `botocore`, `isort`, `packaging`, `pandas`, `pillow`, `rich`, and `tenacity`.
    - *Reason*: The previously hardcoded specific versions created an unsolvable pip dependency conflict (e.g. `pyopenssl 24.2.1` requires `cryptography<44`, but `cryptography==49.0.0` was pinned).
- **`ai_service.py`**:
  - **Replaced Emergent Integrations**: Removed `from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone`.
  - **Local Wrapper**: Implemented a local `LlmChat`, `UserMessage`, `TextDelta`, and `StreamDone` class relying directly on the standard `litellm.acompletion` API.
    - *Reason*: The `emergentintegrations` package is not open-source. Using a standard `litellm` wrapper retains full compatibility with the existing streaming endpoints without altering the rest of the codebase.
- **`auth.py`**:
  - **Removed Emergent Auth Endpoint**: Replaced the `create_session_from_google` API request to `https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data` with a `501 Not Implemented` mock.
    - *Reason*: Prevents server initialization/runtime failures when encountering missing session environments.

## Deployment & Cleanup
- **`vercel.json`**:
  - **Created Config**: Configured Vercel to use `@vercel/static-build` for the React frontend and `@vercel/python` for the FastAPI backend. Configured proxy routing so `/api/*` goes to `server.py` and everything else goes to the static React bundle.
    - *Reason*: Necessary for deploying a Python/React monorepo to Vercel correctly.
- **`.env.example` (Frontend & Backend)**:
  - **Created Files**: Added reference environment files (`frontend/.env.example` and `backend/.env.example`).
    - *Reason*: Documents required environment variables (e.g. `MONGO_URL`, `JWT_SECRET`, `LLM_API_KEY`).
- **`.emergent` Directory**:
  - **Removed**: Deleted the entire directory.
    - *Reason*: Removed agent-specific caches and configuration files that are irrelevant to the core repository.
