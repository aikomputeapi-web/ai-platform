# Staging Deployment Instructions

This guide explains how to commit, push, and deploy changes to the staging environment.

## Step 1: Commit Your Staged Changes
To commit your current workspace modifications:
```bash
git commit -m "Upgrade admin dashboard: consolidate to 4 parent routes and improve UI layout"
```

## Step 2: Push to the `staging` Branch
The staging/preview environment is configured to deploy automatically whenever a commit is pushed to the `staging` branch on GitHub.

To push the local commit from your `main` branch to the remote `staging` branch, run:
```bash
git push origin main:staging
```
*(You can also run `git push origin main` to sync your GitHub `main` branch).*

---

## Step 3: Automatic Staging Deployment
Once pushed, the GitHub Actions workflow defined in `.github/workflows/deploy-staging.yml` will trigger automatically:
1. It SSHs into the staging server.
2. It pulls the latest changes from the `staging` branch.
3. It runs the `deploy-preview.sh` script to build and launch the isolated preview containers on the preview ports (e.g., portal on port `3301`).

### Checking Deployment Logs & Status
* **On GitHub:** Go to the **Actions** tab in your repository and select the **Deploy to Staging** workflow to see the build output.
* **On the Server:** If you are SSHed into the staging server, you can inspect the preview stack directly:
  ```bash
  # Check preview container status
  docker compose -f docker-compose.unified.yml -f docker-compose.preview.yml -p aikompute-preview ps

  # View preview logs
  docker compose -f docker-compose.unified.yml -f docker-compose.preview.yml -p aikompute-preview logs -f
  ```
