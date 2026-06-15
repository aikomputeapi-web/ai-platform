# Verdent Integration Plan Notes

This document captures the current plan for adding Verdent as a provider in OmniRoute and automating token capture.

## 1. Local Bridge & Chrome Extension (Client-Side)

These changes are implemented in the cloned repository `/home/stevenleblanc62920/ai-platform/scratch/verdent2api` on the server so they can be copied to the local machine:

### A. Chrome Extension
- **`extension/manifest.json`**: Manifest V3 extension configuration with cookie permissions for `verdent.ai` and host permission for `http://localhost:8787` (the bridge).
- **`extension/background.js`**: Background service worker script. It listens for cookies on `verdent.ai`, captures the HttpOnly `token` cookie when logged in, and POSTs it to `http://localhost:8787/agent/register-token`.

### B. `verdent2api` Bridge Server
- **`src/server.js`**:
  - Add `getEmailFromJwt` to extract email addresses from the payload of a JWT token natively.
  - Add `POST /agent/register-token` endpoint to receive a JWT from the Chrome Extension, extract the email, and persist it to `~/.verdent/verdent2api-tokens.json` in a map (`{ email: token }`).
  - Modify `getRequestAccessToken` to inspect the `Authorization: Bearer <token>` header. If the token is a registered email address, it looks up and returns the matching JWT access token.
  - Modify `getRequestApiToken` so if the Bearer token matches an email address or is a JWT, it returns `null` (allowing the local sidecar to authenticate via the globally cached local `api_token` derived at startup).

---

## 2. OmniRoute Server Configuration (Production-Side)

These changes are applied to the OmniRoute project on the server:

- **`src/shared/constants/providers.ts`**:
  - Register `verdent` under `LOCAL_PROVIDERS` (defaulting to `http://localhost:8787/v1`) with appropriate description and metadata.
  - Add `verdent` to the `SELF_HOSTED_CHAT_PROVIDER_IDS` set to enable standard self-hosted validation rules.
- **`open-sse/executors/default.ts`**:
  - Add case `"verdent"` to the default executor's `buildUrl` logic so requests are routed to standard OpenAI-compatible chat endpoints.
- **`src/shared/components/lobeProviderIcons.ts`**:
  - Map `verdent` to the `OpenAI` icon for a clean visual representation in the dashboard.
- **`tests/unit/provider-hints.test.ts` & `tests/unit/providers-page-utils.test.ts`**:
  - Add unit test coverage and assertions verifying Verdent's behavior and categorization as a self-hosted provider.

---

## 3. General Development Guidelines

- **Always save to git**: Ensure all code changes, scripts, configurations, and documentation are saved/committed to Git regularly. When updating submodules like `OmniRoute`, make sure to commit inside the submodule first, then update the submodule pointer in the main `ai-platform` repository. Use the `/git` workflow command when saving changes to git.
