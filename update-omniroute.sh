#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  AI Platform — Automated OmniRoute Submodule Update
# ══════════════════════════════════════════════════════════════════════════════
#
#  Fetches the latest upstream OmniRoute changes, merges them into your custom
#  branch, updates the submodule pointer, and deploys.
#
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OMNIROUTE_DIR="${SCRIPT_DIR}/OmniRoute"

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info()  { echo -e "${BLUE}[i]${NC} $1"; }

echo ""
echo -e "${CYAN}${BOLD}═══ OmniRoute Submodule Auto-Update ═══${NC}"
echo ""

# Check directory
if [[ ! -d "${OMNIROUTE_DIR}" ]]; then
    error "OmniRoute directory not found at ${OMNIROUTE_DIR}"
fi

# Step 1: Check git status of parent repo
cd "${SCRIPT_DIR}"
if [[ -n "$(git status --porcelain)" ]]; then
    warn "Parent repository has uncommitted changes. Stashing before continuing..."
    git stash
fi

# Step 2: Fetch and Merge Upstream inside OmniRoute
cd "${OMNIROUTE_DIR}"
info "Fetching upstream updates..."
git fetch upstream

CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "detached")
if [[ "${CURRENT_BRANCH}" == "detached" ]]; then
    warn "Submodule is in a detached HEAD state. Checking out 'main' branch..."
    git checkout main
    CURRENT_BRANCH="main"
fi

info "Submodule currently on branch: ${CURRENT_BRANCH}"

if [[ -n "$(git status --porcelain)" ]]; then
    warn "Submodule has uncommitted modifications. Stashing..."
    git stash
fi

info "Merging upstream/main into ${CURRENT_BRANCH}..."
set +e
git merge upstream/main -m "Merge latest upstream updates"
MERGE_RC=$?
set -e

if [[ $MERGE_RC -ne 0 ]]; then
    echo ""
    echo -e "${RED}${BOLD}🚨 MERGE CONFLICT DETECTED IN SUBMODULE!${NC}"
    echo "Please resolve conflicts manually in the OmniRoute folder:"
    echo "  cd OmniRoute"
    echo "  git status"
    echo "  # Resolve conflicts, commit, then rerun this script."
    exit 1
fi

log "Submodule merge successful!"

# Pop stashes if they were created
set +e
git stash pop &>/dev/null
cd "${SCRIPT_DIR}"
git stash pop &>/dev/null
set -e

# Step 3: Record the updated submodule pointer in parent repo
info "Staging the updated submodule pointer..."
git add OmniRoute

# Step 4: Run Deploy
echo ""
info "Triggering rolling deployment to restart containers..."
if [[ -x "${SCRIPT_DIR}/deploy.sh" ]]; then
    "${SCRIPT_DIR}/deploy.sh"
else
    error "deploy.sh not executable or not found at ${SCRIPT_DIR}/deploy.sh"
fi

echo ""
log "OmniRoute updated and deployed successfully!"
echo ""
