"""Genera samples para probar el analizador de documentos:

1. factura_legitima.pdf       — factura normal, fecha posterior al evento
2. factura_sospechosa.pdf     — factura con fecha ANTES del evento (RF-02)
3. factura_sin_ruc.pdf        — falta RUC del vendedor
4. parte_policial.pdf         — denuncia oficial-ish
5. foto_dano_frontal.png      — daño en parachoques frontal
6. foto_dano_lateral.png      — daño en puerta lateral
"""
from __future__ import annotations

import os
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas

OUT = Path(__file__).resolve().parents[1] / "data" / "synthetic" / "docs_demo"
OUT.mkdir(parents=True, exist_ok=True)


def factura(path: Path, fecha_emision: str, monto: float, tiene_ruc: bool = True,
            vendedor: str = "Servi-Frenos Ecuador S.A.", numero: str = "001-001-000124567"):
    c = canvas.Canvas(str(path), pagesize=letter)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(2*cm, 26*cm, "FACTURA")
    c.setFont("Helvetica", 10)
    c.drawString(2*cm, 25*cm, f"Numero: {numero}")
    c.drawString(2*cm, 24.5*cm, f"Fecha emision: {fecha_emision}")

    c.setFont("Helvetica-Bold", 11)
    c.drawString(2*cm, 23*cm, "VENDEDOR")
    c.setFont("Helvetica", 10)
    c.drawString(2*cm, 22.5*cm, vendedor)
    if tiene_ruc:
        c.drawString(2*cm, 22*cm, "RUC: 0992345678001")
    c.drawString(2*cm, 21.5*cm, "Direccion: Av. Republica E10-128, Quito")
    c.drawString(2*cm, 21*cm, "Telefono: (02) 123-4567")

    c.setFont("Helvetica-Bold", 11)
    c.drawString(2*cm, 19.5*cm, "CLIENTE")
    c.setFont("Helvetica", 10)
    c.drawString(2*cm, 19*cm, "Aseguradora del Sur S.A.")
    c.drawString(2*cm, 18.5*cm, "RUC: 1791234567001")

    c.setFont("Helvetica-Bold", 11)
    c.drawString(2*cm, 16.5*cm, "DETALLE")
    c.setFont("Helvetica", 10)
    c.drawString(2*cm, 15.5*cm, "1  Reparacion parachoques frontal Toyota Hilux 2019")
    c.drawString(14*cm, 15.5*cm, f"${monto * 0.6:,.2f}")
    c.drawString(2*cm, 15*cm, "2  Pintura y repintado")
    c.drawString(14*cm, 15*cm, f"${monto * 0.2:,.2f}")
    c.drawString(2*cm, 14.5*cm, "3  Mano de obra y otros")
    c.drawString(14*cm, 14.5*cm, f"${monto * 0.2:,.2f}")

    c.setFont("Helvetica-Bold", 11)
    c.drawString(11*cm, 12*cm, "SUBTOTAL:")
    c.drawString(14*cm, 12*cm, f"${monto:,.2f}")
    c.drawString(11*cm, 11.5*cm, "IVA 12%:")
    c.drawString(14*cm, 11.5*cm, f"${monto*0.12:,.2f}")
    c.drawString(11*cm, 11*cm, "TOTAL:")
    c.drawString(14*cm, 11*cm, f"${monto*1.12:,.2f}")

    c.showPage()
    c.save()


def parte_policial(path: Path, fecha: str, narrativa: str, expediente: str = "EXP-2024-A001-098765"):
    c = canvas.Canvas(str(path), pagesize=letter)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(2*cm, 26*cm, "POLICIA NACIONAL DEL ECUADOR")
    c.setFont("Helvetica-Bold", 12)
    c.drawString(2*cm, 25*cm, "PARTE POLICIAL DE ACCIDENTE DE TRANSITO")
    c.setFont("Helvetica", 9)
    c.drawString(2*cm, 24*cm, f"Expediente N°: {expediente}")
    c.drawString(2*cm, 23.5*cm, f"Fecha del evento: {fecha}")
    c.drawString(2*cm, 23*cm, "UPC: UPC Norte Quito - Sector La Y")

    c.setFont("Helvetica-Bold", 10)
    c.drawString(2*cm, 22*cm, "NARRATIVA DEL EVENTO:")
    c.setFont("Helvetica", 9)
    txt = c.beginText(2*cm, 21*cm)
    for line in narrativa.split('\n'):
        for i in range(0, len(line), 90):
            txt.textLine(line[i:i+90])
    c.drawText(txt)

    c.setFont("Helvetica", 9)
    c.drawString(2*cm, 5*cm, "_______________________________")
    c.drawString(2*cm, 4.5*cm, "Cabo Primero Luis Andrade")
    c.drawString(2*cm, 4*cm, "Agente Investigador - PNE")
    c.drawString(2*cm, 3*cm, "Sello Institucional - PNE - UPC Norte Quito")

    c.showPage()
    c.save()


def main():
    # 1. Factura LEGITIMA (fecha 5 dias DESPUES del siniestro 2024-08-15)
    factura(OUT / "factura_legitima.pdf",
            fecha_emision="2024-08-20",
            monto=2500.00)
    print(f"  factura_legitima.pdf  (fecha 2024-08-20 > evento 2024-08-15)")

    # 2. Factura SOSPECHOSA (fecha ANTES del siniestro)
    factura(OUT / "factura_sospechosa.pdf",
            fecha_emision="2024-08-01",
            monto=2500.00)
    print(f"  factura_sospechosa.pdf  (fecha 2024-08-01 ANTES del evento 2024-08-15)")

    # 3. Factura sin RUC
    factura(OUT / "factura_sin_ruc.pdf",
            fecha_emision="2024-08-22",
            monto=1800.00, tiene_ruc=False,
            vendedor="Taller Express",
            numero="0001")
    print(f"  factura_sin_ruc.pdf   (formato sospechoso, sin RUC)")

    # 4. Parte policial valido
    parte_policial(OUT / "parte_policial_valido.pdf",
                    fecha="15/08/2024",
                    narrativa=("A las 14:30 del 15 de agosto de 2024, en la Av. Galo Plaza km 12, "
                                "se reporto colision multiple por alcance entre tres vehiculos. "
                                "Vehiculo 1: Toyota Hilux placa PCT-1234. Conductor sin lesiones. "
                                "Vehiculo 2: Chevrolet Sail placa PXM-5678. Vehiculo 3: Kia Rio placa "
                                "PXM-9012. Se procedio a levantar parte policial y se solicito "
                                "comparecencia de las partes para resolucion administrativa."))
    print(f"  parte_policial_valido.pdf")

    print(f"\nGenerados en {OUT}")


if __name__ == "__main__":
    main()
