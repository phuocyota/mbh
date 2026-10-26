import { isUUID } from 'class-validator';
import { EntityManager, In } from 'typeorm';
import { KitchenOperation, KitchenRecipe, User } from '../../entities';
import { localDate } from '../stock/stock-movement.service';

/** Call within the write transaction, after acquiring the branch kitchen lock. */
export async function ensureKitchenRecipeRequest(manager: EntityManager, input: {
  branchId: string;
  productId: string;
  productName: string;
  requestedBy?: string | null;
  source: 'PRODUCT' | 'MEAL_PLAN' | 'PRODUCTION';
  productionDate?: string;
  batchIds?: string[];
}) {
  const { branchId, productId } = input;
  const recipes = manager.getRepository(KitchenRecipe);
  const active = await recipes.find({ where: { branchId, productId, status: 'ACTIVE' }, relations: ['items'] });
  if (active.some((recipe) => recipe.items.length > 0)) return false;
  const recipe = await recipes.findOne({ where: { branchId, productId }, order: { version: 'DESC' } });
  const status = recipe?.status === 'PENDING_REVIEW' ? 'SUBMITTED'
    : recipe?.status === 'REVISION_REQUESTED' ? 'REVISION_REQUESTED'
    : recipe?.status === 'DRAFT' ? 'DRAFTED' : 'OPEN';
  const repo = manager.getRepository(KitchenOperation);
  const previous = await repo.findOne({
    where: { branchId, kind: 'recipe-request', parentId: productId,
      status: In(['OPEN', 'DRAFTED', 'REVISION_REQUESTED', 'SUBMITTED']) },
    order: { createdAt: 'DESC' },
  });
  const requester = isUUID(input.requestedBy || '')
    ? await manager.getRepository(User).findOneBy({ id: input.requestedBy! }) : null;
  const chefs = await manager.query(`SELECT u.id FROM users u
    JOIN employees e ON e.user_id=u.id AND e.branch_id=u.branch_id
    WHERE u.branch_id=$1 AND u.role='HEAD_CHEF' AND u.status='ACTIVE' AND e.status='working'`, [branchId]);
  const row = previous || repo.create({ branchId, kind: 'recipe-request', parentId: productId,
    date: localDate(), shift: '', requestId: null, createdBy: requester?.id || 'system' });
  const payload = { ...row.payload,
    automatic: previous ? Boolean(previous.payload.automatic) : true,
    source: previous?.payload.source || input.source,
    productSetupRequired: Boolean(previous?.payload.productSetupRequired) || input.source !== 'PRODUCTION',
    productName: input.productName,
    note: previous?.payload.note || (input.source === 'PRODUCTION'
      ? `Mẻ chế biến món ${input.productName} đang chờ công thức và định lượng được phê duyệt.`
      : `Món bán trú ${input.productName} cần công thức và định lượng. Bếp trưởng thiết lập và gửi Admin/Quản lý phê duyệt.`),
    requestedByName: previous?.payload.requestedByName || requester?.fullName || 'Quản trị',
    recipientRole: 'HEAD_CHEF', recipientIds: [...new Set(chefs.map((chef) => chef.id))].sort(),
    recipeId: status === 'OPEN' ? null : recipe!.id,
    revisionReason: recipe?.approval?.reason || null,
    ...(input.source === 'PRODUCTION' ? {
      productionDate: input.productionDate, batchCount: input.batchIds?.length || 0,
      batchIds: input.batchIds?.slice(0, 50) || [],
    } : {}),
    ...(status === 'SUBMITTED' && previous?.status !== 'SUBMITTED'
      ? { submittedAt: recipe?.approval?.submittedAt || new Date().toISOString(), requesterReadAt: null } : {}),
  };
  if (previous && previous.status === status && JSON.stringify(previous.payload) === JSON.stringify(payload)) return false;
  row.status = status;
  row.payload = payload;
  row.updatedBy = input.requestedBy || 'system:recipe-check';
  await repo.save(row);
  return true;
}
