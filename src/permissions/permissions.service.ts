import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Permission, PermissionDocument } from './schemas/permission.schema';
import { Role, RoleDocument } from './schemas/role.schema';
import { RolePermission, RolePermissionDocument } from './schemas/role-permission.schema';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Permissions, ROLES } from './constants/permissions.constants';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  permissions: string[];
  expiresAt: number;
}

@Injectable()
export class PermissionsService implements OnModuleInit {
  private rolePermissionsCache = new Map<string, CacheEntry>();

  constructor(
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<PermissionDocument>,
    @InjectModel(Role.name)
    private readonly roleModel: Model<RoleDocument>,
    @InjectModel(RolePermission.name)
    private readonly rolePermissionModel: Model<RolePermissionDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedRolesAndPermissions();
  }

  async getPermissionsForRole(roleName: string): Promise<string[]> {
    if (roleName === ROLES.SUPER_ADMIN) {
      const all = await this.permissionModel.find().distinct('name').exec();
      return all;
    }
    const cached = this.rolePermissionsCache.get(roleName);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.permissions;
    }
    const role = await this.roleModel.findOne({ name: roleName }).lean().exec();
    if (!role) {
      return [];
    }
    const links = await this.rolePermissionModel
      .find({ roleId: role._id })
      .populate('permissionId', 'name')
      .lean()
      .exec();
    const permissions = links
      .map((l) => (l.permissionId as unknown as { name: string })?.name)
      .filter(Boolean);
    this.rolePermissionsCache.set(roleName, {
      permissions,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return permissions;
  }

  hasPermission(rolePermissions: string[], required: string): boolean {
    return rolePermissions.includes(required);
  }

  invalidateRoleCache(roleName: string): void {
    this.rolePermissionsCache.delete(roleName);
  }

  invalidateCache(): void {
    this.rolePermissionsCache.clear();
  }

  async seedRolesAndPermissions(): Promise<void> {
    const permissionNames = Object.values(Permissions);
    for (const name of permissionNames) {
      await this.permissionModel.findOneAndUpdate(
        { name },
        { $setOnInsert: { name } },
        { upsert: true },
      );
    }
    const roleNames = Object.values(ROLES);
    for (const name of roleNames) {
      await this.roleModel.findOneAndUpdate({ name }, { $setOnInsert: { name } }, { upsert: true });
    }
    const roles = await this.roleModel.find().lean().exec();
    const permissions = await this.permissionModel.find().lean().exec();
    const roleByName = new Map(roles.map((r) => [r.name, r]));
    const permissionByName = new Map(permissions.map((p) => [p.name, p]));

    const studentRole = roleByName.get(ROLES.STUDENT);
    const teacherRole = roleByName.get(ROLES.TEACHER);
    const adminRole = roleByName.get(ROLES.ADMIN);
    const superAdminRole = roleByName.get(ROLES.SUPER_ADMIN);

    const studentPerms = [Permissions.WORDS_READ];
    const teacherPerms = [
      Permissions.WORDS_READ,
      Permissions.WORDS_WRITE,
      Permissions.TESTS_READ,
      Permissions.TESTS_WRITE,
    ];
    const adminPerms = [
      ...teacherPerms,
      Permissions.USERS_READ,
      Permissions.USERS_WRITE,
      Permissions.ROLES_READ,
      Permissions.ROLES_WRITE,
      Permissions.PERMISSIONS_READ,
      Permissions.PERMISSIONS_WRITE,
    ];
    const allPerms = permissionNames;

    const assign = async (role: { _id: Types.ObjectId } | undefined, permNames: string[]) => {
      if (!role) return;
      for (const pName of permNames) {
        const perm = permissionByName.get(pName);
        if (!perm) continue;
        await this.rolePermissionModel.findOneAndUpdate(
          { roleId: role._id, permissionId: perm._id },
          { roleId: role._id, permissionId: perm._id },
          { upsert: true },
        );
      }
    };

    await assign(studentRole, studentPerms);
    await assign(teacherRole, teacherPerms);
    await assign(adminRole, adminPerms);
    await assign(superAdminRole, allPerms);

    this.invalidateCache();
  }

  // Permissions CRUD
  async createPermission(dto: CreatePermissionDto) {
    const existing = await this.permissionModel.findOne({ name: dto.name });
    if (existing) {
      throw new ConflictException(`Permission with name ${dto.name} exists`);
    }
    const doc = await this.permissionModel.create(dto);
    return doc.toObject();
  }

  async findAllPermissions() {
    return this.permissionModel.find().sort({ name: 1 }).lean().exec();
  }

  async findOnePermission(id: string) {
    const doc = await this.permissionModel.findById(id).lean().exec();
    if (!doc) {
      throw new NotFoundException(`Permission with id ${id} not found`);
    }
    return doc;
  }

  async updatePermission(id: string, dto: UpdatePermissionDto) {
    if (dto.name) {
      const existing = await this.permissionModel.findOne({
        name: dto.name,
        _id: { $ne: id },
      });
      if (existing) {
        throw new ConflictException(`Permission with name ${dto.name} exists`);
      }
    }
    const doc = await this.permissionModel.findByIdAndUpdate(id, dto, { new: true }).lean().exec();
    if (!doc) {
      throw new NotFoundException(`Permission with id ${id} not found`);
    }
    return doc;
  }

  async removePermission(id: string) {
    const doc = await this.permissionModel.findByIdAndDelete(id).exec();
    if (!doc) {
      throw new NotFoundException(`Permission with id ${id} not found`);
    }
    await this.rolePermissionModel.deleteMany({ permissionId: id }).exec();
    this.invalidateCache();
  }

  // Roles CRUD
  async createRole(dto: CreateRoleDto) {
    if (dto.name === ROLES.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot create super_admin role');
    }
    const existing = await this.roleModel.findOne({ name: dto.name });
    if (existing) {
      throw new ConflictException(`Role with name ${dto.name} exists`);
    }
    const doc = await this.roleModel.create(dto);
    return doc.toObject();
  }

  async findAllRoles() {
    return this.roleModel.find().sort({ name: 1 }).lean().exec();
  }

  async findOneRole(id: string) {
    const doc = await this.roleModel.findById(id).lean().exec();
    if (!doc) {
      throw new NotFoundException(`Role with id ${id} not found`);
    }
    return doc;
  }

  async findRoleByName(name: string) {
    return this.roleModel.findOne({ name }).lean().exec();
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    const existing = await this.roleModel.findById(id).lean().exec();
    if (!existing) {
      throw new NotFoundException(`Role with id ${id} not found`);
    }
    if ((existing as { name: string }).name === ROLES.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot update super_admin role');
    }
    if (dto.name) {
      const other = await this.roleModel.findOne({
        name: dto.name,
        _id: { $ne: id },
      });
      if (other) {
        throw new ConflictException(`Role with name ${dto.name} exists`);
      }
    }
    const doc = await this.roleModel.findByIdAndUpdate(id, dto, { new: true }).lean().exec();
    if (!doc) {
      throw new NotFoundException(`Role with id ${id} not found`);
    }
    this.invalidateRoleCache((doc as { name: string }).name);
    return doc;
  }

  async removeRole(id: string) {
    const doc = await this.roleModel.findById(id).lean().exec();
    if (!doc) {
      throw new NotFoundException(`Role with id ${id} not found`);
    }
    if ((doc as { name: string }).name === ROLES.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot delete super_admin role');
    }
    await this.roleModel.findByIdAndDelete(id).exec();
    await this.rolePermissionModel.deleteMany({ roleId: id }).exec();
    this.invalidateRoleCache((doc as { name: string }).name);
  }

  async getRolePermissions(roleId: string) {
    const role = await this.roleModel.findById(roleId).lean().exec();
    if (!role) {
      throw new NotFoundException(`Role with id ${roleId} not found`);
    }
    if ((role as { name: string }).name === ROLES.SUPER_ADMIN) {
      const all = await this.permissionModel.find().lean().exec();
      return all.map((p) => ({ permissionId: p._id, name: p.name }));
    }
    const links = await this.rolePermissionModel
      .find({ roleId })
      .populate('permissionId', 'name')
      .lean()
      .exec();
    return links.map((l) => {
      const p = l.permissionId as unknown as { _id: Types.ObjectId; name: string };
      return { permissionId: p?._id, name: p?.name };
    });
  }

  async setRolePermissions(roleId: string, permissionIds: string[]) {
    const role = await this.roleModel.findById(roleId).lean().exec();
    if (!role) {
      throw new NotFoundException(`Role with id ${roleId} not found`);
    }
    if ((role as { name: string }).name === ROLES.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot change super_admin permissions');
    }
    await this.rolePermissionModel.deleteMany({ roleId }).exec();
    for (const pid of permissionIds) {
      await this.rolePermissionModel.create({
        roleId,
        permissionId: pid,
      });
    }
    this.invalidateRoleCache((role as { name: string }).name);
    return this.getRolePermissions(roleId);
  }
}
