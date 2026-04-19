import { sign, SignOptions } from 'jsonwebtoken';
import 'dotenv/config';

const refreshTokenSecurityKey = process.env.JWT_REFRESH_SECRET || '';

const generateRefreshToken = (payload: any, options: SignOptions): string => {
  return sign(payload, refreshTokenSecurityKey, options);
};

export default generateRefreshToken;
