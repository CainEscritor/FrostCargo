import { db } from "./firebase.js";
import {
    doc,
    setDoc,
    getDoc,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// --- Formulario de Búsqueda ---
const formBuscar = document.getElementById("form-buscar-cliente");
const nombreClienteBuscarInput = document.getElementById("nombre-cliente-buscar");
const btnBuscar = document.getElementById("btn-buscar");
const mensajeBusquedaDiv = document.getElementById("mensaje-busqueda");
const panelModificacion = document.getElementById("panel-modificacion");

// --- Formulario de Modificación ---
const formModifica = document.getElementById("form-modifica-cliente");
const btnGuardar = document.getElementById("btn-guardar-cambios");
const mensajeModificacionDiv = document.getElementById("mensaje-modificacion");

// Campos del formulario de modificación
const nombreInput = document.getElementById("nombre"); // Este es el ID del documento
const direccionInput = document.getElementById("direccion");
const cuitInput = document.getElementById("cuit");
const localInput = document.getElementById("local");
const localidadInput = document.getElementById("localidad");
const telefonoInput = document.getElementById("telefono");

// Variables de estado
let clientes = [];
let clienteOriginalName = null; // Para almacenar el nombre del cliente cargado

// ----------------------------------------------------------------------
// LÓGICA DE CARGA Y AUTOCOMPLETADO
// ----------------------------------------------------------------------

async function cargarClientes() {
    try {
        const snap = await getDocs(collection(db, "Clientes"));
        clientes = snap.docs.map((d) => {
            const data = d.data();
            return (data && data.Nombre) ? data.Nombre : "";
        }).filter(n => n).sort();
    } catch (e) {
        console.error("Error al cargar la lista de clientes:", e);
    }
}

nombreClienteBuscarInput.addEventListener("input", () => {
    const valor = nombreClienteBuscarInput.value.trim();
    const sugerencias = clientes
        .filter((c) => c.toLowerCase().includes(valor.toLowerCase()))
        .slice(0, 5);

    let lista = document.getElementById("sugerencias-lista-modifica");
    if (lista) lista.remove();

    if (!valor || sugerencias.length === 0) return;

    lista = document.createElement("ul");
    lista.id = "sugerencias-lista-modifica";
    lista.classList.add("sugerencias-lista");

    sugerencias.forEach((s) => {
        const li = document.createElement("li");
        li.textContent = s;
        li.addEventListener("click", () => {
            nombreClienteBuscarInput.value = s;
            lista.remove();
        });
        lista.appendChild(li);
    });

    // Se asume que el contenedor del input es su padre para el autocompletado
    nombreClienteBuscarInput.parentNode.appendChild(lista);
});

document.addEventListener("click", (e) => {
    if (e.target !== nombreClienteBuscarInput && e.target.closest(".sugerencias-lista") === null) {
        const lista = document.getElementById("sugerencias-lista-modifica");
        if (lista) lista.remove();
    }
});


// ----------------------------------------------------------------------
// LÓGICA DE BÚSQUEDA Y CARGA DE DATOS
// ----------------------------------------------------------------------

async function buscarYMostrarCliente() {
    const nombreBusqueda = nombreClienteBuscarInput.value.trim();
    mensajeBusquedaDiv.textContent = "";
    mensajeModificacionDiv.textContent = "";
    formModifica.style.display = "none";
    clienteOriginalName = null;

    if (!nombreBusqueda) {
        mensajeBusquedaDiv.textContent = "Por favor, ingresa el nombre de un cliente.";
        mensajeBusquedaDiv.style.color = "red";
        return;
    }

    btnBuscar.disabled = true;
    btnBuscar.innerHTML = `<span class="spinner-small"></span> Buscando...`;

    try {
        const clienteRef = doc(db, "Clientes", nombreBusqueda);
        const clienteSnap = await getDoc(clienteRef);

        if (!clienteSnap.exists()) {
            mensajeBusquedaDiv.textContent = `Cliente '${nombreBusqueda}' no encontrado. 🙁`;
            mensajeBusquedaDiv.style.color = "orange";
            // Vaciar y ocultar formulario
            formModifica.reset();
            return;
        }

        const data = clienteSnap.data();
        
        // Cargar datos en el formulario
        nombreInput.value = data.Nombre || "";
        direccionInput.value = data.Direccion || "";
        cuitInput.value = data.CUIT || "";
        localInput.value = data.Local || "";
        localidadInput.value = data.Localidad || "";
        telefonoInput.value = data.Telefono || "";
        
        // Guardar el nombre original para la actualización
        clienteOriginalName = data.Nombre;

        // Mostrar el formulario
        formModifica.style.display = "flex";

        mensajeBusquedaDiv.textContent = `Cliente '${nombreBusqueda}' cargado. Modifica los campos.`;
        mensajeBusquedaDiv.style.color = "green";

        // Aplicar el formato CUIT al valor cargado
        aplicarFormatoCuit(cuitInput);

    } catch (error) {
        console.error("Error al buscar cliente:", error);
        mensajeBusquedaDiv.textContent = `Error al buscar los datos: ${error.message}`;
        mensajeBusquedaDiv.style.color = "red";
    } finally {
        btnBuscar.disabled = false;
        btnBuscar.textContent = "Cargar Datos del Cliente";
    }
}

// Listener para el formulario de búsqueda
formBuscar.addEventListener("submit", async (e) => {
    e.preventDefault();
    await buscarYMostrarCliente();
});

// ----------------------------------------------------------------------
// LÓGICA DE MODIFICACIÓN Y GUARDADO
// ----------------------------------------------------------------------

// Helper: Función de formateo de CUIT (Necesario también para los valores cargados)
function aplicarFormatoCuit(inputElement) {
    let value = inputElement.value.replace(/\D/g, ''); 

    if (value.length > 11) {
        value = value.substring(0, 11);
    }

    let formatted = '';
    if (value.length > 0) {
        formatted = value.substring(0, 2);
    }
    if (value.length > 2) {
        formatted += '-' + value.substring(2, 10);
    }
    if (value.length > 10) {
        formatted += '-' + value.substring(10, 11);
    }

    inputElement.value = formatted;
}

// Listener para el formateo de CUIT mientras se escribe
cuitInput.addEventListener('input', (e) => {
    aplicarFormatoCuit(e.target);
});


// Listener de Submit para Guardar Cambios
formModifica.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!clienteOriginalName) {
        mensajeModificacionDiv.textContent = "Error: Primero debes cargar un cliente válido.";
        mensajeModificacionDiv.style.color = "red";
        return;
    }
    
    // Obtener los valores del formulario
    const nombre = nombreInput.value.trim(); // Se mantiene el nombre original
    const direccion = direccionInput.value.trim();
    const cuit = cuitInput.value.trim();
    const local = localInput.value.trim();
    const localidad = localidadInput.value.trim();
    const telefono = telefonoInput.value.trim();

    // Validaciones básicas (igual que en nuevoCliente)
    if (!nombre || !direccion || !cuit || !local || !localidad || !telefono) {
        mensajeModificacionDiv.textContent = "Todos los campos son obligatorios.";
        mensajeModificacionDiv.style.color = "red";
        return;
    }
    const cuitRegex = /^\d{2}-\d{8}-\d{1}$/;
    if (!cuitRegex.test(cuit)) {
        mensajeModificacionDiv.textContent = "El CUIT debe tener el formato 00-00000000-0.";
        mensajeModificacionDiv.style.color = "red";
        return;
    }
    const telDigits = telefono.replace(/\D/g, '');
    if (telDigits.length < 6) {
        mensajeModificacionDiv.textContent = "Ingresa un teléfono válido.";
        mensajeModificacionDiv.style.color = "red";
        return;
    }


    btnGuardar.disabled = true;
    btnGuardar.innerHTML = `<span class="spinner"></span> Guardando cambios...`;
    mensajeModificacionDiv.textContent = "";

    try {
        // Usamos el nombre original (clienteOriginalName) como ID para actualizar el documento existente
        await setDoc(doc(db, "Clientes", clienteOriginalName), {
            Nombre: nombre, // Si el nombre no es modificable, se guarda el mismo
            Direccion: direccion,
            CUIT: cuit,
            Local: local,
            Localidad: localidad,
            Telefono: telefono,
        }, { merge: true }); // Usamos merge: true para no borrar el historial si existe

        mensajeModificacionDiv.textContent = `Cliente '${nombre}' modificado con éxito. ✅`;
        mensajeModificacionDiv.style.color = "green";
        
        // Opcional: Deshabilitar el formulario hasta nueva búsqueda
        formModifica.style.display = "none";
        formModifica.reset();
        nombreClienteBuscarInput.value = "";
        
        // Recargar la lista de clientes por si se usa en otra parte
        await cargarClientes(); 

    } catch (error) {
        mensajeModificacionDiv.textContent = `Error al guardar: ${error.message}`;
        mensajeModificacionDiv.style.color = "red";
        console.error("Error guardando cliente modificado:", error);
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = "Guardar Cambios";
    }
});

// INICIALIZACIÓN
cargarClientes();