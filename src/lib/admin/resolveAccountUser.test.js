/**
 * Smoke: impersonation must resolve office admin, not SuperAdmin JWT sub.
 */
import { resolveAccountUser } from './resolveAccountUser.js';

const officeAdmin = {
  id: 'office-admin-1',
  email: 'office@example.com',
  role: 'admin',
  is_active: true,
  name: 'Office Admin',
};
const agent = {
  id: 'agent-1',
  email: 'agent@example.com',
  role: 'agent',
  is_active: true,
  name: 'Agent',
};

console.assert(
  resolveAccountUser([officeAdmin, agent], { jwtSub: 'agent-1', email: 'office@example.com' })
    ?.id === 'agent-1',
  'prefers JWT subject',
);

console.assert(
  resolveAccountUser([officeAdmin, agent], {
    jwtSub: 'superadmin-id',
    email: 'office@example.com',
  })?.id === 'office-admin-1',
  'falls back to email',
);

console.assert(
  resolveAccountUser([agent, officeAdmin], {
    jwtSub: 'superadmin-id',
    email: 'axilleas0@yahoo.gr',
    impersonating: true,
  })?.id === 'office-admin-1',
  'impersonation picks office admin',
);

console.assert(
  resolveAccountUser([officeAdmin], {
    jwtSub: 'superadmin-id',
    email: 'axilleas0@yahoo.gr',
    impersonating: false,
  }) === null,
  'no match without impersonation',
);

console.log('resolveAccountUser.test.js: ok');
