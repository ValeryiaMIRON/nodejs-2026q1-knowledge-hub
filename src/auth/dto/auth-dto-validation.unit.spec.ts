import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { LoginDto } from './login.dto';
import { RefreshDto } from './refresh.dto';
import { SignupDto } from './signup.dto';

describe('Auth DTO validation', () => {
  it('fails SignupDto when required fields are missing', async () => {
    const dto = new SignupDto();

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['login', 'password']),
    );
  });

  it('passes SignupDto with a valid payload', async () => {
    const dto = Object.assign(new SignupDto(), {
      login: 'john_doe',
      password: 'secure_password',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('fails LoginDto when required fields are missing', async () => {
    const dto = new LoginDto();

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['login', 'password']),
    );
  });

  it('passes LoginDto with a valid payload', async () => {
    const dto = Object.assign(new LoginDto(), {
      login: 'john_doe',
      password: 'secure_password',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('fails RefreshDto when refreshToken is missing', async () => {
    const dto = new RefreshDto();

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.map((error) => error.property)).toContain('refreshToken');
  });

  it('passes RefreshDto with a valid payload', async () => {
    const dto = Object.assign(new RefreshDto(), {
      refreshToken: 'refresh-token',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
