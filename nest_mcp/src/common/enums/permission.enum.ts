export enum Permission {
  // User permissions
  USER_READ = 'user:read',
  USER_CREATE = 'user:create',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',

  // Task permissions
  TASK_READ = 'task:read',
  TASK_CREATE = 'task:create',
  TASK_UPDATE = 'task:update',
  TASK_DELETE = 'task:delete',

  // Comment permissions
  COMMENT_READ = 'comment:read',
  COMMENT_CREATE = 'comment:create',
  COMMENT_UPDATE = 'comment:update',
  COMMENT_DELETE = 'comment:delete',

  // Permission management
  PERMISSION_MANAGE = 'permission:manage',
}
