# next-static-searchparams

Keep your Next.js pages static even when using URL search parameters by encrypting them into path parameters.

## The Problem

URL search parameters make pages dynamic in Next.js, preventing static generation and caching.

## The Solution

This library encrypts your search parameters into a short, deterministic string that can be used as a path parameter. This allows you to:

- ✅ Keep pages statically generated
- ✅ Enable proper caching with ISR
- ✅ Handle unlimited search parameter combinations
- ✅ Maintain SEO-friendly URLs
- ✅ Preserve search parameter functionality

## Installation

```bash
npm install next-static-searchparams
# or
pnpm add next-static-searchparams
# or
yarn add next-static-searchparams
```

## Setup

### 1. Environment Variable

Create a secret key for encrypting search parameters:

```bash
# Generate a random 32-byte secret
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Add it to your environment:

```bash
# .env.local
SEARCHPARAMS_SECRET=your_generated_secret_here
```

### 2. Middleware Setup

Create or update your `middleware.ts` file:

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { encode } from 'next-static-searchparams';

export const config = { 
  matcher: [
    // Add paths where you want to encode search params
    '/',
    '/products',
    '/search',
  ] 
};

export async function middleware(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Encode search params into an encrypted code
  const code = await encode(
    searchParams,
    (params) => params // You can filter/transform params here
  );

  // Rewrite to a static path with the encrypted code
  const nextUrl = new URL(
    `/${code}${request.nextUrl.pathname}${request.nextUrl.hash}`,
    request.url,
  );

  return NextResponse.rewrite(nextUrl);
}
```

### 3. Page Structure

Update your file structure to handle the encrypted codes:

```
app/
├── [code]/
│   ├── page.tsx          # Home page with search params
│   ├── products/
│   │   └── page.tsx      # Products page with search params
│   └── search/
│       └── page.tsx      # Search page with search params
├── page.tsx              # Home page without search params
├── products/
│   └── page.tsx          # Products page without search params
└── search/
    └── page.tsx          # Search page without search params
```

### 4. Access Search Parameters in Pages

Use the `decrypt` function to access the original search parameters:

```tsx
// app/[code]/search/page.tsx
import { decrypt } from 'next-static-searchparams';

type Params = Promise<{ code: string }>;

export default async function SearchPage({ params }: { params: Params }) {
  const { code } = await params;
  
  // Decrypt the search parameters
  const searchParams = await decrypt(code);
  
  // Use the search parameters
  const query = searchParams.get('q') || '';
  const category = searchParams.get('category') || 'all';
  const page = parseInt(searchParams.get('page') || '1');

  return (
    <div>
      <h1>Search Results</h1>
      <p>Query: {query}</p>
      <p>Category: {category}</p>
      <p>Page: {page}</p>
      {/* Your search results component */}
    </div>
  );
}
```

## API Reference

### `encode(searchParams, parseFunction)`

Encrypts search parameters into a deterministic string.

**Parameters:**
- `searchParams` (`URLSearchParams`) - The search parameters to encrypt
- `parseFunction` (`(params: URLSearchParams) => URLSearchParams`) - Function to filter/transform parameters

**Returns:** `Promise<string>` - Encrypted code representing the search parameters

**Example:**
```ts
const code = await encode(
  new URLSearchParams('?q=hello&page=2'),
  (params) => {
    // Only include specific parameters
    const filtered = new URLSearchParams();
    if (params.has('q')) filtered.set('q', params.get('q')!);
    if (params.has('page')) filtered.set('page', params.get('page')!);
    return filtered;
  }
);
```

### `decrypt(code, secret?)`

Decrypts an encrypted code back to the original search parameters.

**Parameters:**
- `code` (`string`) - The encrypted code to decrypt
- `secret` (`string`, optional) - Custom secret key (defaults to `process.env.SEARCHPARAMS_SECRET`)

**Returns:** `Promise<URLSearchParams>` - The original search parameters

**Example:**
```ts
const searchParams = await decrypt('eyJhbGciOiJIUzI1NiJ9...');
const query = searchParams.get('q'); // 'hello'
const page = searchParams.get('page'); // '2'
```

## Advanced Usage

### Filtering Search Parameters

You can filter or transform search parameters before encryption:

```ts
// middleware.ts
const code = await encode(
  searchParams,
  (params) => {
    const filtered = new URLSearchParams();
    
    // Only include allowed parameters
    const allowedParams = ['q', 'category', 'page', 'sort'];
    allowedParams.forEach(key => {
      if (params.has(key)) {
        filtered.set(key, params.get(key)!);
      }
    });
    
    // Set defaults
    if (!filtered.has('page')) {
      filtered.set('page', '1');
    }
    
    return filtered;
  }
);
```

### Enabling ISR (Incremental Static Regeneration)

Enable ISR to cache generated pages:

```tsx
// app/[code]/layout.tsx
export async function generateStaticParams() {
  // Return empty array to enable ISR for all combinations
  return [];
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
```

### Multiple Pages with Different Parameters

You can handle different search parameters for different pages by structuring your routes accordingly:

