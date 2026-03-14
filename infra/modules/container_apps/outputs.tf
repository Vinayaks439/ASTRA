output "environment_id" {
  value = azurerm_container_app_environment.main.id
}

output "default_domain" {
  value = azurerm_container_app_environment.main.default_domain
}

output "agent_fqdns" {
  value = local.agent_fqdns
}

output "agent_app_ids" {
  value = { for k, v in azurerm_container_app.agents : k => v.id }
}

output "backend_url" {
  value = "https://${azurerm_container_app.backend.ingress[0].fqdn}"
}

output "frontend_url" {
  value = "https://${azurerm_container_app.frontend.ingress[0].fqdn}"
}
