#!/usr/bin/env bash
# One-time setup for deploying Academy to Azure from GitHub Actions.
#
# Creates (or reuses):
#   1. a resource group
#   2. the Entra ID app registration users sign in with (+ client secret)
#   3. a deployment identity for GitHub Actions (OIDC federated credential, no stored keys)
#      with Contributor + User Access Administrator on the resource group
#   4. the GitHub repository variables and secrets the deploy workflow reads
#
# Requirements: Azure CLI (az login), GitHub CLI (gh auth login), openssl.
# Safe to re-run: existing apps are reused, and existing GitHub secrets for AUTH_SECRET
# and POSTGRES_ADMIN_PASSWORD are kept.
#
# Usage (all optional):
#   RESOURCE_GROUP=att-prod LOCATION=uksouth NAME_PREFIX=att APP_DISPLAY_NAME=Academy \
#   INITIAL_ADMIN_EMAILS=you@company.com ./infra/bootstrap.sh
set -euo pipefail

RESOURCE_GROUP="${RESOURCE_GROUP:-att-prod}"
LOCATION="${LOCATION:-uksouth}"
NAME_PREFIX="${NAME_PREFIX:-att}"
APP_DISPLAY_NAME="${APP_DISPLAY_NAME:-Academy}"
APP_TIMEZONE="${APP_TIMEZONE:-Europe/London}"
GITHUB_REPO="${GITHUB_REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"

SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
if [ -z "${INITIAL_ADMIN_EMAILS:-}" ]; then
  INITIAL_ADMIN_EMAILS=$(az ad signed-in-user show --query "mail || userPrincipalName" -o tsv)
fi

GRAPH_API=00000003-0000-0000-c000-000000000000
GRAPH_USER_READ=e1fe6dd8-ba31-4d61-89e7-88639da4683d

echo "Subscription: $SUBSCRIPTION_ID"
echo "Tenant:       $TENANT_ID"
echo "Repository:   $GITHUB_REPO"
echo "Admins:       $INITIAL_ADMIN_EMAILS"
echo

echo "==> Resource group $RESOURCE_GROUP ($LOCATION)"
az group create -n "$RESOURCE_GROUP" -l "$LOCATION" -o none
RG_ID=$(az group show -n "$RESOURCE_GROUP" --query id -o tsv)

echo "==> Sign-in app registration: $APP_DISPLAY_NAME"
SIGNIN_APP_ID=$(az ad app list --display-name "$APP_DISPLAY_NAME" --query "[0].appId" -o tsv)
if [ -z "$SIGNIN_APP_ID" ]; then
  SIGNIN_APP_ID=$(az ad app create \
    --display-name "$APP_DISPLAY_NAME" \
    --sign-in-audience AzureADMyOrg \
    --web-redirect-uris "http://localhost:3000/api/auth/callback/microsoft-entra-id" \
    --required-resource-accesses "[{\"resourceAppId\":\"$GRAPH_API\",\"resourceAccess\":[{\"id\":\"$GRAPH_USER_READ\",\"type\":\"Scope\"}]}]" \
    --query appId -o tsv)
  az ad sp create --id "$SIGNIN_APP_ID" -o none
  echo "    created $SIGNIN_APP_ID"
else
  echo "    reusing $SIGNIN_APP_ID"
fi
SIGNIN_SECRET=$(az ad app credential reset --id "$SIGNIN_APP_ID" --append \
  --display-name "github-deploy-$(date +%Y%m%d)" --years 2 --query password -o tsv)
# User.Read normally needs no admin consent; granting it up front avoids a consent prompt.
az ad app permission admin-consent --id "$SIGNIN_APP_ID" 2>/dev/null || echo "    (skipped admin consent: needs an admin; users will consent on first sign-in)"

