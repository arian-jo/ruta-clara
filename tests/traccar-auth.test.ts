import assert from "node:assert/strict";
import test from "node:test";
import { traccarAuthorization } from "../lib/traccar-auth.ts";

test("crea Basic Auth con usuario y contraseña", () => {
  assert.equal(
    traccarAuthorization({ username: "ruta@example.com", password: "clave-segura" }),
    `Basic ${btoa("ruta@example.com:clave-segura")}`,
  );
});

test("prioriza token y rechaza credenciales incompletas", () => {
  assert.equal(traccarAuthorization({ token: "abc", username: "user", password: "pass" }), "Bearer abc");
  assert.equal(traccarAuthorization({ username: "user" }), null);
  assert.equal(traccarAuthorization({ password: "pass" }), null);
});
