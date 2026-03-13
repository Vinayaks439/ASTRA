output "acr_login_server" {
  description = "Azure Container Registry login server"
  value       = module.acr.login_server
}

output "aks_cluster_name" {
  description = "AKS cluster name"
  value       = module.aks.cluster_name
}

output "aks_resource_group" {
  description = "Resource group name"
  value       = module.resource_group.name
}

output "cosmos_endpoint" {
  description = "Cosmos DB endpoint"
  value       = module.cosmos_db.endpoint
  sensitive   = true
}

output "cosmos_key" {
  description = "Cosmos DB primary key"
  value       = module.cosmos_db.primary_key
  sensitive   = true
}

output "cosmos_database_name" {
  description = "Cosmos DB database name"
  value       = var.cosmos_db_name
}

output "key_vault_uri" {
  description = "Key Vault URI"
  value       = module.key_vault.vault_uri
}

output "container_app_fqdns" {
  description = "Container Apps FQDNs for each agent"
  value       = module.container_apps.agent_fqdns
}

output "openai_endpoint" {
  description = "Azure OpenAI endpoint"
  value       = module.openai.endpoint
  sensitive   = true
}
