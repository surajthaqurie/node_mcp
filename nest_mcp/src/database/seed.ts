/**
 * seed.ts
 * --------
 * Seeds the database with:
 *   - 1 Super Admin  (all permissions)
 *   - 3 Managers     (user:read + all task permissions)
 *   - 16 Users       (varied task permission subsets)
 *
 * Run: npm run db:seed
 */

import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { AppDataSource } from './data-source';
import { User } from '../modules/users/entities/user.entity';
import { Role } from '../common/enums/role.enum';
import { Permission } from '../common/enums/permission.enum';

// ─── Permission presets per role ────────────────────────────────────────────

const ADMIN_PERMISSIONS: Permission[] = Object.values(Permission);

const MANAGER_PERMISSIONS: Permission[] = [
  Permission.USER_READ,
  Permission.TASK_READ,
  Permission.TASK_CREATE,
  Permission.TASK_UPDATE,
  Permission.TASK_DELETE,
  Permission.COMMENT_READ,
  Permission.COMMENT_CREATE,
  Permission.COMMENT_UPDATE,
  Permission.COMMENT_DELETE,
  Permission.PERMISSION_MANAGE,
];

// Different permission tiers for regular users
const USER_PRESETS: Permission[][] = [
  // Tier 1 – read only
  [Permission.TASK_READ, Permission.COMMENT_READ],

  // Tier 2 – task creator & commenter
  [
    Permission.TASK_READ,
    Permission.TASK_CREATE,
    Permission.COMMENT_READ,
    Permission.COMMENT_CREATE,
  ],

  // Tier 3 – task editor & commenter
  [
    Permission.TASK_READ,
    Permission.TASK_CREATE,
    Permission.TASK_UPDATE,
    Permission.COMMENT_READ,
    Permission.COMMENT_CREATE,
    Permission.COMMENT_UPDATE,
  ],

  // Tier 4 – full task & comment access
  [
    Permission.TASK_READ,
    Permission.TASK_CREATE,
    Permission.TASK_UPDATE,
    Permission.TASK_DELETE,
    Permission.COMMENT_READ,
    Permission.COMMENT_CREATE,
    Permission.COMMENT_UPDATE,
    Permission.COMMENT_DELETE,
  ],
];

// ─── Seed data ───────────────────────────────────────────────────────────────

interface SeedUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Role;
  permissions: Permission[];
}

function buildSeedUsers(): SeedUser[] {
  const users: SeedUser[] = [];

  // 1 Admin
  users.push({
    firstName: 'Super',
    lastName: 'Admin',
    email: 'admin@nest-mcp.com',
    password: 'Admin@12345',
    role: Role.ADMIN,
    permissions: ADMIN_PERMISSIONS,
  });

  // 3 Managers
  const managers = [
    { firstName: 'Alice', lastName: 'Morgan' },
    { firstName: 'Bob', lastName: 'Carter' },
    { firstName: 'Carol', lastName: 'Reed' },
  ];

  managers.forEach((m, i) => {
    users.push({
      ...m,
      email: `manager${i + 1}@nest-mcp.com`,
      password: 'Manager@12345',
      role: Role.MANAGER,
      permissions: MANAGER_PERMISSIONS,
    });
  });

  // 16 Regular users — 4 per preset tier
  const firstNames = [
    'David',
    'Emma',
    'Frank',
    'Grace',
    'Henry',
    'Isabel',
    'James',
    'Karen',
    'Liam',
    'Mia',
    'Noah',
    'Olivia',
    'Paul',
    'Quinn',
    'Ryan',
    'Sara',
  ];
  const lastNames = [
    'Smith',
    'Jones',
    'Brown',
    'Davis',
    'Wilson',
    'Taylor',
    'Anderson',
    'Thomas',
    'Jackson',
    'White',
    'Harris',
    'Martin',
    'Thompson',
    'Garcia',
    'Martinez',
    'Robinson',
  ];

  firstNames.forEach((firstName, i) => {
    users.push({
      firstName,
      lastName: lastNames[i],
      email: `user${i + 1}@nest-mcp.com`,
      password: 'User@12345',
      role: Role.USER,
      permissions: USER_PRESETS[i % USER_PRESETS.length],
    });
  });

  return users;
}

// ─── Runner ──────────────────────────────────────────────────────────────────

async function seed(dataSource: DataSource): Promise<void> {
  const userRepo = dataSource.getRepository(User);
  const seedUsers = buildSeedUsers();
  let created = 0;
  let skipped = 0;

  console.log(`\n🌱 Seeding ${seedUsers.length} users...\n`);

  for (const data of seedUsers) {
    const existing = await userRepo.findOne({ where: { email: data.email } });

    if (existing) {
      console.log(`  ⏭️  Skipped  ${data.email} (already exists)`);
      skipped++;
      continue;
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = userRepo.create({
      ...data,
      password: hashedPassword,
    });

    await userRepo.save(user);
    console.log(
      `  ✅ Created ${data.role.padEnd(7)} ${data.email.padEnd(30)} [${data.permissions.length} permissions]`,
    );
    created++;
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`  Created : ${created}`);
  console.log(`  Skipped : ${skipped}`);
  console.log(`  Total   : ${seedUsers.length}`);
  console.log(`─────────────────────────────────────────\n`);
}

async function main(): Promise<void> {
  let dataSource: DataSource | null = null;

  try {
    dataSource = await AppDataSource.initialize();
    console.log('🔌 Connected to database.');
    await seed(dataSource);
    console.log('✅ Seeding complete.');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  }
}

void main();
