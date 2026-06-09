import { createConnection } from 'typeorm';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { Employee, WorkSchedule } from './src/entities';

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

    const employeeRepository = connection.getRepository(Employee);
    const workScheduleRepository = connection.getRepository(WorkSchedule);
    const seededEmployees: Employee[] = [];

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
      let employee = await employeeRepository.findOne({
        where: { code: employeeData.code },
      });

      if (!employee) {
        employee = employeeRepository.create({
          id: uuidv4(),
          ...employeeData,
        });
        await employeeRepository.save(employee);
        console.log('✅ Employee created:', employee.code, '-', employee.fullName);
      } else {
        Object.assign(employee, employeeData);
        await employeeRepository.save(employee);
        console.log('✅ Employee updated:', employee.code, '-', employee.fullName);
      }

      seededEmployees.push(employee);
    }

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const today = new Date();
    const currentDay = today.getDay() === 0 ? 7 : today.getDay();
    const monday = new Date(today);
    monday.setHours(12, 0, 0, 0);
    monday.setDate(today.getDate() - currentDay + 1);

    const schedulePatterns = [
      ['full', 'morning', 'full', 'afternoon', 'full', null, null],
      ['morning', 'afternoon', 'full', 'morning', 'afternoon', null, null],
    ];

    for (const [employeeIndex, employee] of seededEmployees.entries()) {
      const pattern = schedulePatterns[employeeIndex] || schedulePatterns[0];

      for (const [dayIndex, shift] of pattern.entries()) {
        if (!shift) continue;

        const workDate = new Date(monday);
        workDate.setDate(monday.getDate() + dayIndex);
        const workDateString = formatDate(workDate);

        let workSchedule = await workScheduleRepository.findOne({
          where: {
            employeeId: employee.id,
            workDate: workDateString,
          },
        });

        if (!workSchedule) {
          workSchedule = workScheduleRepository.create({
            id: uuidv4(),
            employeeId: employee.id,
            workDate: workDateString,
            shift,
            note: 'Dữ liệu mẫu chấm công',
          });
        } else {
          workSchedule.shift = shift;
          workSchedule.note = 'Dữ liệu mẫu chấm công';
        }

        await workScheduleRepository.save(workSchedule);
      }
    }

    console.log('\n✅ Seed completed successfully!');
    console.log('\n📋 Test Employees:');
    for (const employee of employees) {
      console.log(`├─ ${employee.code} | ${employee.fullName} | ${employee.status}`);
    }
    console.log('\n📅 Test Time-sheet:');
    console.log(`└─ Seeded work schedules for week ${formatDate(monday)}`);
  } catch (error) {
    console.error('❌ Seed error:', error);
  } finally {
    await connection.close();
  }
};

seedTestEmployees();
