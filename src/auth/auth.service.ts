import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    const { email, password, fullName, workspaceName } = dto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const workspace = await this.prisma.workspace.create({
      data: {
        name: workspaceName,
        users: {
          create: {
            fullName,
            email,
            password: hashedPassword,
          },
        },
      },
      include: {
        users: true,
      },
    });

    const user = workspace.users[0];
    const { password: _, ...userWithoutPassword } = user;
    const { users: __, ...workspaceWithoutUsers } = workspace;

    const token = jwt.sign(
      { userId: user.id, workspaceId: workspace.id },
      process.env.JWT_SECRET || 'super-secret-key-change-in-production',
      { expiresIn: '7d' },
    );

    return {
      user: userWithoutPassword,
      workspace: workspaceWithoutUsers,
      token,
    };
  }

  async login(dto: LoginDto) {
    const { email, password } = dto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { workspace: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = jwt.sign(
      { userId: user.id, workspaceId: user.workspaceId },
      process.env.JWT_SECRET || 'super-secret-key-change-in-production',
      { expiresIn: '7d' },
    );

    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
    };
  }
}
