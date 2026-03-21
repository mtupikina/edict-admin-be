import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { UsersService } from './users.service';
import { User } from './schemas/user.schema';
import { Role } from '../permissions/schemas/role.schema';
import { ROLES } from '../permissions/constants/permissions.constants';

const mockRoleId = '507f1f77bcf86cd799439012';
const superAdminRoleId = '507f1f77bcf86cd799439099';
const mockRole = { _id: new Types.ObjectId(mockRoleId), name: 'student' };
const superAdminRole = { _id: new Types.ObjectId(superAdminRoleId), name: ROLES.SUPER_ADMIN };

const mockUserDoc = {
  _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  roleIds: [mockRole],
  createdAt: new Date(),
  updatedAt: new Date(),
};

function chain(execResult: unknown) {
  return { exec: jest.fn().mockResolvedValue(execResult) };
}

function leanChain(execResult: unknown) {
  return { lean: jest.fn().mockReturnValue(chain(execResult)) };
}

function populateLeanChain(execResult: unknown) {
  return {
    populate: jest.fn().mockReturnValue(leanChain(execResult)),
  };
}

function tutorResolveDocsFromIds(
  ids: Types.ObjectId[],
  roleName: string = ROLES.TUTOR,
): { _id: Types.ObjectId; roleIds: { name: string }[] }[] {
  return ids.map((oid) => ({
    _id: oid,
    roleIds: [{ name: roleName }],
  }));
}

/** Routes `find({ _id: { $in } })` (tutor resolution) vs list query used by findAll. */
function userFindMockImpl(query?: Record<string, unknown>) {
  const idFilter = query?._id as { $in?: Types.ObjectId[] } | undefined;
  if (idFilter && Array.isArray(idFilter.$in)) {
    return {
      populate: jest.fn().mockReturnValue(leanChain(tutorResolveDocsFromIds(idFilter.$in))),
    };
  }
  return {
    sort: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue(leanChain([mockUserDoc])),
    }),
  };
}

