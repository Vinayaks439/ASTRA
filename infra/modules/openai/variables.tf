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

variable "model_name" {
  type    = string
  default = "gpt-4o-mini"
}

variable "deployment_name" {
  type    = string
  default = "astra-gpt"
}

variable "capacity" {
  type    = number
  default = 30
}
