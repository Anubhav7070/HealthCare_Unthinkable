import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Healthcare Manager database...');

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@healthcare.org' },
    update: {},
    create: {
      email: 'admin@healthcare.org',
      name: 'System Admin',
      passwordHash,
      role: 'ADMIN',
    },
  });
  console.log('Created Admin:', admin.email);

  // 2. Create Doctors
  const doctor1User = await prisma.user.upsert({
    where: { email: 'dr.smith@healthcare.org' },
    update: {},
    create: {
      email: 'dr.smith@healthcare.org',
      name: 'Dr. Sarah Smith',
      passwordHash,
      role: 'DOCTOR',
    },
  });

  const dr1Profile = await prisma.doctorProfile.upsert({
    where: { userId: doctor1User.id },
    update: {},
    create: {
      userId: doctor1User.id,
      specialisation: 'Cardiology',
      workingHoursStart: '09:00',
      workingHoursEnd: '17:00',
      slotDurationMinutes: 30,
      bio: 'Board-certified cardiologist with over 12 years of experience in cardiovascular wellness.',
    },
  });

  const doctor2User = await prisma.user.upsert({
    where: { email: 'dr.johnson@healthcare.org' },
    update: {},
    create: {
      email: 'dr.johnson@healthcare.org',
      name: 'Dr. Michael Johnson',
      passwordHash,
      role: 'DOCTOR',
    },
  });

  const dr2Profile = await prisma.doctorProfile.upsert({
    where: { userId: doctor2User.id },
    update: {},
    create: {
      userId: doctor2User.id,
      specialisation: 'Dermatology',
      workingHoursStart: '10:00',
      workingHoursEnd: '16:00',
      slotDurationMinutes: 30,
      bio: 'Specialist in clinical dermatology, skin cancer screening, and chronic allergy treatments.',
    },
  });

  // 3. Create Patient
  const patientUser = await prisma.user.upsert({
    where: { email: 'patient@example.com' },
    update: {},
    create: {
      email: 'patient@example.com',
      name: 'Alice Cooper',
      passwordHash,
      role: 'PATIENT',
    },
  });

  console.log('Database seeded successfully with default accounts:');
  console.log('Admin: admin@healthcare.org / password123');
  console.log('Doctor: dr.smith@healthcare.org / password123');
  console.log('Patient: patient@example.com / password123');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
