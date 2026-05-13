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
  ) {}

  async seed(): Promise<void> {
    console.log('🌱 Starting database seeding...');

    // Create users
    const adminId = uuid();
    const cashierId = uuid();
    const kitchenStaffId = uuid();

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

    // Create categories
    const categoryData = [
      { name: 'Đồ Ăn Nhanh', sortOrder: 1 },
      { name: 'Đồ Uống', sortOrder: 2 },
      { name: 'Bánh', sortOrder: 3 },
      { name: 'Cơm', sortOrder: 4 },
      { name: 'Mì Pasta', sortOrder: 5 },
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

    // Create products
    const productData = [
      {
        category: categoryList[0],
        sku: 'BURGER001',
        name: 'Burger Gà',
        price: 35000,
        unit: 'cái',
      },
      {
        category: categoryList[0],
        sku: 'PIZZA001',
        name: 'Pizza Thịt',
        price: 45000,
        unit: 'cái',
      },
      {
        category: categoryList[1],
        sku: 'JUICE001',
        name: 'Nước Cam Tươi',
        price: 20000,
        unit: 'ly',
      },
      {
        category: categoryList[1],
        sku: 'MILKSHAKE001',
        name: 'Sữa Lắc Dâu',
        price: 25000,
        unit: 'ly',
      },
      {
        category: categoryList[2],
        sku: 'DONUT001',
        name: 'Bánh Donut',
        price: 15000,
        unit: 'cái',
      },
      {
        category: categoryList[3],
        sku: 'RICE001',
        name: 'Cơm Gà',
        price: 40000,
        unit: 'phần',
      },
      {
        category: categoryList[4],
        sku: 'PENNE001',
        name: 'Mì Penne Sốt Cà Chua',
        price: 50000,
        unit: 'phần',
      },
      {
        category: categoryList[1],
        sku: 'ICED_COFFEE001',
        name: 'Cà Phê Đen Đá',
        price: 18000,
        unit: 'ly',
      },
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
