variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "location" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "tenant_id" {
  type = string
}

variable "current_principal_id" {
  type = string
}

variable "aks_principal_id" {
  type = string
}

variable "cosmos_endpoint" {
  type      = string
  sensitive = true
}

variable "cosmos_key" {
  type      = string
  sensitive = true
}

variable "openai_endpoint" {
  type      = string
  sensitive = true
}

variable "openai_key" {
  type      = string
  sensitive = true
}
