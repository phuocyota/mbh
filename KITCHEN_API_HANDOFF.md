# Kitchen Backend API Handoff

## Portal integration extension (2026-10-08)

FE `../MBH_Kichen` now calls this backend. Preserve the paid-only ticket invariant, no cancellation after sending to kitchen, and separate POS stock from the finished-food ledger described below. The REST envelope remains unchanged; errors preserve HTTP status, business code and `shortages`.

### Product and material stock contracts

- Product `productType`: nullable legacy value or `INGREDIENT`, `FUEL`, `FINISHED_GOOD`, `MERCHANDISE`. Product reads and inventory reads support this filter. `categoryId` and `isCanteenItem` retain their separate meanings. Dish metadata: `requiresSample`, `cookDuration`, `recommendedUseMinutes`.
- `baseUnitId` references existing measurement units. Import lines accept `unitId`, `lotCode`, `manufacturedAt`, `expiresAt`. Backend normalizes quantities to the base unit only within the same dimension; money uses the original input quantity/unit price. Receipt lines expose `inputDetails` with original unit, quantity, unit price and lot allocations; historical lines have null metadata.
- `GET /stock-lots?branchId=&productId=&productType=&status=AVAILABLE|EXPIRED&page=&size=` returns server pagination. Ingredient expiry is mandatory after enabling tracking; fuel expiry is optional. Expiry dates use Asia/Bangkok local dates, inclusive on the expiry day. Physical stock includes expired lots; inventory also returns usable and expired quantities.
- Export lines and consumption actual lines require explicit `allocations: [{lotId, quantity}]` in the stock unit. The sum must match, even for one lot. Expired lots can only be exported for disposal with `purpose: DISPOSAL` and a reason in `note`.
- `GET /stock-lots/opening-preview?branchId=` previews untracked material balances; add `productId` for all warehouse allocations the actor can review. `POST /stock-lots/opening` accepts `{branchId, productId, requestId?, note?, stockAllocations:[{stockId,lots:[{lotCode,quantity,manufacturedAt?,expiresAt?}]}]}`; single-warehouse clients may continue sending `lots`. Every nonzero warehouse balance must be allocated in the same transaction, preserving each balance. Missing warehouses return `OTHER_WAREHOUSE_OPENING_REQUIRED`. ADMIN can review and allocate across branches; MANAGER can only allocate its own branch and the preview flags when ADMIN is required. No dates or expiry are invented. Stable request IDs replay the activation result once.
- Tracking is never enabled by a product PUT. Tracked total-stock PUT is rejected; count all lots through `/stock-takes/drafts` with `lotCounts:[{lotId, actualQuantity}]`, then complete. Transfers accept allocations and complete immediately, preserving lot metadata. Old untracked contracts remain available.
- Transfers retain the original product ID. Destination branches can read and use products recorded in their warehouse; ordinary managers edit product configuration only in the owning branch. Opening allocations must cover every warehouse before activating product-wide lot tracking.
- JWT branch checks and manager permissions protect warehouse writes. Movements, lots, total stock, receipt lines, financial vouchers and supplier balances use the same transaction manager. Product/stock advisory and row locks prevent negative balances and conflicting unit changes. Send stable UUID `requestId` for voucher retries; reused IDs with different payloads return 409.
- `GET /stock-vouchers` additionally accepts `productType` and `receiptType: IMPORT|EXPORT|TRANSFER`, filtering on BE before pagination. The portal exposes read-only material vouchers to kitchen staff and manager count/transfer actions.

### New kitchen documents

Resources are persisted in the versioned `kitchen_operations` document ledger; authoritative inventory changes and audit history are transactional. Common response fields: `id, branchId, kind, date, shift, status, parentId, requestId, version, payload`. Clients map `payload` to their display model. Common list filters: `date/from/to/shift/status/productId/page/size`; create accepts `branchId, date, shift, requestId`; draft PUT requires `expectedVersion`.

