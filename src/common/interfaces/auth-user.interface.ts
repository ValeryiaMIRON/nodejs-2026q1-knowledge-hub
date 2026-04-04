import { UserRole } from '../enums/user-role.enum';

export interface AuthUser {
  userId: string;
  login: string;
  role: UserRole;
}
