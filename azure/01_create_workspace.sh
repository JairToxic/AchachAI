#!/usr/bin/env bash
# Crea el Azure ML workspace + compute cluster en eastus2.
# Idempotente: si ya existen, no falla.
#
# Uso: bash azure/01_create_workspace.sh

set -e

SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID:-4eefad92-a82c-4d3d-a5fc-da8f44e01816}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-achachai-hack}"
WORKSPACE="${AZURE_ML_WORKSPACE:-mlw-achachai}"
LOCATION="${AZURE_ML_REGION:-eastus2}"
COMPUTE_NAME="cpu-cluster"

echo "Subscription: $SUBSCRIPTION_ID"
echo "Resource Group: $RESOURCE_GROUP"
echo "Workspace: $WORKSPACE"
echo "Region: $LOCATION"
echo ""

az account set --subscription "$SUBSCRIPTION_ID"

echo "==> Creando Workspace (puede tardar 2-5 min)..."
az ml workspace create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$WORKSPACE" \
  --location "$LOCATION" \
  --description "AchachAI hackIAthon 2026 - Aseguradora del Sur" \
  --tags proyecto=achachai hackathon=2026 \
  -o table

echo ""
echo "==> Creando Compute Cluster $COMPUTE_NAME (min=0, max=2)..."
az ml compute create \
  --resource-group "$RESOURCE_GROUP" \
  --workspace-name "$WORKSPACE" \
  --name "$COMPUTE_NAME" \
  --type AmlCompute \
  --size Standard_DS3_v2 \
  --min-instances 0 \
  --max-instances 2 \
  --idle-time-before-scale-down 600 \
  -o table

echo ""
echo "==> Listo. Workspace: $WORKSPACE en $RESOURCE_GROUP"
echo "Verifica en: https://ml.azure.com/?tid=57f42b34-1699-488b-99de-086f4f947a95"
