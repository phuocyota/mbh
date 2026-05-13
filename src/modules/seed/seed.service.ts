import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  User,
  Branch,
  POSDevice,
  Customer,
  Card,
  Wallet,
  Category,
  Product,
  StudentProfile,
  School,
  Class,
  StudentClass,
} from '../../entities';
import { v4 as uuid } from 'uuid';

@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Branch)
    private branchRepository: Repository<Branch>,
    @InjectRepository(POSDevice)
    private posDeviceRepository: Repository<POSDevice>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Card)
    private cardRepository: Repository<Card>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(StudentProfile)
    private studentProfileRepository: Repository<StudentProfile>,
    @InjectRepository(School)
    private schoolRepository: Repository<School>,
    @InjectRepository(Class)
    private classRepository: Repository<Class>,
    @InjectRepository(StudentClass)
    private studentClassRepository: Repository<StudentClass>,
  ) {}

  async seed(): Promise<void> {
    console.log('🌱 Starting database seeding...');

    // Create users
    const adminId = uuid();
    const cashierId = uuid();
    const kitchenStaffId = uuid();

    const studentId = uuid();
    const users = [
      {
        id: adminId,
        fullName: 'Admin User',
        email: 'admin@pos.local',
        phone: '0901000001',
        passwordHash: await bcrypt.hash('admin123', 10),
        role: 'ADMIN',
        status: 'ACTIVE',
      },
      {
        id: cashierId,
        fullName: 'Cashier 1',
        email: 'cashier1@pos.local',
        phone: '0901000002',
        passwordHash: await bcrypt.hash('cashier123', 10),
        role: 'CASHIER',
        status: 'ACTIVE',
      },
      {
        id: kitchenStaffId,
        fullName: 'Kitchen Staff 1',
        email: 'kitchen1@pos.local',
        phone: '0901000003',
        passwordHash: await bcrypt.hash('kitchen123', 10),
        role: 'KITCHEN',
        status: 'ACTIVE',
      },
      {
        id: studentId,
        fullName: 'Student User',
        email: 'student1@pos.local',
        phone: '0901000004',
        passwordHash: await bcrypt.hash('student123', 10),
        role: 'STUDENT',
        status: 'ACTIVE',
        cardId: '0089280076',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=student1',
      },
    ];

    for (const user of users) {
      const existingUser = await this.userRepository.findOne({
        where: { email: user.email },
      });
      if (!existingUser) {
        await this.userRepository.save(user);
      }
    }
    console.log('✅ Users seeded');

    // Create branches
    const branchId = uuid();
    const branches = [
      {
        id: branchId,
        name: 'Canteen Trường Học A',
        address: '123 Đường ABC, Thành Phố XYZ',
        status: 'ACTIVE',
      },
      {
        id: uuid(),
        name: 'Canteen Trường Học B',
        address: '456 Đường DEF, Thành Phố XYZ',
        status: 'ACTIVE',
      },
    ];

    for (const branch of branches) {
      const existingBranch = await this.branchRepository.findOne({
        where: { id: branch.id },
      });
      if (!existingBranch) {
        await this.branchRepository.save(branch);
      }
    }
    console.log('✅ Branches seeded');

    // Create POS devices
    const posDevices = [
      {
        id: uuid(),
        branchId: branchId,
        deviceCode: 'POS001',
        deviceName: 'POS Quầy 1',
        deviceType: 'DESKTOP_POS',
        status: 'ACTIVE',
      },
      {
        id: uuid(),
        branchId: branchId,
        deviceCode: 'POS002',
        deviceName: 'POS Quầy 2',
        deviceType: 'DESKTOP_POS',
        status: 'ACTIVE',
      },
      {
        id: uuid(),
        branchId: branchId,
        deviceCode: 'HANDHELD001',
        deviceName: 'Thiết Bị Cầm Tay 1',
        deviceType: 'HANDHELD',
        status: 'ACTIVE',
      },
    ];

    for (const device of posDevices) {
      const existingDevice = await this.posDeviceRepository.findOne({
        where: { deviceCode: device.deviceCode },
      });
      if (!existingDevice) {
        await this.posDeviceRepository.save(device);
      }
    }
    console.log('✅ POS Devices seeded');

    // Create school: Trường Tiểu học Chi Lăng
    let schoolId = uuid();
    const existingSchool = await this.schoolRepository.findOne({
      where: { name: 'Trường Tiểu học Chi Lăng' },
    });
    if (!existingSchool) {
      await this.schoolRepository.save({
        id: schoolId,
        name: 'Trường Tiểu học Chi Lăng',
        address: 'Xã Chi Lăng, Huyện Chi Lăng, Tỉnh Lạng Sơn',
        phone: '0205-xxx-xxxx',
        status: 'ACTIVE',
      });
    } else {
      schoolId = existingSchool.id;
    }
    console.log('✅ School seeded: Trường Tiểu học Chi Lăng');

    // Create classes for the school
    const classNames = ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '4/3', '5A', '5B'];
    const classIds: string[] = [];
    for (const className of classNames) {
      const classId = uuid();
      const existingClass = await this.classRepository.findOne({
        where: { name: className, schoolId },
      });
      if (!existingClass) {
        await this.classRepository.save({
          id: classId,
          name: className,
          schoolId,
          grade: className[0],
          status: 'ACTIVE',
        });
        classIds.push(classId);
      } else {
        classIds.push(existingClass.id);
      }
    }
    console.log(`✅ Classes seeded: ${classNames.length} classes`);

    // Create customers
    const customers: any[] = [];
    for (let i = 1; i <= 10; i++) {
      const customerId = uuid();
      customers.push({
        id: customerId,
        customerCode: `STU${String(i).padStart(5, '0')}`,
        fullName: `Học Sinh ${i}`,
        phone: `090100000${i}`,
        type: 'STUDENT',
        status: 'ACTIVE',
        userId: i === 1 ? studentId : null, // Link first customer to student user
      });
    }

    for (const customer of customers) {
      const existingCustomer = await this.customerRepository.findOne({
        where: { customerCode: customer.customerCode },
      });
      if (!existingCustomer) {
        await this.customerRepository.save(customer);
      }
    }
    console.log('✅ Customers seeded');

    // Create cards and wallets for customers
    const savedCustomers = await this.customerRepository.find();
    for (const customer of savedCustomers) {
      // Create card
      const existingCard = await this.cardRepository.findOne({
        where: { customerId: customer.id },
      });
      if (!existingCard) {
        const card = {
          id: uuid(),
          customerId: customer.id,
          cardUid: `NFC${customer.customerCode}`,
          cardNumber: `CARD${customer.customerCode}`,
          status: 'ACTIVE',
          issuedAt: new Date(),
        };
        await this.cardRepository.save(card);
      }

      // Create wallet
      const existingWallet = await this.walletRepository.findOne({
        where: { customerId: customer.id },
      });
      if (!existingWallet) {
        const wallet = {
          id: uuid(),
          customerId: customer.id,
          balance: Math.random() * 500000, // Random balance 0-500k
          status: 'ACTIVE',
        };
        await this.walletRepository.save(wallet);
      }
    }
    console.log('✅ Cards and Wallets seeded');

    // Create student profiles for STUDENT type customers
    const savedStudents = await this.customerRepository.find({
      where: { type: 'STUDENT' },
    });

    // Find class 4/3 index for first student
    const class43Index = classNames.indexOf('4/3');
    const class43Id = classIds[class43Index];

    for (const customer of savedStudents) {
      const isFirstStudent = customer.customerCode === 'STU00001';
      const assignedClassId = isFirstStudent && class43Id
        ? class43Id
        : (classIds[Math.floor(Math.random() * classIds.length)] || classIds[0]);

      const existingProfile = await this.studentProfileRepository.findOne({
        where: { customerId: customer.id },
      });

      if (!existingProfile) {
        // Create new profile
        const profile = {
          id: uuid(),
          customerId: customer.id,
          schoolId: schoolId,
          classId: assignedClassId,
          studentCode: customer.customerCode,
          parentPhone: `090200000${Math.floor(Math.random() * 9) + 1}`,
        };
        await this.studentProfileRepository.save(profile);
      } else if (isFirstStudent && class43Id) {
        // Force update first student to class 4/3
        await this.studentProfileRepository.update(
          { id: existingProfile.id },
          { classId: class43Id, schoolId: schoolId }
        );
      }
    }
    console.log('✅ Student Profiles seeded');

    // Create student-class relationships (n-n)
    const allStudents = await this.customerRepository.find({
      where: { type: 'STUDENT' },
    });
    const allClasses = await this.classRepository.find();

    // Find class 4/3 specifically
    const class43 = allClasses.find(c => c.name === '4/3');

    for (const student of allStudents) {
      const isFirstStudent = student.customerCode === 'STU00001';
      const targetClassId = isFirstStudent && class43
        ? class43.id
        : allClasses[Math.floor(Math.random() * allClasses.length)]?.id;

      const existingStudentClass = await this.studentClassRepository.findOne({
        where: { studentId: student.id, year: '2024-2025' },
      });

      if (!existingStudentClass && targetClassId) {
        // Create new student-class relationship
        await this.studentClassRepository.save({
          id: uuid(),
          studentId: student.id,
          classId: targetClassId,
          year: '2024-2025',
          status: 'ACTIVE',
        });
      } else if (existingStudentClass && isFirstStudent && class43) {
        // Force update first student to class 4/3
        await this.studentClassRepository.update(
          { id: existingStudentClass.id },
          { classId: class43.id }
        );
      }
    }
    console.log('✅ Student-Class relationships seeded');

    // Create categories
    const categoryData = [
      { name: 'Kẹo', sortOrder: 1 },
      { name: 'Phụ kiện', sortOrder: 2 },
      { name: 'Snack', sortOrder: 3 },
      { name: 'Ăn vặt', sortOrder: 4 },
      { name: 'Sữa', sortOrder: 5 },
      { name: 'Nước', sortOrder: 6 },
      { name: 'Học tập', sortOrder: 7 },
      { name: 'Tiện ích', sortOrder: 8 },
      { name: 'Đồ chơi', sortOrder: 9 },
    ];

    const categoryList: any[] = [];
    for (const cat of categoryData) {
      const existingCategory = await this.categoryRepository.findOne({
        where: { name: cat.name },
      });
      if (!existingCategory) {
        const category = await this.categoryRepository.save({
          id: uuid(),
          name: cat.name,
          sortOrder: cat.sortOrder,
          status: 'ACTIVE',
        });
        categoryList.push(category);
      } else {
        categoryList.push(existingCategory);
      }
    }
    console.log('✅ Categories seeded');

    // Create products (match FE product list)
    const productData = [
      // ===== Kẹo (0) - 5K =====
      { category: categoryList[0], sku: 'KEO001', name: 'Kẹo mút', price: 5000, unit: 'cây' },
      { category: categoryList[0], sku: 'KEO002', name: 'Kẹo viên', price: 5000, unit: 'gói' },
      // ===== Phụ kiện (1) - 5K =====
      { category: categoryList[1], sku: 'PHUKIEN001', name: 'Sticker', price: 5000, unit: 'tấm' },
      { category: categoryList[1], sku: 'PHUKIEN002', name: 'Ghim cài áo', price: 5000, unit: 'cái' },
      // ===== Snack (2) - 10K =====
      { category: categoryList[2], sku: 'SNACK001', name: 'Bánh snack', price: 10000, unit: 'gói' },
      // ===== Ăn vặt (3) - 10K =====
      { category: categoryList[3], sku: 'ANVAT001', name: 'Thạch rau câu', price: 10000, unit: 'cái' },
      // ===== Sữa (4) - 10K =====
      { category: categoryList[4], sku: 'SUA001', name: 'Sữa chua nhỏ', price: 10000, unit: 'hộp' },
      // ===== Nước (5) - 10K =====
      { category: categoryList[5], sku: 'NUOC001', name: 'Nước suối', price: 10000, unit: 'chai' },
      // ===== Học tập (6) =====
      { category: categoryList[6], sku: 'HOCTAP001', name: 'Tập', price: 10000, unit: 'quyển' },
      { category: categoryList[6], sku: 'HOCTAP002', name: 'Bút chì', price: 10000, unit: 'cây' },
      { category: categoryList[6], sku: 'HOCTAP003', name: 'Bút thú', price: 10000, unit: 'cây' },
      { category: categoryList[6], sku: 'HOCTAP004', name: 'Thước con thú', price: 5000, unit: 'cái' },
      // ===== Tiện ích (7) =====
      { category: categoryList[7], sku: 'TIENICH001', name: 'Quạt cầm tay', price: 5000, unit: 'cái' },
      { category: categoryList[7], sku: 'TIENICH002', name: 'Bút quạt', price: 10000, unit: 'cây' },
      // ===== Đồ chơi (8) =====
      { category: categoryList[8], sku: 'DOCHOI001', name: 'Mô hình lắp ráp', price: 10000, unit: 'bộ' },
    ];

    for (const prod of productData) {
      const existingProduct = await this.productRepository.findOne({
        where: { sku: prod.sku },
      });
      if (!existingProduct) {
        await this.productRepository.save({
          id: uuid(),
          categoryId: prod.category.id,
          sku: prod.sku,
          name: prod.name,
          price: prod.price,
          costPrice: prod.price * 0.4, // 40% cost
          unit: prod.unit,
          isActive: true,
        });
      }
    }
    console.log('✅ Products seeded');

    console.log('🎉 Database seeding completed!');
  }
}
