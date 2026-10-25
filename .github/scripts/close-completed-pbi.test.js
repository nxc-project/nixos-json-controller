"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  currentIssueType,
  isCompletedSubIssue,
  areAllSubIssuesCompleted,
  closeParentForClosedIssue,
  closePbiIfComplete,
  listSubIssues,
  handleClosure,
} = require("./close-completed-pbi.js");

function makeCore() {
  const logs = { info: [], warnings: [] };
  return {
    logs,
    info(message) { logs.info.push(message); },
    warning(message) { logs.warnings.push(message); },
  };
}

function completedChild(number, type = "Task") {
  return {
    id: number * 10,
    number,
    type: { name: type },
    state: "closed",
    state_reason: "completed",
  };
}

function mockGithub({ issues, parents = {}, children = {}, subIssuePages = {} }) {
  const calls = { requests: [], updates: [], subIssuePages: [] };
  const github = {
    rest: {
      issues: {
        get: async ({ issue_number }) => {
          const issue = issues[issue_number];
          if (!issue) {
            const error = new Error(`Issue #${issue_number} not found`);
            error.status = 404;
            throw error;
          }
          return { data: { ...issue } };
        },
        update: async (params) => {
          calls.updates.push(params);
          issues[params.issue_number] = {
            ...issues[params.issue_number],
            state: params.state,
            state_reason: params.state_reason,
          };
          return { data: { ...issues[params.issue_number] } };
        },
        listForRepo: async () => ({ data: [] }),
      },
    },
    request: async (route, params) => {
      calls.requests.push({ route, params });
      if (route.endsWith("/parent")) {
        const parent = parents[params.issue_number];
        if (!parent) {
          const error = new Error("No parent Issue");
          error.status = 404;
          throw error;
        }
        return { data: { ...parent } };
      }
      if (route.endsWith("/sub_issues")) {
        calls.subIssuePages.push(params.page);
        if (subIssuePages[params.issue_number]) {
          return { data: subIssuePages[params.issue_number][params.page - 1] || [] };
        }
        const all = children[params.issue_number] || [];
        const start = (params.page - 1) * params.per_page;
        return { data: all.slice(start, start + params.per_page) };
      }
      throw new Error(`Unexpected API route: ${route}`);
    },
    paginate: async (_method, params) => Object.values(issues).filter(
      (issue) => issue.state === params.state && !issue.pull_request,
    ),
  };
  return { github, calls };
}

function eventContext(issueNumber, { eventName = "issues", action = "closed" } = {}) {
  return {
    eventName,
    repo: { owner: "nxc-project", repo: "nixos-json-controller" },
    payload: { action, issue: { number: issueNumber, state: "closed" } },
  };
}

function fixture({ childIssues, pbiType = "PBI", pbiState = "open", pbiNumber = 200 }) {
  const child = { id: 1010, number: 101, type: { name: "Task" }, state: "closed", state_reason: "completed" };
  const pbi = { id: pbiNumber * 10, number: pbiNumber, type: { name: pbiType }, state: pbiState, state_reason: null };
  const issues = { 101: child, [pbiNumber]: pbi };
  const children = { [pbiNumber]: childIssues === undefined ? [child] : childIssues };
  const parents = { 101: { number: pbiNumber, type: { name: pbiType } } };
  return mockGithub({ issues, parents, children });
}

test("reads both common GitHub Issue Type payload shapes", () => {
  assert.equal(currentIssueType({ type: "PBI" }), "PBI");
  assert.equal(currentIssueType({ type: { name: "Task" } }), "Task");
  assert.equal(currentIssueType({ type: null }), null);
});

test("only completed Task/Bug/Spike children count toward PBI completion", () => {
  assert.equal(isCompletedSubIssue(completedChild(1)), true);
  assert.equal(isCompletedSubIssue(completedChild(2, "Bug")), true);
  assert.equal(isCompletedSubIssue(completedChild(3, "Spike")), true);
  assert.equal(isCompletedSubIssue({ ...completedChild(4), state: "open" }), false);
  assert.equal(isCompletedSubIssue({ ...completedChild(5), state_reason: "not_planned" }), false);
  assert.equal(isCompletedSubIssue({ ...completedChild(6), state_reason: "duplicate" }), false);
  assert.equal(isCompletedSubIssue({ ...completedChild(7), type: null }), false);
  assert.equal(isCompletedSubIssue({ ...completedChild(8), pull_request: { url: "https://example.test" } }), false);
});

test("does not consider an empty sub-issue list complete", () => {
  assert.equal(areAllSubIssuesCompleted([]), false);
  assert.equal(areAllSubIssuesCompleted(null), false);
});

test("closes the parent PBI when every child is completed", async () => {
  const { github, calls } = fixture({});
  const result = await closeParentForClosedIssue({
    github,
    context: eventContext(101),
    core: makeCore(),
  });

  assert.equal(result.action, "closed");
  assert.equal(result.pbiNumber, 200);
  assert.equal(calls.updates.length, 1);
  assert.deepEqual(
    { state: calls.updates[0].state, state_reason: calls.updates[0].state_reason },
    { state: "closed", state_reason: "completed" },
  );
});

test("keeps the PBI open when a child Issue remains open", async () => {
  const openChild = { ...completedChild(102), state: "open", state_reason: null };
  const { github, calls } = fixture({ childIssues: [completedChild(101), openChild] });
  const result = await closeParentForClosedIssue({
    github,
    context: eventContext(101),
    core: makeCore(),
  });

  assert.equal(result.reason, "sub-issues-incomplete");
  assert.equal(calls.updates.length, 0);
});

