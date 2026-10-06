# Kitchen Backend API Handoff

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
