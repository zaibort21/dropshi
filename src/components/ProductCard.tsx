import Link from "next/link";
import Image from "next/image";

export interface ProductCardProps {
  id: string;
  sku: string;
  slug: string;
  title: string;
  price: number;
  stock: number;
  shortDescription: string;
  descriptionHtml: string;
  images: string[];
  tags?: string[];
}

export default function ProductCard({ slug, title, price, images }: ProductCardProps) {
  const imageUrl = images && images.length > 0 ? images[0] : "/placeholders/product-placeholder.jpg";
  return (
    <div className="rounded-2xl shadow-md hover:shadow-lg p-4 flex flex-col">
      <Link href={`/products/${slug}`}>
        <a className="block">
          <div className="w-full relative aspect-square mb-3">
            <Image src={imageUrl} alt={title} layout="fill" objectFit="cover" className="rounded-xl" />
          </div>
          <h3 className="text-lg font-semibold mb-1">{title}</h3>
          <p className="text-gray-700 font-medium">${price.toFixed(2)}</p>
        </a>
      </Link>
      <Link href={`/products/${slug}`}>
        <a className="mt-4 inline-block bg-blue-600 text-white text-center px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
          Ver producto
        </a>
      </Link>
    </div>
  );
}