```
app/
├── [code]/
│   ├── products/
│   │   ├── page.tsx              # Products listing: ?category=electronics&sort=price&page=1
│   │   └── [productCode]/
│   │       └── page.tsx          # Individual product: ?variant=red&size=large&quantity=2
│   └── search/
│       └── page.tsx              # Search results: ?q=laptop&filter=brand&page=1
├── products/
│   ├── page.tsx                  # Products without params
│   └── [slug]/
│       └── page.tsx              # Individual product without params
└── search/
    └── page.tsx                  # Search without params
```

Configure middleware to handle different parameter patterns:

```ts
// middleware.ts
export const config = { 
  matcher: ['/products', '/products/:slug*', '/search'] 
};

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  
  if (searchParams.size === 0) {
    return NextResponse.next();
  }

  let code: string;
  
  if (pathname === '/products') {
    // Products listing parameters: category, sort, page, filters
    code = await encode(searchParams, (params) => {
      const filtered = new URLSearchParams();
      ['category', 'sort', 'page', 'brand', 'price_min', 'price_max'].forEach(key => {
        if (params.has(key)) filtered.set(key, params.get(key)!);
      });
      return filtered;
    });
  } else if (pathname.startsWith('/products/')) {
    // Individual product parameters: variant, size, color, quantity
    code = await encode(searchParams, (params) => {
      const filtered = new URLSearchParams();
      ['variant', 'size', 'color', 'quantity'].forEach(key => {
        if (params.has(key)) filtered.set(key, params.get(key)!);
      });
      return filtered;
    });
    // Create separate code for product-specific params
    const slug = pathname.split('/products/')[1];
    const nextUrl = new URL(`/${code}/products/${slug}`, request.url);
    return NextResponse.rewrite(nextUrl);
  } else if (pathname === '/search') {
    // Search parameters: query, filters, pagination
    code = await encode(searchParams, (params) => {
      const filtered = new URLSearchParams();
      ['q', 'category', 'sort', 'page', 'brand'].forEach(key => {
        if (params.has(key)) filtered.set(key, params.get(key)!);
      });
      return filtered;
    });
  }

  const nextUrl = new URL(`/${code}${pathname}`, request.url);
  return NextResponse.rewrite(nextUrl);
}
```

Then in your pages, decrypt the appropriate parameters:

```tsx
// app/[code]/products/page.tsx - Products listing
export default async function ProductsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const searchParams = await decrypt(code);
  
  const category = searchParams.get('category') || 'all';
  const sort = searchParams.get('sort') || 'name';
  const page = parseInt(searchParams.get('page') || '1');
  const brand = searchParams.get('brand');
  
  return (
    <div>
      <h1>Products - {category}</h1>
      <p>Sorted by: {sort}, Page: {page}</p>
      {brand && <p>Brand: {brand}</p>}
      {/* Product listing component */}
    </div>
  );
}
```

```tsx
// app/[code]/products/[productCode]/page.tsx - Individual product
export default async function ProductPage({ 
  params 
}: { 
  params: Promise<{ code: string; productCode: string }> 
}) {
  const { code, productCode } = await params;
  const searchParams = await decrypt(code);
  
  const variant = searchParams.get('variant') || 'default';
  const size = searchParams.get('size') || 'medium';
  const quantity = parseInt(searchParams.get('quantity') || '1');
  
  return (
    <div>
      <h1>Product: {productCode}</h1>
      <p>Variant: {variant}</p>
      <p>Size: {size}</p>
      <p>Quantity: {quantity}</p>
      {/* Product details component */}
    </div>
  );
}
```

### Client-Side Navigation

When navigating client-side, continue using regular search parameters:

```tsx
'use client';

import { useRouter } from 'next/navigation';

export function SearchForm() {
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get('q') as string;
    
    // Navigate with search parameters - middleware will handle encryption
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="q" placeholder="Search..." />
      <button type="submit">Search</button>
    </form>
  );
}
```

## How It Works

1. **Request**: User visits `/search?q=hello&page=2`
2. **Middleware**: Encrypts search params into code like `eyJhbGciOiJIUzI1NiJ9...`
3. **Rewrite**: Request becomes `/eyJhbGciOiJIUzI1NiJ9.../search`
4. **Static Page**: Next.js treats this as a static page that can be cached
5. **Decrypt**: Page component decrypts the code to access original search params

## Comparison with Feature Flags

This library is inspired by the [precompute pattern](https://flags-sdk.dev/frameworks/next/precompute) used in feature flag systems, but adapted for search parameters using an encode/decode pattern:

| Feature Flags | Search Parameters |
|---------------|-------------------|
| Limited set of boolean/enum values | Unlimited string combinations |
| Controlled by developers | Controlled by users |
| Predictable permutations | Unpredictable combinations |
| Build-time generation possible | Runtime encryption required |

## Security

- Search parameters are signed using HMAC-SHA256 to prevent tampering
- The secret key should be kept secure and rotated periodically
- Encrypted codes are deterministic for the same parameters (enabling caching)
- No sensitive data should be included in search parameters

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
