import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { User, UserRole } from './schemas/user.schema';

describe('UsersService', () => {
  let service: UsersService;

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    role: UserRole.STUDENT,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const chain = (execResult: unknown) => ({
    exec: jest.fn().mockResolvedValue(execResult),
  });
  const leanChain = (execResult: unknown) => ({
    lean: jest.fn().mockReturnValue(chain(execResult)),
  });
  const mockUserModel = {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue(leanChain([mockUser])),
    }),
    findOne: jest.fn().mockImplementation(() => chain(null)),
    findById: jest.fn().mockImplementation(() => leanChain(mockUser)),
    findByIdAndUpdate: jest.fn().mockImplementation(() => leanChain(mockUser)),
    findByIdAndDelete: jest.fn().mockImplementation(() => chain(mockUser)),
    create: jest.fn().mockResolvedValue({ toObject: () => mockUser }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isUserAllowed', () => {
    it('should return true when user exists', async () => {
      mockUserModel.findOne.mockImplementationOnce(() => chain(mockUser));
      const result = await service.isUserAllowed('john@example.com');
      expect(result).toBe(true);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: 'john@example.com' });
    });

    it('should return false when user does not exist', async () => {
      const result = await service.isUserAllowed('unknown@example.com');
      expect(result).toBe(false);
    });
  });

  describe('seedDefaultUser', () => {
    it('should create default user when not exists', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      await service.seedDefaultUser();
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: 'mmylymuk@gmail.com' });
      expect(mockUserModel.create).toHaveBeenCalledWith({
        firstName: 'Default',
        lastName: 'Admin',
        email: 'mmylymuk@gmail.com',
        role: UserRole.SUPER_ADMIN,
      });
      expect(logSpy).toHaveBeenCalledWith('Seeded default user: mmylymuk@gmail.com');
      logSpy.mockRestore();
    });

    it('should not create when default user already exists', async () => {
      mockUserModel.findOne.mockImplementationOnce(() => chain({ email: 'mmylymuk@gmail.com' }));
      await service.seedDefaultUser();
      expect(mockUserModel.create).not.toHaveBeenCalled();
    });
  });

  describe('onModuleInit', () => {
    it('should call seedDefaultUser', async () => {
      const seedSpy = jest.spyOn(service, 'seedDefaultUser').mockResolvedValueOnce(undefined);
      await service.onModuleInit();
      expect(seedSpy).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create a user', async () => {
      const dto = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        role: UserRole.STUDENT,
      };
      const result = await service.create(dto);
      expect(result).toEqual(mockUser);
      expect(mockUserModel.create).toHaveBeenCalledWith(dto);
    });

    it('should throw ConflictException when email exists', async () => {
      mockUserModel.findOne.mockImplementationOnce(() => chain(mockUser));
      await expect(
        service.create({
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'john@example.com',
          role: UserRole.STUDENT,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ForbiddenException when role is SUPER_ADMIN', async () => {
      await expect(
        service.create({
          firstName: 'Super',
          lastName: 'Admin',
          email: 'super@example.com',
          role: UserRole.SUPER_ADMIN,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockUserModel.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return users sorted by createdAt desc, excluding super_admin', async () => {
      const result = await service.findAll();
      expect(result).toEqual([mockUser]);
      expect(mockUserModel.find).toHaveBeenCalledWith({
        role: { $ne: UserRole.SUPER_ADMIN },
      });
      expect(mockUserModel.find().sort).toHaveBeenCalledWith({ createdAt: -1 });
    });
  });

  describe('findOne', () => {
    it('should return a user', async () => {
      const result = await service.findOne('507f1f77bcf86cd799439011');
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserModel.findById.mockImplementationOnce(() => leanChain(null));
      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when user is super_admin', async () => {
      const superAdmin = { ...mockUser, role: UserRole.SUPER_ADMIN };
      mockUserModel.findById.mockImplementationOnce(() => leanChain(superAdmin));
      await expect(service.findOne('507f1f77bcf86cd799439011')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const dto = { firstName: 'Jane' };
      const result = await service.update('507f1f77bcf86cd799439011', dto);
      expect(result).toEqual(mockUser);
      expect(mockUserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        dto,
        { new: true },
      );
    });

    it('should throw ConflictException when new email already exists', async () => {
      mockUserModel.findOne.mockImplementationOnce(() => chain(mockUser));
      await expect(
        service.update('507f1f77bcf86cd799439011', { email: 'existing@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserModel.findById.mockImplementationOnce(() => leanChain(null));
      await expect(service.update('nonexistent', { firstName: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when editing super_admin', async () => {
      const superAdmin = { ...mockUser, role: UserRole.SUPER_ADMIN };
      mockUserModel.findById.mockImplementationOnce(() => leanChain(superAdmin));
      await expect(service.update('507f1f77bcf86cd799439011', { firstName: 'X' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when assigning super_admin role', async () => {
      mockUserModel.findById.mockImplementationOnce(() => leanChain(mockUser));
      await expect(
        service.update('507f1f77bcf86cd799439011', { role: UserRole.SUPER_ADMIN }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      await service.remove('507f1f77bcf86cd799439011');
      expect(mockUserModel.findByIdAndDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('should throw NotFoundException when user not found', async () => {
      mockUserModel.findById.mockImplementationOnce(() => leanChain(null));
      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when deleting super_admin', async () => {
      const superAdmin = { ...mockUser, role: UserRole.SUPER_ADMIN };
      mockUserModel.findById.mockImplementationOnce(() => leanChain(superAdmin));
      await expect(service.remove('507f1f77bcf86cd799439011')).rejects.toThrow(ForbiddenException);
      expect(mockUserModel.findByIdAndDelete).not.toHaveBeenCalled();
    });
  });
});
