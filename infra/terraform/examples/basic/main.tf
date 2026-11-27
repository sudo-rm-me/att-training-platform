terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.20"
    }
  }
}

provider "azurerm" {
  features {}
  # The media storage account has shared keys disabled.
  storage_use_azuread = true
}

variable "entra_client_secret" {
  type      = string
  sensitive = true
}

resource "azurerm_resource_group" "training" {
  name     = "rg-training"
  location = "uksouth"
}

module "training" {
  # In your own repo:
  # source = "github.com/sudo-rm-me/att-training-platform//infra/terraform?ref=v0.9.0"
  source = "../.."

  resource_group_name  = azurerm_resource_group.training.name
  name_prefix          = "academy"
  image                = "ghcr.io/sudo-rm-me/att-training-platform:0.9.0"
  app_name             = "Contoso Academy"
  entra_tenant_id      = "00000000-0000-0000-0000-000000000000"
  entra_client_id      = "00000000-0000-0000-0000-000000000000"
  entra_client_secret  = var.entra_client_secret
  initial_admin_emails = ["you@contoso.com"]
}

output "app_url" {
  value = module.training.app_url
}

output "redirect_uri" {
  value = module.training.redirect_uri
}
