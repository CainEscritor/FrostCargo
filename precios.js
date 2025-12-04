import { db } from "./firebase.js";
// Se asegura de importar 'setDoc'
import { doc, getDoc, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const preciosLista = document.getElementById("precios-lista");
const guardarBtn = document.getElementById("guardar-precios");

let preciosData = {}; // Para guardar los precios nuevos antes de subir

// Objeto para almacenar la lista de artículos agrupados
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
    swift: []
};


/**
 * Genera filas de tabla con el precio actual (read-only) y una ranura de nuevo precio (input).
 */
function generarInputs(container, grupos, preciosActuales) {
  container.innerHTML = "";
  
  // Definir el orden de los grupos para la visualización
  const ordenGrupos = [
    'carnicos',
    'frigorbalde',
    'frigorimpulsivos',
    'frigorpostres',
    'frigorpotes',
    'glupsgranel',
    'glupsimpulsivos',
    'gudfud',
    'inal',
    'lambweston',
    'mexcal',
    'orale',
    'pripán',
    'swift'
  ];
  
  ordenGrupos.forEach(grupoKey => {
      const lista = grupos[grupoKey];
      
      if (lista.length === 0) return;
      
      // Crear un encabezado visual para el grupo
      const h2 = document.createElement('tr');
      h2.innerHTML = `<td colspan="3" style="background-color: #f0f0f0; font-weight: bold; text-align: center; padding: 10px;">${formatoNombreGrupo(grupoKey)}</td>`;
      container.appendChild(h2);
      
      // Ordenar alfabéticamente dentro del grupo
      lista.sort((a, b) => a.localeCompare(b));

      lista.forEach(key => {
        const tr = document.createElement("tr");
        
        // Obtiene el precio actual, si existe, o 0.00
        const precioActual = preciosActuales[key] !== undefined ? preciosActuales[key] : 0; 
        const precioActualDisplay = precioActual.toFixed(2);
        
        // El input de modificación ahora usa el precio actual como valor inicial
        tr.innerHTML = `
          <td>${key}</td>
          <td class="precio-actual">$ ${precioActualDisplay}</td>
          <td><input type="number" min="0" value="${precioActual}" data-key="${key}" step="0.01"></td>
        `;
        container.appendChild(tr);
      });
  });
}

/**
 * Función auxiliar para formatear el nombre de la key a un título visible.
 */
function formatoNombreGrupo(key) {
    switch(key) {
        case 'carnicos': return 'Stock Cárnicos';
        case 'frigorbalde': return 'Stock Frigor Balde';
        case 'frigorimpulsivos': return 'Stock Frigor Impulsivos';
        case 'frigorpostres': return 'Stock Frigor Postres';
        case 'frigorpotes': return 'Stock Frigor Potes';
        case 'glupsgranel': return 'Stock Glups Granel';
        case 'glupsimpulsivos': return 'Stock Glups Impulsivos';
        case 'gudfud': return 'Stock Gudfud';
        case 'inal': return 'Stock Inal';
        case 'lambweston': return 'Stock Lambweston';
        case 'mexcal': return 'Stock Mexcal';
        case 'orale': return 'Stock Orale';
        case 'pripán': return 'Stock Pripan';
        case 'swift': return 'Stock Swift';
        default: return key;
    }
}


