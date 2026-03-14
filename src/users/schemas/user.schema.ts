import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type UserDocument = User & Document;

/** Role document as returned when roleIds are populated (from roles collection). */
export interface PopulatedRole {
  _id: Types.ObjectId;
  name: string;
  description?: string;
}

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({
    type: [MongooseSchema.Types.ObjectId],
    ref: 'Role',
    required: true,
  })
  roleIds: Types.ObjectId[];

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

/** User with roleIds populated as full role objects (raw API response shape). */
export type UserWithPopulatedRoleIds = Omit<User, 'roleIds'> & { roleIds: PopulatedRole[] };

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});
