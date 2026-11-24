// ----------------------------------------------------------------------

export type PermissionData = {
  action: PermissionId;
};

// ----------------------------------------------------------------------

export type PermissionId = 'trip_fuel_access';

export type PermissionCheckData = { id: PermissionId } | PermissionId;

export type PermissionCheckParams = {
  method: 'every' | 'some';
  permissions: PermissionCheckData[];
};
