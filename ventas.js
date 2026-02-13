import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// DOM
const tbody = document.querySelector("#tabla-ventas tbody");
const refrescarBtn = document.getElementById("refrescar-btn");
const btnBuscar = document.getElementById("buscar-btn");
const btnExportPDF = document.getElementById("btn-export-pdf");
const btnExportExcel = document.getElementById("btn-export-excel");

const filtros = {
  cliente: document.getElementById("filtro-cliente"),
  localidad: document.getElementById("filtro-localidad"),
  direccion: document.getElementById("filtro-direccion"),
  fechaDesde: document.getElementById("filtro-fecha-desde"),
  fechaHasta: document.getElementById("filtro-fecha-hasta"),
  remito: document.getElementById("filtro-remito"),
  tipo: document.getElementById("filtro-tipo"),
  vendedor: document.getElementById("filtro-vendedor"),
  total: document.getElementById("filtro-total"),
};

let ventasFiltradas = [];
let sumaTotalGlobal = 0; // Variable para guardar el total acumulado

// 🔹 Verifica filtros activos
function hayFiltrosActivos() {
  return Object.values(filtros).some((el) => el && el.value.trim() !== "");
}

// 🔹 BUSQUEDA COMPLETA
async function ejecutarBusqueda() {
  if (!hayFiltrosActivos()) {
    alert("Ingrese al menos un criterio de búsqueda.");
    return;
  }

  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px;">Buscando en la base de datos...</td></tr>`;

  try {
    const colRef = collection(db, "Ventas");
    let condiciones = [];

    const remitoRaw = filtros.remito.value.trim();
    if (remitoRaw !== "") {
      condiciones.push(where("NumeroRemito", "==", Number(remitoRaw)));
    }

    if (filtros.fechaDesde.value) {
      condiciones.push(where("fechaEntrega", ">=", filtros.fechaDesde.value));
    }
    if (filtros.fechaHasta.value) {
      condiciones.push(where("fechaEntrega", "<=", filtros.fechaHasta.value));
    }
    if (filtros.tipo.value) {
      condiciones.push(where("tipoDocumento", "==", filtros.tipo.value));
    }
    if (filtros.vendedor.value) {
  condiciones.push(where("Vendedor", "==", filtros.vendedor.value));
}

    condiciones.push(limit(500));

    const q = query(colRef, ...condiciones);
    const snap = await getDocs(q);

    let resultados = [];
    snap.forEach((doc) => {
      resultados.push({ id: doc.id, ...doc.data() });
    });

    // FILTRADO Y ORDEN ALFABÉTICO POR CLIENTE
    ventasFiltradas = resultados
      .filter((v) => {
        const matchCliente =
          !filtros.cliente.value ||
          (v.cliente || "")
            .toLowerCase()
            .includes(filtros.cliente.value.toLowerCase());
        const matchLocalidad =
          !filtros.localidad.value ||
          (v.Localidad || "")
            .toLowerCase()
            .includes(filtros.localidad.value.toLowerCase());
        const matchDireccion =
          !filtros.direccion.value ||
          (v.direccion || "")
            .toLowerCase()
            .includes(filtros.direccion.value.toLowerCase());
        const matchTotal =
          !filtros.total.value ||
          String(v.total || "").includes(filtros.total.value);

        return matchCliente && matchLocalidad && matchDireccion && matchTotal;
      })
      .sort((a, b) => (a.cliente || "").localeCompare(b.cliente || ""));

    renderizarTabla(ventasFiltradas);
  } catch (error) {
    console.error("Error en búsqueda:", error);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:red; padding:20px;">Error: ${error.message}</td></tr>`;
  }
}

// 🔹 Render de tabla
function renderizarTabla(lista) {
  tbody.innerHTML = "";
  sumaTotalGlobal = 0; // Reiniciar suma

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px;">No se encontraron resultados</td></tr>`;
    return;
  }

  lista.forEach((v) => {
    const productosEntradas = Object.entries(v.productos || {});
    const totalUnidades = productosEntradas.reduce(
      (acc, [_, cant]) => acc + (Number(cant) || 0),
      0,
    );

    const valorVenta = Number(v.total || 0);
    sumaTotalGlobal += valorVenta;

    let opcionesProd = `<option>Productos (${totalUnidades})</option>`;
    for (const [prod, cant] of productosEntradas) {
      opcionesProd += `<option disabled>${prod}: ${cant}</option>`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${v.cliente || "-"}</strong></td>
      <td>${v.Localidad || "-"}</td>
      <td>${v.direccion || "-"}</td>
      <td>${v.fechaEntrega || "-"}</td>
      <td>${v.NumeroRemito || "-"}</td>
      <td>${v.tipoDocumento || "-"}</td>
      <td>$ ${valorVenta.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
      })}</td>
      <td>
        <select style="width:100%; font-size:11px; padding: 4px; border-radius: 4px;">
          ${opcionesProd}
        </select>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Fila de Totales en Web
  const filaTotal = document.createElement("tr");
  filaTotal.style.backgroundColor = "#f1f1f1";
  filaTotal.style.fontWeight = "bold";
  filaTotal.innerHTML = `
    <td colspan="6" style="text-align: right; padding: 12px;">TOTAL VENTAS:</td>
    <td colspan="2" style="color: #c50014;">$ ${sumaTotalGlobal.toLocaleString(
      "es-AR",
      { minimumFractionDigits: 2 },
    )}</td>
  `;
  tbody.appendChild(filaTotal);
}