async function cargarPrecios() {
  try {
    // 1. Definir referencias de documentos para Stock (Usando "Stock" como nombre de documento)
    const DOC_NAME = "Stock";
    const carnicosRef = doc(db, "StockCarnicos", DOC_NAME);
    const frigorBaldeRef = doc(db, "StockFrigorBalde", DOC_NAME);
    const frigorImpulsivosRef = doc(db, "StockFrigorImpulsivos", DOC_NAME);
    const frigorPostresRef = doc(db, "StockFrigorPostres", DOC_NAME);
    const frigorPotesRef = doc(db, "StockFrigorPotes", DOC_NAME);
    const glupsGranelRef = doc(db, "StockGlupsGranel", DOC_NAME);
    const glupsImpulsivosRef = doc(db, "StockGlupsImpulsivos", DOC_NAME);
    const gudfudRef = doc(db, "StockGudfud", DOC_NAME);
    const inalRef = doc(db, "StockInal", DOC_NAME);
    const lambwestonRef = doc(db, "StockLambweston", DOC_NAME);
    const mexcalRef = doc(db, "StockMexcal", DOC_NAME);
    const oraleRef = doc(db, "StockOrale", DOC_NAME);
    const pripanRef = doc(db, "StockPripan", DOC_NAME);
    const swiftRef = doc(db, "StockSwift", DOC_NAME);
    
    // Referencia de Precios Mayoristas
    const preciosRef = doc(db, "Precios", "Precio"); 
    
    // 2. Ejecutar todas las lecturas de Firestore
    const [
      carnicosSnap,
      frigorBaldeSnap,
      frigorImpulsivosSnap,
      frigorPostresSnap,
      frigorPotesSnap,
      glupsGranelSnap,
      glupsImpulsivosSnap,
      gudfudSnap,
      inalSnap,
      lambwestonSnap,
      mexcalSnap,
      oraleSnap,
      pripanSnap,
      swiftSnap,
      preciosSnap
    ] = await Promise.all([
      getDoc(carnicosRef),
      getDoc(frigorBaldeRef),
      getDoc(frigorImpulsivosRef),
      getDoc(frigorPostresRef),
      getDoc(frigorPotesRef),
      getDoc(glupsGranelRef),
      getDoc(glupsImpulsivosRef),
      getDoc(gudfudRef),
      getDoc(inalRef),
      getDoc(lambwestonRef),
      getDoc(mexcalRef),
      getDoc(oraleRef),
      getDoc(pripanRef),
      getDoc(swiftRef),
      getDoc(preciosRef)
    ]);

    // 3. Obtener datos de Precios Actuales
    const preciosActuales = preciosSnap.exists() ? preciosSnap.data() : {};
    
    // 4. Consolidar la lista de nombres por grupo
    articulosAgrupados.carnicos = carnicosSnap.exists() ? Object.keys(carnicosSnap.data()) : [];
    articulosAgrupados.frigorbalde = frigorBaldeSnap.exists() ? Object.keys(frigorBaldeSnap.data()) : [];
    articulosAgrupados.frigorimpulsivos = frigorImpulsivosSnap.exists() ? Object.keys(frigorImpulsivosSnap.data()) : [];
    articulosAgrupados.frigorpostres = frigorPostresSnap.exists() ? Object.keys(frigorPostresSnap.data()) : [];
    articulosAgrupados.frigorpotes = frigorPotesSnap.exists() ? Object.keys(frigorPotesSnap.data()) : [];
    articulosAgrupados.glupsgranel = glupsGranelSnap.exists() ? Object.keys(glupsGranelSnap.data()) : [];
    articulosAgrupados.glupsimpulsivos = glupsImpulsivosSnap.exists() ? Object.keys(glupsImpulsivosSnap.data()) : [];
    articulosAgrupados.gudfud = gudfudSnap.exists() ? Object.keys(gudfudSnap.data()) : [];
    articulosAgrupados.inal = inalSnap.exists() ? Object.keys(inalSnap.data()) : [];
    articulosAgrupados.lambweston = lambwestonSnap.exists() ? Object.keys(lambwestonSnap.data()) : [];
    articulosAgrupados.mexcal = mexcalSnap.exists() ? Object.keys(mexcalSnap.data()) : [];
    articulosAgrupados.orale = oraleSnap.exists() ? Object.keys(oraleSnap.data()) : [];
    articulosAgrupados.pripán = pripanSnap.exists() ? Object.keys(pripanSnap.data()) : [];
    articulosAgrupados.swift = swiftSnap.exists() ? Object.keys(swiftSnap.data()) : [];


    // 5. Generar Inputs agrupados
    generarInputs(preciosLista, articulosAgrupados, preciosActuales);

  } catch (err) {
    console.error("Error cargando artículos y precios:", err);
    alert("Error cargando la lista de artículos y precios ❌");
  }
}

guardarBtn.addEventListener("click", async () => {
  try {
    // Referencia de Precios Mayoristas
    const preciosRef = doc(db, "Precios", "Precio"); 
    
    // 1. Recorrer y recopilar los nuevos precios
    const nuevosPrecios = {};
    preciosLista.querySelectorAll("input").forEach(input => {
        const nuevoValor = parseFloat(input.value); 
        
        // Usamos el data-key para obtener el nombre del artículo
        nuevosPrecios[input.dataset.key] = nuevoValor;
    });
    
    // Si no hay precios para actualizar, salir
    if (Object.keys(nuevosPrecios).length === 0) {
        alert("No hay artículos para actualizar.");
        return;
    }

    // 2. Ejecutar la actualización de Firestore
    // *** CAMBIO: Usamos setDoc con merge: true para asegurar que el documento exista y se actualice ***
    await setDoc(preciosRef, nuevosPrecios, { merge: true });

    alert("Precios actualizados correctamente ✅");
    
    // Recargar la vista para reflejar los cambios
    cargarPrecios(); 

  } catch (err) {
    console.error("Error guardando precios:", err);
    alert("Error guardando precios ❌. Verifica las Reglas de Seguridad de Firestore.");
  }
});

cargarPrecios();