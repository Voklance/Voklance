import type { CommandId, CommandMetadata } from '@voklance/shared';
import { commandPayloadSchemas } from '@voklance/shared';
import type { z } from 'zod';
import type { CommandPermission } from '../../communities/service/communityPermissions.js';

export interface RegisteredCommand extends CommandMetadata {
  requiredPermission: CommandPermission;
  schema: z.ZodType;
}

export const commandDefinitions: RegisteredCommand[] = [
  {
    id: 'referral',
    command: '/referral',
    label: 'Referral opportunity',
    description: 'Share a professional job referral opportunity.',
    iconId: 'briefcase',
    category: 'career',
    enabled: true,
    requiredPermission: 'command:create',
    payloadVersion: 1,
    displayType: 'referral',
    schema: commandPayloadSchemas.referral
  },
  {
    id: 'needreferral',
    command: '/needreferral',
    label: 'Referral request',
    description: 'Ask for a referral to a professional role.',
    iconId: 'request',
    category: 'career',
    enabled: true,
    requiredPermission: 'command:create',
    payloadVersion: 1,
    displayType: 'needreferral',
    schema: commandPayloadSchemas.needreferral
  },
  {
    id: 'event',
    command: '/event',
    label: 'Professional event',
    description: 'Announce a professional event.',
    iconId: 'calendar',
    category: 'events',
    enabled: true,
    requiredPermission: 'command:create',
    payloadVersion: 1,
    displayType: 'event',
    schema: commandPayloadSchemas.event
  },
  {
    id: 'meetup',
    command: '/meetup',
    label: 'Professional meetup',
    description: 'Announce a professional meetup.',
    iconId: 'people',
    category: 'events',
    enabled: true,
    requiredPermission: 'command:create',
    payloadVersion: 1,
    displayType: 'meetup',
    schema: commandPayloadSchemas.meetup
  },
  {
    id: 'discussion',
    command: '/discussion',
    label: 'Discussion',
    description: 'Ask a question or share an idea with your community.',
    iconId: 'discussion',
    category: 'knowledge',
    enabled: true,
    requiredPermission: 'command:create',
    payloadVersion: 1,
    displayType: 'discussion',
    schema: commandPayloadSchemas.discussion
  },
  {
    id: 'resource',
    command: '/resource',
    label: 'Share resource',
    description: 'Share a professional document with your community.',
    iconId: 'document',
    category: 'knowledge',
    enabled: true,
    requiredPermission: 'command:create',
    payloadVersion: 1,
    displayType: 'resource',
    schema: commandPayloadSchemas.resource
  }
];

export function findCommand(id: string): RegisteredCommand | undefined {
  return commandDefinitions.find((definition) => definition.id === id);
}

export function metadataFor(definition: RegisteredCommand): CommandMetadata {
  const { id, command, label, description, iconId, category, enabled, payloadVersion, displayType } =
    definition;
  return { id, command, label, description, iconId, category, enabled, payloadVersion, displayType };
}

export function isCommandId(value: string): value is CommandId {
  return commandDefinitions.some((definition) => definition.id === value);
}
