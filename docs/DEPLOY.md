# Deploying to Azure

Academy runs as a single container on **Azure Container Apps**. GitHub Actions builds and deploys it, and the infrastructure is defined in Bicep (`infra/main.bicep`).

```
                    ┌──────────────── Resource group ────────────────────────────┐
  Browser ──HTTPS──▶│ Container App (Next.js, 1–3 replicas, /api/health probes)  │
     │              │   │  user-assigned managed identity                        │
     │              │   ├──▶ Azure Container Registry   (AcrPull)                │
     │              │   ├──▶ Storage account, "media"    (Blob Data Contributor) │
     │              │   ├──▶ Key Vault secrets           (Secrets User)          │
     │              │   └──▶ PostgreSQL Flexible Server  (TLS, password from KV) │
     │              │ Log Analytics ◀── container logs                          │
     │              └────────────────────────────────────────────────────────────┘
     └──── sign-in ───▶ Microsoft Entra ID (app registration, Graph User.Read)
```

- No registry passwords or storage keys: the app reaches ACR, Blob Storage and Key Vault with its managed identity, and shared-key access on the storage account is turned off.
- GitHub Actions signs in to Azure with **OIDC** (a federated credential), so no Azure credentials are stored in GitHub.
- Secrets (`AUTH_SECRET`, the Entra client secret and the database URL) live in Key Vault. The container app references them; they never appear in plain configuration.
- Database migrations run automatically when the app starts. A Postgres advisory lock makes sure only one replica migrates at a time.

## Prerequisites

