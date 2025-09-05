"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

export interface ProductGalleryProps {
  /**
   * An array of image URLs associated with the product. If the array is empty
   * a placeholder will be shown instead.
   */
  images: string[];
  /**
   * Optional placeholder image to use when no product images are provided.
   */
  placeholder?: string;
}

/**
 * ProductGallery renders a simple image gallery with thumbnail navigation. It
 * supports keyboard navigation (left/right arrows) for accessibility and
 * wraps around when reaching the end. Thumbnails are rendered horizontally
 * below the primary image and can be scrolled on smaller screens.
 */
export default function ProductGallery({ images, placeholder = "/product-placeholder.jpg" }: ProductGalleryProps) {
  // If no images exist, fall back to an array containing the placeholder. This
  // simplifies the logic for selecting the active image.
  const imageList = images && images.length > 0 ? images : [placeholder];
  const [current, setCurrent] = useState(0);

  const next = () => setCurrent((prev) => (prev + 1) % imageList.length);
  const prev = () => setCurrent((prev) => (prev - 1 + imageList.length) % imageList.length);

  // Attach keyboard listeners for arrow navigation.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        next();
      } else if (event.key === "ArrowLeft") {
        prev();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [imageList.length]);

  return (
    <div className="w-full">
      {/* Main image container */}
      <div className="relative w-full aspect-square mb-4">
        <Image
          src={imageList[current]}
          alt={`Imagen ${current + 1} de ${imageList.length}`}
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          className="rounded-lg object-contain"
        />
      </div>
      {/* Thumbnail navigation */}
      <div className="flex space-x-2 overflow-x-auto" aria-label="Miniaturas de producto">
        {imageList.map((url, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setCurrent(index)}
            className={`relative w-20 h-20 flex-shrink-0 border-2 ${
              current === index ? "border-blue-600" : "border-transparent"
            } rounded-md focus:outline-none`}
            aria-label={`Seleccionar imagen ${index + 1}`}
            aria-selected={current === index}
          >
            <Image src={url} alt={`Miniatura ${index + 1}`} fill sizes="80px" className="rounded object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
