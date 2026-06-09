import { createConnection } from 'typeorm';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User, Branch } from './src/entities';

dotenv.config();

const seedTestManager = async () => {
  const connection = await createConnection({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || process.env.DB_NAME || 'pos_system',
    entities: ['src/entities/**/*.ts'],
    synchronize: false,
    logging: false,
  });

  try {
    console.log('🌱 Starting seed for test manager...');

    let branch = await connection.getRepository(Branch).findOne({
      where: { name: 'Test Branch' },
    });

    if (!branch) {
      branch = connection.getRepository(Branch).create({
        id: uuidv4(),
        name: 'Test Branch',
        address: '123 Test Branch Street',
        status: 'ACTIVE',
      });
      await connection.getRepository(Branch).save(branch);
      console.log('✅ Branch created:', branch.id);
    } else {
      console.log('✅ Branch already exists:', branch.id);
    }

    const email = 'manager.test@mbh.local';
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    let user = await connection.getRepository(User).findOne({
      where: { email },
    });

    if (!user) {
      user = connection.getRepository(User).create({
        id: uuidv4(),
        email,
        passwordHash: hashedPassword,
        fullName: 'Test Manager',
        role: 'MANAGER',
        status: 'ACTIVE',
        branchId: branch.id,
      });
      await connection.getRepository(User).save(user);
      console.log('✅ Manager created:', user.id);
    } else {
      user.passwordHash = hashedPassword;
      user.fullName = 'Test Manager';
      user.role = 'MANAGER';
      user.status = 'ACTIVE';
      user.branchId = branch.id;
      await connection.getRepository(User).save(user);
      console.log('✅ Manager updated:', user.id);
    }

    console.log('\n✅ Seed completed successfully!');
    console.log('\n📋 Test Manager Account:');
    console.log('├─ Email:', email);
    console.log('├─ Password:', password);
    console.log('├─ Role: MANAGER');
    console.log('├─ Branch:', branch.name);
    console.log('└─ Login endpoint: POST /auth/login/admin');
  } catch (error) {
    console.error('❌ Seed error:', error);
  } finally {
    await connection.close();
  }
};

seedTestManager();
