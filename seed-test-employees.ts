import { createConnection } from 'typeorm';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { Employee } from './src/entities';

dotenv.config();

const seedTestEmployees = async () => {
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
    console.log('🌱 Starting seed for test employees...');

    const employees = [
      {
        code: 'NV000001',
        timekeepingCode: 'CC001',
        fullName: 'Nguyễn Văn A',
        phone: '0901000001',
        cccd: '079123456001',
        debt: 0,
        note: 'Nhân viên test',
        status: 'working',
      },
      {
        code: 'NV000002',
        timekeepingCode: 'CC002',
        fullName: 'Trần Thị B',
        phone: '0901000002',
        cccd: '079123456002',
        debt: 50000,
        note: 'Nhân viên test',
        status: 'working',
      },
    ];

    for (const employeeData of employees) {
      let employee = await connection.getRepository(Employee).findOne({
        where: { code: employeeData.code },
      });

      if (!employee) {
        employee = connection.getRepository(Employee).create({
          id: uuidv4(),
          ...employeeData,
        });
        await connection.getRepository(Employee).save(employee);
        console.log('✅ Employee created:', employee.code, '-', employee.fullName);
      } else {
        Object.assign(employee, employeeData);
        await connection.getRepository(Employee).save(employee);
        console.log('✅ Employee updated:', employee.code, '-', employee.fullName);
      }
    }

    console.log('\n✅ Seed completed successfully!');
    console.log('\n📋 Test Employees:');
    for (const employee of employees) {
      console.log(`├─ ${employee.code} | ${employee.fullName} | ${employee.status}`);
    }
  } catch (error) {
    console.error('❌ Seed error:', error);
  } finally {
    await connection.close();
  }
};

seedTestEmployees();
