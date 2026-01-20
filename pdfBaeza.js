// ===============================
// pdfBaeza.js
// ===============================

export async function generarPDFBaeza({
  pedidoId,
  data,
  preciosData,
  grupos,
  productosPedidos,
  ocultarPrecios,
  descuentoPorcentaje = 0,
  descuentoEfectivo = 0,
  observaciones = "",
  idsData,
}) {
  const { jsPDF } = window.jspdf;
  const docPDF = new jsPDF({ format: "legal", unit: "mm" });

  const logoImg = await cargarLogo("images/Grido_logo.png");

  // ORIGINAL
  await drawRemitoBaeza(docPDF, logoImg, "ORIGINAL", {
    data,
    preciosData,
    grupos,
    productosPedidos,
    ocultarPrecios,
    descuentoPorcentaje,
    descuentoEfectivo,
    observaciones,
    idsData,
  });

  docPDF.addPage("legal", "portrait");

  // DUPLICADO
  await drawRemitoBaeza(docPDF, logoImg, "DUPLICADO", {
    data,
    preciosData,
    grupos,
    productosPedidos,
    ocultarPrecios,
    descuentoPorcentaje,
    descuentoEfectivo,
    observaciones,
    idsData,
  });

  docPDF.save(`BAEZA_${pedidoId}.pdf`);
}

// --------------------------------------------------
// 🔹 LOGO
// --------------------------------------------------
function cargarLogo(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}

// --------------------------------------------------
// 🔹 DRAW REMITO (BAEZA)
// --------------------------------------------------
async function drawRemitoBaeza(
  docPDF,
  logoImg,
  tipoCopia,
  {
    data,
    preciosData,
    grupos,
    productosPedidos,
    ocultarPrecios,
    descuentoPorcentaje,
    descuentoEfectivo,
    observaciones,
    idsData,
  }
) {
  const pageWidth = docPDF.internal.pageSize.getWidth();
  let y = 10;
  const marginLeft = 10;

  // ===============================
  // ENCABEZADO
  // ===============================
  docPDF.addImage(logoImg, "PNG", marginLeft, y, 50, 20);
  y += 25;

  docPDF.setFont("helvetica", "normal");
  docPDF.setFontSize(10);
  docPDF.text("BAEZA", marginLeft, y); // 👈 ÚNICO CAMBIO
  y += 5;
  docPDF.text("Benjamin Franklin 1557", marginLeft, y);
  y += 5;
  docPDF.text("(5850) RIO TERCERO (Cba.) Tel: 3571-528075", marginLeft, y);
  y += 5;
  docPDF.setFontSize(8);
  docPDF.text("Responsable Inscripto", marginLeft, y);

  y = 20;
  docPDF.setFont("helvetica", "bold");
  docPDF.setFontSize(14);
  docPDF.text(`REMITO - COPIA ${tipoCopia}`, pageWidth - 10, y, {
    align: "right",
  });

  y += 8;
  docPDF.setFontSize(9);
  docPDF.setFont("helvetica", "normal");
  docPDF.text("DOCUMENTO NO VALIDO COMO FACTURA", pageWidth - 10, y, {
    align: "right",
  });

  y += 7;
  const numeroRemito = data.NumeroRemito ?? 0;
  docPDF.text(
    `N° ${numeroRemito.toString().padStart(8, "0")}`,
    pageWidth - 10,
    y,
    { align: "right" }
  );

  y += 7;
  docPDF.setFontSize(8);
  docPDF.text(
    "CUIT: 30-71857453-2   Ing. Brutos: 280-703834",
    pageWidth - 10,
    y,
    { align: "right" }
  );

  y += 5;
  docPDF.text("Fecha de Inicio Act.: 01/05/2010", pageWidth - 10, y, {
    align: "right",
  });

  y += 3;
  docPDF.line(marginLeft, y, pageWidth - marginLeft, y);
  y += 6;

  // ===============================
  // CLIENTE
  // ===============================
  docPDF.setFontSize(13);
  docPDF.setFont("helvetica", "normal");
  docPDF.text(
    `${data.Nombre || "-"} (${data.Local || "-"})`,
    marginLeft,
    y
  );
  y += 5;
  docPDF.text(
    `${data.Direccion || "-"}, ${data.Localidad || "-"}`,
    marginLeft,
    y
  );
  y += 10;

  // ===============================
  // PRODUCTOS
  // ===============================
  let subtotal = 0;

  function dibujarGrupo(nombreColeccion, items) {
    if (!items.length) return;

    docPDF.setFont("helvetica", "bold");
    docPDF.setFontSize(13);
    docPDF.text(nombresColecciones[nombreColeccion] || nombreColeccion, 10, y);
    y += 6;

    items.forEach((prod) => {
      const key = `${nombreColeccion}::${prod}`;
      const detalle = productosPedidos[key];
      const cant = detalle?.cantidad || 0;
      if (!cant) return;

      const precio = preciosData[prod] || 0;
      const total = cant * precio;
      subtotal += total;

      docPDF.setFont("helvetica", "bold");
      docPDF.setFontSize(11);
      docPDF.text(cant.toString(), 13, y);

      docPDF.setFont("helvetica", "normal");
      docPDF.text(`- ${prod}`, 18, y);

      if (!ocultarPrecios) {
        docPDF.text(`$${total.toFixed(2)}`, pageWidth - 10, y, {
          align: "right",
        });
      }

      y += 5;
      if (y > 280) {
        docPDF.addPage();
        y = 20;
      }
    });

    y += 4;
  }

  coleccionesStock.forEach((col) => dibujarGrupo(col, grupos[col]));

  // ===============================
  // TOTALES
  // ===============================
  if (!ocultarPrecios) {
    docPDF.setFontSize(10);
    docPDF.text(`SUBTOTAL: $${subtotal.toFixed(2)}`, pageWidth - 10, y, {
      align: "right",
    });
    y += 6;

    let descP = subtotal * (descuentoPorcentaje / 100);
    let descE = descuentoEfectivo;

    if (descP > 0) {
      docPDF.text(
        `Descuento (${descuentoPorcentaje}%): -$${descP.toFixed(2)}`,
        pageWidth - 10,
        y,
        { align: "right" }
      );
      y += 6;
    }

    if (descE > 0) {
      docPDF.text(
        `Descuento Efectivo: -$${descE.toFixed(2)}`,
        pageWidth - 10,
        y,
        { align: "right" }
      );
      y += 6;
    }

    let totalFinal = Math.max(0, subtotal - descP - descE);

    docPDF.setFont("helvetica", "bold");
    docPDF.setFontSize(12);
    docPDF.text(`TOTAL FINAL: $${totalFinal.toFixed(2)}`, pageWidth - 10, y, {
      align: "right",
    });
  }

  y += 12;

  // ===============================
  // FIRMA
  // ===============================
  docPDF.setFontSize(8);
  docPDF.setFont("helvetica", "normal");
  docPDF.text("Recibí(mos) Conforme", 10, y);
  docPDF.text("Firma: ____________________", 160, y);
  y += 5;
  docPDF.text("Aclaración: ________________", 160, y);

  if (observaciones) {
    y += 8;
    docPDF.setFontSize(11);
    docPDF.text(`Observaciones: ${observaciones}`, 10, y);
  }
}
