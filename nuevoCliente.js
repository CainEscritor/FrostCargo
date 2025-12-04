import { db } from "./firebase.js";
import {
    doc,
    setDoc,
    getDoc,
    collection,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// --- Panel de Agregar Cliente ---
const formAgregar = document.getElementById("form-cliente");
const btnAgregar = document.getElementById("btn-agregar");
const mensajeAgregarDiv = document.getElementById("mensaje");
const cuitInput = document.getElementById("cuit");
const nombreInput = document.getElementById("nombre");
const direccionInput = document.getElementById("direccion");
const localInput = document.getElementById("local");
const localidadInput = document.getElementById("localidad");
const telefonoInput = document.getElementById("telefono"); // Referencia directa al input de teléfono

// --- Manejo del botón "Modificar Cliente" ---
// Buscamos primero por id "btn-modificar". Si no existe, intentamos localizar el botón
// que contenga la palabra "Modificar" y que no sea el botón de agregar.
let btnModificar = document.getElementById("btn-modificar");
if (!btnModificar) {
    btnModificar = Array.from(document.querySelectorAll("button")).find(b => {
        // Ignorar el botón de agregar (si existe)
        if (btnAgregar && b === btnAgregar) return false;
        const text = (b.textContent || b.innerText || "").trim();
        return /modificar/i.test(text);
    }) || null;
}

if (btnModificar) {
    btnModificar.addEventListener("click", (e) => {
        // Evitar que el botón envíe el formulario si tiene type="submit"
        if (e && typeof e.preventDefault === "function") e.preventDefault();
        // Redirigir a la página de modificación
        window.location.href = "modificaCliente.html";
    });
} else {
    // Opcional: console para debugging si el botón no fue encontrado
    console.warn("btnModificar no encontrado. Asegurate de tener un botón con id='btn-modificar' o con texto 'Modificar Cliente'.");
}

// --- Panel de Buscar Historial ---
const formHistorial = document.getElementById("form-historial");
const nombreClienteInput = document.getElementById("nombre-cliente-historial");
const btnBuscar = document.getElementById("btn-buscar-historial");
const filtroMesSelect = document.getElementById("filtro-mes");
const historialResultadoDiv = document.getElementById("historial-resultado");
const mensajeHistorialDiv = document.getElementById("mensaje-historial");

// Variables para el autocompletado y el estado
const inputContainerHistorial = nombreClienteInput.closest(".input-group");
let clientes = [];
let historialCompleto = {};

// ----------------------------------------------------------------------
// LÓGICA DE CARGA Y AUTOCOMPLETADO
// ----------------------------------------------------------------------

async function cargarClientes() {
    try {
        const snap = await getDocs(collection(db, "Clientes"));
        clientes = snap.docs.map((d) => {
            const data = d.data();
            // Si no existe Nombre, evitar undefined
            return (data && data.Nombre) ? data.Nombre : "";
        }).filter(n => n).sort();
    } catch (e) {
        console.error("Error al cargar la lista de clientes:", e);
    }
}

// Lógica de Autocompletado
nombreClienteInput.addEventListener("input", () => {
    const valor = nombreClienteInput.value.trim();
    const sugerencias = clientes
        .filter((c) => c.toLowerCase().includes(valor.toLowerCase()))
        .slice(0, 5);

    let lista = document.getElementById("sugerencias-lista-historial");
    if (lista) lista.remove();

    if (!valor || sugerencias.length === 0) return;

    lista = document.createElement("ul");
    lista.id = "sugerencias-lista-historial";
    lista.classList.add("sugerencias-lista");

    sugerencias.forEach((s) => {
        const li = document.createElement("li");
        li.textContent = s;
        li.addEventListener("click", () => {
            nombreClienteInput.value = s;
            lista.remove();
        });
        lista.appendChild(li);
    });

    if (inputContainerHistorial) {
        inputContainerHistorial.appendChild(lista);
    } else {
        nombreClienteInput.parentNode.appendChild(lista);
    }
});

// Listener para ocultar la lista de sugerencias al hacer clic fuera
document.addEventListener("click", (e) => {
    if (e.target !== nombreClienteInput && e.target.closest(".sugerencias-lista") === null) {
        const lista = document.getElementById("sugerencias-lista-historial");
        if (lista) lista.remove();
    }
});

// ----------------------------------------------------------------------
// LÓGICA DEL PANEL DE AGREGAR CLIENTE
// ----------------------------------------------------------------------

// NUEVA FUNCIÓN: Formateo de CUIT
cuitInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, ''); // Eliminar no dígitos

    // Limitar a 11 dígitos para el CUIT sin guiones
    if (value.length > 11) {
        value = value.substring(0, 11);
    }

    // Aplicar el formato 00-00000000-0
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

    e.target.value = formatted;
});

