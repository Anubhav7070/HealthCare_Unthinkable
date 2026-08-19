import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key';

export class AuthController {
  public static async register(req: Request, res: Response) {
    try {
      const { email, password, name, role } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Name, email, and password are required.' });
      }

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: 'User with this email already exists.' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userRole = role && ['PATIENT', 'DOCTOR', 'ADMIN'].includes(role) ? role : 'PATIENT';

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: userRole,
        },
      });

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.status(201).json({
        message: 'User registered successfully',
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
    } catch (err: any) {
      console.error('Register error:', err);
      return res.status(500).json({ error: err?.message || 'Server error during registration' });
    }
  }

  public static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const user = await prisma.user.findUnique({
        where: { email },
        include: { doctorProfile: true },
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          doctorId: user.doctorProfile?.id || null,
        },
      });
    } catch (err: any) {
      console.error('Login error:', err);
      return res.status(500).json({ error: err?.message || 'Server error during login' });
    }
  }

  public static async me(req: any, res: Response) {
    try {
      const userId = req.user.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { doctorProfile: true },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      return res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          doctorId: user.doctorProfile?.id || null,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to retrieve profile' });
    }
  }
}
