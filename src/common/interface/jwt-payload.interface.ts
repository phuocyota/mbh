import { UserType } from '../enum/user-type.enum';

export interface JwtPayload {
  userId: string;
  userType: UserType;
  branchId?: string | null;
  branchName?: string | null;
  deviceId?: string;
  iat?: number;
  exp?: number;
}
