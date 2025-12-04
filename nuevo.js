import { db } from "./firebase.js";
import {
  doc,
  updateDoc,
  getDoc,
  deleteField,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// -------------------------------------------------------------
// ## Constantes del Nuevo Esquema
// -------------------------------------------------------------

const coleccionesStock = [
  "StockCarnicos", "StockFrigorBalde", "StockFrigorImpulsivos", "StockFrigorPostres",
  "StockFrigorPotes", "StockGlupsGranel", "StockGlupsImpulsivos", "StockGudfud",
  "StockInal", "StockLambweston", "StockMexcal", "StockOrale", "StockPripan", "StockSwift"
];

const nombresColecciones = {
  StockCarnicos: "Cárnicos",
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
  StockSwift: "Swift"
};

const priceCollections = [
  "PreciosExpress",
  "PreciosFranquicia",
  "PreciosGastronomico",
  "PreciosStore",
  "PreciosSupermercados"
];

// -------------------------------------------------------------
// ## Funciones de CRUD Genéricas
// -------------------------------------------------------------

async function agregarProducto({ nombre, coleccion }) {
  const producto = nombre.trim();
  if (!producto) {
    alert("Ingresa un nombre de producto válido.");
    return;
  }
  
  // En el nuevo esquema, el documento de stock se llama "Stock" en todas las colecciones
  const documentoStock = "Stock";
  const documentoPrecio = "Precio"; // El documento de precio se llama "Precio"

  try {
    // 1. Agregar el producto al Stock (inicialmente con 0 unidades)
    await updateDoc(doc(db, coleccion, documentoStock), {
      [producto]: 0
    });

    // 2. Agregar el producto a todas las colecciones de Precios (inicialmente con precio 0)
    const camposPrecio = { [producto]: 0 };
    const tareas = priceCollections.map(col => updateDoc(doc(db, col, documentoPrecio), camposPrecio));
    
    await Promise.all(tareas);

    alert(`✅ Producto/Insumo '${producto}' agregado en ${coleccion} y Precios`);
  } catch (e) {
    console.error("Error agregando producto/insumo:", e);
    alert("❌ Error agregando producto/insumo: " + e.message);
  }
}

async function borrarProducto({ nombre, coleccion }) {
  const producto = nombre.trim();
  if (!producto) {
    alert("Ingresa un nombre de producto válido.");
    return;
  }

  const documentoStock = "Stock";
  const documentoPrecio = "Precio";

  try {
    const stockRef = doc(db, coleccion, documentoStock);
    const snap = await getDoc(stockRef);

    if (!snap.exists() || !snap.data().hasOwnProperty(producto)) {
      alert(`⚠️ El producto/insumo '${producto}' NO existe en ${coleccion}`);
      return;
    }

    const confirmar = confirm(`¿Seguro que querés borrar '${producto}' de ${coleccion}?`);
    if (!confirmar) return;

    // 1. Borrar de Stock
    await updateDoc(stockRef, { [producto]: deleteField() });
    
    // 2. Borrar de Precios
    const camposBorrarPrecios = { [producto]: deleteField() };
    const tareas = priceCollections.map(col => updateDoc(doc(db, col, documentoPrecio), camposBorrarPrecios));
    
    await Promise.all(tareas);

    alert(`🗑️ Producto/Insumo '${producto}' borrado de ${coleccion} y Precios`);
  } catch (e) {
    console.error("Error borrando producto/insumo:", e);
    alert("❌ Error borrando producto/insumo: " + e.message);
  }
}

// -------------------------------------------------------------
// ## Generación de Paneles (Nuevo)
// -------------------------------------------------------------

const stockPanelsContainer = document.getElementById("stock-panels-container");

function generarPanel(coleccion, titulo) {
  const panel = document.createElement("div");
  panel.className = "panel";
  
  const h2 = document.createElement("h2");
  h2.textContent = titulo;
  panel.appendChild(h2);

  // Formulario de Agregar
  const formAgregar = document.createElement("form");
  formAgregar.id = `form-agregar-${coleccion}`;
  formAgregar.innerHTML = `
    <label>Nombre del producto</label>
    <input type="text" id="nombre-${coleccion}" placeholder="Nombre del producto" required />
    <button type="submit" class="btn-rojo">Agregar Producto</button>
  `;
  panel.appendChild(formAgregar);

  // Formulario de Borrar
  const formBorrar = document.createElement("form");
  formBorrar.id = `form-borrar-${coleccion}`;
  formBorrar.innerHTML = `
    <label>Borrar producto</label>
    <input type="text" id="borrar-${coleccion}" placeholder="Nombre del producto a borrar" required />
    <button type="submit" class="btn-gris">Borrar Producto</button>
  `;
  panel.appendChild(formBorrar);
  
  // Agregar Listeners
  formAgregar.addEventListener("submit", (e) => {
    e.preventDefault();
    const nombre = document.getElementById(`nombre-${coleccion}`).value;
    agregarProducto({ nombre, coleccion });
    e.target.reset();
  });

  formBorrar.addEventListener("submit", (e) => {
    e.preventDefault();
    const nombre = document.getElementById(`borrar-${coleccion}`).value;
    borrarProducto({ nombre, coleccion });
    e.target.reset();
  });

  return panel;
}

function inicializarPaneles() {
  stockPanelsContainer.innerHTML = ''; // Limpiar el mensaje de carga

  coleccionesStock.forEach(col => {
    const titulo = nombresColecciones[col] || col;
    const panel = generarPanel(col, titulo);
    stockPanelsContainer.appendChild(panel);
  });
}

// -------------------------------------------------------------
// ## Inicio
// -------------------------------------------------------------

inicializarPaneles();