| Resource | Payload and actions |
| --- | --- |
| `/kitchen/menus` | `title, mealPeriod, productIds, note`; `POST /:id/copy` with target date/shift/requestId; `POST /:id/lock` |
| `/kitchen/manual-plans` | `mealPeriod, items:[{id?, productId, expectedQuantity, stationId, shift, assignedTo?, serviceArea, plannedStartAt, deadline, note?}]`; copy; `POST /:id/confirm` with `lineId`. One manual source batch per confirmed line; never replaces boarding batches. |
| `/kitchen/finished-imports` | `batchId, quantity, receiverArea, importedAt?, note`; draft PUT; `POST /:id/confirm`. Source batch must be completed, cumulative confirmed import ≤ actual portions. |
| `/kitchen/finished-exports` | `lotId, quantity, receiverPlace, deliveredBy?, receivedBy, note`; immediate transactional export; `POST /:id/returns` with `quantity, reason, requestId`. Partial returns enter quarantine. |
| `/kitchen/finished-inventory` | Read physical available pool and quarantine pool per lot; `POST /:id/adjustments` with signed quantity/reason/requestId, or `/release` with positive quantity/reason/requestId (manager only, still must be unexpired). |
| `/kitchen/disposals` | `lotId, quantity, pool: AVAILABLE|QUARANTINED, reason, imageUrl?`; pending request; manager `POST /:id/confirm` subtracts the chosen pool. |
| `/kitchen/samples` | `batchId, quantity, unit: g|ml, storageLocation, sampledAt?, storageStartedAt?, expectedEndAt?, imageUrl?`; PUT while stored; `POST /:id/process` with reason. Default storage duration 24 hours is configurable business behavior, not a legal claim. |
| `/kitchen/shift-closings` | One date/shift record; employee `/confirm`, manager `/approve`, `/reopen` with reason. Approval stores immutable report snapshots in audit/revision history. |
| `/kitchen/dashboard`, `/history`, `/reports/meal-flow` | Server aggregation and paginated history; report requires manager. Remaining physical stock, expired stock and quarantine are separate fields. |

Timestamps accept ISO values with timezone. The shift/date for imports, exports, samples and disposals is derived from the source production record, so an input date cannot bypass the shift lock. Confirmed shifts already block writes; approval locks and snapshots. Processing a stored sample after closure records a new audit event. Images are uploaded separately via `/upload/images`; store only URLs.

Batch `mealItemId` is nullable for manual source. `source` defaults BOARDING for existing rows; `manualLineId` is unique. `PUT /kitchen/batches/:id` edits actual quantity and detail metadata with `expectedVersion`; existing start/ready/complete endpoints also require expectedVersion. Production can start only on its Asia/Bangkok production date. Manual lines may specify their own shift; writes and confirmation check those shift locks. Completion requires measured actual quantity and a valid sample when configured. Actual quantity cannot fall below confirmed imports. Serving expiry is captured at READY from the ready timestamp plus product serving duration; later imports or configuration changes cannot extend it. Legacy ready batches without the captured expiry use the original timestamp fallback. Finished stock does not change legacy POS stock or auto-link POS orders.

### Safe rollout and proof boundary

1. Back up and review database/schema state, then deploy additive migration `1764000000000-KitchenPortalAndStockLots.ts` after the kitchen base migration. Existing product types stay null and tracking stays false. Quantities widen to four decimals; historical values are not rescaled.
2. Explicitly set `DB_SYNCHRONIZE=false` and `DB_MIGRATIONS_RUN=false` until the reviewed migration window. Both runtime config and CLI data source honor these flags; omitted flags preserve the previous source defaults. Run reviewed migrations with `node node_modules/typeorm/cli.js migration:run -d dist/data-source.js` after BE build. Do not start BE against an unreviewed real database assuming it is read-only.
3. Configure kitchen feature flags and FE origin; review units, recipes, employee links, branches and opening lot allocations. Do not convert stored quantity units automatically or import demo state.
4. Unit tests: `npm.cmd test -- --runInBand`. Database integration: configure `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD` and `DB_DATABASE` (or `DB_NAME`) in the backend `.env`, then run `npm.cmd run test:kitchen:integration`. No `TEST_DATABASE_URL` is required. The runner creates one random schema with its own search path, independently of application synchronization/migration flags. It checks migration SQL, rollback, concurrent exports, counted-lot/transfer reconciliation, multi-warehouse opening, import retry, return limits, quarantine and source-date locking, then drops only its own schema. The database account needs CREATE SCHEMA permission; PostgreSQL must support `gen_random_uuid()`.
5. Staging still must prove real authentication, finance failure rollback, count/transfer reconciliation, socket reconnect, uploads, persistence after reload, POS/payment regressions and multiple devices. Build, lint, mock tests and metadata validation do not prove these runtime behaviors. No real migration or deployment was executed during implementation.

The previous backend ticket/recipe contracts below remain applicable.

The kitchen backend is disabled by default. Enable it with:

```env
KITCHEN_MODULE_ENABLED=true
KITCHEN_RECIPE_STOCK_ENABLED=false
KITCHEN_ACTIVATED_AT=2026-09-30T00:00:00+07:00
KITCHEN_FRONTEND_ORIGIN=https://fe-kitchen.example.vn
KITCHEN_TICKET_SLA_MINUTES=15
```