- An Azure subscription where you can create resources **and role assignments** (Owner, or Contributor + User Access Administrator).
- Permission to create app registrations in Entra ID.
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) (`az login`), [GitHub CLI](https://cli.github.com) (`gh auth login`) and `openssl`. Docker is **not** needed locally: images are built in GitHub Actions.

## Option A: bootstrap script (recommended)

From a bash shell (Git Bash, WSL, macOS or Linux) in the repo root:

```bash
RESOURCE_GROUP=att-prod LOCATION=uksouth ./infra/bootstrap.sh
```

The script:

1. creates the resource group;
2. creates the **sign-in app registration** (single tenant, Microsoft Graph `User.Read`, a localhost redirect URI for development) and a client secret;
3. creates the **deployment identity** with a federated credential for `repo:<owner>/<repo>:environment:production`, and gives it Contributor + User Access Administrator on the resource group (Bicep needs the latter to grant the app's managed identity its roles);
4. sets the GitHub variables and secrets listed below. It generates `AUTH_SECRET` and `POSTGRES_ADMIN_PASSWORD` only if they don't already exist.

Then deploy and add the production redirect URI. The script prints the exact commands:

```bash
gh workflow run deploy.yml
# when the run is green:
FQDN=$(az containerapp show -g att-prod -n att-app --query properties.configuration.ingress.fqdn -o tsv)
az ad app update --id <sign-in app id> --web-redirect-uris \
  "https://$FQDN/api/auth/callback/microsoft-entra-id" \
  "http://localhost:3000/api/auth/callback/microsoft-entra-id"
```

Sign in with an email from `INITIAL_ADMIN_EMAILS` and you're an admin. From then on, every push to `main` deploys.

## Option B: manual setup

### 1. Sign-in app registration (Entra admin center)

1. **App registrations → New registration**
   - Name: `Academy`
   - Supported account types: *Accounts in this organizational directory only*
   - Redirect URI (Web): `https://<your-app-fqdn>/api/auth/callback/microsoft-entra-id`. You can add this after the first deployment; add `http://localhost:3000/api/auth/callback/microsoft-entra-id` for local development.
2. **API permissions**: make sure Microsoft Graph → Delegated → `User.Read` is listed. It's the default. Optionally, *Grant admin consent*.
   The app reads each user's `department` and `jobTitle` from Graph at sign-in. Team leaderboards and manager scopes use the department, so make sure it's filled in for your users.
3. **Certificates & secrets → New client secret**. Copy the value.
4. Note the **Application (client) ID** and **Directory (tenant) ID**.

### 2. Deployment identity (OIDC)

1. Create a second app registration, e.g. `Academy GitHub deploy`.
2. **Certificates & secrets → Federated credentials → Add**: *GitHub Actions deploying Azure resources*, your org/repo, entity type **Environment**, name `production`.
3. On the resource group, assign this app's service principal **Contributor** and **User Access Administrator**.

### 3. GitHub repository settings

**Settings → Secrets and variables → Actions**

| Variables              | Value                                                                    |
| ---------------------- | ------------------------------------------------------------------------ |
| `AZURE_CLIENT_ID`      | Deployment identity's client ID                                           |
| `AZURE_TENANT_ID`      | Tenant ID                                                                 |
| `AZURE_SUBSCRIPTION_ID`| Subscription ID                                                           |
| `AZURE_RESOURCE_GROUP` | e.g. `att-prod`. **Setting this enables the deploy workflow.**            |
| `AZURE_NAME_PREFIX`    | Resource name prefix, default `att`                                       |
| `ENTRA_TENANT_ID`      | Tenant ID users sign in to                                                |
| `ENTRA_CLIENT_ID`      | Sign-in app's client ID                                                   |
| `INITIAL_ADMIN_EMAILS` | Comma-separated emails that become admins                                 |
| `APP_NAME`             | Display name baked into the image (default `Academy`)                     |
| `APP_TIMEZONE`         | Optional, default `Europe/London`                                         |
| `MIN_REPLICAS`         | Optional, default `1`. `0` scales to zero but adds cold starts.           |

| Secrets                   | Value                                                                  |
| ------------------------- | ---------------------------------------------------------------------- |
| `ENTRA_CLIENT_SECRET`     | Sign-in app's client secret                                            |
| `AUTH_SECRET`             | `openssl rand -base64 33`. Changing it signs everyone out.             |
| `POSTGRES_ADMIN_PASSWORD` | Strong password (12+ chars, upper, lower, digit)                        |

### 4. Deploy

Push to `main` or run **Actions → Deploy to Azure → Run workflow**. The workflow:

1. provisions or updates the infrastructure (`infra/main.bicep`), keeping the image that's running now;
2. builds the Docker image and pushes it to ACR, tagged with the commit SHA;
3. rolls out a new revision with that image;
4. smoke-tests `/api/health` and puts the app URL and redirect URI in the run summary.

On the very first run, the container app briefly uses a placeholder image until step 3.

## Manual deployment without GitHub

```bash
export ENTRA_TENANT_ID=... ENTRA_CLIENT_ID=... ENTRA_CLIENT_SECRET=... \
       AUTH_SECRET=$(openssl rand -base64 33) POSTGRES_ADMIN_PASSWORD=... \
       INITIAL_ADMIN_EMAILS=you@company.com
az deployment group create -g att-prod -n infra --parameters infra/main.bicepparam   # placeholder image
ACR=$(az deployment group show -g att-prod -n infra --query properties.outputs.acrName.value -o tsv)
az acr build -r "$ACR" -t att:v1 .
CONTAINER_IMAGE="$ACR.azurecr.io/att:v1" az deployment group create -g att-prod -n infra --parameters infra/main.bicepparam
```

## Operations

- **Logs**: `az containerapp logs show -g att-prod -n att-app --follow`, or query `ContainerAppConsoleLogs_CL` in Log Analytics.
- **Rotate the Entra client secret**: create a new secret, update the `ENTRA_CLIENT_SECRET` GitHub secret and re-run the deploy. Key Vault gets a new version, and the next revision picks it up.
- **Custom domain**: *Container App → Custom domains* (managed certificate). Then add `https://<domain>/api/auth/callback/microsoft-entra-id` to the sign-in app's redirect URIs.
- **Scaling**: 1 to 3 replicas at 0.5 vCPU / 1 GiB each, scaling on 50 concurrent requests per replica. Adjust in `main.bicep`.
- **Database size**: Burstable `Standard_B1ms` with 32 GB that grows automatically. Override `postgresSkuName` and `postgresSkuTier` for larger organisations. Backups are kept for 7 days.
- **Costs**: the always-on replica, the Postgres server and Log Analytics ingestion are the main costs. Use the Azure pricing calculator for your region.

## Hardening options

The defaults are secure for most internal tools: TLS everywhere, no shared keys and secrets in Key Vault. For stricter environments:

- Put the Container Apps environment and Postgres in a **VNet** (Postgres private access) and remove the `AllowAllAzureServices` firewall rule.
- Add **private endpoints** for Storage and Key Vault, and turn off their public network access.
- Switch Postgres to **Entra ID authentication** for the managed identity. This needs a token-refreshing connection in `src/db/index.ts`.
- Restrict the deployment identity using *Role Based Access Control Administrator* with a condition that allows only the three roles the template assigns.
