#!/usr/bin/env bash
# =============================================================================
# setup-omniroute.sh
# -----------------------------------------------------------------------------
# Bootstrap script that clones OmniRoute as a STANDALONE git repo (NOT a
# submodule) into ./OmniRoute, then registers the original creator's repo as
# the `upstream` remote so you can pull their updates with:
#
#     cd OmniRoute && git fetch upstream && git merge upstream/main
#
# Why a script instead of a submodule?
#   OmniRoute is an independent project we forked. Keeping it as a submodule
#   caused pointer-drift / two-repo commit headaches. This script reproduces
#   the layout for fresh checkouts and deployments without any submodule glue.
#
# Idempotent: safe to re-run. If ./OmniRoute already exists it is left as-is
# and only the upstream remote is (re)configured.
#
# Usage:
#   scripts/setup-omniroute.sh                 # clone origin/main (latest)
#   scripts/setup-omniroute.sh --ref v3.8.26   # checkout a specific ref/tag/branch
# =============================================================================
set -euo pipefail

# ---- Config -----------------------------------------------------------------
ORIGIN_URL="${OMNIROUTE_ORIGIN_URL:-https://github.com/aikomputeapi-web/OmniRoute.git}"
UPSTREAM_URL="${OMNIROUTE_UPSTREAM_URL:-https://github.com/diegosouzapw/OmniRoute.git}"
BRANCH="${OMNIROUTE_BRANCH:-main}"

# Resolve platform root (one level above this script's directory).
PLATFORM_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${PLATFORM_ROOT}/OmniRoute"

REF=""
if [[ "${1:-}" == "--ref" && -n "${2:-}" ]]; then
  REF="$2"
fi

# ---- Helpers ----------------------------------------------------------------
log()  { printf '\033[1;34m[setup-omniroute]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[setup-omniroute]\033[0m %s\n' "$*" >&2; }
err()  { printf '\033[1;31m[setup-omniroute]\033[0m %s\n' "$*" >&2; }

# ---- Main -------------------------------------------------------------------
if [[ -d "${DEST}/.git" ]]; then
  log "OmniRoute already present at ${DEST} — skipping clone."
else
  if [[ -e "${DEST}" ]]; then
    err "${DEST} exists but is not a git repo. Remove it and re-run."
    exit 1
  fi
  log "Cloning fork (origin) into ${DEST} …"
  git clone --branch "${BRANCH}" "${ORIGIN_URL}" "${DEST}"
fi

cd "${DEST}"

# (Re)register the upstream remote so updates from the original creator can be pulled.
if git remote get-url upstream >/dev/null 2>&1; then
  log "upstream remote already configured."
else
  log "Adding upstream remote (${UPSTREAM_URL}) …"
  git remote add upstream "${UPSTREAM_URL}"
fi

# Optional: check out a specific ref instead of tracking origin/main.
if [[ -n "${REF}" ]]; then
  log "Checking out ref '${REF}' …"
  git fetch --all --tags
  git checkout "${REF}"
else
  log "Staying on origin/${BRANCH} (always latest). Pull upstream updates with:"
  log "  cd OmniRoute && git fetch upstream && git merge upstream/main"
fi

log "Done. OmniRoute is ready at ${DEST}"
