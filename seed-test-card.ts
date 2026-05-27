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

    const seedStudents = [
      {
        cardId: '5000',
        walletBalance: 5000,
        email: 'teststudent5000@test.local',
        fullName: 'Test Student 5000',
        customerCode: 'CUST-TEST-5000',
        phone: '0500050000',
        studentCode: 'STU5000',
      },
      {
        cardId: '10000',
        walletBalance: 10000,
        email: 'teststudent10000@test.local',
        fullName: 'Test Student 10000',
        customerCode: 'CUST-TEST-10000',
        phone: '0100010000',
        studentCode: 'STU10000',
      },
    ];

    const seededRecords: Array<{
      user: User;
      customer: Customer;
      wallet: Wallet;
      studentProfile: StudentProfile;
      studentCard: StudentCard;
      cardId: string;
    }> = [];

    for (const seedStudent of seedStudents) {
      console.log('\nSeeding test student for card:', seedStudent.cardId);

      let user = await connection.getRepository(User).findOne({
        where: { email: seedStudent.email },
      });
      if (!user) {
        const hashedPassword = await bcrypt.hash('password123', 10);
        user = connection.getRepository(User).create({
          id: uuidv4(),
          email: seedStudent.email,
          passwordHash: hashedPassword,
          fullName: seedStudent.fullName,
          role: 'STUDENT',
          status: 'ACTIVE',
        });
        await connection.getRepository(User).save(user);
        console.log('✅ User created:', user.id, '(email:', seedStudent.email + ')');
      } else {
        console.log('✅ User already exists:', user.id);
      }

      let customer = await connection.getRepository(Customer).findOne({
        where: { userId: user.id },
      });
      if (!customer) {
        customer = connection.getRepository(Customer).create({
          customerCode: seedStudent.customerCode,
          fullName: seedStudent.fullName,
          phone: seedStudent.phone,
          type: 'STUDENT',
          status: 'ACTIVE',
          userId: user.id,
        });
        await connection.getRepository(Customer).save(customer);
        console.log('✅ Customer created:', customer.id);
      } else {
        console.log('✅ Customer already exists:', customer.id);
      }

      let wallet = await connection.getRepository(Wallet).findOne({
        where: { customerId: customer.id },
      });
      if (!wallet) {
        wallet = connection.getRepository(Wallet).create({
          id: uuidv4(),
          customerId: customer.id,
          balance: seedStudent.walletBalance,
          status: 'ACTIVE',
        });
        await connection.getRepository(Wallet).save(wallet);
        console.log('✅ Wallet created:', wallet.id, '(balance:', seedStudent.walletBalance + ')');
      } else {
        wallet.balance = seedStudent.walletBalance;
        wallet.status = 'ACTIVE';
        await connection.getRepository(Wallet).save(wallet);
        console.log('✅ Wallet updated:', wallet.id, '(balance:', seedStudent.walletBalance + ')');
      }

      let studentProfile = await connection.getRepository(StudentProfile).findOne({
        where: { customerId: customer.id },
      });
      if (!studentProfile) {
        studentProfile = connection.getRepository(StudentProfile).create({
          id: uuidv4(),
          customerId: customer.id,
          classId: classEntity.id,
          studentCode: seedStudent.studentCode,
          fullName: seedStudent.fullName,
        });
        await connection.getRepository(StudentProfile).save(studentProfile);
        console.log('✅ StudentProfile created:', studentProfile.id);
      } else {
        studentProfile.classId = classEntity.id;
        studentProfile.studentCode = seedStudent.studentCode;
        studentProfile.fullName = seedStudent.fullName;
        await connection.getRepository(StudentProfile).save(studentProfile);
        console.log('✅ StudentProfile updated:', studentProfile.id);
      }

      let studentCard = await connection.getRepository(StudentCard).findOne({
        where: [{ cardUid: seedStudent.cardId }, { cardNumber: seedStudent.cardId }],
      });
      if (!studentCard) {
        studentCard = connection.getRepository(StudentCard).create({
          id: uuidv4(),
          studentProfileId: studentProfile.id,
          cardUid: seedStudent.cardId,
          cardNumber: seedStudent.cardId,
          status: 'ACTIVE',
          issuedAt: new Date(),
          expiredAt: new Date(new Date().getTime() + 365 * 24 * 60 * 60 * 1000),
        });
        await connection.getRepository(StudentCard).save(studentCard);
        console.log('✅ StudentCard created:', studentCard.id, '(card:', seedStudent.cardId + ')');
      } else {
        studentCard.studentProfileId = studentProfile.id;
        studentCard.cardUid = seedStudent.cardId;
        studentCard.cardNumber = seedStudent.cardId;
        studentCard.status = 'ACTIVE';
        await connection.getRepository(StudentCard).save(studentCard);
        console.log('✅ StudentCard updated:', studentCard.id, '(card:', seedStudent.cardId + ')');
      }

      seededRecords.push({
        user,
        customer,
        wallet,
        studentProfile,
        studentCard,
        cardId: seedStudent.cardId,
      });
    }

    console.log('\n✅ Seed completed successfully!');
    console.log('\n📋 Test Data Summary:');
    for (const record of seededRecords) {
      console.log('├─ Card ID:', record.cardId);
      console.log('│  ├─ User Email:', record.user.email);
      console.log('│  ├─ StudentCode:', record.studentProfile.studentCode);
      console.log('│  ├─ User ID:', record.user.id);
      console.log('│  ├─ Customer ID:', record.customer.id);
      console.log('│  ├─ StudentProfile ID:', record.studentProfile.id);
      console.log('│  ├─ StudentCard ID:', record.studentCard.id);
      console.log('│  └─ Wallet Balance:', record.wallet.balance);
    }
    console.log('\n🧪 Test Login Options:');
    console.log('\n1. Login by Card (no password):');
    console.log('POST http://localhost:3002/auth/login/student');
    console.log('Body: {"cardId":"5000"}');
    console.log('Body: {"cardId":"10000"}');
    console.log('\n2. Login by Email/Password:');
    console.log('POST http://localhost:3002/auth/login/student');
    console.log('Body: {"username":"teststudent5000@test.local","password":"password123"}');
    console.log('Body: {"username":"teststudent10000@test.local","password":"password123"}');
    console.log('\n3. Login by StudentCode/Password:');
    console.log('POST http://localhost:3002/auth/login/student');
    console.log('Body: {"username":"STU5000","password":"password123"}');
    console.log('Body: {"username":"STU10000","password":"password123"}');
  } catch (error) {
    console.error('❌ Seed error:', error);
  } finally {
    await connection.close();
  }
};

seedTestCard();
