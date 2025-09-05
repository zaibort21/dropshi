import fs from 'fs';
import path from 'path';
import ProductCard from '@/components/ProductCard';
import React from 'react';

interface Product {
  id: string;
  sku: string;
  slug: string;
  title: string;
  price: number;
  stock: number;
  shortDescription: string;
  descriptionHtml: string;
    images: string[];
  tags: string[];

async function getProducts(): Promise<Product[]> {
  const filePath = path.join(process.cwd(), 'data', 'products.json');
  const data = await fs.promises.readFile(filePath, 'utf-8');
  return JSON.parse(data) as Product[];
}

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Productos</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            slug={product.slug}
            title={product.title}
            price={product.price}
            images={product.images}
          />
        ))}
      </div>
    </div>
  );
}
