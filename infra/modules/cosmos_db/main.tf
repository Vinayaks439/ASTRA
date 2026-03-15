resource "azurerm_cosmosdb_account" "main" {
  name                = "cosmos-${var.project}-${var.environment}"
  resource_group_name = var.resource_group_name
  location            = var.location
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"

  capabilities {
    name = "EnableServerless"
  }

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = var.location
    failover_priority = 0
  }

  tags = {
    project     = var.project
    environment = var.environment
  }
}

resource "azurerm_cosmosdb_sql_database" "main" {
  name                = var.database_name
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.main.name
}

locals {
  containers = {
    "skus"                   = "/category"
    "competitors"            = "/platform"
    "hourly-comp-snapshots"  = "/skuId"
    "daily-own-snapshots"    = "/skuId"
    "daily-comp-snapshots"   = "/skuId"
    "weekly-own-snapshots"   = "/skuId"
    "weekly-comp-snapshots"  = "/skuId"
    "monthly-own-snapshots"  = "/skuId"
    "monthly-comp-snapshots" = "/skuId"
    "risk-scores"            = "/skuId"
    "recommendations"        = "/skuId"
    "tickets"                = "/skuId"
    "audit-log"              = "/skuId"
    "settings"               = "/userId"
    "agent-decisions"        = "/skuId"
  }
}

resource "azurerm_cosmosdb_sql_container" "containers" {
  for_each = local.containers

  name                = each.key
  resource_group_name = var.resource_group_name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_sql_database.main.name

  partition_key_paths = [each.value]
}
