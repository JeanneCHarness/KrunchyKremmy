UPDATE "Product"
SET "imageUrl" = 'https://images.unsplash.com/photo-1558584724-0e4d32ca55a4?auto=format&fit=crop&w=900&q=82',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'strawberry-sunday';
