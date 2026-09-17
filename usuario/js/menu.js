let slideActual = 0;
let intervaloCarrusel;

function mostrarSlide(index) {
    const slides = document.querySelectorAll('.slide');
    const puntos = document.querySelectorAll('.punto');
    if (slides.length === 0) return; 

    slides.forEach(slide => slide.classList.remove('activa'));
    puntos.forEach(punto => punto.classList.remove('activo'));
    
    if (index >= slides.length) slideActual = 0;
    if (index < 0) slideActual = slides.length - 1;
    
    slides[slideActual].classList.add('activa');
    if (puntos.length > 0) puntos[slideActual].classList.add('activo');
}

window.cambiarSlide = function(direccion) {
    slideActual += direccion;
    mostrarSlide(slideActual);
    reiniciarIntervalo();
};

window.irASlide = function(index) {
    slideActual = index;
    mostrarSlide(slideActual);
    reiniciarIntervalo();
};

function iniciarCarrusel() {
    intervaloCarrusel = setInterval(() => { window.cambiarSlide(1); }, 5000); 
}

function reiniciarIntervalo() {
    clearInterval(intervaloCarrusel);
    iniciarCarrusel();
}

const listaProductos = [
    { titulo: "Platillo 1", subtitulo: "NUEVOS SABORES", imagen: "https://cdn7.kiwilimon.com/articuloimagen/26891/26901.jpg" },
    { titulo: "Platillo 2", subtitulo: "DE TEMPORADA", imagen: "https://30a39faf89.cbaul-cdnwnd.com/2d95e5ae8d81454ebe01327301114053/200000033-4bfb24cf4d/maxresdefault.jpg?ph=30a39faf89" },
    { titulo: "Platillo 3", subtitulo: "PARA EMPEZAR", imagen: "https://www.unileverfoodsolutions.com.mx/tendencias/de-mexico-para-el-mundo/platillos-mexicanos/top10-platillos/jcr:content/parsys/content-aside-footer/columncontrol/columnctrl_parsys_1/textimage/image.transform/jpeg-optimized/image.1592429873377.jpg" },
    { titulo: "Platillo 4", subtitulo: "POSTRE", imagen: "https://images.aws.nestle.recipes/resized/2024_10_23T08_34_55_badun_images.badun.es_pastelitos_de_chocolate_blanco_y_queso_con_fresas_1290_742.jpg" },
    { titulo: "Platillo 5", subtitulo: "BEBIDAS", imagen: "https://enlacocina.telemesa.es/wp-content/uploads/2018/07/bebidas-refrescantes-992x640.jpg" }
];

