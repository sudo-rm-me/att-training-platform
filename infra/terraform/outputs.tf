output "app_url" {
  description = "Where the app is served."
  value       = local.app_url
}

output "redirect_uri" {
  description = "Add this as a Web redirect URI on the Entra sign-in app registration."
  value       = "${local.app_url}/api/auth/callback/microsoft-entra-id"
}

output "container_app_id" {
  value = azurerm_container_app.app.id
}

output "container_app_name" {
  value = azurerm_container_app.app.name
}

output "container_app_fqdn" {
  description = "Default hostname (point a custom domain's CNAME here)."
  value       = azurerm_container_app.app.ingress[0].fqdn
}

output "container_app_environment_id" {
  value = local.env_id
}

output "identity_principal_id" {
  description = "Managed identity used by the app (blob access)."
  value       = azurerm_user_assigned_identity.app.principal_id
}

output "identity_client_id" {
  value = azurerm_user_assigned_identity.app.client_id
}

output "storage_account_name" {
  value = azurerm_storage_account.media.name
}

output "postgres_fqdn" {
  value = local.create_db ? azurerm_postgresql_flexible_server.db[0].fqdn : null
}

output "reminders_job_name" {
  value = var.enable_reminders ? azurerm_container_app_job.reminders[0].name : null
}

output "cron_secret" {
  description = "Bearer token for POST /api/cron/reminders, if you schedule it some other way."
  value       = random_password.cron.result
  sensitive   = true
}
