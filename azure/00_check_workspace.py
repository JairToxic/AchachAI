"""Verifica si el workspace Azure ML existe y es accesible.

Usa pip-system-certs para que requests respete el cert store de Windows.
Si AzureCliCredential falla, cae a InteractiveBrowserCredential.
"""
from __future__ import annotations

import sys

import pip_system_certs.wrapt_requests  # noqa: F401 - parche requests
from azure.identity import (
    AzureCliCredential,
    ChainedTokenCredential,
    InteractiveBrowserCredential,
)
from azure.mgmt.subscription import SubscriptionClient

SUBSCRIPTION_ID = "4eefad92-a82c-4d3d-a5fc-da8f44e01816"
RG = "rg-achachai-hack"
WS = "mlw-achachai"
LOC = "eastus2"


def try_auth() -> ChainedTokenCredential:
    """Prueba AzureCliCredential primero, despues InteractiveBrowserCredential."""
    return ChainedTokenCredential(
        AzureCliCredential(),
        InteractiveBrowserCredential(tenant_id="57f42b34-1699-488b-99de-086f4f947a95"),
    )


def main() -> int:
    cred = try_auth()

    print("Listando suscripciones...")
    try:
        sc = SubscriptionClient(cred)
        subs = list(sc.subscriptions.list())
        for s in subs:
            print(f"  {s.subscription_id}  {s.display_name}  ({s.state})")
    except Exception as e:
        print(f"ERROR listando subs: {type(e).__name__}: {str(e)[:200]}")
        return 1

    print(f"\nVerificando Resource Group {RG}...")
    from azure.mgmt.resource import ResourceManagementClient
    rm = ResourceManagementClient(cred, SUBSCRIPTION_ID)
    try:
        rg = rm.resource_groups.get(RG)
        print(f"  OK: RG existe en {rg.location}")
    except Exception as e:
        print(f"  NO encontrado o sin acceso: {type(e).__name__}: {str(e)[:200]}")
        return 2

    print(f"\nVerificando Workspace ML {WS}...")
    try:
        from azure.ai.ml import MLClient
        ml = MLClient(cred, SUBSCRIPTION_ID, RG, WS)
        ws = ml.workspaces.get(WS)
        print(f"  OK: workspace {ws.name} en {ws.location}, discovery={ws.discovery_url}")
    except Exception as e:
        print(f"  Workspace NO existe o no accesible: {type(e).__name__}: {str(e)[:200]}")
        return 3

    print(f"\nVerificando Compute Cluster 'cpu-cluster' en el workspace...")
    try:
        compute = ml.compute.get("cpu-cluster")
        print(f"  OK: compute {compute.name} type={compute.type} size={compute.size}")
    except Exception as e:
        print(f"  Compute NO existe: {type(e).__name__}: {str(e)[:200]}")
        return 4

    print("\nTodo OK. Listo para registrar modelo y crear endpoint.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
