import { db } from "./firebase.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const contenedor = document.getElementById("contenedor-paneles");
const refrescarBtn = document.getElementById("refrescar-btn");
const abrirModalBtn = document.getElementById("listado-btn");

const modal = document.getElementById("modal-export");
const step1 = document.getElementById("step-1");
const step2 = document.getElementById("step-2");
const btnConCant = document.getElementById("btn-con-cant");
const btnSinCant = document.getElementById("btn-sin-cant");
const btnPdf = document.getElementById("btn-formato-pdf");
const btnExcel = document.getElementById("btn-formato-excel");
const btnCerrar = document.getElementById("btn-cerrar-modal");

let incluirStockGlobal = false;
let datosCache = null; // Variable para almacenar los datos y evitar re-lecturas

const colecciones = [
  "StockCarnicos",
  "StockFrigorBalde",
  "StockFrigorImpulsivos",
  "StockFrigorPostres",
  "StockFrigorPotes",
  "StockGlupsGranel",
  "StockGlupsImpulsivos",
  "StockGudfud",
  "StockInal",
  "StockLambweston",
  "StockMexcal",
  "StockOrale",
  "StockPripan",
  "StockSwift",
];

const nombresColecciones = {
  StockCarnicos: "Productos Extras",
  StockFrigorBalde: "Frigor Baldes",
  StockFrigorImpulsivos: "Frigor Impulsivos",
  StockFrigorPostres: "Frigor Postres",
  StockFrigorPotes: "Frigor Potes",
  StockGlupsGranel: "Glups Granel",
  StockGlupsImpulsivos: "Glup Impulsivos",
  StockGudfud: "Gudfud",
  StockInal: "Inal",
  StockLambweston: "Lambweston",
  StockMexcal: "Mexcal",
  StockOrale: "Orale",
  StockPripan: "Pripan",
  StockSwift: "Swift",
};

/* ===================== RENDERIZADO PANTALLA (BLAZE-FRIENDLY) ===================== */

function crearPanel(titulo) {
  const panel = document.createElement("div");
  panel.className = "panel";
  panel.innerHTML = `<h2>${titulo}</h2><table><thead><tr><th>ID</th><th>Producto</th><th>Cantidad</th></tr></thead><tbody></tbody></table>`;
  contenedor.appendChild(panel);
  return panel.querySelector("tbody");
}

