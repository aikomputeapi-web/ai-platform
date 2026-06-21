#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  Deploy GCP Cloud Function Relay for OmniRoute
# ══════════════════════════════════════════════════════════════════════════════
#
#  Deploys a Cloud Function that acts as a pass-through HTTP relay proxy,
#  grants the VM's service account permission to invoke it, and optionally
#  registers the function URL in OmniRoute's proxy registry.
#
#  Usage:  ./scripts/deploy-gcp-relay.sh [--register]
#
#    --register   Also register the deployed function URL in OmniRoute's
#                 proxy pool via the management API.
#
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info()  { echo -e "${BLUE}[i]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FUNCTION_DIR="${PROJECT_DIR}/gcp-relay-function"
ENV_FILE="${PROJECT_DIR}/.env"

# ── Configuration ──
FUNCTION_NAME="omniroute-relay"
REGION="us-central1"
RUNTIME="nodejs22"
MEMORY="256MB"
TIMEOUT="120s"
MIN_INSTANCES=0
MAX_INSTANCES=100
ENTRY_POINT="relay"

echo ""
echo -e "${CYAN}${BOLD}═══ GCP Cloud Function Relay — Deploy ═══${NC}"
echo ""

# ── Pre-flight checks ──
command -v gcloud &>/dev/null || error "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
[[ -d "${FUNCTION_DIR}" ]] || error "Function source not found at ${FUNCTION_DIR}"
[[ -f "${FUNCTION_DIR}/index.js" ]] || error "index.js not found in ${FUNCTION_DIR}"
[[ -f "${FUNCTION_DIR}/package.json" ]] || error "package.json not found in ${FUNCTION_DIR}"

# ── Resolve GCP project ──
GCP_PROJECT=$(gcloud config get-value project 2>/dev/null)
[[ -n "${GCP_PROJECT}" ]] || error "No GCP project configured. Run: gcloud config set project YOUR_PROJECT_ID"
log "GCP Project: ${GCP_PROJECT}"

# ── Resolve VM service account ──
VM_SA=$(curl -s -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email" 2>/dev/null || echo "")
if [[ -z "${VM_SA}" ]]; then
  warn "Could not detect VM service account from metadata server."
  warn "Falling back to default compute service account."
  PROJECT_NUMBER=$(gcloud projects describe "${GCP_PROJECT}" --format="value(projectNumber)" 2>/dev/null)
  VM_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
fi
log "VM Service Account: ${VM_SA}"

# ── Enable required APIs ──
info "Ensuring Cloud Functions and Cloud Build APIs are enabled..."
gcloud services enable cloudfunctions.googleapis.com --quiet 2>/dev/null || true
gcloud services enable cloudbuild.googleapis.com --quiet 2>/dev/null || true
gcloud services enable run.googleapis.com --quiet 2>/dev/null || true
gcloud services enable artifactregistry.googleapis.com --quiet 2>/dev/null || true
log "Required APIs enabled"

# ── Deploy the Cloud Function (gen2) ──
info "Deploying Cloud Function '${FUNCTION_NAME}' to ${REGION}..."
echo ""

gcloud functions deploy "${FUNCTION_NAME}" \
  --gen2 \
  --region="${REGION}" \
  --runtime="${RUNTIME}" \
  --source="${FUNCTION_DIR}" \
  --entry-point="${ENTRY_POINT}" \
  --trigger-http \
  --no-allow-unauthenticated \
  --memory="${MEMORY}" \
  --timeout="${TIMEOUT}" \
  --min-instances="${MIN_INSTANCES}" \
  --max-instances="${MAX_INSTANCES}" \
  --set-env-vars="NODE_ENV=production" \
  --quiet

echo ""
log "Cloud Function deployed successfully"

# ── Get the function URL ──
FUNCTION_URL=$(gcloud functions describe "${FUNCTION_NAME}" \
  --region="${REGION}" \
  --gen2 \
  --format="value(serviceConfig.uri)" 2>/dev/null)

if [[ -z "${FUNCTION_URL}" ]]; then
  error "Could not retrieve function URL. Check the deployment status in GCP Console."
fi
log "Function URL: ${FUNCTION_URL}"

# ── Grant invoker permission to the VM service account ──
info "Granting Cloud Functions Invoker role to ${VM_SA}..."

# Gen2 functions are backed by Cloud Run, so we grant run.invoker
gcloud run services add-iam-policy-binding "${FUNCTION_NAME}" \
  --region="${REGION}" \
  --member="serviceAccount:${VM_SA}" \
  --role="roles/run.invoker" \
  --quiet 2>/dev/null

log "IAM policy updated — VM can invoke the function"

# ── Quick smoke test ──
info "Running smoke test..."
ID_TOKEN=$(curl -s -H "Metadata-Flavor: Google" \
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${FUNCTION_URL}" 2>/dev/null || echo "")

if [[ -n "${ID_TOKEN}" ]]; then
  SMOKE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${ID_TOKEN}" \
    -H "x-relay-target: https://httpbin.org" \
    -H "x-relay-path: /ip" \
    "${FUNCTION_URL}" 2>/dev/null || echo "000")

  if [[ "${SMOKE_STATUS}" == "200" ]]; then
    log "Smoke test passed (HTTP ${SMOKE_STATUS})"

    # Show the egress IP for verification
    EGRESS_IP=$(curl -s \
      -H "Authorization: Bearer ${ID_TOKEN}" \
      -H "x-relay-target: https://httpbin.org" \
      -H "x-relay-path: /ip" \
      "${FUNCTION_URL}" 2>/dev/null || echo "{}")
    info "Egress IP from Cloud Function: ${EGRESS_IP}"
  else
    warn "Smoke test returned HTTP ${SMOKE_STATUS} — the function may need a moment to warm up."
    warn "IAM propagation can take up to 60 seconds. Try again shortly."
  fi
else
  warn "Could not fetch identity token — skipping smoke test."
  warn "You can test manually with: curl -H 'Authorization: Bearer <TOKEN>' ${FUNCTION_URL}"
fi

# ── Register in OmniRoute (optional) ──
REGISTER=false
for arg in "$@"; do
  [[ "${arg}" == "--register" ]] && REGISTER=true
done

if [[ "${REGISTER}" == "true" ]]; then
  info "Registering proxy in OmniRoute..."

  # Read OmniRoute credentials from .env
  OMNIROUTE_URL=""
  OMNIROUTE_PASS=""

  if [[ -f "${ENV_FILE}" ]]; then
    OMNIROUTE_URL=$(grep "^OMNIROUTE_PUBLIC_URL=" "${ENV_FILE}" | cut -d= -f2- || echo "")
    OMNIROUTE_PASS=$(grep "^OMNIROUTE_INITIAL_PASSWORD=" "${ENV_FILE}" | cut -d= -f2- || echo "")
  fi

  # Fallback to localhost
  if [[ -z "${OMNIROUTE_URL}" ]]; then
    OMNIROUTE_URL="http://localhost:20128"
    info "Using localhost OmniRoute URL: ${OMNIROUTE_URL}"
  fi

  if [[ -z "${OMNIROUTE_PASS}" ]]; then
    warn "OMNIROUTE_INITIAL_PASSWORD not found in .env — skipping registration."
    warn "Register manually via the OmniRoute dashboard: Settings → Proxy Pool → Add Proxy"
    warn "  Type: gcp"
    warn "  Host: ${FUNCTION_URL#https://}"
    warn "  Port: 443"
  else
    # Login to get auth cookie
    LOGIN_RESPONSE=$(curl -s -c - \
      -X POST "${OMNIROUTE_URL}/api/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"password\":\"${OMNIROUTE_PASS}\"}" 2>/dev/null)

    # Extract cookie from response
    AUTH_COOKIE=$(echo "${LOGIN_RESPONSE}" | grep -oP 'auth_token=\K[^\s;]+' || echo "")

    if [[ -z "${AUTH_COOKIE}" ]]; then
      # Try extracting from Set-Cookie header by re-doing the request
      AUTH_COOKIE=$(curl -s -D - -o /dev/null \
        -X POST "${OMNIROUTE_URL}/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"password\":\"${OMNIROUTE_PASS}\"}" 2>/dev/null \
        | grep -i "set-cookie" | grep -oP 'auth_token=\K[^;\s]+' || echo "")
    fi

    FUNCTION_HOST="${FUNCTION_URL#https://}"

    REGISTER_RESPONSE=$(curl -s -w "\n%{http_code}" \
      -X POST "${OMNIROUTE_URL}/api/settings/proxies" \
      -H "Content-Type: application/json" \
      -H "Cookie: auth_token=${AUTH_COOKIE}" \
      -d "{
        \"name\": \"GCP Relay (${REGION})\",
        \"type\": \"gcp\",
        \"host\": \"${FUNCTION_HOST}\",
        \"port\": 443,
        \"status\": \"active\",
        \"notes\": \"Serverless outbound proxy — rotating GCP egress IPs. Function: ${FUNCTION_NAME}\"
      }" 2>/dev/null)

    REG_STATUS=$(echo "${REGISTER_RESPONSE}" | tail -1)
    REG_BODY=$(echo "${REGISTER_RESPONSE}" | head -n -1)

    if [[ "${REG_STATUS}" == "200" ]] || [[ "${REG_STATUS}" == "201" ]]; then
      log "Proxy registered in OmniRoute!"
      info "Response: ${REG_BODY}"
    else
      warn "Registration returned HTTP ${REG_STATUS}"
      warn "Response: ${REG_BODY}"
      warn ""
      warn "You can register manually via the dashboard:"
      warn "  Settings → Proxy Pool → Add Proxy"
      warn "  Type: gcp | Host: ${FUNCTION_HOST} | Port: 443"
    fi
  fi
fi

# ── Summary ──
echo ""
echo -e "${CYAN}${BOLD}═══ Deployment Summary ═══${NC}"
echo ""
echo -e "  Function Name:    ${GREEN}${FUNCTION_NAME}${NC}"
echo -e "  Region:           ${GREEN}${REGION}${NC}"
echo -e "  Runtime:          ${GREEN}${RUNTIME}${NC}"
echo -e "  URL:              ${GREEN}${FUNCTION_URL}${NC}"
echo -e "  Service Account:  ${GREEN}${VM_SA}${NC}"
echo -e "  Auth:             ${GREEN}IAM (no-allow-unauthenticated)${NC}"
echo ""
echo -e "  ${BOLD}Next Steps:${NC}"
echo -e "  1. If you did not use --register, add the proxy in OmniRoute dashboard:"
echo -e "     Settings → Proxy Pool → Add Proxy"
echo -e "     Type: ${CYAN}gcp${NC}  Host: ${CYAN}${FUNCTION_URL#https://}${NC}  Port: ${CYAN}443${NC}"
echo -e "  2. Assign the proxy to providers/accounts in the dashboard"
echo -e "  3. Verify by checking logs: ${CYAN}[ProxyFetch] Routing via GCP relay${NC}"
echo ""
log "Done!"
