import { db } from "./firebase.js";
import {
  doc,
  writeBatch,
  deleteField,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

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

const nombresEtiquetas = {
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
  StockSwift: "Swift",
};

const contenedor = document.getElementById("contenedor-gestion");

// Renderizado de paneles
colecciones.forEach((col) => {
  const div = document.createElement("div");
  div.className = "panel";
  div.innerHTML = `
        <h2>${nombresEtiquetas[col]}</h2>
        <div class="formulario-gestion">
            <label>Nombre del producto</label>
            <input type="text" id="n-${col}" placeholder="Ej: Hamburguesa">
            <label>ID del producto (Código)</label>
            <input type="text" id="i-${col}" placeholder="Ej: CAR-001">
            <button class="btn-azul" id="btn-a-${col}">Agregar Producto</button>
        </div>
        <hr>
        <div class="formulario-gestion">
            <label>Borrar producto</label>
            <input type="text" id="b-${col}" placeholder="Nombre exacto">
            <button class="btn-borrar" id="btn-b-${col}">Borrar de Todo el Sistema</button>
        </div>
    `;
  contenedor.appendChild(div);

  document.getElementById(`btn-a-${col}`).onclick = () => crearProducto(col);
  document.getElementById(`btn-b-${col}`).onclick = () => borrarProducto(col);
});

/* ===================== CREAR PRODUCTO (BATCH) ===================== */

async function crearProducto(coleccion) {
  const nombreInput = document.getElementById(`n-${coleccion}`);
  const idInput = document.getElementById(`i-${coleccion}`);
  const btn = document.getElementById(`btn-a-${coleccion}`);

  const nombre = nombreInput.value.trim();
  const idValor = idInput.value.trim();

  if (!nombre || !idValor) return alert("Completa ambos campos");

  try {
    btn.disabled = true;
    btn.textContent = "Procesando...";

    const batch = writeBatch(db);

    // 1. Preparar el stock (inicia en 0)
    const refStock = doc(db, coleccion, "Stock");
    batch.set(refStock, { [nombre]: 0 }, { merge: true });

    // 2. Preparar el ID
    const refIDs = doc(db, "idProductos", "idProducto");
    batch.set(refIDs, { [nombre]: idValor }, { merge: true });

    // Ejecución atómica
    await batch.commit();

    alert(`Producto "${nombre}" creado con éxito ✅`);
    nombreInput.value = "";
    idInput.value = "";
  } catch (error) {
    console.error("Error al crear:", error);
    alert("Error al guardar los datos.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Agregar Producto";
  }
}

/* ===================== BORRAR PRODUCTO (BATCH) ===================== */

async function borrarProducto(coleccion) {
  const inputBorrar = document.getElementById(`b-${coleccion}`);
  const btn = document.getElementById(`btn-b-${coleccion}`);
  const nombre = inputBorrar.value.trim();

  if (!nombre) return alert("Escribe el nombre del producto");
  if (!confirm(`¿Estás seguro de eliminar "${nombre}" de forma permanente?`))
    return;

  try {
    btn.disabled = true;
    btn.textContent = "Eliminando...";

    const batch = writeBatch(db);

    // 1. Eliminar campo de la colección de Stock
    const refStock = doc(db, coleccion, "Stock");
    batch.update(refStock, { [nombre]: deleteField() });

    // 2. Eliminar campo del catálogo de IDs
    const refIDs = doc(db, "idProductos", "idProducto");
    batch.update(refIDs, { [nombre]: deleteField() });

    await batch.commit();

    alert("Producto eliminado del sistema ✅");
    inputBorrar.value = "";
  } catch (error) {
    console.error("Error al borrar:", error);
    alert("Error al intentar eliminar. Verifica que el nombre sea exacto.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Borrar de Todo el Sistema";
  }
}