// *** Se elimina la función obtenerLocalYTelefono() ya que no era necesaria y causaba el error ***

// Listener de Submit CORREGIDO
formAgregar.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombre = nombreInput.value.trim();
    const direccion = direccionInput.value.trim();
    const cuit = cuitInput.value.trim();
    const localidad = localidadInput.value.trim();
    
    // 🔥 CAMBIO CLAVE: Obtener Local y Telefono directamente de sus IDs
    const local = localInput.value.trim();
    const telefono = telefonoInput.value.trim();

    // Validar todos los campos
    if (!nombre || !direccion || !cuit || !local || !localidad || !telefono) {
        mensajeAgregarDiv.textContent = "Todos los campos son obligatorios.";
        mensajeAgregarDiv.style.color = "red";
        return;
    }

    // Validación de formato CUIT
    const cuitRegex = /^\d{2}-\d{8}-\d{1}$/;
    if (!cuitRegex.test(cuit)) {
        mensajeAgregarDiv.textContent = "El CUIT debe tener el formato 00-00000000-0.";
        mensajeAgregarDiv.style.color = "red";
        return;
    }

    // Validación simple de teléfono
    const telDigits = telefono.replace(/\D/g, '');
    if (telDigits.length < 6) {
        mensajeAgregarDiv.textContent = "Ingresa un teléfono válido.";
        mensajeAgregarDiv.style.color = "red";
        return;
    }

    btnAgregar.disabled = true;
    btnAgregar.innerHTML = `<span class="spinner"></span>Guardando...`;
    mensajeAgregarDiv.textContent = "";

    try {
        // Usamos el nombre como ID del documento
        await setDoc(doc(db, "Clientes", nombre), {
            Nombre: nombre,
            Direccion: direccion,
            CUIT: cuit,
            Local: local,
            Localidad: localidad,
            Telefono: telefono, // <-- AHORA SE GUARDA CORRECTAMENTE
        }, { merge: true });

        mensajeAgregarDiv.textContent = `Cliente '${nombre}' agregado ✅`;
        mensajeAgregarDiv.style.color = "green";

        formAgregar.reset();
        await cargarClientes(); // Recarga la lista de clientes para el autocompletado
    } catch (error) {
        mensajeAgregarDiv.textContent = `Error: ${error.message}`;
        mensajeAgregarDiv.style.color = "red";
        console.error("Error guardando cliente:", error);
    } finally {
        btnAgregar.disabled = false;
        btnAgregar.textContent = "Agregar Cliente";
    }
});

// ----------------------------------------------------------------------
// LÓGICA DEL PANEL DE BUSCAR HISTORIAL
// ----------------------------------------------------------------------

function fillMonthSelect(historial) {
    filtroMesSelect.innerHTML = '<option value="todos">Todos los meses (Total)</option>';
    filtroMesSelect.disabled = true;

    if (!historial || Object.keys(historial).length === 0) {
        return;
    }

    filtroMesSelect.disabled = false;

    // Obtenemos los meses y los ordenamos de forma descendente (más recientes primero)
    const meses = Object.keys(historial).sort().reverse();

    meses.forEach(mes => {
        const [year, month] = mes.split('-');
        // month - 1 porque el mes es 0-indexado en JS
        const date = new Date(year, month - 1);
        // Formato para mostrar: Enero 2024
        const nombreMes = date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

        const option = document.createElement('option');
        option.value = mes;
        // Capitalizamos la primera letra
        option.textContent = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);
        filtroMesSelect.appendChild(option);
    });
}

