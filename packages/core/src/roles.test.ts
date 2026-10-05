import { describe, expect, it } from 'vitest';
import { MODULES } from './modules';
import { isPermission } from './permissions';
import { SYSTEM_ROLES } from './roles';

describe('SYSTEM_ROLES', () => {
  it('haben eindeutige Schlüssel', () => {
    const keys = SYSTEM_ROLES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('verwenden nur bekannte Berechtigungen', () => {
    for (const role of SYSTEM_ROLES) {
      for (const permission of role.permissions) {
        expect(isPermission(permission), `${role.key}: ${permission}`).toBe(true);
      }
    }
  });
});

describe('MODULES', () => {
  it('haben eindeutige Schlüssel', () => {
    const keys = MODULES.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
