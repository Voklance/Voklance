import type { CommunityPermissions, CommunityRole } from '@voklance/shared';

export type CommunityAction = keyof CommunityPermissions;
const denied: CommunityPermissions = {
  viewMembers: false,
  reviewRequests: false,
  editDetails: false,
  manageRoles: false,
  removeMembers: false,
  transferOwnership: false,
  archive: false
};
const byRole: Record<CommunityRole, CommunityPermissions> = {
  OWNER: {
    viewMembers: true,
    reviewRequests: true,
    editDetails: true,
    manageRoles: true,
    removeMembers: true,
    transferOwnership: true,
    archive: true
  },
  ADMIN: {
    viewMembers: true,
    reviewRequests: true,
    editDetails: true,
    manageRoles: true,
    removeMembers: true,
    transferOwnership: false,
    archive: false
  },
  MODERATOR: { ...denied, viewMembers: true, reviewRequests: true },
  MEMBER: { ...denied, viewMembers: true }
};

export function permissionsFor(
  role: CommunityRole | null,
  active: boolean,
  archived: boolean
): CommunityPermissions {
  if (!active || !role) return denied;
  if (archived) return { ...denied, viewMembers: true };
  return byRole[role];
}

export function canManageRole(
  actor: CommunityRole,
  target: CommunityRole,
  next: 'ADMIN' | 'MODERATOR' | 'MEMBER'
) {
  if (target === 'OWNER') return false;
  if (actor === 'OWNER') return true;
  return actor === 'ADMIN' && target !== 'ADMIN' && next !== 'ADMIN';
}

export function canRemove(actor: CommunityRole, target: CommunityRole) {
  return (actor === 'OWNER' && target !== 'OWNER') || (actor === 'ADMIN' && target === 'MEMBER');
}

export type CommandPermission = 'command:create';
export function canCreateCommand(
  role: CommunityRole | null,
  active: boolean,
  archived: boolean,
  permission: CommandPermission
) {
  return permission === 'command:create' && !!role && active && !archived;
}

export function canModerateActivity(role: CommunityRole | null, active: boolean, archived: boolean) {
  return !!role && active && !archived && ['OWNER', 'ADMIN', 'MODERATOR'].includes(role);
}
