"""Sube el modelo XGBoost entrenado local al Azure ML workspace,
lo registra como modelo, crea un managed online endpoint y lo despliega.

Requisitos previos:
- Workspace creado (bash azure/01_create_workspace.sh)
- Modelo entrenado en runs/local/ (python src/models/train_xgboost.py)
- .env con AZURE_SUBSCRIPTION_ID, AZURE_RESOURCE_GROUP, AZURE_ML_WORKSPACE

Uso:
    python azure/02_train_register_deploy.py [--skip-deploy]
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from azure.ai.ml import MLClient
from azure.ai.ml.entities import (
    Environment,
    ManagedOnlineDeployment,
    ManagedOnlineEndpoint,
    Model,
)
from azure.identity import DefaultAzureCredential
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "runs" / "local"
SCORE_SCRIPT = ROOT / "azure" / "score.py"

load_dotenv()


def log(msg: str) -> None:
    print(f"[azure] {msg}")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--skip-deploy", action="store_true",
                   help="Solo registra el modelo, no crea endpoint")
    args = p.parse_args()

    sub = os.environ["AZURE_SUBSCRIPTION_ID"]
    rg = os.environ["AZURE_RESOURCE_GROUP"]
    ws = os.environ["AZURE_ML_WORKSPACE"]

    log(f"Conectando a workspace {ws} en {rg}...")
    ml = MLClient(DefaultAzureCredential(), sub, rg, ws)

    # 1. Registrar modelo
    log("Registrando modelo XGBoost...")
    model = Model(
        path=str(MODEL_DIR),
        name="achachai-fraude-xgb",
        type="custom_model",
        description="XGBoost para deteccion de posible fraude en siniestros vehiculares.",
        tags={"proyecto": "achachai", "algoritmo": "xgboost", "version": "v1"},
    )
    registered = ml.models.create_or_update(model)
    log(f"Modelo registrado: {registered.name} v{registered.version}")

    if args.skip_deploy:
        log("Skip deploy. Modelo registrado y listo para usarse.")
        return 0

    # 2. Crear endpoint (si no existe)
    endpoint_name = "achachai-fraud-endpoint"
    log(f"Creando/actualizando endpoint {endpoint_name}...")
    endpoint = ManagedOnlineEndpoint(
        name=endpoint_name,
        description="Endpoint para scoring de posibles fraudes - AchachAI hackIAthon 2026",
        auth_mode="key",
        tags={"proyecto": "achachai"},
    )
    ml.online_endpoints.begin_create_or_update(endpoint).result()
    log(f"Endpoint creado: {endpoint_name}")

    # 3. Definir environment
    env = Environment(
        name="achachai-xgb-env",
        description="Python 3.11 + xgboost + sklearn para scoring de fraude",
        image="mcr.microsoft.com/azureml/openmpi4.1.0-ubuntu22.04",
        conda_file={
            "channels": ["conda-forge"],
            "dependencies": [
                "python=3.11",
                "pip",
                {"pip": [
                    "xgboost==2.0.3", "scikit-learn==1.4.2", "joblib==1.4.2",
                    "pandas==2.2.2", "azureml-defaults>=1.55.0",
                    "inference-schema[numpy-support]",
                ]},
            ],
        },
    )

    # 4. Deployment
    deployment_name = "blue"
    log(f"Desplegando '{deployment_name}' (puede tardar 5-10 min)...")
    deployment = ManagedOnlineDeployment(
        name=deployment_name,
        endpoint_name=endpoint_name,
        model=registered,
        environment=env,
        code_path=str(ROOT / "azure"),
        scoring_script="score.py",
        instance_type="Standard_DS3_v2",
        instance_count=1,
    )
    ml.online_deployments.begin_create_or_update(deployment).result()

    # 100% trafico al deployment blue
    endpoint.traffic = {"blue": 100}
    ml.online_endpoints.begin_create_or_update(endpoint).result()
    log(f"Deployment listo. Trafico 100% -> blue.")

    # Obtener URL y key
    ep_details = ml.online_endpoints.get(name=endpoint_name)
    keys = ml.online_endpoints.get_keys(name=endpoint_name)
    log(f"\nEndpoint URL: {ep_details.scoring_uri}")
    log(f"Primary key: (en {ROOT}/.env como AZURE_ML_ENDPOINT_KEY)")

    # Persistir en .env
    env_path = ROOT / ".env"
    lines = env_path.read_text().splitlines() if env_path.exists() else []
    lines = [l for l in lines if not l.startswith(("AZURE_ML_ENDPOINT_URL=", "AZURE_ML_ENDPOINT_KEY="))]
    lines.append(f"AZURE_ML_ENDPOINT_URL={ep_details.scoring_uri}")
    lines.append(f"AZURE_ML_ENDPOINT_KEY={keys.primary_key}")
    env_path.write_text("\n".join(lines) + "\n")
    log(f".env actualizado con URL y key del endpoint.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
