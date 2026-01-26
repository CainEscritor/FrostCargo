import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const preciosLista = document.getElementById("precios-lista");
const guardarBtn = document.getElementById("guardar-precios");

let articulosAgrupados = {
  carnicos: [],
  frigorbalde: [],
  frigorimpulsivos: [],
  frigorpostres: [],
  frigorpotes: [],
  glupsgranel: [],
  glupsimpulsivos: [],
  gudfud: [],
  inal: [],
  lambweston: [],
  mexcal: [],
  orale: [],
  pripán: [],
  swift: [],
};

/**
 * Genera filas con valor inicial 0.
 * El precio actual se muestra solo como referencia visual.
 */
function generarInputs(container, grupos, preciosActuales) {
  container.innerHTML = "";

  const ordenGrupos = Object.keys(articulosAgrupados);

  ordenGrupos.forEach((grupoKey) => {
    const lista = grupos[grupoKey];
    if (lista.length === 0) return;

    // Encabezado de grupo
    const headerTr = document.createElement("tr");
    headerTr.innerHTML = `<td colspan="3" style="background-color: #f0f0f0; font-weight: bold; text-align: center; padding: 10px;">${formatoNombreGrupo(grupoKey)}</td>`;
    container.appendChild(headerTr);

    lista.sort((a, b) => a.localeCompare(b));

    lista.forEach((key) => {
      const tr = document.createElement("tr");
      const precioActual = preciosActuales[key] || 0;

      tr.innerHTML = `
          <td>${key}</td>
          <td class="precio-actual" style="color: #666;">$ ${precioActual.toFixed(2)}</td>
          <td>
            <input 
              type="number" 
              min="0" 
              value="0" 
              data-key="${key}" 
              step="0.01"
              style="border: 1px solid #ccc;"
              onfocus="if(this.value=='0') this.value=''" 
              onblur="if(this.value=='') this.value='0'"
            >
          </td>
        `;
      container.appendChild(tr);
    });
  });
}

function formatoNombreGrupo(key) {
  const nombres = {
    carnicos: "Stock Productos Extras",
    frigorbalde: "Stock Frigor Balde",
    frigorimpulsivos: "Stock Frigor Impulsivos",
    frigorpostres: "Stock Frigor Postres",
    frigorpotes: "Stock Frigor Potes",
    glupsgranel: "Stock Glups Granel",
    glupsimpulsivos: "Stock Glups Impulsivos",
    gudfud: "Stock Gudfud",
    inal: "Stock Inal",
    lambweston: "Stock Lambweston",
    mexcal: "Stock Mexcal",
    orale: "Stock Orale",
    pripán: "Stock Pripan",
    swift: "Stock Swift",
  };
  return nombres[key] || key;
}

async function cargarPrecios() {
  try {
    const DOC_NAME = "Stock";
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

    // Mapeo de promesas para los stocks
    const promesasStock = colecciones.map((col) =>
      getDoc(doc(db, col, DOC_NAME)),
    );
    // Promesa para precios
    const promesaPrecios = getDoc(doc(db, "Precios", "Precio"));

    const resultados = await Promise.all([...promesasStock, promesaPrecios]);

    const preciosSnap = resultados.pop(); // El último es el de precios
    const preciosActuales = preciosSnap.exists() ? preciosSnap.data() : {};

    // Llenar articulosAgrupados dinámicamente según el orden de 'colecciones'
    const keysAgrupados = Object.keys(articulosAgrupados);
    resultados.forEach((snap, index) => {
      const grupo = keysAgrupados[index];
      articulosAgrupados[grupo] = snap.exists() ? Object.keys(snap.data()) : [];
    });

    generarInputs(preciosLista, articulosAgrupados, preciosActuales);
  } catch (err) {
    console.error("Error cargando artículos:", err);
    alert("Error cargando la lista ❌");
  }
}

guardarBtn.addEventListener("click", async () => {
  try {
    const preciosRef = doc(db, "Precios", "Precio");
    const nuevosPrecios = {};

    // Recopilar solo valores mayores a 0
    preciosLista.querySelectorAll("input").forEach((input) => {
      const valor = parseFloat(input.value);
      if (valor > 0) {
        nuevosPrecios[input.dataset.key] = valor;
      }
    });

    if (Object.keys(nuevosPrecios).length === 0) {
      alert("No has ingresado ningún precio nuevo (mayores a 0).");
      return;
    }

    // Actualización parcial (merge)
    await setDoc(preciosRef, nuevosPrecios, { merge: true });

    alert("¡Precios actualizados con éxito! ✅");
    cargarPrecios(); // Recarga para ver los nuevos precios actuales
  } catch (err) {
    console.error("Error al guardar:", err);
    alert("Error al guardar precios ❌");
  }
});

// Inicio
cargarPrecios();