const listaPlatillosCompletos = [
    { titulo: "Molletes Naturales", precio: "99.00", precioOriginal: "206.00", rating: "96", votos: "86", descuento: "- 52%", descripcion: "Tradicionales molletes gratinados (6 pzas) acompañados de salsa.", imagen: "https://tropicalcheese.com/wp-content/uploads/2019/03/molletes.jpg" },
    { titulo: "Combo Pechuga Crispy", precio: "360.80", precioOriginal: "451.00", rating: "60", votos: "5", descuento: "- 20%", descripcion: "De pollo (150 g) crocante, con puré de papa y lechuga al jengibre.", imagen: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSerpNuwj96HubTl-FnG08cIG4w3IAQxPFNV5kwPRsYZYhWo2JudJNd4vc&s=10" },
    { titulo: "Combo Tacos de Pollo", precio: "300.00", precioOriginal: "375.00", rating: "88", votos: "9", descuento: "- 20%", descripcion: "Tacos (4 pzas) de pollo con guacamole y salsa verde al cilantro.", imagen: "https://cdn.avena.io/avena-recipes-v2/2019/10/1571780755073.jpeg" },
    { titulo: "Enchiladas Toks", precio: "119.00", precioOriginal: "219.00", rating: "92", votos: "97", descuento: "- 45%", descripcion: "Rellenas de pollo, bañadas en salsa verde con queso gratinado.", imagen: "https://saboresdemicocina.com/wp-content/uploads/2025/10/22queretaro-enchiladas-queretanas-68ed60c10ad5a-1.webp" }
];

function activarInteractividadHeader() {
    // 1. Modal Login
    const btnLogin = document.getElementById('btn-login');
    const modalLogin = document.getElementById('login-modal');
    if(btnLogin && modalLogin) {
        btnLogin.addEventListener('click', () => modalLogin.classList.add('activo'));
        document.getElementById('cerrar-login').addEventListener('click', () => modalLogin.classList.remove('activo'));
        modalLogin.addEventListener('click', (e) => { if(e.target === modalLogin) modalLogin.classList.remove('activo'); });
    }

    // 2. Carrito de Compras
    const btnCarrito = document.getElementById('btn-carrito');
    const panelCarrito = document.getElementById('cart-panel');
    const overlayCarrito = document.getElementById('cart-overlay');
    
    const cerrarCart = () => {
        panelCarrito.classList.remove('activo');
        overlayCarrito.classList.remove('activo');
    };

    if(btnCarrito) {
        btnCarrito.addEventListener('click', () => {
            panelCarrito.classList.add('activo');
            overlayCarrito.classList.add('activo');
        });
        document.getElementById('cerrar-carrito').addEventListener('click', cerrarCart);
        overlayCarrito.addEventListener('click', cerrarCart);
    }

    // 3. Simulación Agregar al Carrito
    const btnEmpezarPedido = document.getElementById('btn-empezar-pedido');
    const btnIrPagar = document.getElementById('btn-ir-pagar');
    
    if(btnEmpezarPedido) {
        btnEmpezarPedido.addEventListener('click', () => {
            // Ocultamos el carrito vacío y mostramos el lleno
            document.getElementById('estado-vacio').style.display = 'none';
            document.getElementById('estado-lleno').style.display = 'flex';
            
            // Actualizamos precios y habilitamos el botón de pago
            document.getElementById('total-carrito').innerText = "$459.80";
            btnIrPagar.style.opacity = "1";
            btnIrPagar.style.cursor = "pointer";
        });
    }

    // 4. Modal de Pago
    const modalPago = document.getElementById('pago-modal');
    if(btnIrPagar && modalPago) {
        btnIrPagar.addEventListener('click', () => {
            // Solo si el carrito tiene cosas (opacidad 1)
            if(btnIrPagar.style.opacity === "1") {
                cerrarCart(); // Cerramos el carrito
                setTimeout(() => modalPago.classList.add('activo'), 300); // Abrimos pago
            }
        });
        
        document.getElementById('cerrar-pago').addEventListener('click', () => modalPago.classList.remove('activo'));
        modalPago.addEventListener('click', (e) => { if(e.target === modalPago) modalPago.classList.remove('activo'); });
        
        // Botón final de pago exitoso
        document.getElementById('btn-finalizar-pago').addEventListener('click', () => {
            alert("¡Pago exitoso! Tu orden de Q-Rico está siendo preparada. 🍔");
            modalPago.classList.remove('activo');
            
            // Reiniciamos el carrito
            document.getElementById('estado-vacio').style.display = 'block';
            document.getElementById('estado-lleno').style.display = 'none';
            document.getElementById('total-carrito').innerText = "$0.00";
            btnIrPagar.style.opacity = "0.5";
            btnIrPagar.style.cursor = "not-allowed";
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    
    iniciarCarrusel();

    // Cargar Header 
    fetch('header.html')
        .then(respuesta => respuesta.text())
        .then(datos => {
            if(!datos.includes("Cannot GET") && datos.trim() !== "") {
                document.getElementById('contenedor-header').innerHTML = datos;
                activarInteractividadHeader(); // <--- Activamos la lógica
            }
        });

    // Cargar Tarjetas Slider
    fetch('card.html')
        .then(respuesta => respuesta.text())
        .then(plantilla => {
            if(!plantilla.includes("Cannot GET") && plantilla.trim() !== "") {
                const contenedor = document.getElementById('contenedor-productos');
                if (contenedor) {
                    let htmlFinal = "";
                    listaProductos.forEach(producto => {
                        htmlFinal += plantilla.replace(/_TITULO_/g, producto.titulo).replace(/_SUBTITULO_/g, producto.subtitulo).replace(/_IMAGEN_/g, producto.imagen);
                    });
                    contenedor.innerHTML = htmlFinal; 
                }
            }
        });

    // Cargar Cuadrícula
    fetch('cuadro_card.html')
        .then(respuesta => respuesta.text())
        .then(plantilla => {
            if(!plantilla.includes("Cannot GET") && plantilla.trim() !== "") {
                const contenedor = document.getElementById('contenedor-cuadricula');
                if (contenedor) {
                    let htmlFinal = "";
                    listaPlatillosCompletos.forEach(platillo => {
                        htmlFinal += plantilla.replace(/_TITULO_/g, platillo.titulo).replace(/_PRECIO_/g, platillo.precio).replace(/_PRECIOORIGINAL_/g, platillo.precioOriginal).replace(/_RATING_/g, platillo.rating).replace(/_VOTOS_/g, platillo.votos).replace(/_DESCUENTO_/g, platillo.descuento).replace(/_DESCRIPCION_/g, platillo.descripcion).replace(/_IMAGEN_/g, platillo.imagen);
                    });
                    contenedor.innerHTML = htmlFinal; 
                }
            }
        });

    // Cargar Footer
    fetch('footer.html')
        .then(respuesta => respuesta.text())
        .then(datos => {
            if(!datos.includes("Cannot GET") && datos.trim() !== "") {
                document.getElementById('contenedor-footer').innerHTML = datos;
            }
        });

    // Flechas del Slider
    setTimeout(() => {
        const pista = document.getElementById('contenedor-productos');
        const flechas = document.querySelectorAll('.flecha-carrusel');
        if(pista && flechas.length >= 2) {
            flechas[0].addEventListener('click', () => pista.scrollBy({ left: -350, behavior: 'smooth' }));
            flechas[1].addEventListener('click', () => pista.scrollBy({ left: 350, behavior: 'smooth' }));
        }
    }, 500); 
});