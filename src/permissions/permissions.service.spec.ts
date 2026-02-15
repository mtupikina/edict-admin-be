import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PermissionsService } from './permissions.service';
import { Permission } from './schemas/permission.schema';
import { Role } from './schemas/role.schema';
import { RolePermission } from './schemas/role-permission.schema';
import { ROLES } from './constants/permissions.constants';

const mockPermission = {
  _id: new Types.ObjectId(),
  name: 'words:read',
  description: 'Read words',
};

const mockRole = {
  _id: new Types.ObjectId(),
  name: ROLES.ADMIN,
  description: 'Admin',
};

const mockRolePermissionLink = {
  roleId: mockRole._id,
  permissionId: { _id: mockPermission._id, name: mockPermission.name },
};

const chain = (execResult: unknown) => ({
  exec: jest.fn().mockResolvedValue(execResult),
});
const leanChain = (execResult: unknown) => ({
  lean: jest.fn().mockReturnValue(chain(execResult)),
});

/** Query-like that resolves to null when awaited or .lean().exec() - service sometimes awaits findOne() directly. */
function queryLikeNull(): Promise<null> & { lean(): unknown; exec(): Promise<null> } {
  const p = Promise.resolve(null) as Promise<null> & { lean(): unknown; exec(): Promise<null> };
  p.lean = () => p;
  p.exec = () => p;
  return p;
}
/** Query-like that resolves to doc when awaited or .lean().exec(). */
function queryLike<T>(doc: T): Promise<T> & { lean(): unknown; exec(): Promise<T> } {
  const p = Promise.resolve(doc) as Promise<T> & { lean(): unknown; exec(): Promise<T> };
  p.lean = () => p;
  p.exec = () => p;
  return p;
}

