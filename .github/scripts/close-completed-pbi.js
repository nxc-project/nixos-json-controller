"use strict";

const CHILD_TYPES = new Set(["Task", "Bug", "Spike"]);

function currentIssueType(issue) {
  if (typeof issue?.type === "string") return issue.type.trim() || null;
  if (issue?.type && typeof issue.type.name === "string") {
    return issue.type.name.trim() || null;
  }
  return null;
}

function isCompletedSubIssue(issue) {
  return Boolean(
    issue &&
      !issue.pull_request &&
      CHILD_TYPES.has(currentIssueType(issue)) &&
      issue.state === "closed" &&
      issue.state_reason === "completed",
  );
}

/**
 * An empty PBI is not implicitly complete. Only completed child Issues count;
 * not_planned, duplicate, untyped, and still-open children keep the PBI open.
 */
function areAllSubIssuesCompleted(subIssues) {
  return Array.isArray(subIssues) &&
    subIssues.length > 0 &&
    subIssues.every(isCompletedSubIssue);
}

async function getParentIssue({ github, owner, repo, issueNumber }) {
  try {
    const response = await github.request(
      "GET /repos/{owner}/{repo}/issues/{issue_number}/parent",
      {
        owner,
        repo,
        issue_number: issueNumber,
        headers: { "X-GitHub-Api-Version": "2022-11-28" },
      },
    );
    return response.data;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

async function listSubIssues({ github, owner, repo, pbiNumber }) {
  const subIssues = [];
  let page = 1;

  while (true) {
    const response = await github.request(
      "GET /repos/{owner}/{repo}/issues/{issue_number}/sub_issues",
      {
        owner,
        repo,
        issue_number: pbiNumber,
        per_page: 100,
        page,
        headers: { "X-GitHub-Api-Version": "2022-11-28" },
      },
    );
    if (!Array.isArray(response.data)) {
      throw new Error(`GitHub returned a non-array sub-issue list for PBI #${pbiNumber}.`);
    }

    subIssues.push(...response.data);
    if (response.data.length < 100) return subIssues;
    page += 1;
  }
}

async function getIssue({ github, owner, repo, issueNumber }) {
  const response = await github.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });
  return response.data;
}

async function closePbiIfComplete({ github, owner, repo, pbiNumber, core }) {
  const parent = await getIssue({ github, owner, repo, issueNumber: pbiNumber });
  if (parent.pull_request || currentIssueType(parent) !== "PBI") {
    core.info(`Skipping #${pbiNumber}: parent is not a PBI Issue.`);
    return { action: "skip", reason: "not-pbi" };
  }
  if (parent.state !== "open") {
    core.info(`Skipping PBI #${pbiNumber}: it is already closed.`);
    return { action: "skip", reason: "already-closed" };
  }

  const subIssues = await listSubIssues({ github, owner, repo, pbiNumber });
  if (!areAllSubIssuesCompleted(subIssues)) {
    core.info(
      `Keeping PBI #${pbiNumber} open: it has no child Issues or at least one child is not completed.`,
    );
    return { action: "skip", reason: "sub-issues-incomplete", childCount: subIssues.length };
  }

  // Re-read both the parent and children immediately before the state change so
  // newly added work or a concurrently reopened child is less likely to be missed.
  const latestParent = await getIssue({ github, owner, repo, issueNumber: pbiNumber });
  if (latestParent.state !== "open" || currentIssueType(latestParent) !== "PBI") {
    core.info(`Skipping PBI #${pbiNumber}: its state or Type changed during the check.`);
    return { action: "skip", reason: "parent-changed" };
  }
  const latestSubIssues = await listSubIssues({ github, owner, repo, pbiNumber });
  if (!areAllSubIssuesCompleted(latestSubIssues)) {
    core.info(`Keeping PBI #${pbiNumber} open: child Issues changed during the check.`);
    return { action: "skip", reason: "sub-issues-changed", childCount: latestSubIssues.length };
  }

  await github.rest.issues.update({
    owner,
    repo,
    issue_number: pbiNumber,
    state: "closed",
    state_reason: "completed",
  });
  core.info(`Closed PBI #${pbiNumber}: all ${latestSubIssues.length} child Issue(s) are completed.`);
  return { action: "closed", pbiNumber, childCount: latestSubIssues.length };
}

async function closeParentForClosedIssue({ github, context, core }) {
  const eventIssue = context.payload?.issue;
  if (!eventIssue || eventIssue.pull_request || context.payload?.action !== "closed") {
    core.info("No closed non-PR Issue event to process.");
    return { action: "skip", reason: "not-a-closed-issue" };
  }

  const { owner, repo } = context.repo;
  const parent = await getParentIssue({
    github,
    owner,
    repo,
    issueNumber: eventIssue.number,
  });
  if (!parent) {
    core.info(`Issue #${eventIssue.number} has no native parent; leaving it unchanged.`);
    return { action: "skip", reason: "no-parent" };
  }

  return closePbiIfComplete({
    github,
    owner,
    repo,
    pbiNumber: parent.number,
    core,
  });
}

async function reconcileOpenPbis({ github, context, core }) {
  const { owner, repo } = context.repo;
  const openIssues = await github.paginate(github.rest.issues.listForRepo, {
    owner,
    repo,
    state: "open",
    per_page: 100,
  });
  const openPbis = openIssues.filter(
    (issue) => !issue.pull_request && currentIssueType(issue) === "PBI",
  );

  let closedCount = 0;
  for (const pbi of openPbis) {
    const result = await closePbiIfComplete({
      github,
      owner,
      repo,
      pbiNumber: pbi.number,
      core,
    });
    if (result.action === "closed") closedCount += 1;
  }
  core.info(`PBI reconciliation complete: checked ${openPbis.length}, closed ${closedCount}.`);
  return { checked: openPbis.length, closed: closedCount };
}

async function handleClosure({ github, context, core }) {
  if (context.eventName === "issues") {
    return closeParentForClosedIssue({ github, context, core });
  }
  // Scheduled and manually dispatched runs reconcile all currently open PBIs.
  return reconcileOpenPbis({ github, context, core });
}

module.exports = {
  currentIssueType,
  isCompletedSubIssue,
  areAllSubIssuesCompleted,
  getParentIssue,
  listSubIssues,
  closePbiIfComplete,
  closeParentForClosedIssue,
  reconcileOpenPbis,
  handleClosure,
};
