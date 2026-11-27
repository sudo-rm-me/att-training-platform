data "azurerm_resource_group" "this" {
  name = var.resource_group_name
}

locals {
  location   = coalesce(var.location, data.azurerm_resource_group.this.location)
  tags       = merge({ app = "att-training" }, var.tags)
  create_env = var.container_app_environment_id == null
  create_law = local.create_env && var.log_analytics_workspace_id == null
  create_db  = nonsensitive(var.database_url == null)

  app_name     = "${var.name_prefix}-app"
  storage_name = substr(replace("${var.name_prefix}media${random_string.suffix.result}", "-", ""), 0, 24)
  db_name      = "att"

  # /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.App/managedEnvironments/<name>
  existing_env = local.create_env ? null : split("/", var.container_app_environment_id)
  env_id       = local.create_env ? azurerm_container_app_environment.this[0].id : var.container_app_environment_id
  env_domain   = local.create_env ? azurerm_container_app_environment.this[0].default_domain : data.azurerm_container_app_environment.existing[0].default_domain

  app_url     = trimsuffix(coalesce(var.public_url, "https://${local.app_name}.${local.env_domain}"), "/")
  auth_secret = var.auth_secret != null ? var.auth_secret : random_password.auth.result
  database_url = local.create_db ? format(
    "postgresql://%s:%s@%s:5432/%s",
    var.postgres_admin_login,
    urlencode(random_password.postgres.result),
    azurerm_postgresql_flexible_server.db[0].fqdn,
    local.db_name,
  ) : var.database_url

  plain_env = merge({
    AUTH_TRUST_HOST                = "true"
    AUTH_MICROSOFT_ENTRA_ID_ID     = var.entra_client_id
    AUTH_MICROSOFT_ENTRA_ID_ISSUER = "https://login.microsoftonline.com/${var.entra_tenant_id}/v2.0"
    INITIAL_ADMIN_EMAILS           = join(",", var.initial_admin_emails)
    DATABASE_SSL                   = local.create_db ? "true" : ""
    AZURE_STORAGE_ACCOUNT_URL      = azurerm_storage_account.media.primary_blob_endpoint
    AZURE_STORAGE_CONTAINER        = azurerm_storage_container.media.name
    AZURE_CLIENT_ID                = azurerm_user_assigned_identity.app.client_id
    APP_NAME                       = var.app_name
    APP_TIMEZONE                   = var.app_timezone
    APP_URL                        = local.app_url
    MAIL_SENDER                    = var.mail_sender
    ESCALATE_AFTER_DAYS            = tostring(var.escalate_after_days)
  }, var.extra_env)

  secret_env = {
    AUTH_SECRET                    = "auth-secret"
    AUTH_MICROSOFT_ENTRA_ID_SECRET = "entra-client-secret"
    DATABASE_URL                   = "database-url"
    CRON_SECRET                    = "cron-secret"
  }
}

resource "random_string" "suffix" {
  length  = 6
  upper   = false
  special = false
}

resource "random_password" "auth" {
  length  = 48
  special = false
}

resource "random_password" "cron" {
  length  = 48
  special = false
}

resource "random_password" "postgres" {
  length           = 32
  min_upper        = 2
  min_lower        = 2
  min_numeric      = 2
  override_special = "-_.~"
}

# --- Identity ------------------------------------------------------------

resource "azurerm_user_assigned_identity" "app" {
  name                = "${var.name_prefix}-id"
  resource_group_name = var.resource_group_name
  location            = local.location
  tags                = local.tags
}

# --- Media storage (Entra auth only, no shared keys) ---------------------

resource "azurerm_storage_account" "media" {
  name                            = local.storage_name
  resource_group_name             = var.resource_group_name
  location                        = local.location
  account_kind                    = "StorageV2"
  account_tier                    = "Standard"
  account_replication_type        = var.storage_replication_type
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = false
  default_to_oauth_authentication = true
  tags                            = local.tags
}

resource "azurerm_storage_container" "media" {
  name                  = "media"
  storage_account_id    = azurerm_storage_account.media.id
  container_access_type = "private"
}

resource "azurerm_role_assignment" "blob" {
  scope                = azurerm_storage_account.media.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
  principal_type       = "ServicePrincipal"
}

# --- Database ------------------------------------------------------------

resource "azurerm_postgresql_flexible_server" "db" {
  count                         = local.create_db ? 1 : 0
  name                          = "${var.name_prefix}-pg-${random_string.suffix.result}"
  resource_group_name           = var.resource_group_name
  location                      = local.location
  version                       = var.postgres_version
  sku_name                      = var.postgres_sku_name
  storage_mb                    = var.postgres_storage_mb
  auto_grow_enabled             = true
  backup_retention_days         = var.postgres_backup_retention_days
  administrator_login           = var.postgres_admin_login
  administrator_password        = random_password.postgres.result
  public_network_access_enabled = true
  tags                          = local.tags

  authentication {
    password_auth_enabled         = true
    active_directory_auth_enabled = false
  }

  lifecycle {
    # Azure picks a zone when none is given; don't fight it on later plans.
    ignore_changes = [zone, high_availability[0].standby_availability_zone]
  }
}

