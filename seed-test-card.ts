import { createConnection } from 'typeorm';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import {
  User,
  Customer,
  StudentProfile,
  StudentCard,
  School,
  Class,
  Wallet,
} from './src/entities';

dotenv.config();

const seedTestCard = async () => {
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
    console.log('🌱 Starting seed for test card...');

    // 1. Create School if not exists
    let school = await connection.getRepository(School).findOne({
      where: { name: 'Test School' },
    });
    if (!school) {
      school = connection.getRepository(School).create({
        id: uuidv4(),
        name: 'Test School',
        address: '123 Test Street',
        status: 'ACTIVE',
      });
      await connection.getRepository(School).save(school);
      console.log('✅ School created:', school.id);
    } else {
      console.log('✅ School already exists:', school.id);
    }

    // 2. Create Class if not exists
    let classEntity = await connection.getRepository(Class).findOne({
      where: { name: 'Test Class A' },
    });
    if (!classEntity) {
      classEntity = connection.getRepository(Class).create({
        id: uuidv4(),
        name: 'Test Class A',
        schoolId: school.id,
        status: 'ACTIVE',
      });
      await connection.getRepository(Class).save(classEntity);
      console.log('✅ Class created:', classEntity.id);
    } else {
      console.log('✅ Class already exists:', classEntity.id);
    }

    // 3. Create User (STUDENT)
    const userEmail = 'teststudent@test.local';
    let user = await connection.getRepository(User).findOne({
      where: { email: userEmail },
    });
    if (!user) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      user = connection.getRepository(User).create({
        id: uuidv4(),
        email: userEmail,
        passwordHash: hashedPassword,
        fullName: 'Test Student',
        role: 'STUDENT',
        status: 'ACTIVE',
      });
      await connection.getRepository(User).save(user);
      console.log('✅ User created:', user.id, '(email:', userEmail + ')');
    } else {
      console.log('✅ User already exists:', user.id);
    }

    // 4. Create Customer
    let customer = await connection.getRepository(Customer).findOne({
      where: { userId: user.id },
    });
    if (!customer) {
      customer = connection.getRepository(Customer).create({
        customerCode: 'CUST-' + uuidv4().substring(0, 8),
        fullName: 'Test Student Customer',
        phone: '0123456789',
        type: 'STUDENT',
        status: 'ACTIVE',
        userId: user.id,
      });
      await connection.getRepository(Customer).save(customer);
      console.log('✅ Customer created:', customer.id);
    } else {
      console.log('✅ Customer already exists:', customer.id);
    }

    // 5. Create Wallet
    let wallet = await connection.getRepository(Wallet).findOne({
      where: { customerId: customer.id },
    });
    if (!wallet) {
      wallet = connection.getRepository(Wallet).create({
        id: uuidv4(),
        customerId: customer.id,
        balance: 500000, // 500k initial balance
        status: 'ACTIVE',
      });
      await connection.getRepository(Wallet).save(wallet);
      console.log('✅ Wallet created:', wallet.id, '(balance: 500,000)');
    } else {
      console.log('✅ Wallet already exists:', wallet.id);
    }

    // 6. Create StudentProfile
    let studentProfile = await connection.getRepository(StudentProfile).findOne({
      where: { customerId: customer.id },
    });
    if (!studentProfile) {
      studentProfile = connection.getRepository(StudentProfile).create({
        id: uuidv4(),
        customerId: customer.id,
        classId: classEntity.id,
        studentCode: 'STU001',
        fullName: 'Test Student Profile',
      });
      await connection.getRepository(StudentProfile).save(studentProfile);
      console.log('✅ StudentProfile created:', studentProfile.id);
    } else {
      console.log('✅ StudentProfile already exists:', studentProfile.id);
    }

    // 7. Create StudentCard
    const cardUid = '0089280076';
    let studentCard = await connection.getRepository(StudentCard).findOne({
      where: [{ cardUid }, { cardNumber: cardUid }],
    });
    if (!studentCard) {
      studentCard = connection.getRepository(StudentCard).create({
        id: uuidv4(),
        studentProfileId: studentProfile.id,
        cardUid,
        cardNumber: cardUid,
        status: 'ACTIVE',
        issuedAt: new Date(),
        expiredAt: new Date(new Date().getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      });
      await connection.getRepository(StudentCard).save(studentCard);
      console.log('✅ StudentCard created:', studentCard.id);
    } else {
      console.log('✅ StudentCard already exists:', studentCard.id);
    }

    console.log('\n✅ Seed completed successfully!');
    console.log('\n📋 Test Data Summary:');
    console.log('├─ User Email:', userEmail);
    console.log('├─ User ID:', user.id);
    console.log('├─ Customer ID:', customer.id);
    console.log('├─ StudentProfile ID:', studentProfile.id);
    console.log('├─ RFID/Card ID string:', cardUid);
    console.log('├─ StudentCard ID:', studentCard.id);
    console.log('└─ Wallet Balance:', '500,000');
    console.log('\n🧪 Test Login:');
    console.log('POST http://localhost:3002/auth/login-card');
    console.log('Body: {"cardId":"0089280076"}');
  } catch (error) {
    console.error('❌ Seed error:', error);
  } finally {
    await connection.close();
  }
};

seedTestCard();
