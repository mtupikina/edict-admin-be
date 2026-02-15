import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissionsGuard } from '../auth/guards/require-permissions.guard';
import { PermissionsController, RolesController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

describe('PermissionsController', () => {
  let controller: PermissionsController;

  const mockPermissionsService = {
    findAllPermissions: jest.fn().mockResolvedValue([]),
    createPermission: jest.fn().mockResolvedValue({ _id: 'p1', name: 'p' }),
    findOnePermission: jest.fn().mockResolvedValue({ _id: 'p1', name: 'p' }),
    updatePermission: jest.fn().mockResolvedValue({ _id: 'p1', name: 'p' }),
    removePermission: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PermissionsController],
      providers: [{ provide: PermissionsService, useValue: mockPermissionsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RequirePermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PermissionsController>(PermissionsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAllPermissions should return service result', async () => {
    const list = [{ _id: '1', name: 'a' }];
    mockPermissionsService.findAllPermissions.mockResolvedValue(list);
    const result = await controller.findAllPermissions();
    expect(mockPermissionsService.findAllPermissions).toHaveBeenCalled();
    expect(result).toEqual(list);
  });

  it('createPermission should call service', async () => {
    const dto = { name: 'words:read', description: 'Read' };
    const created = { _id: 'id', ...dto };
    mockPermissionsService.createPermission.mockResolvedValue(created);
    const result = await controller.createPermission(dto);
    expect(mockPermissionsService.createPermission).toHaveBeenCalledWith(dto);
    expect(result).toEqual(created);
  });

  it('findOnePermission should call service with id', async () => {
    const perm = { _id: 'id', name: 'x' };
    mockPermissionsService.findOnePermission.mockResolvedValue(perm);
    const result = await controller.findOnePermission('id');
    expect(mockPermissionsService.findOnePermission).toHaveBeenCalledWith('id');
    expect(result).toEqual(perm);
  });

  it('updatePermission should call service', async () => {
    const dto = { name: 'updated' };
    const updated = { _id: 'id', ...dto };
    mockPermissionsService.updatePermission.mockResolvedValue(updated);
    const result = await controller.updatePermission('id', dto);
    expect(mockPermissionsService.updatePermission).toHaveBeenCalledWith('id', dto);
    expect(result).toEqual(updated);
  });

  it('removePermission should call service', async () => {
    await controller.removePermission('id');
    expect(mockPermissionsService.removePermission).toHaveBeenCalledWith('id');
  });
});

describe('RolesController', () => {
  let controller: RolesController;

  const mockPermissionsService = {
    findAllRoles: jest.fn().mockResolvedValue([]),
    createRole: jest.fn().mockResolvedValue({ _id: 'r1', name: 'admin' }),
    findOneRole: jest.fn().mockResolvedValue({ _id: 'r1', name: 'admin' }),
    updateRole: jest.fn().mockResolvedValue({ _id: 'r1', name: 'admin' }),
    removeRole: jest.fn().mockResolvedValue(undefined),
    getRolePermissions: jest.fn().mockResolvedValue([]),
    setRolePermissions: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [{ provide: PermissionsService, useValue: mockPermissionsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RequirePermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RolesController>(RolesController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAllRoles should return service result', async () => {
    const list = [{ _id: '1', name: 'admin' }];
    mockPermissionsService.findAllRoles.mockResolvedValue(list);
    const result = await controller.findAllRoles();
    expect(mockPermissionsService.findAllRoles).toHaveBeenCalled();
    expect(result).toEqual(list);
  });

  it('createRole should call service', async () => {
    const dto = { name: 'editor', description: 'Editor' };
    const created = { _id: 'id', ...dto };
    mockPermissionsService.createRole.mockResolvedValue(created);
    const result = await controller.createRole(dto);
    expect(mockPermissionsService.createRole).toHaveBeenCalledWith(dto);
    expect(result).toEqual(created);
  });

  it('findOneRole should call service with id', async () => {
    const role = { _id: 'id', name: 'admin' };
    mockPermissionsService.findOneRole.mockResolvedValue(role);
    const result = await controller.findOneRole('id');
    expect(mockPermissionsService.findOneRole).toHaveBeenCalledWith('id');
    expect(result).toEqual(role);
  });

  it('updateRole should call service', async () => {
    const dto = { description: 'Updated' };
    const updated = { _id: 'id', name: 'admin', ...dto };
    mockPermissionsService.updateRole.mockResolvedValue(updated);
    const result = await controller.updateRole('id', dto);
    expect(mockPermissionsService.updateRole).toHaveBeenCalledWith('id', dto);
    expect(result).toEqual(updated);
  });

  it('removeRole should call service', async () => {
    await controller.removeRole('id');
    expect(mockPermissionsService.removeRole).toHaveBeenCalledWith('id');
  });

  it('getRolePermissions should call service', async () => {
    const perms = ['p1', 'p2'];
    mockPermissionsService.getRolePermissions.mockResolvedValue(perms);
    const result = await controller.getRolePermissions('id');
    expect(mockPermissionsService.getRolePermissions).toHaveBeenCalledWith('id');
    expect(result).toEqual(perms);
  });

  it('setRolePermissions should call service', async () => {
    const permissionIds = ['pid1', 'pid2'];
    mockPermissionsService.setRolePermissions.mockResolvedValue(permissionIds);
    const result = await controller.setRolePermissions('roleId', {
      permissionIds,
    });
    expect(mockPermissionsService.setRolePermissions).toHaveBeenCalledWith('roleId', permissionIds);
    expect(result).toEqual(permissionIds);
  });
});
