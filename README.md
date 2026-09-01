# Liga Metropolitana de Béisbol (LMB) Buenos Aires - App de Estadísticas

Aplicación web PWA adaptada 100% a dispositivos móviles y tablets (máximo 768px) para la gestión integral de partidos, planteles y estadísticas oficiales de la Liga Metropolitana de Béisbol de Buenos Aires.

## 🚀 Características Principales

1. **Diseño Mobile-First 100% (Max 768px)**:
   - Estilos inspirados en Material Design 3 con paleta de colores oficial LMB (Azul Marino `#0A192F`, Rojo Carmesí `#D32F2F`, Dorado `#FFC107`).
   - Carrusel Scorebug estilo MLB para partidos en vivo, resultados y próximos juegos.
   - Navegación inferior fija, tablas táctiles y badges dinámicos.

2. **Estructura Multicategoría y Ascenso/Descenso**:
   - Soporte para divisiones: **A1 - Primera División**, **A2 - Segunda**, **A3 - Tercera**, **Infantiles**, **Little League**.
   - Gestión por temporadas (ej. *Temporada Oficial 2026*).
   - Sistema de **Ascenso y Descenso** para mover equipos entre divisiones conservando su historial.

3. **Anotador en Vivo ("En Partido") Offline-First**:
   - Registro táctil jugada a jugada: Sencillo (1B), Doble (2B), Triplete (3B), Jonrón (HR), Base por Bolas (BB), Ponches (SO), Out de Fly, Out de Rola, Errores, Carreras Impulsadas (RBI), etc.
   - Diamante de béisbol interactivo con corredores en base.
   - Control de lanzadores, cambios y conteo de lanzamientos.
   - **Funciona 100% Sin Conexión**: En los estadios sin señal, las jugadas se guardan en la cola local de `localStorage` y se sincronizan automáticamente con el servidor al recuperar conexión.

4. **Sección de Líderes Departamentales**:
   - Rankings ordenados dinámicamente por **Average (AVG)**, **Jonrones (HR)**, **Carreras Impulsadas (CI)**, **Hits (H)**, **OPS**, **Robos (SB)**, **Efectividad de Lanzadores (ERA)**, **Ponches (SO)**, **Victorias (W)**, **Salvados (SV)** y **WHIP**.

5. **Roles de Usuario y Permisos**:
   - **Administrador SuperAdmin**: Control total de ligas, temporadas, equipos, ascensos/descensos y reinicio del sistema.
   - **Delegado / Admin de Equipo**: Edición de plantel, jugadores y fotos del equipo asignado.
   - **Planillero / Scorekeeper**: Registro de partidos en vivo y boxscores.
   - **Público / Fanáticos**: Consulta libre de calendario, posiciones, tarjetas de jugadores, resultados y postales.

6. **Multimedia y Galería**:
   - Subida de logos de equipos, tarjetas/fotos de jugadores y **hasta 10 postales fotográficas por partido**.

---

## 💻 Instalación Local y Despliegue en Hostinger

### En Hostinger (MySQL)
1. Importa el archivo `db/schema.sql` en phpMyAdmin dentro del panel de Hostinger.
2. Edita `db/config.php` con tus credenciales de MySQL:
   ```php
   define('DB_DRIVER', 'mysql');
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'tu_base_de_datos');
   define('DB_USER', 'tu_usuario');
   define('DB_PASS', 'tu_contraseña');
   ```
3. Sube la carpeta del proyecto a `public_html`.

### En Localhost (XAMPP / LAMPP)
- Abre la URL `http://localhost/LMB-estadisticas/` en tu navegador.
- Si MySQL no está configurado, la aplicación se iniciará de forma autómata usando SQLite integrado (`db/lmb_database.sqlite`) con todos los datos de prueba pre-cargados.

---

## 🔑 Credenciales de Prueba Pre-cargadas

- **Super Administrador**: `admin` / `admin123`
- **Delegado DAOM**: `delegado_daom` / `delegado123`
- **Anotador / Planillero**: `anotador` / `delegado123`

---

## 📦 Repositorio Git
- Enlazado a: `https://github.org/geyler/LMB-estadisticas.git`
