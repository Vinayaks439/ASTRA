resource "azurerm_container_registry" "main" {
  name                = "acr${var.project}${var.environment}"
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = "Basic"
  admin_enabled       = true

  tags = {
    project     = var.project
    environment = var.environment
  }
}
