function path(root: string, sublink: string) {
  return `${root}${sublink}`;
}

const ROOTS_DASHBOARD = '/dashboard';
const ROOTS_LOGIN = '/login';

export const PATH_DASHBOARD = {
  default: path(ROOTS_DASHBOARD, '/'),
};

export const PATH_LOGIN = {
  default: path(ROOTS_LOGIN, '/'),
};

export const PATH_KNOWLEDGE_BASE = {
  list: path(ROOTS_DASHBOARD, '/knowledge-base'),
};

