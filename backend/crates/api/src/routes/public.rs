// A3, no authentication. Wire GET /public/featured-partners and GET /public/cities, with
// Cache-Control: public, max-age=PUBLIC_CACHE_SECONDS, strict rate limiting and a separate CORS policy
// without credentials. No auth extractor may appear in these signatures. Priority: P2
