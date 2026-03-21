import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument, UserWithPopulatedRoleIds } from './schemas/user.schema';
import { Role, RoleDocument } from '../permissions/schemas/role.schema';
import { ROLES, TUTOR_ELIGIBLE_ROLE_NAMES } from '../permissions/constants/permissions.constants';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Role.name)
    private readonly roleModel: Model<RoleDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultUser();
  }

  async isUserAllowed(email: string): Promise<boolean> {
    const user = await this.userModel.findOne({ email }).exec();
    return !!user;
  }

  async findOneByEmail(email: string): Promise<UserWithPopulatedRoleIds | null> {
    const user = await this.userModel.findOne({ email }).populate('roleIds').lean().exec();
    return user as unknown as UserWithPopulatedRoleIds | null;
  }

  async seedDefaultUser(): Promise<void> {
    const defaultEmail = 'mmylymuk@gmail.com';
    const exists = await this.userModel.findOne({ email: defaultEmail }).exec();
    if (!exists) {
      const superAdminRole = await this.roleModel
        .findOne({ name: ROLES.SUPER_ADMIN })
        .lean()
        .exec();
      if (!superAdminRole) {
        console.warn('Super admin role not found; skipping default user seed');
        return;
      }
      await this.userModel.create({
        firstName: 'Default',
        lastName: 'Admin',
        email: defaultEmail,
        roleIds: [superAdminRole._id],
      });
      console.log(`Seeded default user: ${defaultEmail}`);
    }
  }

  private userMayBeTutorFromPopulatedRoles(roleIds: unknown): boolean {
    if (!Array.isArray(roleIds)) {
      return false;
    }
    return roleIds.some(
      (r) =>
        r != null &&
        typeof r === 'object' &&
        'name' in r &&
        typeof (r as { name: unknown }).name === 'string' &&
        TUTOR_ELIGIBLE_ROLE_NAMES.has((r as { name: string }).name),
    );
  }

  private async validateTutorIds(tutorIds: string[]): Promise<Types.ObjectId[]> {
    const unique = [...new Set(tutorIds)];
    if (unique.length === 0) {
      return [];
    }
    const objectIds = unique.map((id) => new Types.ObjectId(id));
    const found = await this.userModel
      .find({ _id: { $in: objectIds } })
      .populate({ path: 'roleIds', select: 'name' })
      .lean()
      .exec();
    const eligibleIds = new Set(
      found
        .filter((doc) => this.userMayBeTutorFromPopulatedRoles(doc.roleIds))
        .map((doc) => doc._id.toString()),
    );
    return unique
      .filter((idStr) => eligibleIds.has(idStr))
      .map((idStr) => new Types.ObjectId(idStr));
  }

  private async validateRoleIds(roleIds: string[]): Promise<Types.ObjectId[]> {
    const ids = roleIds.map((id) => new Types.ObjectId(id));
    const roles = await this.roleModel
      .find({ _id: { $in: ids } })
      .select('_id name')
      .lean()
      .exec();
    if (roles.length !== roleIds.length) {
      const foundIds = new Set(roles.map((r) => r._id.toString()));
      const missing = roleIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(`Roles not found: ${missing.join(', ')}`);
    }
    const superAdmin = roles.find((r) => r.name === ROLES.SUPER_ADMIN);
    if (superAdmin) {
      throw new ForbiddenException('Cannot assign super_admin role');
    }
    return ids;
  }

  private hasSuperAdminRole(roleIds: { _id: Types.ObjectId; name?: string }[]): boolean {
    return roleIds.some((r) => r.name === ROLES.SUPER_ADMIN);
  }

  async create(createUserDto: CreateUserDto): Promise<UserWithPopulatedRoleIds> {
    const roleIds = await this.validateRoleIds(createUserDto.roleIds);
    const existing = await this.userModel.findOne({ email: createUserDto.email }).exec();
    if (existing) {
      throw new ConflictException(`User with email ${createUserDto.email} already exists`);
    }
    const createPayload: Record<string, unknown> = {
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      email: createUserDto.email,
      roleIds,
    };
    if (createUserDto.tutorIds != null) {
      createPayload.tutorIds = await this.validateTutorIds(createUserDto.tutorIds);
    }
    const created = await this.userModel.create(createPayload);
    const populated = await this.userModel.findById(created._id).populate('roleIds').lean().exec();
    return populated as unknown as UserWithPopulatedRoleIds;
  }

  async findAll(): Promise<UserWithPopulatedRoleIds[]> {
    /** Include super_admin accounts so they can appear as tutor options and in tutor name resolution. */
    const users = await this.userModel
      .find({})
      .sort({ createdAt: -1 })
      .populate('roleIds')
      .lean()
      .exec();
    return users as unknown as UserWithPopulatedRoleIds[];
  }

  async findOne(id: string): Promise<UserWithPopulatedRoleIds> {
    const user = await this.userModel.findById(id).populate('roleIds').lean().exec();
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    const roleIds = Array.isArray(user.roleIds) ? user.roleIds : [];
    if (this.hasSuperAdminRole(roleIds)) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user as unknown as UserWithPopulatedRoleIds;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserWithPopulatedRoleIds> {
    const existingUser = await this.userModel.findById(id).populate('roleIds').lean().exec();
    if (!existingUser) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    const existingRoleIds = Array.isArray(existingUser.roleIds) ? existingUser.roleIds : [];
    if (this.hasSuperAdminRole(existingRoleIds)) {
      throw new ForbiddenException('Cannot edit super_admin user');
    }
    if (updateUserDto.roleIds != null) {
      await this.validateRoleIds(updateUserDto.roleIds);
    }
    if (updateUserDto.email) {
      const existing = await this.userModel
        .findOne({ email: updateUserDto.email, _id: { $ne: id } })
        .exec();
      if (existing) {
        throw new ConflictException(`User with email ${updateUserDto.email} already exists`);
      }
    }
    const updatePayload: Record<string, unknown> = { ...updateUserDto };
    if (updateUserDto.roleIds != null) {
      updatePayload.roleIds = updateUserDto.roleIds.map((rid) => new Types.ObjectId(rid));
    }
    if (updateUserDto.tutorIds != null) {
      updatePayload.tutorIds = await this.validateTutorIds(updateUserDto.tutorIds);
    }
    const user = await this.userModel
      .findByIdAndUpdate(id, updatePayload, { new: true })
      .populate('roleIds')
      .lean()
      .exec();
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user as unknown as UserWithPopulatedRoleIds;
  }

  async remove(id: string): Promise<void> {
    const existingUser = await this.userModel.findById(id).populate('roleIds').lean().exec();
    if (!existingUser) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    const roleIds = Array.isArray(existingUser.roleIds) ? existingUser.roleIds : [];
    if (this.hasSuperAdminRole(roleIds)) {
      throw new ForbiddenException('Cannot delete super_admin user');
    }
    await this.userModel.findByIdAndDelete(id).exec();
  }
}
