import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PermissionsService } from '../permissions/permissions.service';
import { RequirePermissionsGuard } from '../auth/guards/require-permissions.guard';
import { UserRole } from './schemas/user.schema';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    role: 'student',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUsersService = {
    create: jest.fn().mockResolvedValue(mockUser),
    findAll: jest.fn().mockResolvedValue([mockUser]),
    findOne: jest.fn().mockResolvedValue(mockUser),
    findOneByEmail: jest.fn().mockResolvedValue(mockUser),
    update: jest.fn().mockResolvedValue(mockUser),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  const mockPermissionsService = {
    getPermissionsForRole: jest.fn().mockResolvedValue(['users:read', 'users:write']),
    hasPermission: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: PermissionsService, useValue: mockPermissionsService },
        Reflector,
        RequirePermissionsGuard,
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create should call service.create', async () => {
    const dto = { firstName: 'J', lastName: 'D', email: 'j@d.com', role: UserRole.STUDENT };
    const result = await controller.create(dto);
    expect(mockUsersService.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockUser);
  });

  it('findAll should return users', async () => {
    const result = await controller.findAll();
    expect(mockUsersService.findAll).toHaveBeenCalled();
    expect(result).toEqual([mockUser]);
  });

  it('findOne should return user', async () => {
    const result = await controller.findOne('id-1');
    expect(mockUsersService.findOne).toHaveBeenCalledWith('id-1');
    expect(result).toEqual(mockUser);
  });

  it('update should call service.update', async () => {
    const dto = { firstName: 'Jane' };
    const result = await controller.update('id-1', dto);
    expect(mockUsersService.update).toHaveBeenCalledWith('id-1', dto);
    expect(result).toEqual(mockUser);
  });

  it('remove should call service.remove', async () => {
    await controller.remove('id-1');
    expect(mockUsersService.remove).toHaveBeenCalledWith('id-1');
  });
});