Enable recipe stock only after product base units and active recipes have been reviewed. The activation timestamp prevents the reconciliation job from creating tickets for historical orders.

## Authentication and roles

- `POST /auth/login/kitchen` accepts `{ email, password, deviceId? }` and returns the normal JWT response plus `employeeId`.
- A kitchen user must be active, have role `KITCHEN`, have a branch, and be linked to an active Employee in the same branch.
- `KITCHEN` can read configuration and operate tickets/batches. `ADMIN` and `MANAGER` also configure, adjust, assign, confirm stock consumption, and read reports.
- For `KITCHEN` and `MANAGER`, branch comes only from JWT. `ADMIN` must send `branchId` when its JWT has no branch.

## REST resources

| Area            | Endpoints                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staff           | `PUT /kitchen/staff/:userId/employee-link`                                                                                                                 |
| Units           | `GET /kitchen/units`                                                                                                                                       |
| Stations        | `GET/POST /kitchen/stations`, `PUT/DELETE /kitchen/stations/:id`, `PUT /kitchen/stations/:id/products/:productId`                                          |
| Recipes         | `GET/POST /kitchen/recipes`, `POST /kitchen/recipes/:id/activate`, `DELETE /kitchen/recipes/:id` (draft only)                                              |
| Service periods | `GET/PUT /kitchen/service-periods`                                                                                                                         |
| Order board     | `GET /kitchen/tickets`, `GET /kitchen/tickets/:id`, `POST /kitchen/tickets/:id/start`, `POST /kitchen/tickets/:id/ready`                                   |
| Boarding plans  | `GET/POST /kitchen/meal-plans`, `POST /kitchen/meal-plans/:id/lock`, `POST /kitchen/meal-plans/:id/adjustments`                                            |
| Batches         | `POST /kitchen/batches/:id/start`, `/ready`, `/complete`                                                                                                   |
| Materials       | `GET /kitchen/demand`, `GET/POST /kitchen/consumption-sessions`, `GET /kitchen/consumption-sessions/:id`, `POST /kitchen/consumption-sessions/:id/confirm` |
| Assignments     | `GET/POST /kitchen/assignments`, `PUT/DELETE /kitchen/assignments/:id`                                                                                     |
| Reports         | `GET /kitchen/reports/operations?from=YYYY-MM-DD&to=YYYY-MM-DD&branchId=`                                                                                  |

Ticket and batch mutations require `{ "expectedVersion": 1 }`. A stale version returns HTTP 409. Ticket states are `WAITING -> PREPARING -> READY -> DELIVERED`; batch states are `WAITING -> PREPARING -> READY -> COMPLETED`.

Create a consumption session with `{ branchId?, date, mealPeriod, stationId }`. Confirm it with optional actual values:

```json
{
  "lines": [{ "productId": "ingredient-uuid", "actualQuantity": 1250 }]
}
```

Omitted lines keep their calculated quantity. Confirmation is idempotent, locks stock rows, rejects the entire operation when any ingredient is short, and creates one export voucher with `referenceType=kitchen_consumption_session`.

## Socket.IO

Connect with `auth: { token: '<JWT>' }`. The server derives the branch from the JWT and joins `kitchen:branch:{branchId}`. Clients cannot select another branch.

- `kitchen:ticket.created`
- `kitchen:ticket.updated`
- `kitchen:batch.updated`
- `kitchen:meal-plan.locked`
- `kitchen:consumption.updated`

Ticket events contain the ticket, order snapshot, item snapshots, station, timestamps, status, and version.

## Stable error codes/messages

- `KITCHEN_MODULE_DISABLED`
- `KITCHEN_BRANCH_REQUIRED`
- `CROSS_BRANCH_FORBIDDEN`
- `KITCHEN_USER_EMPLOYEE_BRANCH_MISMATCH`
- `KITCHEN_STAFF_INACTIVE`
- `KITCHEN_TICKET_VERSION_CONFLICT`
- `KITCHEN_BATCH_VERSION_CONFLICT`
- `ORDER_ALREADY_SENT_TO_KITCHEN`
- `ORDER_NOT_READY_FROM_KITCHEN`
- `KITCHEN_STOCK_SHORTAGE` with a `shortages` array
- `EMPLOYEE_NOT_SCHEDULED`
- `INCOMPATIBLE_INGREDIENT_UNIT:<productId>`

Swagger remains available at `/docs` when the service is running.