function renderHistorial(data) {
    if (Object.keys(data).length === 0) {
        historialResultadoDiv.innerHTML = '<p class="aviso-gris">No hay productos registrados para este periodo.</p>';
        return;
    }

    const html = Object.entries(data)
        .sort((a, b) => a[0].localeCompare(b[0])) // Ordenar por nombre de producto
        .map(([producto, cantidad]) =>
            `<div class="historial-item">
                <span class="producto-nombre">${producto}:</span>
                <span class="producto-cantidad">${cantidad}</span>
            </div>`
        ).join('');

    historialResultadoDiv.innerHTML = `<div class="historial-lista">${html}</div>`;
}

async function buscarYMostrarHistorial() {
    const nombre = nombreClienteInput.value.trim();
    mensajeHistorialDiv.textContent = "";
    historialResultadoDiv.innerHTML = "";
    // Restablecer el select
    filtroMesSelect.innerHTML = '<option value="todos">Busca un cliente para cargar los meses...</option>';
    filtroMesSelect.disabled = true;
    historialCompleto = {};

    if (!nombre) {
        mensajeHistorialDiv.textContent = "Por favor, ingresa el nombre de un cliente.";
        mensajeHistorialDiv.style.color = "red";
        return;
    }

    btnBuscar.disabled = true;
    btnBuscar.innerHTML = `<span class="spinner-small"></span> Buscando...`;

    try {
        const clienteRef = doc(db, "Clientes", nombre);
        const clienteSnap = await getDoc(clienteRef);

        if (!clienteSnap.exists()) {
            mensajeHistorialDiv.textContent = `Cliente '${nombre}' no encontrado. 🙁`;
            mensajeHistorialDiv.style.color = "orange";
            return;
        }

        const data = clienteSnap.data();
        historialCompleto = data.historial || {};

        if (Object.keys(historialCompleto).length === 0) {
            mensajeHistorialDiv.textContent = `Cliente '${nombre}' encontrado, pero no tiene historial de pedidos.`;
            mensajeHistorialDiv.style.color = "blue";
            return;
        }

        // 1. Rellenar el Select de Meses
        fillMonthSelect(historialCompleto);

        // 2. Mostrar el Historial Total (dispara el listener 'change')
        filtroMesSelect.value = "todos";
        filtroMesSelect.dispatchEvent(new Event('change'));

        mensajeHistorialDiv.textContent = `Historial de '${nombre}' cargado. Total de meses: ${Object.keys(historialCompleto).length} 📊`;
        mensajeHistorialDiv.style.color = "green";
    } catch (error) {
        console.error("Error al buscar historial:", error);
        mensajeHistorialDiv.textContent = `Error al buscar los datos: ${error.message}`;
        mensajeHistorialDiv.style.color = "red";
    } finally {
        btnBuscar.disabled = false;
        btnBuscar.textContent = "Buscar Historial";
    }
}

// Listener para el filtro de mes
filtroMesSelect.addEventListener("change", () => {
    const mesSeleccionado = filtroMesSelect.value;

    if (mesSeleccionado === "todos") {
        const historialTotal = {};
        for (const mes in historialCompleto) {
            const productosDelMes = historialCompleto[mes];
            for (const producto in productosDelMes) {
                historialTotal[producto] = (historialTotal[producto] || 0) + productosDelMes[producto];
            }
        }
        renderHistorial(historialTotal);
    } else if (historialCompleto[mesSeleccionado]) {
        renderHistorial(historialCompleto[mesSeleccionado]);
    } else {
        historialResultadoDiv.innerHTML = '<p class="aviso-gris">Mes no disponible o sin datos.</p>';
    }
});

formHistorial.addEventListener("submit", async (e) => {
    e.preventDefault();
    await buscarYMostrarHistorial();
});

// INICIALIZACIÓN: Carga la lista de clientes al inicio
cargarClientes();