echo "==> GitHub deployment identity"
DEPLOY_NAME="$APP_DISPLAY_NAME GitHub deploy"
DEPLOY_APP_ID=$(az ad app list --display-name "$DEPLOY_NAME" --query "[0].appId" -o tsv)
if [ -z "$DEPLOY_APP_ID" ]; then
  DEPLOY_APP_ID=$(az ad app create --display-name "$DEPLOY_NAME" --sign-in-audience AzureADMyOrg --query appId -o tsv)
  az ad sp create --id "$DEPLOY_APP_ID" -o none
  echo "    created $DEPLOY_APP_ID"
else
  echo "    reusing $DEPLOY_APP_ID"
fi
DEPLOY_SP_ID=$(az ad sp show --id "$DEPLOY_APP_ID" --query id -o tsv)

SUBJECT="repo:$GITHUB_REPO:environment:production"
if ! az ad app federated-credential list --id "$DEPLOY_APP_ID" --query "[?subject=='$SUBJECT'] | [0].name" -o tsv | grep -q .; then
  az ad app federated-credential create --id "$DEPLOY_APP_ID" --parameters "{
    \"name\": \"github-production\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"$SUBJECT\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }" -o none
fi

for ROLE in "Contributor" "User Access Administrator"; do
  az role assignment create --assignee-object-id "$DEPLOY_SP_ID" --assignee-principal-type ServicePrincipal \
    --role "$ROLE" --scope "$RG_ID" -o none 2>/dev/null || true
done

echo "==> GitHub environment, variables and secrets"
gh api -X PUT "repos/$GITHUB_REPO/environments/production" > /dev/null
setvar() { gh variable set "$1" --repo "$GITHUB_REPO" --body "$2"; }
setvar AZURE_CLIENT_ID "$DEPLOY_APP_ID"
setvar AZURE_TENANT_ID "$TENANT_ID"
setvar AZURE_SUBSCRIPTION_ID "$SUBSCRIPTION_ID"
setvar AZURE_NAME_PREFIX "$NAME_PREFIX"
setvar ENTRA_TENANT_ID "$TENANT_ID"
setvar ENTRA_CLIENT_ID "$SIGNIN_APP_ID"
setvar INITIAL_ADMIN_EMAILS "$INITIAL_ADMIN_EMAILS"
setvar APP_TIMEZONE "$APP_TIMEZONE"
setvar APP_NAME "$APP_DISPLAY_NAME"

gh secret set ENTRA_CLIENT_SECRET --repo "$GITHUB_REPO" --body "$SIGNIN_SECRET"
EXISTING=$(gh secret list --repo "$GITHUB_REPO" --json name -q '.[].name')
if ! grep -qx AUTH_SECRET <<<"$EXISTING"; then
  gh secret set AUTH_SECRET --repo "$GITHUB_REPO" --body "$(openssl rand -base64 33)"
fi
if ! grep -qx POSTGRES_ADMIN_PASSWORD <<<"$EXISTING"; then
  gh secret set POSTGRES_ADMIN_PASSWORD --repo "$GITHUB_REPO" --body "$(openssl rand -base64 30 | tr -d '/+=')Aa1"
fi

# Setting this last enables the deploy workflow.
setvar AZURE_RESOURCE_GROUP "$RESOURCE_GROUP"

cat <<EOF

Done. Next:

  1. Deploy:   gh workflow run deploy.yml --repo $GITHUB_REPO   (or push to main)
  2. When it finishes, add the redirect URI shown in the run summary to the sign-in app:

       FQDN=\$(az containerapp show -g $RESOURCE_GROUP -n $NAME_PREFIX-app --query properties.configuration.ingress.fqdn -o tsv)
       az ad app update --id $SIGNIN_APP_ID --web-redirect-uris \\
         "https://\$FQDN/api/auth/callback/microsoft-entra-id" \\
         "http://localhost:3000/api/auth/callback/microsoft-entra-id"

  3. Sign in as $INITIAL_ADMIN_EMAILS. You'll be an admin.
EOF
