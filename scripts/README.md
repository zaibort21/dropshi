Uso del script download-images.ps1

1) Preparar un archivo `image-list.json`. Ejemplo:
[
  { "id": 36, "url": "https://cdn.dropi.com/product/36/imagen1.jpg", "fileName": "leggins-1.jpg" },
  { "id": 36, "url": "https://cdn.dropi.com/product/36/imagen2.jpg", "fileName": "leggins-2.jpg" },
  { "id": 53, "url": "https://cdn.dropi.com/product/53/imagen1.jpg", "fileName": "product-53-1.jpg" }
]

2) Ejecutar en PowerShell (desde la carpeta `dropshi`):

    .\scripts\download-images.ps1 -SourceFile .\scripts\image-list.json

Opcional para inyectar automáticamente los nombres de archivos descargados en `products.json` (mapea por `id`):

    .\scripts\download-images.ps1 -SourceFile .\scripts\image-list.json -InjectToProductsJson -ProductsJsonPath .\products.json

3) Verifica `assets/images` y actualiza referencias en `products.json` si quieres otra estructura.

Notas:
- Si Dropi provee CSV o una API, puedes exportar la lista con columnas `id,url,fileName` y usarla.
- Si necesitas que el script consulte directamente la API de Dropi, dame la documentación o un ejemplo de la URL y lo adapto.
