import test from "node:test";
import assert from "node:assert/strict";
import { authEmail, canonicalUsername } from "../src/lib/identity";
import { ownTaskSchema, statusSchema, userSchema } from "../src/lib/validation";

test("username login tolerates capitalization and outer spaces", () => {
  assert.equal(authEmail(" Lena baswed "), authEmail("lena baswed"));
  assert.equal(canonicalUsername("Ｌｅｎａ baswed"), "lena baswed");
  assert.notEqual(authEmail("other user"), authEmail("Lena baswed"));
});

test("only the two requested task statuses are valid", () => {
  assert.equal(statusSchema.safeParse("Approved").success, true);
  assert.equal(statusSchema.safeParse("Not Approved").success, true);
  for (const value of ["Done", "Pending", "In Progress", "", null]) assert.equal(statusSchema.safeParse(value).success, false);
});

test("normal-user task input rejects injected assignments and blank task text", () => {
  assert.equal(ownTaskSchema.safeParse({ task_text: "Do the work", status: "Approved", assigned_user_id: "someone-else" }).success, false);
  assert.equal(ownTaskSchema.safeParse({ task_text: "Do the work", status: "Approved", head_id: 2 }).success, false);
  assert.equal(ownTaskSchema.safeParse({ task_text: "   ", status: "Approved" }).success, false);
});

test("account creation rejects injected roles and short passwords", () => {
  assert.equal(userSchema.safeParse({ name: "Test", username: "test", password: "test-only-long-password", role: "main_admin" }).success, false);
  assert.equal(userSchema.safeParse({ name: "Test", username: "test", password: "short" }).success, false);
});
