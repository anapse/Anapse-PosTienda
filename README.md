# Anapse PosTienda 🇨🇴
**Sistema Profesional de Ventas, Caja Rápida, Inventario, Fiados y Catálogo Online para Comercios de Colombia**

---

## 🛒 Características Principales

- **Moneda Oficial:** Pesos Colombianos (COP) con formato `$ 25.000` (sin decimales para moneda estándar).
- **Punto de Venta (POS):** Venta rápida por celular o PC, teclado numérico de billetes colombianos ($100k, $50k, $20k, $10k, $5k, $2k), cálculo de cambio, pagos divididos (Efectivo, Nequi, Daviplata, Tarjeta, Fiado).
- **Cuaderno de Fiados Digital:** Registro de deudas de clientes, abonos parciales, saldo acumulado y extractos de cuenta automáticos para compartir por WhatsApp.
- **Inventario y Kardex:** Control de existencias, cálculo de costo vs precio de venta (ganancia bruta real), alertas de stock mínimo, venta por peso / decimales y exportación/importación en CSV.
- **Caja Diaria:** Apertura con base inicial, registro de gastos e ingresos, discriminación de efectivo físico vs dinero digital (Nequi/Daviplata) y cierre con cálculo de diferencias.
- **Catálogo Online Público:** Catálogo web para cada comercio con pedidos directos enviados al WhatsApp de la tienda.
- **Comprobantes Térmicos:** Impresión formato ticket (80mm / 58mm) y envío directo al WhatsApp del comprador.

---

## 💰 Modelo de Suscripción & Planes

- **Tarifa mensual:** **$ 40.000 COP / mes**
- **Capacidad:** Hasta **500 productos** por tienda
- **Ciclo de Servicio:** **30 días** con contador regresivo automático
- **Mecanismo de Activación:**
  1. El cliente se registra e ingresa la solicitud de su comercio indicando el tipo de negocio.
  2. La tienda queda en estado **Pre-Aprobación / En Revisión**.
  3. El Super Administrador (`elherreroanapse@gmail.com`) aprueba y activa los 30 días de servicio desde el **Panel de Activaciones** o puede suspender/extender el servicio.
- **Línea de Atención y Pagos:** **+51 912391502** (Solo WhatsApp).

---

## 🚀 Cómo Subir este Proyecto a GitHub y GitHub Pages

### 1. Inicializar Git y subir a GitHub

Abre tu terminal en la carpeta del proyecto y ejecuta:

```bash
# 1. Iniciar repositorio local
git init

# 2. Agregar todos los archivos
git add .

# 3. Crear el primer commit
git commit -m "feat: Anapse PosTienda inicial con Firebase y GitHub Pages"

# 4. Conectar con tu repositorio en GitHub (reemplaza con tu usuario y repo)
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git

# 5. Cambiar rama a main y subir el código
git branch -M main
git push -u origin main
```

---

### 2. Activar GitHub Pages

El proyecto ya incluye el archivo `.github/workflows/deploy.yml` para despliegue automático:

1. Ve a tu repositorio en **GitHub**.
2. Entra en **Settings** (Configuración) > pestaña **Pages** (en el menú lateral izquierdo).
3. En la sección **Build and deployment**:
   - En **Source**, selecciona: **GitHub Actions**.
4. ¡Listo! Cada vez que hagas `git push`, GitHub compilará y publicará tu tienda automáticamente en:
   `https://TU_USUARIO.github.io/TU_REPOSITORIO/`

> **Nota sobre rutas relativas:** `vite.config.ts` ya tiene configurado `base: './'`, por lo que tus estilos, scripts e imágenes cargarán perfectamente en GitHub Pages sin pantallas en blanco ni errores 404.

---

### 3. Autorizar el Dominio en Firebase Authentication

Para que el inicio de sesión con Google funcione en GitHub Pages:

1. Ve a tu consola de [Firebase Console](https://console.firebase.google.com/).
2. Selecciona tu proyecto (`hdjlsgob32pnp2ptkzfkhn`).
3. En el menú izquierdo ve a **Authentication** > pestaña **Settings** (Configuración).
4. Desplázate hasta **Authorized domains** (Dominios autorizados).
5. Haz clic en **Add domain** y escribe el dominio de GitHub:
   `TU_USUARIO.github.io`
6. Guarda los cambios. ¡Tu aplicación estará 100% operativa en producción!
