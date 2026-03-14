resource "azurerm_resource_group" "main" {
  name     = var.name != "" ? var.name : "rg-${var.project}-${var.environment}"
  location = var.location

  tags = {
    project     = var.project
    environment = var.environment
  }
}
