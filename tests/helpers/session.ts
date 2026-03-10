export const ADMIN_SESSION = {
  data: {
    user: { id: "u-admin", email: "admin@test.com", name: "Test Admin", role: "admin" },
    session: { id: "s1", token: "tok-admin", expiresAt: new Date(Date.now() + 3_600_000) },
  },
  isPending: false,
  error: null,
};

export const SALES_REP_SESSION = {
  data: {
    user: { id: "u-sales", email: "sales@test.com", name: "Sales Rep", role: "sales_rep" },
    session: { id: "s2", token: "tok-sales", expiresAt: new Date(Date.now() + 3_600_000) },
  },
  isPending: false,
  error: null,
};

export const UNAUTH_SESSION = {
  data: null,
  isPending: false,
  error: null,
};

export const LOADING_SESSION = {
  data: null,
  isPending: true,
  error: null,
};
