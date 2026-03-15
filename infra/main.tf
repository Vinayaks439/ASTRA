data "azurerm_client_config" "current" {}

# ── existing resources (manually created) ────────────────────────────────────
module "resource_group" {
  source      = "./modules/resource_group"
  name        = "astra"
  project     = var.project
  environment = var.environment
  location    = "centralindia"
}

data "azurerm_container_registry" "main" {
  name                = "astra"
  resource_group_name = module.resource_group.name
}

data "azurerm_cosmosdb_account" "main" {
  name                = "astra-db"
  resource_group_name = module.resource_group.name
}

data "azurerm_cognitive_account" "openai" {
  name                = "astra-openai-eastus2"
  resource_group_name = module.resource_group.name
}

# ── new resources managed by Terraform ───────────────────────────────────────
module "networking" {
  source              = "./modules/networking"
  project             = var.project
  environment         = var.environment
  location            = module.resource_group.location
  resource_group_name = module.resource_group.name
}

data "azurerm_key_vault" "main" {
  name                = "kvastra6dc544"
  resource_group_name = module.resource_group.name
}

module "container_apps" {
  source              = "./modules/container_apps"
  project             = var.project
  environment         = var.environment
  location            = module.resource_group.location
  resource_group_name = module.resource_group.name
  subnet_id           = module.networking.container_apps_subnet_id
  acr_login_server    = data.azurerm_container_registry.main.login_server
  acr_id              = data.azurerm_container_registry.main.id
  key_vault_id        = data.azurerm_key_vault.main.id
  cosmos_endpoint     = data.azurerm_cosmosdb_account.main.endpoint
  cosmos_key          = data.azurerm_cosmosdb_account.main.primary_key
  cosmos_database     = var.cosmos_db_name
  openai_endpoint     = data.azurerm_cognitive_account.openai.endpoint
  openai_key          = data.azurerm_cognitive_account.openai.primary_access_key
  openai_deployment   = var.openai_deployment
  google_ai_key       = var.google_ai_key
}

module "service_bus" {
  source              = "./modules/service_bus"
  project             = var.project
  environment         = var.environment
  location            = module.resource_group.location
  resource_group_name = module.resource_group.name
}