describe('PermissionsService', () => {
  let service: PermissionsService;

  const mockPermissionModel = {
    find: jest.fn().mockImplementation(() => ({
      lean: jest.fn().mockReturnValue(chain([])),
      distinct: jest.fn().mockReturnValue(chain([mockPermission.name])),
      sort: jest.fn().mockReturnValue(leanChain([])),
    })),
    findOne: jest.fn().mockImplementation(() => queryLikeNull()),
    findOneAndUpdate: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockImplementation(() => leanChain(mockPermission)),
    findByIdAndUpdate: jest.fn().mockImplementation(() => leanChain(mockPermission)),
    findByIdAndDelete: jest.fn().mockImplementation(() => chain(mockPermission)),
    create: jest.fn().mockResolvedValue({ toObject: () => mockPermission }),
  };

  const mockRoleModel = {
    find: jest.fn().mockReturnValue(leanChain([])),
    findOne: jest.fn().mockImplementation(() => queryLikeNull()),
    findOneAndUpdate: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockImplementation(() => leanChain(mockRole)),
    findByIdAndUpdate: jest.fn().mockImplementation(() => leanChain(mockRole)),
    findByIdAndDelete: jest.fn().mockImplementation(() => chain(mockRole)),
    create: jest.fn().mockResolvedValue({ toObject: () => mockRole }),
  };

  const mockRolePermissionModel = {
    find: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue(leanChain([mockRolePermissionLink])),
    }),
    findOneAndUpdate: jest.fn().mockResolvedValue(undefined),
    deleteMany: jest.fn().mockReturnValue(chain(undefined)),
    create: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    mockPermissionModel.find.mockImplementation(() => ({
      lean: jest.fn().mockReturnValue(chain([])),
      distinct: jest.fn().mockReturnValue(chain([mockPermission.name])),
      sort: jest.fn().mockReturnValue(leanChain([])),
    }));
    mockPermissionModel.findOne.mockReset();
    mockPermissionModel.findOne.mockImplementation(() => queryLikeNull());
    mockRoleModel.find.mockReturnValue(leanChain([]));
    mockRoleModel.findOne.mockReset();
    mockRoleModel.findOne.mockImplementation(() => queryLikeNull());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: getModelToken(Permission.name), useValue: mockPermissionModel },
        { provide: getModelToken(Role.name), useValue: mockRoleModel },
        {
          provide: getModelToken(RolePermission.name),
          useValue: mockRolePermissionModel,
        },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should call seedRolesAndPermissions', async () => {
      await service.onModuleInit();
      expect(mockPermissionModel.findOneAndUpdate).toHaveBeenCalled();
      expect(mockRoleModel.findOneAndUpdate).toHaveBeenCalled();
    });
  });

  describe('getPermissionsForRole', () => {
    it('should return all permission names for SUPER_ADMIN', async () => {
      const result = await service.getPermissionsForRole(ROLES.SUPER_ADMIN);
      expect(mockPermissionModel.find).toHaveBeenCalled();
      expect(result).toEqual([mockPermission.name]);
    });

    it('should return permissions from cache when valid', async () => {
      service.invalidateCache();
      mockRoleModel.findOne.mockImplementationOnce(() => queryLike(mockRole));
      mockRolePermissionModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue(leanChain([mockRolePermissionLink])),
      });
      const first = await service.getPermissionsForRole(ROLES.ADMIN);
      expect(first).toEqual([mockPermission.name]);
      const second = await service.getPermissionsForRole(ROLES.ADMIN);
      expect(second).toEqual([mockPermission.name]);
      expect(mockRolePermissionModel.find).toHaveBeenCalledTimes(1);
    });

    it('should return [] when role not found', async () => {
      mockRoleModel.findOne.mockImplementationOnce(() => queryLikeNull());
      const result = await service.getPermissionsForRole('unknown');
      expect(result).toEqual([]);
    });
  });

  describe('hasPermission', () => {
    it('should return true when permission in list', () => {
      expect(service.hasPermission(['a', 'b'], 'b')).toBe(true);
    });
    it('should return false when permission not in list', () => {
      expect(service.hasPermission(['a', 'b'], 'c')).toBe(false);
    });
  });

  describe('invalidateRoleCache / invalidateCache', () => {
    it('invalidateRoleCache should remove role from cache', async () => {
      mockRoleModel.findOne.mockImplementation(() => queryLike(mockRole));
      mockRolePermissionModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue(leanChain([])),
      });
      await service.getPermissionsForRole(ROLES.ADMIN);
      service.invalidateRoleCache(ROLES.ADMIN);
      await service.getPermissionsForRole(ROLES.ADMIN);
      expect(mockRolePermissionModel.find.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('createPermission', () => {
    it('should create permission', async () => {
      const dto = { name: 'words:write' };
      const result = await service.createPermission(dto);
      expect(mockPermissionModel.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockPermission);
    });
    it('should throw ConflictException when name exists', async () => {
      mockPermissionModel.findOne.mockImplementationOnce(() =>
        queryLike(mockPermission as unknown),
      );
      await expect(service.createPermission({ name: mockPermission.name })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAllPermissions', () => {
    it('should return permissions sorted by name', async () => {
      mockPermissionModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue(leanChain([mockPermission])),
      });
      const result = await service.findAllPermissions();
      expect(result).toEqual([mockPermission]);
      expect(mockPermissionModel.find().sort).toHaveBeenCalledWith({ name: 1 });
    });
  });

  describe('findOnePermission', () => {
    it('should return permission', async () => {
      const result = await service.findOnePermission(mockPermission._id.toString());
      expect(result).toEqual(mockPermission);
    });
    it('should throw NotFoundException when not found', async () => {
      mockPermissionModel.findById.mockImplementationOnce(() => leanChain(null));
      await expect(service.findOnePermission('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePermission', () => {
    it('should update permission', async () => {
      const dto = { name: 'words:read:v2' };
      const result = await service.updatePermission(mockPermission._id.toString(), dto);
      expect(mockPermissionModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockPermission._id.toString(),
        dto,
        { new: true },
      );
      expect(result).toEqual(mockPermission);
    });
    it('should throw ConflictException when new name exists on other', async () => {
      mockPermissionModel.findOne.mockImplementationOnce(() =>
        queryLike(mockPermission as unknown),
      );
      await expect(
        service.updatePermission(mockPermission._id.toString(), { name: 'taken' }),
      ).rejects.toThrow(ConflictException);
    });
    it('should throw NotFoundException when not found', async () => {
      mockPermissionModel.findByIdAndUpdate.mockImplementationOnce(() => leanChain(null));
      await expect(service.updatePermission('nonexistent', { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removePermission', () => {
    it('should delete permission and role_permission links', async () => {
      await service.removePermission(mockPermission._id.toString());
      expect(mockPermissionModel.findByIdAndDelete).toHaveBeenCalledWith(
        mockPermission._id.toString(),
      );
      expect(mockRolePermissionModel.deleteMany).toHaveBeenCalledWith({
        permissionId: mockPermission._id.toString(),
      });
    });
    it('should throw NotFoundException when not found', async () => {
      mockPermissionModel.findByIdAndDelete.mockImplementationOnce(() => chain(null));
      await expect(service.removePermission('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createRole', () => {
    it('should create role', async () => {
      const dto = { name: 'editor', description: 'Editor' };
      const result = await service.createRole(dto);
      expect(mockRoleModel.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockRole);
    });
    it('should throw ForbiddenException for super_admin', async () => {
      await expect(service.createRole({ name: ROLES.SUPER_ADMIN })).rejects.toThrow(
        ForbiddenException,
      );
    });
    it('should throw ConflictException when name exists', async () => {
      mockRoleModel.findOne.mockImplementationOnce(() => queryLike(mockRole));
      await expect(service.createRole({ name: mockRole.name })).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllRoles', () => {
    it('should return roles sorted by name', async () => {
      mockRoleModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue(leanChain([mockRole])),
      });
      const result = await service.findAllRoles();
      expect(result).toEqual([mockRole]);
    });
  });

  describe('findOneRole', () => {
    it('should return role', async () => {
      const result = await service.findOneRole(mockRole._id.toString());
      expect(result).toEqual(mockRole);
    });
    it('should throw NotFoundException when not found', async () => {
      mockRoleModel.findById.mockImplementationOnce(() => leanChain(null));
      await expect(service.findOneRole('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findRoleByName', () => {
    it('should return role by name', async () => {
      mockRoleModel.findOne.mockImplementationOnce(() => queryLike(mockRole));
      const result = await service.findRoleByName(ROLES.ADMIN);
      expect(result).toEqual(mockRole);
      expect(mockRoleModel.findOne).toHaveBeenCalledWith({ name: ROLES.ADMIN });
    });
  });

  describe('updateRole', () => {
    it('should update role', async () => {
      const dto = { description: 'Updated' };
      const result = await service.updateRole(mockRole._id.toString(), dto);
      expect(mockRoleModel.findByIdAndUpdate).toHaveBeenCalledWith(mockRole._id.toString(), dto, {
        new: true,
      });
      expect(result).toEqual(mockRole);
    });
    it('should throw ForbiddenException when updating super_admin', async () => {
      const superAdmin = { ...mockRole, name: ROLES.SUPER_ADMIN };
      mockRoleModel.findById.mockImplementationOnce(() => leanChain(superAdmin));
      await expect(
        service.updateRole(superAdmin._id.toString(), { description: 'x' }),
      ).rejects.toThrow(ForbiddenException);
    });
    it('should throw ConflictException when new name exists on other', async () => {
      mockRoleModel.findOne.mockImplementationOnce(() => queryLike(mockRole));
      await expect(service.updateRole(mockRole._id.toString(), { name: 'taken' })).rejects.toThrow(
        ConflictException,
      );
    });
    it('should throw NotFoundException when not found', async () => {
      mockRoleModel.findById.mockImplementationOnce(() => leanChain(null));
      await expect(service.updateRole('nonexistent', { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeRole', () => {
    it('should delete role and role_permission links', async () => {
      await service.removeRole(mockRole._id.toString());
      expect(mockRoleModel.findByIdAndDelete).toHaveBeenCalledWith(mockRole._id.toString());
      expect(mockRolePermissionModel.deleteMany).toHaveBeenCalledWith({
        roleId: mockRole._id.toString(),
      });
    });
    it('should throw ForbiddenException when deleting super_admin', async () => {
      const superAdmin = { ...mockRole, name: ROLES.SUPER_ADMIN };
      mockRoleModel.findById.mockImplementationOnce(() => leanChain(superAdmin));
      await expect(service.removeRole(superAdmin._id.toString())).rejects.toThrow(
        ForbiddenException,
      );
    });
    it('should throw NotFoundException when not found', async () => {
      mockRoleModel.findById.mockImplementationOnce(() => leanChain(null));
      await expect(service.removeRole('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRolePermissions', () => {
    it('should return permissions for role', async () => {
      mockRolePermissionModel.find.mockReturnValue({
        populate: jest
          .fn()
          .mockReturnValue(
            leanChain([{ permissionId: { _id: mockPermission._id, name: mockPermission.name } }]),
          ),
      });
      const result = await service.getRolePermissions(mockRole._id.toString());
      expect(result).toEqual([{ permissionId: mockPermission._id, name: mockPermission.name }]);
    });
    it('should return all permissions for SUPER_ADMIN role', async () => {
      const superAdmin = { ...mockRole, name: ROLES.SUPER_ADMIN };
      mockRoleModel.findById.mockImplementationOnce(() => leanChain(superAdmin));
      mockPermissionModel.find.mockReturnValueOnce(leanChain([mockPermission]));
      const result = await service.getRolePermissions(superAdmin._id.toString());
      expect(result).toEqual([{ permissionId: mockPermission._id, name: mockPermission.name }]);
    });
    it('should throw NotFoundException when role not found', async () => {
      mockRoleModel.findById.mockImplementationOnce(() => leanChain(null));
      await expect(service.getRolePermissions('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setRolePermissions', () => {
    it('should replace role permissions and return new list', async () => {
      mockRolePermissionModel.find.mockReturnValue({
        populate: jest
          .fn()
          .mockReturnValue(
            leanChain([{ permissionId: { _id: mockPermission._id, name: mockPermission.name } }]),
          ),
      });
      const result = await service.setRolePermissions(mockRole._id.toString(), [
        mockPermission._id.toString(),
      ]);
      expect(mockRolePermissionModel.deleteMany).toHaveBeenCalledWith({
        roleId: mockRole._id.toString(),
      });
      expect(mockRolePermissionModel.create).toHaveBeenCalledWith({
        roleId: mockRole._id.toString(),
        permissionId: mockPermission._id.toString(),
      });
      expect(result).toHaveLength(1);
    });
    it('should throw ForbiddenException for super_admin', async () => {
      const superAdmin = { ...mockRole, name: ROLES.SUPER_ADMIN };
      mockRoleModel.findById.mockImplementationOnce(() => leanChain(superAdmin));
      await expect(service.setRolePermissions(superAdmin._id.toString(), [])).rejects.toThrow(
        ForbiddenException,
      );
    });
    it('should throw NotFoundException when role not found', async () => {
      mockRoleModel.findById.mockImplementationOnce(() => leanChain(null));
      await expect(service.setRolePermissions('nonexistent', [])).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