async function cargarTodosLosStocks() {
  contenedor.innerHTML =
    "<p style='text-align:center; padding:20px;'>Cargando inventario de Firebase...</p>";

  try {
    // 1. Preparamos todas las promesas para ejecutarlas en paralelo (más rápido y eficiente)
    const promesasStock = colecciones.map((col) =>
      getDoc(doc(db, col, "Stock"))
    );
    const promesaIDs = getDoc(doc(db, "idProductos", "idProducto"));

    // 2. Ejecutamos todas las lecturas de una sola vez
    const resultados = await Promise.all([...promesasStock, promesaIDs]);

    // El último resultado corresponde a los IDs de productos
    const idsData = resultados[resultados.length - 1].exists()
      ? resultados[resultados.length - 1].data()
      : {};

    // Inicializamos el objeto de caché para PDF/Excel
    datosCache = {
      ids: idsData,
      stocks: {},
    };

    contenedor.innerHTML = "";

    // 3. Procesamos los resultados de stock
    for (let i = 0; i < colecciones.length; i++) {
      const col = colecciones[i];
      const snap = resultados[i];
      const data = snap.exists() ? snap.data() : {};

      // Guardamos en caché local
      datosCache.stocks[col] = data;

      const titulo = nombresColecciones[col] || col;
      const tbody = crearPanel(titulo);

      const productos = Object.keys(data).sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
      );

      if (productos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#666;">Sin datos en esta categoría</td></tr>`;
      } else {
        productos.forEach((prod) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${idsData[prod] || "---"}</td>
            <td>${prod}</td>
            <td>${data[prod]}</td>
          `;
          tbody.appendChild(tr);
        });
      }
    }
  } catch (e) {
    console.error("Error al cargar stocks:", e);
    contenedor.innerHTML =
      "<p style='color:red; text-align:center;'>Error crítico al conectar con Firebase.</p>";
  }
}

/* ===================== MODAL ===================== */

abrirModalBtn.addEventListener("click", () => {
  if (!datosCache) return alert("Espera a que carguen los datos.");
  step1.classList.remove("hidden");
  step2.classList.add("hidden");
  modal.style.display = "flex";
});

btnCerrar.addEventListener("click", () => (modal.style.display = "none"));

btnConCant.addEventListener("click", () => {
  incluirStockGlobal = true;
  step1.classList.add("hidden");
  step2.classList.remove("hidden");
});

btnSinCant.addEventListener("click", () => {
  incluirStockGlobal = false;
  step1.classList.add("hidden");
  step2.classList.remove("hidden");
});

btnPdf.addEventListener("click", () => {
  modal.style.display = "none";
  generarPDF(incluirStockGlobal);
});

btnExcel.addEventListener("click", () => {
  modal.style.display = "none";
  generarExcel(incluirStockGlobal);
});

/* ===================== GENERAR PDF (USANDO CACHÉ) ===================== */

function generarPDF(conCant) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  let y = 15;
  const marginX = 15;
  const colId = 15,
    colProd = 45,
    colCant = 175;

  // Título Principal
  pdf
    .setFont("helvetica", "bold")
    .setFontSize(18)
    .text("INVENTARIO FROST CARGO", 105, y, { align: "center" });
  y += 10;
  pdf
    .setFontSize(10)
    .setFont("helvetica", "normal")
    .text(`Generado el: ${new Date().toLocaleString()}`, 105, y, {
      align: "center",
    });
  y += 15;

  for (const col of colecciones) {
    const data = datosCache.stocks[col];
    if (!data || Object.keys(data).length === 0) continue;

    if (y > 250) {
      pdf.addPage();
      y = 20;
    }

    // Cabecera de Categoría
    pdf.setFillColor(240, 240, 240).rect(marginX, y - 5, 180, 8, "F");
    pdf.setFont("helvetica", "bold").setFontSize(12).setTextColor(0);
    pdf.text((nombresColecciones[col] || col).toUpperCase(), marginX + 2, y);
    y += 10;

    const productos = Object.keys(data).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );

    pdf.setFont("helvetica", "normal").setFontSize(10);
    for (const prod of productos) {
      if (y > 280) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(String(datosCache.ids[prod] || "---"), colId, y);
      pdf.text(String(prod), colProd, y);
      if (conCant) pdf.text(String(data[prod]), colCant, y);
      y += 6;
    }
    y += 8;
  }
  pdf.save("Reporte_Stock_FrostCargo.pdf");
}

/* ===================== GENERAR EXCEL (USANDO CACHÉ) ===================== */

function generarExcel(conCant) {
  const filasExcel = [
    ["CATEGORÍA", "ID", "PRODUCTO", conCant ? "CANTIDAD" : ""],
  ];

  for (const col of colecciones) {
    const data = datosCache.stocks[col];
    if (!data || Object.keys(data).length === 0) continue;

    const productos = Object.keys(data).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );

    productos.forEach((prod) => {
      const fila = [
        nombresColecciones[col] || col,
        datosCache.ids[prod] || "---",
        prod,
      ];
      if (conCant) fila.push(data[prod]);
      filasExcel.push(fila);
    });
    filasExcel.push([]); // Celda vacía entre categorías
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(filasExcel);
  ws["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 45 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws, "Stock");
  XLSX.writeFile(wb, "Stock_FrostCargo.xlsx");
}

/* ===================== INIT ===================== */
refrescarBtn.addEventListener("click", cargarTodosLosStocks);
cargarTodosLosStocks();
