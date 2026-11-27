# --- Placement -----------------------------------------------------------

variable "resource_group_name" {
  description = "Existing resource group to deploy into."
  type        = string
}

variable "location" {
  description = "Azure region, e.g. uksouth. Defaults to the resource group's region."
  type        = string
  default     = null
}

variable "name_prefix" {
  description = "Prefix for resource names (lowercase letters, digits and hyphens)."
  type        = string
  default     = "att"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,18}[a-z0-9]$", var.name_prefix))
    error_message = "Use 3-20 lowercase letters, digits or hyphens, starting with a letter."
  }
}

variable "tags" {
  description = "Tags added to every resource."
  type        = map(string)
  default     = {}
}

# --- Image ---------------------------------------------------------------

variable "image" {
  description = "Container image. Pin a release, e.g. ghcr.io/sudo-rm-me/att-training-platform:0.9.0."
  type        = string
  default     = "ghcr.io/sudo-rm-me/att-training-platform:latest"
}

variable "app_name" {
  description = "Display name shown in the app, emails and certificates."
  type        = string
  default     = "Academy"
}

# --- Sign-in (Microsoft Entra ID) ----------------------------------------

variable "entra_tenant_id" {
  description = "Tenant people sign in to."
  type        = string
}

variable "entra_client_id" {
  description = "Client (application) ID of the sign-in app registration."
  type        = string
}

variable "entra_client_secret" {
  description = "Client secret of the sign-in app registration (also used for Graph email)."
  type        = string
  sensitive   = true
}

variable "auth_secret" {
  description = "Session encryption secret. Leave null to generate one (kept in state). Changing it signs everyone out."
  type        = string
  default     = null
  sensitive   = true
}

variable "initial_admin_emails" {
  description = "Emails that become admins when they first sign in."
  type        = list(string)
  default     = []
}

# --- Existing infrastructure (all optional) ------------------------------

variable "container_app_environment_id" {
  description = "Use an existing Container Apps environment (with a Consumption workload profile) instead of creating one."
  type        = string
  default     = null
}

variable "log_analytics_workspace_id" {
  description = "Existing Log Analytics workspace for a new environment. Null creates one (ignored when an environment is supplied)."
  type        = string
  default     = null
}

variable "database_url" {
  description = "Use an existing Postgres database (postgresql://user:pass@host:5432/db) instead of creating a Flexible Server."
  type        = string
  default     = null
  sensitive   = true
}

variable "public_url" {
  description = "Public URL if you put a custom domain in front of the app, e.g. https://academy.contoso.com. Null uses the Container Apps URL."
  type        = string
  default     = null
}

# --- App settings --------------------------------------------------------

variable "app_timezone" {
  description = "IANA timezone for streak days and due dates."
  type        = string
  default     = "Europe/London"
}

variable "min_replicas" {
  description = "Always-on replicas. 0 scales to zero (cheaper, with cold starts)."
  type        = number
  default     = 1
}

variable "max_replicas" {
  type    = number
  default = 3
}

variable "cpu" {
  type    = number
  default = 0.5
}

variable "memory" {
  type    = string
  default = "1Gi"
}

variable "extra_env" {
  description = "Extra plain environment variables for the app."
  type        = map(string)
  default     = {}
}

# --- Reminders -----------------------------------------------------------

variable "enable_reminders" {
  description = "Create the daily reminders job."
  type        = bool
  default     = true
}

variable "reminders_schedule" {
  description = "Cron expression (UTC) for the reminders job."
  type        = string
  default     = "0 7 * * *"
}

variable "mail_sender" {
  description = "Mailbox that sends reminder emails via Microsoft Graph (the app needs Mail.Send). Empty = in-app only."
  type        = string
  default     = ""
}

variable "escalate_after_days" {
  type    = number
  default = 14
}

# --- Database (when created here) ----------------------------------------

variable "postgres_version" {
  type    = string
  default = "16"
}

variable "postgres_sku_name" {
  type    = string
  default = "B_Standard_B1ms"
}

variable "postgres_storage_mb" {
  type    = number
  default = 32768
}

variable "postgres_backup_retention_days" {
  type    = number
  default = 7
}

variable "postgres_admin_login" {
  type    = string
  default = "attadmin"
}

# --- Storage -------------------------------------------------------------

variable "storage_replication_type" {
  description = "Replication for the media storage account (LRS, ZRS, GRS...)."
  type        = string
  default     = "LRS"
}
