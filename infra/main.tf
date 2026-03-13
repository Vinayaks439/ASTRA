data "azurerm_client_config" "current" {}

module "resource_group" {
  source      = "./modules/resource_group"
  project     = var.project
  environment = var.environment
  location    = var.location
}

module "networking" {
  source              = "./modules/networking"
  project             = var.project
  environment         = var.environment
  location            = var.location
  resource_group_name = module.resource_group.name
}

module "acr" {
  source              = "./modules/acr"
  project             = var.project
  environment         = var.environment
  location            = var.location
  resource_group_name = module.resource_group.name
}

module "aks" {
  source              = "./modules/aks"
  project             = var.project
  environment         = var.environment
  location            = var.location
  resource_group_name = module.resource_group.name
  subnet_id           = module.networking.aks_subnet_id
  acr_id              = module.acr.id
  node_count          = var.aks_node_count
  node_vm_size        = var.aks_node_vm_size
}

module "cosmos_db" {
  source              = "./modules/cosmos_db"
  project             = var.project
  environment         = var.environment
  location            = var.location
  resource_group_name = module.resource_group.name
  database_name       = var.cosmos_db_name
}

module "openai" {
  source              = "./modules/openai"
  project             = var.project
  environment         = var.environment
  location            = var.location
  resource_group_name = module.resource_group.name
  model_name          = var.openai_model
  deployment_name     = var.openai_deployment
  capacity            = var.openai_capacity
}

module "key_vault" {
  source              = "./modules/key_vault"
  project             = var.project
  environment         = var.environment
  location            = var.location
  resource_group_name = module.resource_group.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  current_principal_id = data.azurerm_client_config.current.object_id
  aks_principal_id    = module.aks.kubelet_identity_object_id
  cosmos_endpoint     = module.cosmos_db.endpoint
  cosmos_key          = module.cosmos_db.primary_key
  openai_endpoint     = module.openai.endpoint
  openai_key          = module.openai.primary_key
}

module "container_apps" {
  source              = "./modules/container_apps"
  project             = var.project
  environment         = var.environment
  location            = var.location
  resource_group_name = module.resource_group.name
  subnet_id           = module.networking.container_apps_subnet_id
  acr_login_server    = module.acr.login_server
  acr_id              = module.acr.id
  key_vault_id        = module.key_vault.id
  cosmos_endpoint     = module.cosmos_db.endpoint
  cosmos_key          = module.cosmos_db.primary_key
  cosmos_database     = var.cosmos_db_name
  openai_endpoint     = module.openai.endpoint
  openai_key          = module.openai.primary_key
  openai_deployment   = var.openai_deployment
}

module "service_bus" {
  source              = "./modules/service_bus"
  project             = var.project
  environment         = var.environment
  location            = var.location
  resource_group_name = module.resource_group.name
}
