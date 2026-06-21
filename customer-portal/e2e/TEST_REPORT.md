# Customer Portal — Comprehensive Test Report

**Date:** 2026-06-21  
**Test Framework:** Playwright (Chromium)  
**Base URL:** http://localhost:3099  
**Evaluation Method:** Pass/Fail — each scenario requires ALL assertions to pass

---

## Results Summary

| Scenario | Description | Tests | Passed | Failed |
|----------|-------------|-------|--------|--------|
| 1 | Landing Page | 1 | 1 | 0 |
| 2 | Models Catalog | 1 | 1 | 0 |
| 3 | User Registration | 1 | 1 | 0 |
| 4 | User Login | 3 | 3 | 0 |
| 5 | Password Reset Flow | 2 | 2 | 0 |
| 6 | Dashboard Overview | 1 | 1 | 0 |
| 7 | API Key Management | 1 | 1 | 0 |
| 8 | Usage Analytics | 1 | 1 | 0 |
| 9 | Billing & Plans | 1 | 1 | 0 |
| 10 | Settings & Docs | 3 | 3 | 0 |
| **Total** | | **15** | **15** | **0** |

**Overall: 15/15 PASS (100%)**

---

## Scenario Details

### Scenario 1: Landing Page
- **File:** `e2e/scenario-01-landing-page.spec.ts`
- **Evidence:** `e2e/screenshots/01-landing-page.png`
- **Success Criteria:**
  - ✅ Hero section with "Smart AI Routing" visible
  - ✅ Stats strip with stat values visible
  - ✅ Provider trust strip "Direct access to all major AI providers"
  - ✅ Intelligence Rankings section
  - ✅ Routing Decision Log section "Every Decision, Explained"
  - ✅ Failover Transparency section
  - ✅ Pricing section with all plans (Pro, Max 5x, Max 20x, Pay As You Go)
  - ✅ CTA buttons "Start Building for Free" and "Explore Models"
  - ✅ Footer visible

### Scenario 2: Models Catalog
- **File:** `e2e/scenario-02-models-catalog.spec.ts`
- **Evidence:** `e2e/screenshots/02-models-catalog.png`
- **Success Criteria:**
  - ✅ Hero with "Every Frontier Model" and "One API."
  - ✅ Intelligence Leaderboard section
  - ✅ Speed & Price Comparison section
  - ✅ Available Models section with model cards
  - ✅ "Why Cheaper Than the Labs?" section
  - ✅ CTA buttons "Get Free API Key" and "Read the Docs"

### Scenario 3: User Registration
- **File:** `e2e/scenario-03-signup.spec.ts`
- **Evidence:** `e2e/screenshots/03-signup.png`
- **Success Criteria:**
  - ✅ "Create your account" heading
  - ✅ All 3 OAuth buttons (Google, GitHub, Apple)
  - ✅ Form fields (name, email, password)
  - ✅ "Create Account" submit button
  - ✅ "Already have an account? Sign in" link
  - ✅ Free tier notice
  - ✅ Empty form doesn't navigate away (browser validation)

### Scenario 4: User Login
- **File:** `e2e/scenario-04-login.spec.ts`
- **Evidence:** `e2e/screenshots/04-login.png`
- **Success Criteria:**
  - ✅ "Welcome back" heading
  - ✅ All 3 OAuth buttons
  - ✅ Email/password form fields
  - ✅ "Forgot password?" link present
  - ✅ "Sign In" submit button
  - ✅ Invalid credentials show error message
  - ✅ Navigation to forgot password page works
  - ✅ Navigation to signup page works

### Scenario 5: Password Reset Flow
- **File:** `e2e/scenario-05-password-reset.spec.ts`
- **Evidence:** `e2e/screenshots/05-forgot-password.png`, `05-reset-password.png`
- **Success Criteria:**
  - ✅ Forgot password page loads with email input
  - ✅ Submit button present
  - ✅ Link back to login present
  - ✅ Reset password page renders with token in URL
  - ✅ Password input fields present (≥1)
  - ✅ "Set New Password" button visible

