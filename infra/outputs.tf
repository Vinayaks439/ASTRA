output "acr_login_server" {
  description = "Azure Container Registry login server"
  value       = data.azurerm_container_registry.main.login_server
}

output "resource_group_name" {
  description = "Resource group name"
  value       = module.resource_group.name
}

output "cosmos_endpoint" {
  description = "Cosmos DB endpoint"
  value       = data.azurerm_cosmosdb_account.main.endpoint
  sensitive   = true
}

output "cosmos_key" {
  description = "Cosmos DB primary key"
  value       = data.azurerm_cosmosdb_account.main.primary_key
  sensitive   = true
}

output "cosmos_database_name" {
  description = "Cosmos DB database name"
  value       = var.cosmos_db_name
}

output "key_vault_uri" {
  description = "Key Vault URI"
  value       = data.azurerm_key_vault.main.vault_uri
}

output "container_app_fqdns" {
  description = "Container Apps FQDNs for each agent"
  value       = module.container_apps.agent_fqdns
}

output "backend_url" {
  description = "Backend Container App URL"
  value       = module.container_apps.backend_url
}

output "frontend_url" {
  description = "Frontend Container App URL"
  value       = module.container_apps.frontend_url
}

output "openai_endpoint" {
  description = "Azure OpenAI endpoint"
  value       = data.azurerm_cognitive_account.openai.endpoint
  sensitive   = true
}
