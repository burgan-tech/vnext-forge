/** Role-based access grant, reusable across states, transitions, and subflow overrides. */
export interface RoleGrant {
  role: string;
  grant: 'allow' | 'deny';
}