test("keeps the PBI open when a child was not planned or marked duplicate", async () => {
  for (const state_reason of ["not_planned", "duplicate"]) {
    const child = { ...completedChild(102), state_reason };
    const { github, calls } = fixture({ childIssues: [completedChild(101), child] });
    const result = await closeParentForClosedIssue({
      github,
      context: eventContext(101),
      core: makeCore(),
    });
    assert.equal(result.action, "skip");
    assert.equal(calls.updates.length, 0);
  }
});

test("does not close a PBI with no children", async () => {
  const { github, calls } = fixture({ childIssues: [] });
  const result = await closeParentForClosedIssue({
    github,
    context: eventContext(101),
    core: makeCore(),
  });
  assert.equal(result.reason, "sub-issues-incomplete");
  assert.equal(calls.updates.length, 0);
});

test("does not close a parent whose Issue Type is not PBI", async () => {
  const { github, calls } = fixture({ childIssues: [], pbiType: "Task" });
  const result = await closeParentForClosedIssue({
    github,
    context: eventContext(101),
    core: makeCore(),
  });
  assert.equal(result.reason, "not-pbi");
  assert.equal(calls.updates.length, 0);
});

test("leaves a standalone Issue and a PR event unchanged", async () => {
  const noParentGithub = mockGithub({
    issues: { 101: completedChild(101) },
  });
  const result = await closeParentForClosedIssue({
    github: noParentGithub.github,
    context: eventContext(101),
    core: makeCore(),
  });
  assert.equal(result.reason, "no-parent");
  assert.equal(noParentGithub.calls.updates.length, 0);

  const { github, calls } = fixture({});
  const prContext = eventContext(101);
  prContext.payload.issue.pull_request = { url: "https://example.test" };
  const prResult = await closeParentForClosedIssue({
    github,
    context: prContext,
    core: makeCore(),
  });
  assert.equal(prResult.reason, "not-a-closed-issue");
  assert.equal(calls.updates.length, 0);
});

test("does not close an already-closed PBI", async () => {
  const { github, calls } = fixture({ childIssues: [], pbiState: "closed" });
  const result = await closePbiIfComplete({
    github,
    owner: "nxc-project",
    repo: "nixos-json-controller",
    pbiNumber: 200,
    core: makeCore(),
  });
  assert.equal(result.reason, "already-closed");
  assert.equal(calls.updates.length, 0);
});

test("paginates native Sub-issues beyond 100 children", async () => {
  const firstPage = Array.from({ length: 100 }, (_, i) => completedChild(i + 1));
  const secondPage = [completedChild(101)];
  const { github, calls } = mockGithub({
    issues: { 200: { number: 200, type: { name: "PBI" }, state: "open" } },
    subIssuePages: { 200: [firstPage, secondPage] },
  });
  const result = await listSubIssues({
    github,
    owner: "nxc-project",
    repo: "nixos-json-controller",
    pbiNumber: 200,
  });
  assert.equal(result.length, 101);
  assert.deepEqual(calls.subIssuePages, [1, 2]);
});

test("scheduled reconciliation closes completed PBIs", async () => {
  const { github, calls } = fixture({});
  const result = await handleClosure({
    github,
    context: eventContext(101, { eventName: "schedule", action: undefined }),
    core: makeCore(),
  });
  assert.deepEqual(result, { checked: 1, closed: 1 });
  assert.equal(calls.updates.length, 1);
});


test("propagates API errors without closing a PBI", async () => {
  const { github, calls } = fixture({});
  const originalRequest = github.request;
  github.request = async (route, params) => {
    if (route.endsWith("/sub_issues")) {
      const error = new Error("permission denied");
      error.status = 403;
      throw error;
    }
    return originalRequest(route, params);
  };

  await assert.rejects(
    closeParentForClosedIssue({
      github,
      context: eventContext(101),
      core: makeCore(),
    }),
    /permission denied/,
  );
  assert.equal(calls.updates.length, 0);
});


test("continues scheduled reconciliation after a PBI API error and reports the failure", async () => {
  const pbiOne = {
    id: 2000,
    number: 200,
    type: { name: "PBI" },
    state: "open",
    state_reason: null,
  };
  const pbiTwo = {
    id: 2010,
    number: 201,
    type: { name: "PBI" },
    state: "open",
    state_reason: null,
  };
  const { github, calls } = mockGithub({
    issues: { 200: pbiOne, 201: pbiTwo },
    children: { 201: [completedChild(301)] },
  });
  const originalRequest = github.request;
  github.request = async (route, params) => {
    if (route.endsWith("/sub_issues") && params.issue_number === 200) {
      const error = new Error("temporary API failure");
      error.status = 503;
      throw error;
    }
    return originalRequest(route, params);
  };
  const core = makeCore();

  await assert.rejects(
    handleClosure({
      github,
      context: eventContext(0, { eventName: "schedule", action: undefined }),
      core,
    }),
    /Failed to reconcile 1 PBI\(s\): #200/,
  );

  assert.deepEqual(calls.updates.map((update) => update.issue_number), [201]);
  assert.ok(core.logs.warnings.some((message) => message.includes("PBI #200")));
  assert.ok(core.logs.info.some((message) => message.includes("checked 2, closed 1")));
});
