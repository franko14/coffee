# API Reference

## Base URL

`http://localhost:{port}/api`

## Response Format

All endpoints return:
```json
{
  "success": true|false,
  "data": ...,
  "error": "message (on failure)",
  "details": [...] // validation errors
}
```

## Rate Limiting

200 requests per minute per IP. Returns `429` with:
```json
{ "success": false, "error": "Too many requests" }
```

## Error Codes

| Status | Meaning |
|--------|---------|
| 400 | Invalid input (validation failure) |
| 404 | Resource not found / API endpoint not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

Unknown `/api/*` paths return `404` with JSON (not HTML).

---

## Endpoints

### Products

#### GET /api/products
List all active products with variants and metadata.

**Query params**: none

**Response**: Array of products with variants, ratings, badges, blog reviews, discount info.

#### GET /api/products/:id
Get single product with full detail.

**Params**: `id` — positive integer

#### GET /api/products/:id/variants
Get variants for a product.

**Params**: `id` — positive integer

---

### Shops

#### GET /api/shops
List all non-blog shops with product counts.

#### PUT /api/shops/:slug/discount
Update shop discount settings.

**Body**:
```json
{
  "discountPercent": 10,
  "discountCode": "SAVE10",
  "enabled": true
}
```

---

### Recommendations

#### GET /api/recommendations
Get scored and ranked product recommendations.

**Query params**:
- `budget` (optional) — max price per 100g
- `limit` (optional, default 20) — max results

---

### Price History

#### GET /api/price-history/product/:productId
Get price history for a product.

**Params**: `productId` — positive integer

#### GET /api/price-history/recent
Get recent price observations.

**Query params**: `limit` (optional, default 100, max 500)

#### GET /api/price-history/compare
Compare price history across products.

**Query params**: `ids` — comma-separated product IDs (e.g., `1,2,3`)

#### GET /api/price-history/scatter
Get price scatter plot data (all products with cheapest variant price per kg).

---

### Alerts

#### GET /api/alerts
List all alerts.

**Query params**: `limit` (optional, default 50)

#### GET /api/alerts/unread
List unread alerts (max 200).

#### GET /api/alerts/count
Get unread alert count.

**Response**: `{ "success": true, "data": { "count": 5 } }`

#### POST /api/alerts/:id/read
Mark alert as read.

**Params**: `id` — positive integer

#### POST /api/alerts/read-all
Mark all alerts as read.

### Alert Types

| Type | Description | Severity |
|------|-------------|----------|
| `price_drop` | Price decreased by configured % | info/high |
| `price_increase` | Price increased by 5%+ | low |
| `new_product` | New product discovered | info |
| `stock_change` | Product went in/out of stock | info/low |
| `discount_code` | New discount code found from blog | info |
| `product_removed` | Product marked inactive | low |
