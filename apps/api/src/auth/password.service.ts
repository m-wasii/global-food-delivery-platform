import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

@Injectable()
export class PasswordService {
    hash(plain: string): Promise<string> {
        return hash(plain);
    }

    verify(passwordHash: string, plain: string): Promise<boolean> {
        return verify(passwordHash, plain);
    }
}