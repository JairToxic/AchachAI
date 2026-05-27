"""Deploy endpoint v2: usa environment CURADO de Azure ML en vez de
custom conda. Asi evitamos el build de imagen que fallaba.

Pre-requisito: el modelo achachai-fraude-xgb ya esta registrado.

Uso:
    python azure/03_deploy_endpoint_v2.py
"""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import pip_system_certs.wrapt_requests  # noqa: F401 - SSL fix
from azure.ai.ml import MLClient
from azure.ai.ml.entities import (
    ManagedOnlineDeployment,
    ManagedOnlineEndpoint,
    Model,
    CodeConfiguration,
    OnlineRequestSettings,
)
from azure.identity import AzureCliCredential
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

SUB = os.environ["AZURE_SUBSCRIPTION_ID"]
RG = os.environ["AZURE_RESOURCE_GROUP"]
WS = os.environ["AZURE_ML_WORKSPACE"]
MODEL_NAME = "achachai-fraude-xgb"
ENDPOINT = "achachai-fraud"
DEPLOY = "blue"


def log(msg: str) -> None:
    print(f"[deploy] {msg}", flush=True)


def main() -> int:
    log(f"Conectando a {WS} ({RG})...")
    ml = MLClient(AzureCliCredential(), SUB, RG, WS)

    log("Buscando ultima version del modelo registrado...")
    latest = max(ml.models.list(name=MODEL_NAME), key=lambda m: int(m.version))
    log(f"  encontrado: {latest.name} v{latest.version}")
    model_id = f"azureml:{latest.name}:{latest.version}"

    log(f"Creando/actualizando endpoint '{ENDPOINT}' (espera hasta listo)...")
    endpoint = ManagedOnlineEndpoint(
        name=ENDPOINT,
        description="Endpoint para scoring de posible fraude en siniestros - AchachAI",
        auth_mode="key",
        tags={"proyecto": "achachai"},
    )
    poller = ml.online_endpoints.begin_create_or_update(endpoint)
    while not poller.done():
        time.sleep(15)
        log(f"  endpoint provisioning... ({poller.status()})")
    ep = poller.result()
    log(f"  endpoint OK: state={ep.provisioning_state}")

    log(f"Creando deployment '{DEPLOY}' con environment CURADO (sklearn-1.5)...")
    log("  esto tarda 5-10 min (pull image + descarga modelo + arranque)")
    deployment = ManagedOnlineDeployment(
        name=DEPLOY,
        endpoint_name=ENDPOINT,
        model=model_id,
        # Environment curado: ya trae sklearn, xgboost, pandas, joblib
        environment="azureml://registries/azureml/environments/sklearn-1.5/labels/latest",
        code_configuration=CodeConfiguration(
            code=str(ROOT / "azure"),
            scoring_script="score.py",
        ),
        instance_type="Standard_DS3_v2",
        instance_count=1,
        request_settings=OnlineRequestSettings(
            request_timeout_ms=30000,
            max_concurrent_requests_per_instance=2,
        ),
    )
    poller = ml.online_deployments.begin_create_or_update(deployment)
    last_log = time.time()
    while not poller.done():
        time.sleep(20)
        if time.time() - last_log > 60:
            log(f"  deployment progreso... ({poller.status()})")
            last_log = time.time()
    dep = poller.result()
    log(f"  deployment OK: state={dep.provisioning_state}")

    log("Asignando 100% de trafico a 'blue'...")
    ep.traffic = {DEPLOY: 100}
    ml.online_endpoints.begin_create_or_update(ep).result()

    final = ml.online_endpoints.get(ENDPOINT)
    keys = ml.online_endpoints.get_keys(ENDPOINT)

    log("\n=== ENDPOINT LISTO ===")
    log(f"  scoring_uri: {final.scoring_uri}")
    log(f"  primary key (4 chars): {keys.primary_key[:4]}***")

    # Persistir en .env
    env_path = ROOT / ".env"
    lines = env_path.read_text(encoding="utf-8").splitlines()
    out = []
    set_url = False
    set_key = False
    for l in lines:
        if l.startswith("AZURE_ML_ENDPOINT_URL="):
            out.append(f"AZURE_ML_ENDPOINT_URL={final.scoring_uri}")
            set_url = True
        elif l.startswith("AZURE_ML_ENDPOINT_KEY="):
            out.append(f"AZURE_ML_ENDPOINT_KEY={keys.primary_key}")
            set_key = True
        else:
            out.append(l)
    if not set_url:
        out.append(f"AZURE_ML_ENDPOINT_URL={final.scoring_uri}")
    if not set_key:
        out.append(f"AZURE_ML_ENDPOINT_KEY={keys.primary_key}")
    env_path.write_text("\n".join(out) + "\n", encoding="utf-8")
    log("  .env actualizado")
    return 0


if __name__ == "__main__":
    sys.exit(main())