resource "azurerm_postgresql_flexible_server_database" "app" {
  count     = local.create_db ? 1 : 0
  name      = local.db_name
  server_id = azurerm_postgresql_flexible_server.db[0].id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# Lets Azure services (the Container App) reach the server.
resource "azurerm_postgresql_flexible_server_firewall_rule" "azure" {
  count            = local.create_db ? 1 : 0
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.db[0].id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# --- Container Apps environment ------------------------------------------

resource "azurerm_log_analytics_workspace" "this" {
  count               = local.create_law ? 1 : 0
  name                = "${var.name_prefix}-logs"
  resource_group_name = var.resource_group_name
  location            = local.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
}

resource "azurerm_container_app_environment" "this" {
  count                      = local.create_env ? 1 : 0
  name                       = "${var.name_prefix}-env"
  resource_group_name        = var.resource_group_name
  location                   = local.location
  logs_destination           = "log-analytics"
  log_analytics_workspace_id = local.create_law ? azurerm_log_analytics_workspace.this[0].id : var.log_analytics_workspace_id
  tags                       = local.tags

  workload_profile {
    name                  = "Consumption"
    workload_profile_type = "Consumption"
  }
}

data "azurerm_container_app_environment" "existing" {
  count               = local.create_env ? 0 : 1
  name                = local.existing_env[8]
  resource_group_name = local.existing_env[4]
}

# --- The app -------------------------------------------------------------

resource "azurerm_container_app" "app" {
  name                         = local.app_name
  resource_group_name          = var.resource_group_name
  container_app_environment_id = local.env_id
  revision_mode                = "Single"
  workload_profile_name        = "Consumption"
  tags                         = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }

  secret {
    name  = "auth-secret"
    value = local.auth_secret
  }
  secret {
    name  = "entra-client-secret"
    value = var.entra_client_secret
  }
  secret {
    name  = "database-url"
    value = local.database_url
  }
  secret {
    name  = "cron-secret"
    value = random_password.cron.result
  }

  ingress {
    external_enabled           = true
    target_port                = 3000
    transport                  = "auto"
    allow_insecure_connections = false

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas

    container {
      name   = "web"
      image  = var.image
      cpu    = var.cpu
      memory = var.memory

      dynamic "env" {
        for_each = { for k, v in local.plain_env : k => v if v != "" }
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = local.secret_env
        content {
          name        = env.key
          secret_name = env.value
        }
      }

      # First start runs database migrations, so give it time.
      startup_probe {
        transport               = "HTTP"
        path                    = "/api/health"
        port                    = 3000
        initial_delay           = 10
        interval_seconds        = 10
        failure_count_threshold = 10
      }

      readiness_probe {
        transport               = "HTTP"
        path                    = "/api/health"
        port                    = 3000
        interval_seconds        = 10
        failure_count_threshold = 3
      }

      liveness_probe {
        transport               = "HTTP"
        path                    = "/api/health"
        port                    = 3000
        interval_seconds        = 30
        failure_count_threshold = 3
      }
    }

    http_scale_rule {
      name                = "http"
      concurrent_requests = "50"
    }
  }

  depends_on = [
    azurerm_role_assignment.blob,
    azurerm_postgresql_flexible_server_database.app,
    azurerm_postgresql_flexible_server_firewall_rule.azure,
  ]
}

# --- Daily reminders -----------------------------------------------------

resource "azurerm_container_app_job" "reminders" {
  count                        = var.enable_reminders ? 1 : 0
  name                         = substr("${var.name_prefix}-reminders", 0, 32)
  resource_group_name          = var.resource_group_name
  location                     = local.location
  container_app_environment_id = local.env_id
  workload_profile_name        = "Consumption"
  replica_timeout_in_seconds   = 300
  replica_retry_limit          = 2
  tags                         = local.tags

  schedule_trigger_config {
    cron_expression          = var.reminders_schedule
    parallelism              = 1
    replica_completion_count = 1
  }

  secret {
    name  = "cron-secret"
    value = random_password.cron.result
  }

  template {
    container {
      name    = "reminders"
      image   = "docker.io/curlimages/curl:8.11.1"
      cpu     = 0.25
      memory  = "0.5Gi"
      command = ["sh", "-c", "curl -fsS --retry 3 --retry-delay 20 --max-time 240 -X POST -H \"Authorization: Bearer $CRON_SECRET\" \"$APP_URL/api/cron/reminders\""]

      env {
        name        = "CRON_SECRET"
        secret_name = "cron-secret"
      }
      env {
        name  = "APP_URL"
        value = local.app_url
      }
    }
  }

  depends_on = [azurerm_container_app.app]
}
