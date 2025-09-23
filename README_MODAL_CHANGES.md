Cambios para modal de producto

- Se aumentó la altura máxima de las imágenes del carrusel a 520px y se usa `object-fit: contain` para que la imagen mantenga su proporción.
- Se aumentó la tipografía del bloque de detalles a `16px` y `line-height: 1.7` para mejorar la lectura.
- En pantallas anchas el modal usa grid de 2 columnas: izquierda imagen/carrusel y derecha texto de detalles.

Cómo probar

1. Levanta Live Server en la carpeta `dropshi`.
2. Abre un producto y haz clic en "Ver detalles".
3. Verifica que las imágenes del carrusel sean más grandes y que el texto esté en dos columnas en pantallas anchas.

Notas

- Si tu modal usa selectores distintos a `.product-modal` o `.modal-body`, adaptar los selectores en `styles.css`.
- Si prefieres imágenes aún más grandes, sube `max-height` a 600px o más.