describe('UsersService', () => {
  let service: UsersService;

  const mockUserModel = {
    find: jest.fn().mockImplementation(userFindMockImpl),
    findOne: jest.fn().mockImplementation(() => chain(null)),
    findById: jest.fn().mockImplementation(() => populateLeanChain(mockUserDoc)),
    findByIdAndUpdate: jest.fn().mockImplementation(() => populateLeanChain(mockUserDoc)),
    findByIdAndDelete: jest.fn().mockImplementation(() => chain(mockUserDoc)),
    create: jest.fn().mockResolvedValue(mockUserDoc),
  };

  const mockRoleModel = {
    findOne: jest.fn().mockImplementation((q: { name?: string }) => {
      const role = q?.name === ROLES.SUPER_ADMIN ? superAdminRole : null;
      return {
        select: () => leanChain(role),
        lean: () => chain(role),
      };
    }),
    find: jest.fn().mockReturnValue({
      select: () => leanChain([mockRole]),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(Role.name), useValue: mockRoleModel },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();

    mockUserModel.find.mockImplementation(userFindMockImpl);

    mockRoleModel.findOne.mockImplementation((q: { name?: string }) => {
      const role = q?.name === ROLES.SUPER_ADMIN ? superAdminRole : null;
      return {
        select: () => leanChain(role),
        lean: () => chain(role),
      };
    });
    mockRoleModel.find.mockReturnValue({ select: () => leanChain([mockRole]) });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should run default user seed', async () => {
      await service.onModuleInit();
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: 'mmylymuk@gmail.com' });
    });
  });

  describe('isUserAllowed', () => {
    it('should return true when user exists', async () => {
      mockUserModel.findOne.mockImplementationOnce(() => chain(mockUserDoc));
      const result = await service.isUserAllowed('john@example.com');
      expect(result).toBe(true);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: 'john@example.com' });
    });

    it('should return false when user does not exist', async () => {
      const result = await service.isUserAllowed('unknown@example.com');
      expect(result).toBe(false);
    });
  });

  describe('findOneByEmail', () => {
    it('should return user with populated roleIds when found', async () => {
      mockUserModel.findOne.mockReturnValueOnce(populateLeanChain(mockUserDoc));
      const result = await service.findOneByEmail('john@example.com');
      expect(result).not.toBeNull();
      expect(result?.roleIds).toEqual([mockRole]);
    });

    it('should return null when not found', async () => {
      mockUserModel.findOne.mockReturnValueOnce(populateLeanChain(null));
      const result = await service.findOneByEmail('unknown@example.com');
      expect(result).toBeNull();
    });
  });

  describe('seedDefaultUser', () => {
    it('should create default user when not exists', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      await service.seedDefaultUser();
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: 'mmylymuk@gmail.com' });
      expect(mockRoleModel.findOne).toHaveBeenCalledWith({ name: ROLES.SUPER_ADMIN });
      expect(mockUserModel.create).toHaveBeenCalledWith({
        firstName: 'Default',
        lastName: 'Admin',
        email: 'mmylymuk@gmail.com',
        roleIds: [superAdminRole._id],
      });
      expect(logSpy).toHaveBeenCalledWith('Seeded default user: mmylymuk@gmail.com');
      logSpy.mockRestore();
    });

    it('should not create when default user already exists', async () => {
      mockUserModel.findOne.mockImplementationOnce(() => chain({ email: 'mmylymuk@gmail.com' }));
      await service.seedDefaultUser();
      expect(mockUserModel.create).not.toHaveBeenCalled();
    });

    it('should skip seed when super_admin role is missing', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockUserModel.findOne.mockImplementationOnce(() => chain(null));
      mockRoleModel.findOne.mockImplementationOnce(() => ({
        lean: () => chain(null),
      }));
      await service.seedDefaultUser();
      expect(mockUserModel.create).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        'Super admin role not found; skipping default user seed',
      );
      warnSpy.mockRestore();
    });
  });

  describe('create', () => {
    it('should create a user with valid roleIds', async () => {
      const dto = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        roleIds: [mockRoleId],
      };
      const result = await service.create(dto);
      expect(result.roleIds).toEqual([mockRole]);
      expect(mockRoleModel.find).toHaveBeenCalledWith({
        _id: { $in: [expect.any(Types.ObjectId)] },
      });
      expect(mockUserModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
        }),
      );
    });

    it('should throw ConflictException when email exists', async () => {
      mockUserModel.findOne.mockImplementationOnce(() => chain(mockUserDoc));
      await expect(
        service.create({
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'john@example.com',
          roleIds: [mockRoleId],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ForbiddenException when roleIds include super_admin role', async () => {
      mockRoleModel.find.mockReturnValueOnce({ select: () => leanChain([superAdminRole]) });
      await expect(
        service.create({
          firstName: 'Super',
          lastName: 'Admin',
          email: 'super@example.com',
          roleIds: [superAdminRoleId],
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockUserModel.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when role not found', async () => {
      mockRoleModel.find.mockReturnValueOnce({ select: () => leanChain([]) });
      await expect(
        service.create({
          firstName: 'J',
          lastName: 'D',
          email: 'j@d.com',
          roleIds: ['507f1f77bcf86cd799439099'],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockUserModel.create).not.toHaveBeenCalled();
    });

    it('should create a user with valid tutorIds', async () => {
      const tutorUserId = '507f1f77bcf86cd799439055';
      const dto = {
        firstName: 'Student',
        lastName: 'User',
        email: 'student@example.com',
        roleIds: [mockRoleId],
        tutorIds: [tutorUserId],
      };
      await service.create(dto);
      expect(mockUserModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tutorIds: [new Types.ObjectId(tutorUserId)],
        }),
      );
    });

    it('should create with empty tutorIds when tutor user ids are not found', async () => {
      mockUserModel.find.mockImplementation((query?: Record<string, unknown>) => {
        const idFilter = query?._id as { $in?: Types.ObjectId[] } | undefined;
        if (idFilter && Array.isArray(idFilter.$in)) {
          return {
            populate: jest.fn().mockReturnValue(leanChain([])),
          };
        }
        return userFindMockImpl(query);
      });
      await service.create({
        firstName: 'S',
        lastName: 'U',
        email: 'su@example.com',
        roleIds: [mockRoleId],
        tutorIds: ['507f1f77bcf86cd799439055'],
      });
      expect(mockUserModel.create).toHaveBeenCalledWith(expect.objectContaining({ tutorIds: [] }));
    });

    it('should create keeping only tutor ids that exist', async () => {
      const existingTutorId = '507f1f77bcf86cd799439055';
      mockUserModel.find.mockImplementation((query?: Record<string, unknown>) => {
        const idFilter = query?._id as { $in?: Types.ObjectId[] } | undefined;
        if (idFilter && Array.isArray(idFilter.$in)) {
          const kept = idFilter.$in.filter((oid) => oid.toString() === existingTutorId);
          return {
            populate: jest.fn().mockReturnValue(leanChain(tutorResolveDocsFromIds(kept))),
          };
        }
        return userFindMockImpl(query);
      });
      await service.create({
        firstName: 'S',
        lastName: 'U',
        email: 'su2@example.com',
        roleIds: [mockRoleId],
        tutorIds: [existingTutorId, '507f1f77bcf86cd799439066'],
      });
      expect(mockUserModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tutorIds: [new Types.ObjectId(existingTutorId)],
        }),
      );
    });

    it('should create with empty tutorIds when candidate users are student-only', async () => {
      const tutorUserId = '507f1f77bcf86cd799439055';
      mockUserModel.find.mockImplementation((query?: Record<string, unknown>) => {
        const idFilter = query?._id as { $in?: Types.ObjectId[] } | undefined;
        if (idFilter && Array.isArray(idFilter.$in)) {
          return {
            populate: jest
              .fn()
              .mockReturnValue(leanChain(tutorResolveDocsFromIds(idFilter.$in, ROLES.STUDENT))),
          };
        }
        return userFindMockImpl(query);
      });
      await service.create({
        firstName: 'S',
        lastName: 'U',
        email: 'only-student-tutor@example.com',
        roleIds: [mockRoleId],
        tutorIds: [tutorUserId],
      });
      expect(mockUserModel.create).toHaveBeenCalledWith(expect.objectContaining({ tutorIds: [] }));
    });

    it('should treat tutor candidate with non-array roleIds as ineligible', async () => {
      const tutorUserId = '507f1f77bcf86cd799439055';
      mockUserModel.find.mockImplementation((query?: Record<string, unknown>) => {
        const idFilter = query?._id as { $in?: Types.ObjectId[] } | undefined;
        if (idFilter && Array.isArray(idFilter.$in)) {
          return {
            populate: jest.fn().mockReturnValue(
              leanChain([
                {
                  _id: new Types.ObjectId(tutorUserId),
                  roleIds: 'not-an-array' as unknown as Types.ObjectId[],
                },
              ]),
            ),
          };
        }
        return userFindMockImpl(query);
      });
      await service.create({
        firstName: 'S',
        lastName: 'U',
        email: 'bad-tutor-shape@example.com',
        roleIds: [mockRoleId],
        tutorIds: [tutorUserId],
      });
      expect(mockUserModel.create).toHaveBeenCalledWith(expect.objectContaining({ tutorIds: [] }));
    });

    it('should accept super_admin user as tutor', async () => {
      const superAdminUserId = '507f1f77bcf86cd799439088';
      mockUserModel.find.mockImplementation((query?: Record<string, unknown>) => {
        const idFilter = query?._id as { $in?: Types.ObjectId[] } | undefined;
        if (idFilter && Array.isArray(idFilter.$in)) {
          return {
            populate: jest.fn().mockReturnValue(
              leanChain([
                {
                  _id: new Types.ObjectId(superAdminUserId),
                  roleIds: [superAdminRole],
                },
              ]),
            ),
          };
        }
        return userFindMockImpl(query);
      });
      await service.create({
        firstName: 'S',
        lastName: 'U',
        email: 'with-sa-tutor@example.com',
        roleIds: [mockRoleId],
        tutorIds: [superAdminUserId],
      });
      expect(mockUserModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tutorIds: [new Types.ObjectId(superAdminUserId)],
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all users including super_admin (for tutor assignment and display)', async () => {
      const result = await service.findAll();
      expect(result).toHaveLength(1);
      expect(result[0].roleIds).toEqual([mockRole]);
      expect(mockUserModel.find).toHaveBeenCalledWith({});
    });
  });

  describe('findOne', () => {
    it('should return a user with populated roleIds', async () => {
      const result = await service.findOne('507f1f77bcf86cd799439011');
      expect(result.roleIds).toEqual([mockRole]);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserModel.findById.mockReturnValueOnce(populateLeanChain(null));
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when user has super_admin role', async () => {
      const superAdminUserDoc = { ...mockUserDoc, roleIds: [superAdminRole] };
      mockUserModel.findById.mockReturnValueOnce(populateLeanChain(superAdminUserDoc));
      await expect(service.findOne('507f1f77bcf86cd799439011')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const dto = { firstName: 'Jane' };
      const result = await service.update('507f1f77bcf86cd799439011', dto);
      expect(result.roleIds).toEqual([mockRole]);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        dto,
        { new: true },
      );
    });

    it('should throw ConflictException when new email already exists', async () => {
      mockUserModel.findOne.mockImplementationOnce(() => chain(mockUserDoc));
      await expect(
        service.update('507f1f77bcf86cd799439011', { email: 'existing@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserModel.findById.mockReturnValueOnce(populateLeanChain(null));
      await expect(service.update('nonexistent', { firstName: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when editing super_admin', async () => {
      const superAdminUserDoc = { ...mockUserDoc, roleIds: [superAdminRole] };
      mockUserModel.findById.mockReturnValueOnce(populateLeanChain(superAdminUserDoc));
      await expect(service.update('507f1f77bcf86cd799439011', { firstName: 'X' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when assigning super_admin role', async () => {
      mockRoleModel.find.mockReturnValueOnce({ select: () => leanChain([superAdminRole]) });
      await expect(
        service.update('507f1f77bcf86cd799439011', { roleIds: [superAdminRoleId] }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should update tutorIds when valid', async () => {
      const tutorUserId = '507f1f77bcf86cd799439055';
      await service.update('507f1f77bcf86cd799439011', { tutorIds: [tutorUserId] });
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({
          tutorIds: [new Types.ObjectId(tutorUserId)],
        }),
        { new: true },
      );
    });

    it('should allow tutorIds to include self (self-tutor)', async () => {
      const selfId = '507f1f77bcf86cd799439011';
      await service.update(selfId, { tutorIds: [selfId] });
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        selfId,
        expect.objectContaining({
          tutorIds: [new Types.ObjectId(selfId)],
        }),
        { new: true },
      );
    });

    it('should clear tutorIds when empty array is sent', async () => {
      await service.update('507f1f77bcf86cd799439011', { tutorIds: [] });
      expect(mockUserModel.find).not.toHaveBeenCalled();
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({ tutorIds: [] }),
        { new: true },
      );
    });

    it('should persist new roleIds as ObjectIds', async () => {
      await service.update('507f1f77bcf86cd799439011', { roleIds: [mockRoleId] });
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({
          roleIds: [new Types.ObjectId(mockRoleId)],
        }),
        { new: true },
      );
    });

    it('should throw NotFoundException when findByIdAndUpdate returns null', async () => {
      mockUserModel.findByIdAndUpdate.mockReturnValueOnce(populateLeanChain(null));
      await expect(service.update('507f1f77bcf86cd799439011', { firstName: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      await service.remove('507f1f77bcf86cd799439011');
      expect(mockUserModel.findByIdAndDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserModel.findById.mockReturnValueOnce(populateLeanChain(null));
      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when deleting super_admin', async () => {
      const superAdminUserDoc = { ...mockUserDoc, roleIds: [superAdminRole] };
      mockUserModel.findById.mockReturnValueOnce(populateLeanChain(superAdminUserDoc));
      await expect(service.remove('507f1f77bcf86cd799439011')).rejects.toThrow(ForbiddenException);
      expect(mockUserModel.findByIdAndDelete).not.toHaveBeenCalled();
    });
  });
});
