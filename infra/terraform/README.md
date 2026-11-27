# Terraform module: ATT training platform on Azure Container Apps

Deploys the app from the **public container image** into an existing resource group. Use it from your own Terraform repo:

```hcl
module "training" {
  source = "github.com/sudo-rm-me/att-training-platform//infra/terraform?ref=v0.9.0"

  resource_group_name  = "rg-training"
  image                = "ghcr.io/sudo-rm-me/att-training-platform:0.9.0"
  app_name             = "Contoso Academy"
  entra_tenant_id      = var.tenant_id
  entra_client_id      = var.training_app_client_id
  entra_client_secret  = var.training_app_client_secret
  initial_admin_emails = ["you@contoso.com"]
}

output "training_url"          { value = module.training.app_url }
output "training_redirect_uri" { value = module.training.redirect_uri }
```

Pin `ref` and `image` to the same release. The image tags are `0.9.0`, `0.9` and `latest`.

## What it creates

| Resource | Notes |
| --- | --- |
| Container App `<prefix>-app` | Public HTTPS ingress, 1–3 replicas (0.5 vCPU / 1 GiB), health probes. Database migrations run on start. |
| Container Apps job `<prefix>-reminders` | Daily `POST /api/cron/reminders` (email/Teams reminders). `enable_reminders = false` to skip. |
| Container Apps environment + Log Analytics | Skipped when you pass `container_app_environment_id`. |
| PostgreSQL Flexible Server (B1ms, 32 GB) + database `att` | Skipped when you pass `database_url`. |
| Storage account + `media` container | Shared keys disabled; the app uses its managed identity. |
| User-assigned identity | Gets *Storage Blob Data Contributor* on the storage account. |

Secrets (session secret, Entra client secret, database URL, cron token) are Container App secrets. They are also in your Terraform state, so keep the state in a protected backend.

## Before you apply

1. **Sign-in app registration** in Entra ID (single tenant, *Web* platform). Create a client secret. After the first apply, add the `redirect_uri` output as a redirect URI.
2. **Provider settings**: the storage account has shared keys disabled, so set `storage_use_azuread = true` on your `azurerm` provider.
3. **Permissions**: whoever runs Terraform needs to create role assignments (*Owner* or *User Access Administrator* on the resource group).
4. Optional **email reminders**: set `mail_sender` to a mailbox (a shared mailbox is fine), add the Microsoft Graph *Mail.Send* application permission to the app registration and grant admin consent. Without it, reminders appear in the app only.

## Reusing what you already have

```hcl
  container_app_environment_id = azurerm_container_app_environment.shared.id # must have a "Consumption" workload profile
  database_url                 = "postgresql://user:pass@myserver.postgres.database.azure.com:5432/training?sslmode=require"
  public_url                   = "https://academy.contoso.com" # if you add a custom domain
```

For a custom domain, add `azurerm_container_app_custom_domain` in your repo against `module.training.container_app_id`, set `public_url`, and add the matching redirect URI.

## Inputs

| Name | Default | Description |
| --- | --- | --- |
| `resource_group_name` | (required) | Existing resource group |
| `entra_tenant_id`, `entra_client_id`, `entra_client_secret` | (required) | Sign-in app registration |
| `location` | resource group's region | |
| `name_prefix` | `att` | Prefix for resource names |
| `image` | `ghcr.io/sudo-rm-me/att-training-platform:latest` | Pin a version in production |
| `app_name` | `Academy` | Display name |
| `initial_admin_emails` | `[]` | Become admins on first sign-in |
| `auth_secret` | generated | Session secret; changing it signs everyone out |
| `app_timezone` | `Europe/London` | Streaks and due dates |
| `min_replicas` / `max_replicas` | `1` / `3` | `0` min replicas scales to zero |
| `cpu` / `memory` | `0.5` / `1Gi` | Per replica |
| `container_app_environment_id` | null | Reuse an environment |
| `log_analytics_workspace_id` | null | Reuse a workspace for a new environment |
| `database_url` | null | Reuse a Postgres database |
| `public_url` | null | Custom domain URL |
| `enable_reminders` | `true` | Daily reminders job |
| `reminders_schedule` | `0 7 * * *` | Cron, UTC |
| `mail_sender` | `""` | Graph email sender |
| `escalate_after_days` | `14` | Manager escalation threshold |
| `postgres_*` | B1ms, v16, 32 GB, 7-day backups | When the module creates the database |
| `storage_replication_type` | `LRS` | Media storage |
| `extra_env` | `{}` | Extra app settings |
| `tags` | `{}` | Added to everything |

## Outputs

`app_url`, `redirect_uri`, `container_app_id`, `container_app_name`, `container_app_fqdn`, `container_app_environment_id`, `identity_principal_id`, `identity_client_id`, `storage_account_name`, `postgres_fqdn`, `reminders_job_name`, `cron_secret` (sensitive).

## Upgrading

Change `image` (and `ref`) to the new release and apply. Migrations run automatically when the new revision starts. Learners in the middle of a course finish the version they started.