// 🔹 EXPORTACIÓN PDF CON TOTAL
function exportarPDF() {
  if (!ventasFiltradas.length) return alert("No hay datos para exportar");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("l", "mm", "a4");

  doc.setFontSize(18);
  doc.text("Reporte de Ventas", 14, 15);
  doc.setFontSize(11);
  doc.text(`Fecha de reporte: ${new Date().toLocaleDateString()}`, 14, 22);

  // Mapear datos para la tabla
  const filasParaPDF = ventasFiltradas.map((v) => [
    v.cliente,
    v.Localidad,
    v.direccion,
    v.fechaEntrega,
    v.NumeroRemito,
    v.tipoDocumento,
    `$${Number(v.total || 0).toLocaleString("es-AR", {
      minimumFractionDigits: 2,
    })}`,
  ]);

  // Añadir fila de total al final del PDF
  filasParaPDF.push([
    {
      content: "TOTAL GENERAL",
      colSpan: 6,
      styles: { halign: "right", fontStyle: "bold" },
    },
    {
      content: `$${sumaTotalGlobal.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
      })}`,
      styles: { fontStyle: "bold", fillColor: [240, 240, 240] },
    },
  ]);

  doc.autoTable({
    startY: 28,
    head: [
      ["Cliente", "Localidad", "Dirección", "Fecha", "Remito", "Tipo", "Total"],
    ],
    body: filasParaPDF,
    theme: "striped",
    headStyles: { fillColor: [197, 0, 20] }, // Color institucional rojo
  });

  doc.save(`Reporte_Ventas_${new Date().toISOString().split("T")[0]}.pdf`);
}

// 🔹 EXPORTACIÓN EXCEL
function exportarExcel() {
  if (!ventasFiltradas.length) return alert("No hay datos para exportar");

  const filasExcel = [];

  ventasFiltradas.forEach((v) => {
    const productosEntradas = Object.entries(v.productos || {});

    if (productosEntradas.length === 0) {
      filasExcel.push({
        Cliente: v.cliente || "-",
        Localidad: v.Localidad || "-",
        Dirección: v.direccion || "-",
        Fecha: v.fechaEntrega || "-",
        Remito: v.NumeroRemito || "-",
        Tipo: v.tipoDocumento || "-",
        ID: "",
        Producto: "Sin productos",
        Cantidad: 0,
        "Precio Unitario": "",
        "Precio Total Venta": v.total || 0,
      });
    } else {
      productosEntradas.forEach(([nombreProd, data], index) => {
        const cantidad = Number(data.cantidad || 0);
        const precioUnitario = Number(data.precio || 0);

        filasExcel.push({
          Cliente: index === 0 ? v.cliente : "",
          Localidad: index === 0 ? v.Localidad : "",
          Dirección: index === 0 ? v.direccion : "",
          Fecha: index === 0 ? v.fechaEntrega : "",
          Remito: index === 0 ? v.NumeroRemito : "",
          Tipo: index === 0 ? v.tipoDocumento : "",
          ID: data.id || "",
          Producto: nombreProd,
          Cantidad: cantidad,
          "Precio Unitario": precioUnitario,
          "Precio Total Venta": index === 0 ? v.total : "",
        });
      });
    }
  });

  // TOTAL GENERAL
  filasExcel.push({
    Cliente: "TOTAL GENERAL",
    Localidad: "",
    Dirección: "",
    Fecha: "",
    Remito: "",
    Tipo: "",
    ID: "",
    Producto: "",
    Cantidad: "",
    "Precio Unitario": "",
    "Precio Total Venta": sumaTotalGlobal,
  });

  const ws = XLSX.utils.json_to_sheet(filasExcel);

  // 🔹 PRIMERA FILA EN NEGRITA
  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
    if (cell && !cell.s) {
      cell.s = { font: { bold: true } };
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ventas Detalladas");

  XLSX.writeFile(
    wb,
    `Reporte_Ventas_Detalle_${new Date().toISOString().split("T")[0]}.xlsx`,
  );
}


// 🔹 LISTENERS
btnBuscar.addEventListener("click", ejecutarBusqueda);
btnExportPDF.addEventListener("click", exportarPDF);
btnExportExcel.addEventListener("click", exportarExcel);

refrescarBtn.addEventListener("click", () => {
  Object.values(filtros).forEach((f) => {
    if (f) f.value = "";
  });
  ventasFiltradas = [];
  sumaTotalGlobal = 0;
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px;">Use los filtros y presione BUSCAR</td></tr>`;
});

document.addEventListener("DOMContentLoaded", () => {
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px;">Use los filtros y presione BUSCAR</td></tr>`;
});
