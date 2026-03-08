import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { getUserPermissionKeys } from '../services/rbac/userPermissions';
import type { PermissionKey } from '../types/rbac';

/**
 * Returns permission keys for the current user in the given organization.
 * Uses React Query for caching. Owner bypass: if user is org owner, treat as having all permissions (handled in UI).
 */
export function usePermissions(organizationId: string | null | undefined) {
  const userId = useAuthStore((s) => s.user?.id);
  const query = useQuery({
    queryKey: ['user-permissions', organizationId, userId],
    queryFn: () => getUserPermissionKeys(userId!, organizationId!),
    enabled: !!organizationId && !!userId,
  });
  const permissions = query.data ?? [];

  const has = (key: PermissionKey): boolean => permissions.includes(key);

  return {
    permissions,
    has,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
