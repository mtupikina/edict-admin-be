import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument, UserRole } from './schemas/user.schema';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultUser();
  }

  async isUserAllowed(email: string): Promise<boolean> {
    const user = await this.userModel.findOne({ email }).exec();
    return !!user;
  }

  async findOneByEmail(email: string): Promise<User | null> {
    const user = await this.userModel.findOne({ email }).lean().exec();
    return user as User | null;
  }

  async seedDefaultUser(): Promise<void> {
    const defaultEmail = 'mmylymuk@gmail.com';
    const exists = await this.userModel.findOne({ email: defaultEmail }).exec();
    if (!exists) {
      await this.userModel.create({
        firstName: 'Default',
        lastName: 'Admin',
        email: defaultEmail,
        role: UserRole.SUPER_ADMIN,
      });
      console.log(`Seeded default user: ${defaultEmail}`);
    }
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    if (createUserDto.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot create super_admin user');
    }
    const existing = await this.userModel.findOne({ email: createUserDto.email }).exec();
    if (existing) {
      throw new ConflictException(`User with email ${createUserDto.email} already exists`);
    }
    const user = await this.userModel.create(createUserDto);
    return user.toObject();
  }

  async findAll(): Promise<User[]> {
    const users = await this.userModel
      .find({ role: { $ne: UserRole.SUPER_ADMIN } })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return users as User[];
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userModel.findById(id).lean().exec();
    if (!user || (user as User & { role: UserRole }).role === UserRole.SUPER_ADMIN) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user as User;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const existingUser = await this.userModel.findById(id).lean().exec();
    if (!existingUser) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    if ((existingUser as User & { role: UserRole }).role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot edit super_admin user');
    }
    if (updateUserDto.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot assign super_admin role');
    }
    if (updateUserDto.email) {
      const existing = await this.userModel
        .findOne({ email: updateUserDto.email, _id: { $ne: id } })
        .exec();
      if (existing) {
        throw new ConflictException(`User with email ${updateUserDto.email} already exists`);
      }
    }
    const user = await this.userModel
      .findByIdAndUpdate(id, updateUserDto, { new: true })
      .lean()
      .exec();
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user as User;
  }

  async remove(id: string): Promise<void> {
    const existingUser = await this.userModel.findById(id).lean().exec();
    if (!existingUser) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    if ((existingUser as User & { role: UserRole }).role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot delete super_admin user');
    }
    await this.userModel.findByIdAndDelete(id).exec();
  }
}
