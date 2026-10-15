import type { Auth } from "firebase-admin/auth";
import { getAdminApp } from "./firebaseAdmin";

let _adminAuth: Auth | null = null;

export function getAdminAuth(): Auth {
  if (!_adminAuth) {
    const { getAuth } = require("firebase-admin/auth");
    _adminAuth = getAuth(getAdminApp());
  }
  return _adminAuth!;
}

export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_target, prop) {
    if (prop === "then" || prop === "catch" || prop === "toJSON" || typeof prop === "symbol") {
      return undefined;
    }
    const auth = getAdminAuth();
    const val = (auth as any)[prop];
    return typeof val === "function" ? val.bind(auth) : val;
  }
});
