import { IsNull } from 'typeorm';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

describe('Category branch scope', () => {
  const req = { user: { userId: 'user', branchId: 'branch-a' } };

  it('creates in the authenticated branch even if another branch is supplied', async () => {
    const service = { create: jest.fn() };
    const controller = new CategoryController(service as any);
    await controller.create(req, { name: 'Đồ uống', branchId: 'branch-b' });
    expect(service.create).toHaveBeenCalledWith(
      { name: 'Đồ uống', branchId: 'branch-a' },
      req.user,
    );
  });

  it('keeps branchless users in the shared catalog on creation', async () => {
    const service = { create: jest.fn() };
    await new CategoryController(service as any).create(
      { user: { userId: 'user' } },
      { name: 'Chung', branchId: 'branch-b' },
    );
    expect(service.create.mock.calls[0][0].branchId).toBeNull();
  });

  it('does not update or delete a category outside the authenticated branch', async () => {
    const service = {
      findOneInBranch: jest.fn().mockRejectedValue(new Error('outside branch')),
      update: jest.fn(),
      delete: jest.fn(),
    };
    const controller = new CategoryController(service as any);
    await expect(
      controller.update(req, 'id', { name: 'Mới' }),
    ).rejects.toThrow();
    await expect(controller.delete(req, 'id')).rejects.toThrow();
    expect(service.findOneInBranch).toHaveBeenCalledWith('id', 'branch-a');
    expect(service.update).not.toHaveBeenCalled();
    expect(service.delete).not.toHaveBeenCalled();
  });

  it('preserves branch ownership and records the signed-in user on update', async () => {
    const service = {
      findOneInBranch: jest.fn().mockResolvedValue({ id: 'id' }),
      update: jest.fn(),
    };
    await new CategoryController(service as any).update(req, 'id', {
      name: 'Mới',
      branchId: 'branch-b',
    });
    expect(service.update).toHaveBeenCalledWith(
      'id',
      { name: 'Mới', branchId: 'branch-a' },
      req.user,
    );
  });

  it('rejects a missing category in the requested branch', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue(null) };
    await expect(
      new CategoryService(repo as any).findOneInBranch('id', 'branch-a'),
    ).rejects.toMatchObject({ status: 404 });
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 'id', branchId: 'branch-a' },
    });
  });

  it('queries the shared scope explicitly when there is no branch', async () => {
    const repo = { findOne: jest.fn().mockResolvedValue({ id: 'id' }) };
    await new CategoryService(repo as any).findOneInBranch('id');
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 'id', branchId: IsNull() },
    });
  });

  it('returns a recoverable client error when products still reference the category', async () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue({ id: 'id' }),
      remove: jest.fn().mockRejectedValue({ driverError: { code: '23503' } }),
    };
    await expect(
      new CategoryService(repo as any).delete('id', req.user as any),
    ).rejects.toMatchObject({ status: 400 });
  });
});
