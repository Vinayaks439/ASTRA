output "namespace_id" {
  value = azurerm_servicebus_namespace.main.id
}

output "connection_string" {
  value     = azurerm_servicebus_namespace.main.default_primary_connection_string
  sensitive = true
}
