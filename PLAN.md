# Plan: Implement Stock Traceability (Truy xuất nguồn gốc)

## Context

Hệ thống MBH POS hiện tại có:
- **`StockLot`** + **`StockMovement`**: Ghi nhận lô và di chuyển tồn kho
- **`KitchenRecipe`**: Đã có recipe cho kitchen module
- **Thiếu**: Bill of Materials tổng quát, API truy vết, báo cáo traceability

Cần implement đầy đủ 3 loại traceability:
1. **Lot Traceability**: Theo dõi lô từ nhập -> xuất
2. **Source Traceability**: Truy vết về nguồn nhập (supplier)
3. **Ingredient Traceability**: Từ thành phẩm -> nguyên liệu

---

## Implementation Steps

### Phase 1: Database Entities

#### 1.1 Create `ProductRecipe` + `ProductRecipeItem` (Bill of Materials)
**File:** `src/entities/product-recipe.entity.ts`

```typescript
@Entity('product_recipes')
@Unique(['branchId', 'productId', 'version'])
export class ProductRecipe extends LedgerBaseEntity {
  branchId: string;
  productId: string;          // FINISHED_GOOD
  version: number;
  yieldQuantity: number;
  yieldUnitId: string;
  status: 'DRAFT' | 'ACTIVE';
  effectiveFrom: Date | null;
  description: string | null;
  standardCost: number | null;
}

@Entity('product_recipe_items')
@Unique(['recipeId', 'ingredientProductId'])
export class ProductRecipeItem extends LedgerBaseEntity {
  recipeId: string;
  ingredientProductId: string;  // INGREDIENT product
  quantity: number;
  unitId: string;
  wasteFactor: number;
}
```

#### 1.2 Update `entities/index.ts`
Export new entities.

### Phase 2: Migration

**File:** `src/migrations/1764100000000-CreateStockTraceability.ts`

```sql
-- Tables: product_recipes, product_recipe_items
-- Indexes for query performance
-- FK constraints
```

### Phase 3: Stock Trace Service

**File:** `src/modules/stock-trace/stock-trace.service.ts`

Key methods:
| Method | Purpose |
|--------|---------|
| `getLotDetails(lotId)` | Chi tiết lô |
| `getLotMovements(lotId, options)` | Lịch sử di chuyển lô (FIFO) |
| `traceToSupplier(lotId)` | Truy vết về supplier |
| `getProductLots(productId, options)` | Tất cả lô của sản phẩm |
| `getProductRecipe(productId)` | BOM của thành phẩm |
| `traceIngredients(productId, options)` | Nguyên liệu đã dùng |
| `getConsumedLots(productId, finishedLotId)` | Lô nguyên liệu tiêu thụ |

### Phase 4: Stock Trace Controller

**File:** `src/modules/stock-trace/stock-trace.controller.ts`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/stock-trace/lots/:lotId` | GET | Chi tiết lô |
| `/stock-trace/lots/:lotId/movements` | GET | Lịch sử di chuyển |
| `/stock-trace/lots/:lotId/supplier` | GET | Nguồn gốc supplier |
| `/stock-trace/products/:productId/lots` | GET | Lô theo sản phẩm |
| `/stock-trace/recipes/:productId` | GET/POST | BOM |
| `/stock-trace/recipes/:productId/ingredients` | GET | Truy vết nguyên liệu |
| `/stock-trace/consumed-lots` | GET | Lô đã tiêu thụ |
| `/stock-trace/reports/traceability` | GET | Báo cáo traceability |
| `/stock-trace/reports/expiring` | GET | Lô sắp hết hạn |

### Phase 5: Module Registration

**File:** `src/modules/stock-trace/stock-trace.module.ts`

**File:** `src/app.module.ts` - Import StockTraceModule

---

## Module Structure

```
src/modules/stock-trace/
├── stock-trace.module.ts
├── stock-trace.controller.ts
├── stock-trace.service.ts
└── dto/
    ├── create-product-recipe.dto.ts
    └── trace-responses.dto.ts
```

---

## Key Files to Modify

| File | Change |
|------|--------|
| `src/entities/index.ts` | Export ProductRecipe, ProductRecipeItem |
| `src/app.module.ts` | Add StockTraceModule |
| `src/modules/stock-trace/` | New module files |

---

## Verification

1. **Migration:** `npm run migration:run`
2. **Build:** `npm run build`
3. **Test endpoints:**
   - GET `/stock-trace/lots/:id` - lot details
   - GET `/stock-trace/products/:id/lots` - product lots
   - POST `/stock-trace/recipes` - create BOM
   - GET `/stock-trace/recipes/:id/ingredients` - ingredient trace
4. **Unit tests:** Create `stock-trace.service.spec.ts`

---

## Dependencies

- Reuses existing: `StockLot`, `StockMovement`, `StockReceiptDetail`, `KitchenRecipe`
- New tables: `product_recipes`, `product_recipe_items`