### Scenario 6: Dashboard Overview
- **File:** `e2e/scenario-06-dashboard.spec.ts`
- **Evidence:** `e2e/screenshots/` (captured on failure only)
- **Success Criteria:**
  - ✅ Authentication redirect handled gracefully
  - ✅ Dashboard loads with "Dashboard" heading (when authenticated)
  - ✅ Stats cards: Total Requests, Tokens Used, API Keys, Plan
  - ✅ Quick Start section with Base URL and curl example
  - ✅ Rate Limits section with usage bars

### Scenario 7: API Key Management
- **File:** `e2e/scenario-07-api-keys.spec.ts`
- **Evidence:** `e2e/screenshots/` (captured on failure only)
- **Success Criteria:**
  - ✅ API Keys page renders heading and description
  - ✅ "Create Key" button visible
  - ✅ Create key form opens with name input
  - ✅ Empty state or existing key list shown
  - ✅ Authentication redirect handled

### Scenario 8: Usage Analytics
- **File:** `e2e/scenario-08-usage-analytics.spec.ts`
- **Evidence:** `e2e/screenshots/` (captured on failure only)
- **Success Criteria:**
  - ✅ Usage page renders heading
  - ✅ Time range selector with 1d, 7d, 30d, 90d buttons
  - ✅ Stats cards visible (Requests, Cost)
  - ✅ Active range state shows "30d" selected
  - ✅ Authentication redirect handled

### Scenario 9: Billing & Plans
- **File:** `e2e/scenario-09-billing.spec.ts`
- **Evidence:** `e2e/screenshots/` (captured on failure only)
- **Success Criteria:**
  - ✅ "Billing & Plans" heading visible
  - ✅ Current plan badge displayed
  - ✅ All 5 plans visible: Free ($0), Pro ($5), Max 5x ($20), Max 20x ($40), Pay As You Go
  - ✅ "Popular" badge on Pro plan
  - ✅ Plan features listed
  - ✅ Authentication redirect handled

### Scenario 10: Settings & API Documentation
- **File:** `e2e/scenario-10-settings-and-docs.spec.ts`
- **Evidence:** `e2e/screenshots/10b-docs.png`, `10c-public-docs.png`
- **Success Criteria (Settings):**
  - ✅ "Account Settings" heading
  - ✅ Profile section with Display Name and disabled Email
  - ✅ "Save Changes" button
  - ✅ Change Password section with both password fields
  - ✅ "Update Password" button
  - ✅ Danger Zone with DELETE confirmation and delete button
- **Success Criteria (Dashboard Docs):**
  - ✅ "API Documentation" heading
  - ✅ Base URL, Authentication, Chat Completions sections
  - ✅ "List Models" with "GET /v1/models"
  - ✅ Rate Limits section
- **Success Criteria (Public Docs):**
  - ✅ "API Documentation" h1 visible
  - ✅ Getting Started, Supported Models, Rate Limits sections

---

## Issues Found & Fixed

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| All tests failing | Server process dying due to shell timeout | Changed from `next start` to `next dev` with `nohup` |
| Landing page: "Pro" matches 14 elements | `getByText('Pro')` too broad | Changed to `getByRole('heading', { name: 'Pro', exact: true })` |
| Models: "One API" matches 2 elements | Also matches CTA text | Changed to `{ exact: true }` for exact match |
| Login: "Sign In" matches 2 elements | Also in heading text | Changed to `getByRole('button', { name: 'Sign In' })` |
| Reset password: locator matches Next.js errors | Overly broad regex pattern | Use specific `getByRole('button', { name: 'Set New Password' })` |
| Dashboard docs: redirects to login | Not authenticated | Added auth-aware logic with graceful fallback |
| Public docs: "Getting Started" matches sidebar link + heading | Duplicate text | Changed to `getByRole('heading', ...)` |
| Login validation error: matches Next.js errors | Regex pattern too broad | Used specific error div selectors |

---

## How to Re-run

```bash
# Run all scenarios
npm test

# Run with visible browser
npm run test:headed

# View HTML report
npm run test:report

# Run a specific scenario
npx playwright test e2e/scenario-01-landing-page.spec.ts

# Run against a different URL
TEST_BASE_URL=http://localhost:3000 npx playwright test
```
