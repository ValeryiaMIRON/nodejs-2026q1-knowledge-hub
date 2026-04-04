import { UserRole } from '../../common/enums/user-role.enum';

export class UserResponseDto {
  id: string;
  login: string;
  role: UserRole;
  createdAt: number;
  updatedAt: number;
}
