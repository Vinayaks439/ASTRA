resource "azurerm_servicebus_namespace" "main" {
  name                = "sb-${var.project}-${var.environment}"
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = "Standard"

  tags = {
    project     = var.project
    environment = var.environment
  }
}

resource "azurerm_servicebus_queue" "queues" {
  for_each = toset([
    "risk-assess",
    "risk-result",
    "recommend",
    "ticket-create",
    "notify",
    "audit-write",
  ])

  name         = each.key
  namespace_id = azurerm_servicebus_namespace.main.id
}
