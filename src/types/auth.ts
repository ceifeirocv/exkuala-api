// Flat merge of UserEntity fields + transient JWT roles claim.
// roles is NOT stored in DB — derived from JWT namespace claim on every request.
export interface AuthenticatedUser {
  id: string;
  auth0Id: string;
  createdAt: Date;
  updatedAt: Date;
  roles: string[];
}
