import { URLSearchParams } from "node:url";
import { base64url, CompactSign, compactVerify } from "jose";

/**
 * Precompute the search params to a consistent encrypted base64url encoded string
 * This is used in the middleware.ts to rewrite search params into a path param that allows
 * you to statically render/cache pages with search params.
 * 
 * The search params are encrypted with a secret key that is stored in the environment variables.
 *
 * The secret key is used to decrypt the search params in the middleware.ts to rewrite the search params into a path param.
 *
 * The path param is then used to render/cache the page with the search params.
 *
 * @example
 * ```ts
 * // middleware.ts
 * export async function middleware(req: NextRequest) {
 *  const code = precomputeSearchParams(req.nextUrl.searchParams, (params) => params); 
 * 
 *  const nextUrl = new URL(
 *    `/${code}${request.nextUrl.pathname}`,
 *    request.url,
 *  );
 * 
 * return NextResponse.rewrite(nextUrl, { request });
 * }
 *
 * 
 * ```
 * @param searchParams - The search params to precompute
 * @param parseFunction - The function to parse the search params
 * @returns The precomputed search params
 */
export function precomputeSearchParams(
	searchParams: URLSearchParams,
	parseFunction: (params: URLSearchParams) => URLSearchParams,
) {
	const params = parseFunction(searchParams);
	const encodedParams = serialize(params);
	return encodedParams;
}

/**
 * Serialize the search params to a consistent encrypted base64url encoded string
 * @param searchParams - The search params to serialize
 * @param secret - The secret to use for the signature
 * @returns The serialized search params
 */
function serialize(
	searchParams: URLSearchParams,
	secret: string | undefined = process.env.SEARCHPARAMS_SECRET,
) {
	if (!secret) {
		throw new Error(
			"next-static-searchparams: Can not serialize due to missing secret",
		);
	}

	// Sort search params to be deterministic
	const sortedParams = new URLSearchParams(searchParams);
	sortedParams.sort();

	// Create stringified json of
	const stringifiedParams = JSON.stringify(Object.fromEntries(sortedParams));

	// Encode the search params
	const encodedParams = base64url.encode(stringifiedParams);

	return new CompactSign(new TextEncoder().encode(secret))
		.setProtectedHeader({ alg: "HS256" })
		.sign(new TextEncoder().encode(encodedParams));
}

/**
 * Decrypt the search params from the code and return a URLSearchParams object
 * 
 * @example
 * ```ts
 * // app/[code]/page.tsx
 * export async function Page({ params }: { params: { code: string } }) {
 *  const searchParams = await decrypt(params.code);
 * 
 *  return <div>{searchParams.get("foo")}</div>;
 * }
 * ```
 * @param code - The code to decrypt
 * @returns The decrypted search params
 */
export async function decrypt(code: string, secret: string | undefined = process.env.SEARCHPARAMS_SECRET) {
    if (!secret) {
        throw new Error("next-static-searchparams: Can not decrypt due to missing secret");
    }

    const decoded = await compactVerify(code, base64url.decode(secret));

    return new URLSearchParams(JSON.parse(new TextDecoder().decode(decoded.payload)));
}