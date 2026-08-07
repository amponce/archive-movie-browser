

# Archive Movie Browser

Una aplicación web moderna y responsiva para explorar y ver películas de dominio público del Internet Archive. Cuenta con pósters de alta calidad de TMDB, filtrado por género y un reproductor de video integrado.

<img width="1841" height="1294" alt="image" src="https://github.com/user-attachments/assets/cfe7ca9c-537c-4db3-9bb2-aebbffa3b083" />


## Características

- **Explorar películas de dominio público** - Accede a miles de películas gratuitas y legales de la colección de Archive.org
- **Pósters de alta calidad** - Coincide automáticamente las películas con TMDB para obtener pósters profesionales
- **Filtrado por género** - Filtra por Terror, Ciencia Ficción, Comedia, Drama y más
- **Búsqueda inteligente** - Busca títulos específicos en toda la colección de películas de Archive.org
- **Reproductor integrado** - Ve películas directamente en el navegador sin salir del sitio
- **Detalles de la película** - Visualiza elenco, director, calificaciones, duración y sinopsis
- **Películas relacionadas** - Descubre películas similares basadas en el género
- **Diseño responsivo** - Funciona excelente en dispositivos de escritorio y móviles
- **Caché persistente** - Los datos de TMDB se almacenan en caché localmente para cargas posteriores más rápidas

## Stack Tecnológico

- **React 18** - React moderno con hooks
- **Vite** - Herramienta de compilación rápida y servidor de desarrollo
- **Tailwind CSS** - Framework CSS basado en utilidades
- **Lucide React** - Iconos hermosos
- **API de Archive.org** - Datos de películas y streaming
- **API de TMDB** - Pósters y metadatos de películas

## Primeros Pasos

### Prerrequisitos

- Node.js 18+
- npm o yarn
- Clave API de TMDB (gratuita en [themoviedb.org](https://www.themoviedb.org/settings/api))

### Instalación

1. Clona el repositorio:
```bash
git clone https://github.com/amponce/archive-movie-browser.git
cd archive-movie-browser
```

2. Instala las dependencias:
```bash
npm install
```

3. Crea un archivo `.env` en el directorio raíz:
```bash
cp .env.example .env
```

4. Agrega tu clave API de TMDB a `.env`:
```
VITE_TMDB_API_KEY=your_tmdb_api_key_here
```

5. Inicia el servidor de desarrollo:
```bash
npm run dev
```

6. Abre [http://localhost:3000](http://localhost:3000) en tu navegador

### Compilar para Producción

```bash
npm run build
```

Los archivos compilados se encontrarán en el directorio `dist`.

## Uso

![Archive Movie Browser](https://archive.org/services/img/feature_films)


### Explorando Películas
- Usa las pastillas de género para filtrar por categoría (predeterminado: Terror)
- Alterna entre "Películas completas" y "Cortometrajes" para diferentes tipos de contenido
- Ajusta la duración mínima con el filtro de duración
- Ordena por popularidad, calificación, más recientes o alfabéticamente

### Búsqueda
- Escribe el título de una película en el cuadro de búsqueda y presiona Enter o haz clic en Buscar
- Los resultados de la búsqueda muestran todas las películas coincidentes independientemente de la disponibilidad del póster de TMDB
- Limpia la búsqueda para volver al modo de exploración

### Viendo Películas
- Haz clic en cualquier tarjeta de película para abrir la página de detalles
- Haz clic en "Ver ahora" para iniciar el reproductor integrado de Archive.org
- Explora películas relacionadas en la parte inferior de la página de detalles

## Configuración

### Variables de Entorno

| Variable | Descripción | Requerido |
|----------|-------------|----------|
| `VITE_TMDB_API_KEY` | Tu clave API de TMDB para pósters de películas | Sí |

### Sin clave API de TMDB

La aplicación funciona sin una clave API de TMDB, pero:
- Los pósters de películas usarán miniaturas de Archive.org (menor calidad)
- Sin calificaciones de TMDB ni metadatos adicionales
- Sin filtrado basado en pósters

## Estructura del Proyecto

```
archive-movie-browser/
├── src/
│   ├── components/
│   │   ├── ArchiveMovieBrowser.jsx  # Componente principal de la aplicación
│   │   ├── MovieCard.jsx            # Tarjeta de película (cuadrícula/lista)
│   │   ├── MovieDetailPage.jsx      # Vista completa de detalles de la película
│   │   ├── VideoPlayerModal.jsx     # Modal del reproductor de video
│   │   └── SettingsModal.jsx        # Diálogo de configuración
│   ├── services/
│   │   ├── archive.js               # Servicio API de Archive.org
│   │   └── tmdb.js                  # Servicio API de TMDB con caché
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.js
```

## Créditos de API

- **Internet Archive** - [archive.org](https://archive.org) - Colección y streaming de películas de dominio público
- **TMDB** - [themoviedb.org](https://www.themoviedb.org) - API de base de datos de películas para pósters y metadatos

> Este producto utiliza la API de TMDB, pero no está respaldado ni certificado por TMDB.

## Licencia

Licencia MIT - siéntete libre de usar este proyecto con fines personales o comerciales.

## Contribuciones

¡Las contribuciones son bienvenidas! No dudes en enviar un Pull Request.

1. Haz un fork del repositorio
2. Crea tu rama de características (`git checkout -b feature/AmazingFeature`)
3. Confirma tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Envía a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Agradecimientos

- A Internet Archive por hacer accesibles las películas de dominio público
- A TMDB por su API completa de base de datos de películas
- A las comunidades de React y Vite
