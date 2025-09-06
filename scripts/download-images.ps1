<#
Script: download-images.ps1
Qué hace: descarga imágenes listadas en un JSON/CSV y las guarda en la carpeta local 'assets/images'.
Uso mínimo:
  - Guardar un archivo `image-list.json` con un array de objetos: { "id": 1, "url": "https://...", "fileName": "producto1.jpg" }
  - Ejecutar en PowerShell: .\download-images.ps1 -SourceFile .\image-list.json

Soporta dos modos de entrada: JSON (array) o CSV con columnas `id,url,fileName`.

Notas:
 - Este script no crea cambios automáticos en `products.json`. Después de descargar las imágenes, actualiza manualmente `products.json` o usa la opción `-InjectToProductsJson` para intentar mapear `fileName` a productos por `id`.
 - Si Dropi tiene una API pública, se puede adaptar para que el script consulte la API.
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$SourceFile,

    [string]$ImagesFolder = "assets/images",

    [switch]$InjectToProductsJson,

    [string]$ProductsJsonPath = "products.json"
)

# Crear carpeta de salida
$absImagesFolder = Join-Path -Path (Get-Location) -ChildPath $ImagesFolder
if (-not (Test-Path $absImagesFolder)) {
    New-Item -ItemType Directory -Path $absImagesFolder | Out-Null
}

function Read-JsonFile($path) {
    $text = Get-Content -Path $path -Raw -ErrorAction Stop
    return ConvertFrom-Json $text
}

# Leer lista
$ext = [System.IO.Path]::GetExtension($SourceFile).ToLower()
if ($ext -eq ".json") {
    $list = Read-JsonFile $SourceFile
} elseif ($ext -eq ".csv") {
    $list = Import-Csv -Path $SourceFile
} else {
    Write-Error "Formato no soportado. Usa .json o .csv"
    exit 1
}

# Descargar cada imagen
foreach ($item in $list) {
    $url = $item.url
    if (-not $url) { Write-Warning "Item sin url: $($item | ConvertTo-Json -Compress)"; continue }

    $fileName = if ($item.fileName) { $item.fileName } else {
        $uri = [System.Uri]$url
        [System.IO.Path]::GetFileName($uri.LocalPath)
    }

    # Reemplazar caracteres inválidos
    $safeName = $fileName -replace '[\\/:*?"<>|]', '-' -replace '\s+', ' '
    $dest = Join-Path -Path $absImagesFolder -ChildPath $safeName

    try {
        Write-Host "Descargando $url -> $dest"
        Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -ErrorAction Stop
    } catch {
        Write-Warning "Fallo descarga: $url -> $($_.Exception.Message)"
    }
}

# Opción: inyectar nombres en products.json (por id)
if ($InjectToProductsJson) {
    if (-not (Test-Path $ProductsJsonPath)) { Write-Error "No existe $ProductsJsonPath"; exit 1 }
    $products = Read-JsonFile $ProductsJsonPath

    foreach ($img in $list) {
        if (-not $img.id) { continue }
        $prod = $products | Where-Object { $_.id -eq [int]$img.id }
        if ($prod) {
            $prod.image = $img.fileName
            if ($img.images) { $prod.images = $img.images }
            Write-Host "Inyectado imagen para producto ID $($img.id): $($img.fileName)"
        }
    }

    # Guardar
    $jsonOut = $products | ConvertTo-Json -Depth 6
    Set-Content -Path $ProductsJsonPath -Value $jsonOut -Encoding UTF8
    Write-Host "Products.json actualizado"
}

Write-Host "Descargas completadas. Imágenes en: $absImagesFolder"
