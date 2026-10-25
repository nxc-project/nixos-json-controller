"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { extractH2Headings, validatePullRequestBody } = require("./validate-pr-template.js");

const template = [
  "## Why",
  "<!-- Remove this comment. ## Not a real heading -->",
  "## 変更内容",
  "## 受け入れ条件との対応",
].join("\n");

test("extracts H2 headings and ignores HTML comments and both fence styles", () => {
  const backticks = String.fromCharCode(96).repeat(3);
  const tildes = "~~~";
  const headings = extractH2Headings(
    [
      "## Why",
      "<!-- ## hidden comment -->",
      backticks + "markdown",
      "## hidden in backtick fence",
      backticks,
      tildes + "markdown",
      "## hidden in tilde fence",
      "~~~~",
      "### not an H2",
      "## 検証結果",
    ].join("\n"),
  );

  assert.deepEqual(headings, ["Why", "検証結果"]);
});

test("headings in multiline HTML comments cannot satisfy required PR sections", () => {
  const result = validatePullRequestBody(
    template,
    [
      "## Why",
      "Reason.",
      "<!--",
      "## 変更内容",
      "-->",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n"),
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.missingHeadings, ["変更内容"]);
});


test("escaped backticks do not open or close inline code spans", () => {
  const result = validatePullRequestBody(
    template,
    [
      "## Why",
      "A literal escaped backtick is written as \\` here.",
      "## 変更内容",
      "Changed.",
      "Use `code` in the example.",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n"),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingHeadings, []);
});

test("backslashes inside code spans do not prevent closing delimiters", () => {
  const backslashClosedCodeSpan = "Example: `foo" + "\\" + "` is still a closed code span."; 
  const result = validatePullRequestBody(
    template,
    [
      "## Why",
      backslashClosedCodeSpan,
      "## 変更内容",
      "Changed.",
      "Use `code` in the example.",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n"),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingHeadings, []);
});

test("unmatched backticks cannot mask headings across Markdown block boundaries", () => {
  const tick = String.fromCharCode(96);
  const bodies = [
    [
      "## Why",
      "Reason with an unmatched backtick " + tick,
      "",
      "## 変更内容",
      "Changed.",
      "",
      "Another unmatched backtick " + tick,
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n"),
    [
      "## Why",
      "Reason with an unmatched backtick " + tick,
      "## 変更内容",
      "Changed.",
      "Another unmatched backtick " + tick,
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n"),
  ];

  for (const body of bodies) {
    const result = validatePullRequestBody(template, body);
    assert.equal(result.ok, true);
    assert.deepEqual(result.missingHeadings, []);
    assert.deepEqual(extractH2Headings(body), [
      "Why",
      "変更内容",
      "受け入れ条件との対応",
    ]);
  }
});

test("inline code containing HTML comment start markers does not hide subsequent headings", () => {
  const result = validatePullRequestBody(
    template,
    [
      "## Why",
      "Use the literal token `<!--` in the example; it is not an HTML comment.",
      "## 変更内容",
      "Changed.",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n"),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingHeadings, []);
  assert.deepEqual(extractH2Headings("Text with `## not a heading` here\n## Why"), [
    "Why",
  ]);
});

test("inline HTML followed by a valid heading does not hide the heading", () => {
  const result = validatePullRequestBody(
    template,
    [
      "## Why",
      "Reason.",
      "<span>説明</span>",
      "## 変更内容",
      "Changed.",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n"),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingHeadings, []);
});

test("type 7 HTML tags do not start a raw block inside an open paragraph", () => {
  const result = validatePullRequestBody(
    template,
    [
      "## Why",
      "Reason.",
      "<span>",
      "## 変更内容",
      "Changed.",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n"),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingHeadings, []);
  assert.deepEqual(extractH2Headings("## Why\nReason.\n<span>\n## 変更内容"), [
    "Why",
    "変更内容",
  ]);
});

test("raw HTML blocks cannot satisfy required PR sections", () => {
  const preResult = validatePullRequestBody(
    template,
    [
      "## Why",
      "Reason.",
      "<pre>",
      "## 変更内容",
      "</pre>",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n"),
  );

  assert.equal(preResult.ok, false);
  assert.deepEqual(preResult.missingHeadings, ["変更内容"]);

  const textareaResult = validatePullRequestBody(
    template,
    [
      "## Why",
      "Reason.",
      "<textarea>",
      "",
      "## 変更内容",
      "</textarea>",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n"),
  );

  assert.equal(textareaResult.ok, false);
  assert.deepEqual(textareaResult.missingHeadings, ["変更内容"]);

  const divResult = validatePullRequestBody(
    template,
    [
      "## Why",
      "Reason.",
      "<div>",
      "## 変更内容",
      "</div>",
      "",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n"),
  );

  assert.equal(divResult.ok, false);
  assert.deepEqual(divResult.missingHeadings, ["変更内容"]);
});


test("type 1 HTML block opening tags may end a line before the closing angle bracket", () => {
  for (const tag of ["pre", "script", "style", "textarea"]) {
    const body = [
      "## Why",
      "Reason.",
      "<" + tag,
      ">",
      "## 変更内容",
      "</" + tag + ">",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n");
    const result = validatePullRequestBody(template, body);

    assert.equal(result.ok, false, tag);
    assert.deepEqual(result.missingHeadings, ["変更内容"], tag);
    assert.deepEqual(extractH2Headings(body), [
      "Why",
      "受け入れ条件との対応",
    ], tag);
  }
});

test("self-closing type 1 tag names do not open raw HTML blocks", () => {
  for (const tag of ["pre", "script", "style", "textarea"]) {
    const body = [
      "## Why",
      "Reason.",
      "",
      "<" + tag + "/>",
      "## 変更内容",
      "Changed.",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n");

    const result = validatePullRequestBody(template, body);

    assert.equal(result.ok, true, tag);
    assert.deepEqual(result.missingHeadings, [], tag);
    assert.deepEqual(extractH2Headings(body), [
      "Why",
      "変更内容",
      "受け入れ条件との対応",
    ], tag);
  }
});

test("fence-like lines inside raw HTML blocks do not expose fake headings", () => {
  const body = [
    "## Why",
    "Reason.",
    "<div>",
    "```markdown",
    "Example.",
    "```",
    "## 変更内容",
    "Still inside the raw HTML block.",
    "</div>",
    "",
    "## 受け入れ条件との対応",
    "Done.",
  ].join("\n");

  const result = validatePullRequestBody(template, body);

  assert.equal(result.ok, false);
  assert.deepEqual(result.missingHeadings, ["変更内容"]);
  assert.deepEqual(extractH2Headings(body), ["Why", "受け入れ条件との対応"]);
});

test("backticks inside raw HTML blocks cannot mask valid headings outside the block", () => {
  const result = validatePullRequestBody(
    template,
    [
      "## Why",
      "Reason.",
      "",
      "<custom-tag>",
      "`",
      "</custom-tag>",
      "",
      "## 変更内容",
      "Changed.",
      "A literal unmatched backtick follows: `",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n"),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingHeadings, []);
  assert.deepEqual(
    extractH2Headings([
      "## Why",
      "Reason.",
      "",
      "<custom-tag>",
      "`",
      "</custom-tag>",
      "",
      "## 変更内容",
      "Changed.",
      "A literal unmatched backtick follows: `",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n")),
    ["Why", "変更内容", "受け入れ条件との対応"],
  );
});

test("raw HTML tags inside an HTML comment do not swallow later headings", () => {
  const result = validatePullRequestBody(
    template,
    [
      "## Why",
      "Reason.",
      "",
      "<!--",
      "<pre>",
      "## 変更内容",
      "</pre>",
      "-->",
      "## 変更内容",
      "Changed.",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n"),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingHeadings, []);
});
test("raw HTML blocks with quoted greater-than attribute values cannot satisfy required sections", () => {
  for (const tag of ['<custom-tag title="a > b">', "<custom-tag title='a > b'>"]) {
    const result = validatePullRequestBody(
      template,
      [
        "## Why",
        "Reason.",
        "",
        tag,
        "## 変更内容",
        "Still inside the raw HTML block.",
        "",
        "## 受け入れ条件との対応",
        "Done.",
      ].join("\n"),
    );

    assert.equal(result.ok, false, tag);
    assert.deepEqual(result.missingHeadings, ["変更内容"], tag);
  }
});

test("indented code blocks close paragraph state before type 7 HTML blocks", () => {
  for (const codeLine of ["    example", "\texample"]) {
    const result = validatePullRequestBody(
      template,
      [
        "## Why",
        "Reason.",
        "",
        codeLine,
        "<custom-tag>",
        "## 変更内容",
        "Still inside the raw HTML block.",
        "",
        "## 受け入れ条件との対応",
        "Done.",
      ].join("\n"),
    );

    assert.equal(result.ok, false, JSON.stringify(codeLine));
    assert.deepEqual(result.missingHeadings, ["変更内容"], JSON.stringify(codeLine));
  }
});

test("block quotes and ordered list markers including leading zeros close paragraphs before type 7 HTML blocks", () => {
  for (const marker of [
    "> quote",
    "- list item",
    "1. ordered item",
    "01. ordered item",
    "001) ordered item",
    "000000001. ordered item",
  ]) {
    const result = validatePullRequestBody(
      template,
      [
        "## Why",
        "Reason.",
        marker,
        "<custom-tag>",
        "## 変更内容",
        "Still inside the raw HTML block.",
        "",
        "## 受け入れ条件との対応",
        "Done.",
      ].join("\n"),
    );

    assert.equal(result.ok, false, marker);
    assert.deepEqual(result.missingHeadings, ["変更内容"], marker);
  }
});

test("ordered list markers other than 1 do not interrupt an open paragraph", () => {
  const body = [
    "## Why",
    "Reason.",
    "2. this is still paragraph text",
    "<custom-tag>",
    "## 変更内容",
    "Changed.",
    "3) this is still paragraph text",
    "<custom-tag>",
    "## 受け入れ条件との対応",
    "Done.",
  ].join("\n");

  const result = validatePullRequestBody(template, body);

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingHeadings, []);
  assert.deepEqual(extractH2Headings(body), [
    "Why",
    "変更内容",
    "受け入れ条件との対応",
  ]);
});

test("thematic breaks close paragraphs before type 7 HTML blocks", () => {
  const result = validatePullRequestBody(
    template,
    [
      "## Why",
      "Reason.",
      "***",
      "<custom-tag>",
      "## 変更内容",
      "Still inside the raw HTML block.",
      "",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n"),
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.missingHeadings, ["変更内容"]);
});

test("tab whitespace in ATX headings, thematic breaks, and setext underlines closes paragraphs", () => {
  const cases = [
    {
      name: "tab after ATX heading markers",
      separator: ["##\tSubheading"],
      expectedHeadings: ["Why", "Subheading", "受け入れ条件との対応"],
    },
    {
      name: "tabs between thematic break markers",
      separator: ["*\t*\t*"],
    },
    {
      name: "tab after setext underline",
      separator: ["Setext heading", "===\t"],
    },
  ];

  for (const item of cases) {
    const body = [
      "## Why",
      "Reason.",
      ...item.separator,
      "<custom-tag>",
      "## 変更内容",
      "Still inside the raw HTML block.",
      "",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n");
    const result = validatePullRequestBody(template, body);

    assert.equal(result.ok, false, item.name);
    assert.deepEqual(result.missingHeadings, ["変更内容"], item.name);
    assert.deepEqual(
      extractH2Headings(body),
      item.expectedHeadings || ["Why", "受け入れ条件との対応"],
      item.name,
    );
  }
});

test("fenced code blocks separate paragraphs before type 7 HTML blocks", () => {
  const result = validatePullRequestBody(
    template,
    [
      "## Why",
      "Reason.",
      "```text",
      "This is an example fence.",
      "```",
      "<custom-tag>",
      "## 変更内容",
      "Still inside the raw HTML block.",
      "",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n"),
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.missingHeadings, ["変更内容"]);
});

test("unclosed HTML comments cannot satisfy required PR sections", () => {
  const result = validatePullRequestBody(
    template,
    [
      "## Why",
      "Reason.",
      "<!-- unclosed comment",
      "## 変更内容",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n"),
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.missingHeadings, ["変更内容", "受け入れ条件との対応"]);
});

test("tilde-fenced headings cannot satisfy required PR sections", () => {
  const result = validatePullRequestBody(
    template,
    [
      "## Why",
      "Reason.",
      "~~~markdown",
      "## 変更内容",
      "~~~",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n"),
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.missingHeadings, ["変更内容"]);
});

test("accepts a PR body that includes all template sections", () => {
  const result = validatePullRequestBody(
    template,
    [
      "## Why",
      "Reason.",
      "## 変更内容",
      "Changed.",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n"),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingHeadings, []);
});


test("normalizes valid ATX H2 indentation and optional closing hashes", () => {
  const result = validatePullRequestBody(
    template,
    [
      "  ## Why",
      "Reason.",
      "## 変更内容 ##",
      "Changed.",
      "   ## 受け入れ条件との対応   ###",
      "Done.",
    ].join("\n"),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingHeadings, []);
  assert.deepEqual(extractH2Headings("  ## Why\n## 変更内容 ##"), [
    "Why",
    "変更内容",
  ]);
});

test("reports missing template sections", () => {
  const result = validatePullRequestBody(
    template,
    [
      "## Why",
      "Reason.",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n"),
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.missingHeadings, ["変更内容"]);
});


test("indented continuation lines do not interrupt an open paragraph before type 7 HTML blocks", () => {
  for (const indentedLine of ["    continuation", "\tcontinuation"]) {
    const body = [
      "## Why",
      "Reason.",
      indentedLine,
      "<custom-tag>",
      "## 変更内容",
      "Changed.",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n");
    const result = validatePullRequestBody(template, body);

    assert.equal(result.ok, true, JSON.stringify(indentedLine));
    assert.deepEqual(result.missingHeadings, [], JSON.stringify(indentedLine));
    assert.deepEqual(extractH2Headings(body), [
      "Why",
      "変更内容",
      "受け入れ条件との対応",
    ], JSON.stringify(indentedLine));
  }
});

test("blank lines made of spaces or tabs close paragraphs before type 7 HTML blocks", () => {
  for (const blankLine of ["", "    ", "\t"]) {
    const body = [
      "## Why",
      "Reason.",
      blankLine,
      "<custom-tag>",
      "## 変更内容",
      "Still inside the raw HTML block.",
      "",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n");
    const result = validatePullRequestBody(template, body);

    assert.equal(result.ok, false, JSON.stringify(blankLine));
    assert.deepEqual(result.missingHeadings, ["変更内容"], JSON.stringify(blankLine));
  }
});


test("HTML comment markers in indented code blocks do not mask later headings", () => {
  const body = [
    "## Why",
    "Reason.",
    "",
    "    <!-- literal token",
    "## 変更内容",
    "Changed.",
    "## 受け入れ条件との対応",
    "Done.",
  ].join("\n");
  const result = validatePullRequestBody(template, body);

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingHeadings, []);
  assert.deepEqual(extractH2Headings(body), [
    "Why",
    "変更内容",
    "受け入れ条件との対応",
  ]);
});


test("HTML comment markers inside quoted HTML attributes do not hide later headings", () => {
  for (const tag of [
    'Example: <custom-tag data-example="<!--">.',
    "Example: <custom-tag data-example='<!--'>.",
  ]) {
    const body = [
      "## Why",
      "Reason.",
      "",
      tag,
      "",
      "## 変更内容",
      "Changed.",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n");
    const result = validatePullRequestBody(template, body);

    assert.equal(result.ok, true, tag);
    assert.deepEqual(result.missingHeadings, [], tag);
    assert.deepEqual(extractH2Headings(body), [
      "Why",
      "変更内容",
      "受け入れ条件との対応",
    ], tag);
  }
});


test("meta tags inside an open paragraph do not start raw HTML block type 6", () => {
  const body = [
    "## Why",
    "Reason.",
    "<meta>",
    "## 変更内容",
    "Changed.",
    "## 受け入れ条件との対応",
    "Done.",
  ].join("\n");
  const result = validatePullRequestBody(template, body);

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingHeadings, []);
  assert.deepEqual(extractH2Headings(body), [
    "Why",
    "変更内容",
    "受け入れ条件との対応",
  ]);
});


test("malformed HTML attributes do not start a raw HTML block", () => {
  for (const tag of ["<custom-tag foo=>", "<custom-tag foo= >", "<custom-tag foo=\"unterminated>"]) {
    const body = [
      "## Why",
      "Reason.",
      "",
      tag,
      "## 変更内容",
      "Changed.",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n");
    const result = validatePullRequestBody(template, body);

    assert.equal(result.ok, true, tag);
    assert.deepEqual(result.missingHeadings, [], tag);
    assert.deepEqual(extractH2Headings(body), [
      "Why",
      "変更内容",
      "受け入れ条件との対応",
    ], tag);
  }
});


test("valid HTML attributes still start a raw HTML block", () => {
  for (const tag of [
    "<custom-tag disabled>",
    "<custom-tag disabled checked>",
    "<custom-tag foo = bar>",
    '<custom-tag title="a > b" data-key=value>',
  ]) {
    const body = [
      "## Why",
      "Reason.",
      "",
      tag,
      "## 変更内容",
      "Still inside the raw HTML block.",
      "",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n");
    const result = validatePullRequestBody(template, body);

    assert.equal(result.ok, false, tag);
    assert.deepEqual(result.missingHeadings, ["変更内容"], tag);
    assert.deepEqual(extractH2Headings(body), [
      "Why",
      "受け入れ条件との対応",
    ], tag);
  }
});


test("inline code text in H2 headings is retained for required-section matching", () => {
  const tick = String.fromCharCode(96);
  const body = [
    "## Why",
    "Reason.",
    "## " + tick + "変更内容" + tick,
    "Changed.",
    "## 受け入れ条件との対応",
    "Done.",
  ].join("\n");
  const result = validatePullRequestBody(template, body);

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingHeadings, []);
  assert.deepEqual(extractH2Headings(body), [
    "Why",
    "変更内容",
    "受け入れ条件との対応",
  ]);

  // The same heading-looking text in an ordinary code span is still ignored.
  assert.deepEqual(
    extractH2Headings("## Why\nExample: " + tick + "## 変更内容" + tick + "\n## 受け入れ条件との対応"),
    ["Why", "受け入れ条件との対応"],
  );
});


test("inline code spans in the middle of H2 titles retain their text", () => {
  const tick = String.fromCharCode(96);
  const headingTemplate = [
    "## Why",
    "## 変更対象は nxc のみ",
    "## 受け入れ条件との対応",
  ].join("\n");
  const body = [
    "## Why",
    "Reason.",
    "## 変更対象は " + tick + "nxc" + tick + " のみ",
    "Changed.",
    "## 受け入れ条件との対応",
    "Done.",
  ].join("\n");
  const result = validatePullRequestBody(headingTemplate, body);

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingHeadings, []);
  assert.deepEqual(extractH2Headings(body), [
    "Why",
    "変更対象は nxc のみ",
    "受け入れ条件との対応",
  ]);

  // Inline-code text in ordinary prose must still be excluded from headings.
  assert.deepEqual(
    extractH2Headings("## Why\nExample: " + tick + "## 変更対象は nxc のみ" + tick + "\n## 受け入れ条件との対応"),
    ["Why", "受け入れ条件との対応"],
  );
});


test("emphasis and strong emphasis in H2 titles normalize to rendered heading text", () => {
  const headingTemplate = [
    "## Why",
    "## 変更内容",
    "## 受け入れ条件との対応",
    "## 変更対象は nxc のみ",
  ].join("\n");
  const body = [
    "## *Why*",
    "Reason.",
    "## **変更内容**",
    "Changed.",
    "## __受け入れ条件との対応__",
    "Done.",
    "## 変更対象は **nxc** のみ",
  ].join("\n");
  const result = validatePullRequestBody(headingTemplate, body);

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingHeadings, []);
  assert.deepEqual(extractH2Headings(body), [
    "Why",
    "変更内容",
    "受け入れ条件との対応",
    "変更対象は nxc のみ",
  ]);
});

test("emphasis characters inside inline code in H2 titles remain literal", () => {
  const tick = String.fromCharCode(96);
  const heading = "## " + tick + "*literal* and _literal_" + tick;
  const headingTemplate = [
    "## Why",
    heading,
    "## 受け入れ条件との対応",
  ].join("\n");
  const body = [
    "## Why",
    heading,
    "## 受け入れ条件との対応",
  ].join("\n");
  const result = validatePullRequestBody(headingTemplate, body);

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingHeadings, []);
  assert.deepEqual(extractH2Headings(body), [
    "Why",
    "*literal* and _literal_",
    "受け入れ条件との対応",
  ]);
});


test("fenced code blocks opened inside list items cannot satisfy required sections", () => {
  const fence = String.fromCharCode(96).repeat(3);
  const headingTemplate = ["## Why", "## 補足・設計詳細"].join("\n");

  for (const marker of ["- ", "1. "]) {
    const body = [
      "## Why",
      "Reason.",
      marker + fence + "markdown",
      "  ## 補足・設計詳細",
      "  " + fence,
    ].join("\n");
    const result = validatePullRequestBody(headingTemplate, body);

    assert.equal(result.ok, false, marker);
    assert.deepEqual(result.missingHeadings, ["補足・設計詳細"], marker);
    assert.deepEqual(extractH2Headings(body), ["Why"], marker);
  }
});

test("inline links in H2 titles normalize to their rendered link text", () => {
  const headingTemplate = [
    "## Why",
    "## 変更内容",
    "## 受け入れ条件との対応",
  ].join("\n");
  const body = [
    "## [Why](#details)",
    "Reason.",
    '## [変更内容](https://example.com/path_(section) "title")',
    "Changed.",
    "## [受け入れ条件との対応](#acceptance)",
    "Done.",
  ].join("\n");
  const result = validatePullRequestBody(headingTemplate, body);

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingHeadings, []);
  assert.deepEqual(extractH2Headings(body), [
    "Why",
    "変更内容",
    "受け入れ条件との対応",
  ]);
});


test("H2 headings inside list item content do not satisfy top-level required sections", () => {
  const headingTemplate = [
    "## Why",
    "## 変更内容",
    "## 受け入れ条件との対応",
  ].join("\n");

  for (const [marker, childIndent] of [
    ["- Example:", "  "],
    ["1. Example:", "   "],
  ]) {
    const nestedOnly = [
      "## Why",
      "Reason.",
      marker,
      childIndent + "## 変更内容",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n");
    const nestedResult = validatePullRequestBody(headingTemplate, nestedOnly);

    assert.equal(nestedResult.ok, false, marker);
    assert.deepEqual(nestedResult.missingHeadings, ["変更内容"], marker);
    assert.deepEqual(extractH2Headings(nestedOnly), [
      "Why",
      "受け入れ条件との対応",
    ], marker);

    const topLevelAlsoPresent = [
      nestedOnly,
      "",
      "## 変更内容",
      "Changed.",
    ].join("\n");
    const topLevelResult = validatePullRequestBody(headingTemplate, topLevelAlsoPresent);

    assert.equal(topLevelResult.ok, true, marker);
    assert.deepEqual(topLevelResult.missingHeadings, [], marker);
    assert.deepEqual(extractH2Headings(topLevelAlsoPresent), [
      "Why",
      "受け入れ条件との対応",
      "変更内容",
    ], marker);
  }
});

test("list-contained H2 headings after a blank line remain non-top-level", () => {
  const body = [
    "## Why",
    "Reason.",
    "- Example:",
    "",
    "  ## 変更内容",
    "## 受け入れ条件との対応",
    "Done.",
  ].join("\n");
  const result = validatePullRequestBody(template, body);

  assert.equal(result.ok, false);
  assert.deepEqual(result.missingHeadings, ["変更内容"]);
  assert.deepEqual(extractH2Headings(body), [
    "Why",
    "受け入れ条件との対応",
  ]);
});


test("two consecutive blank lines end a list before an indented top-level H2", () => {
  const body = [
    "## Why",
    "Reason.",
    "- list item",
    "",
    "",
    "  ## 変更内容",
    "Changed.",
    "## 受け入れ条件との対応",
    "Done.",
  ].join("\n");

  const result = validatePullRequestBody(template, body);

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingHeadings, []);
  assert.deepEqual(extractH2Headings(body), [
    "Why",
    "変更内容",
    "受け入れ条件との対応",
  ]);
});

test("tab-expanded list content indentation keeps following top-level H2 headings", () => {
  const body = [
    "## Why",
    "-\tlist item",
    "   ## 変更内容",
    "## 受け入れ条件との対応",
  ].join("\n");

  const result = validatePullRequestBody(template, body);

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingHeadings, []);
  assert.deepEqual(extractH2Headings(body), [
    "Why",
    "変更内容",
    "受け入れ条件との対応",
  ]);
});

test("reference and shortcut reference links normalize only when definitions exist", () => {
  const headingTemplate = [
    "## Why",
    "## 変更内容",
    "## 受け入れ条件との対応",
  ].join("\n");
  const body = [
    "## [Why][section]",
    "Reason.",
    "## [変更内容][]",
    "Changed.",
    "## [受け入れ条件との対応]",
    "Done.",
    "",
    "[section]: #why",
    "[変更内容]: #changes",
    "[受け入れ条件との対応]: #acceptance",
  ].join("\n");
  const result = validatePullRequestBody(headingTemplate, body);

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingHeadings, []);
  assert.deepEqual(extractH2Headings(body), [
    "Why",
    "変更内容",
    "受け入れ条件との対応",
  ]);
});

test("bracketed heading text without reference definitions remains literal", () => {
  assert.deepEqual(
    extractH2Headings([
      "## [Why]",
      "## [Why][missing]",
      "## [Literal] title",
      "[section]: #other",
    ].join("\n")),
    ["[Why]", "[Why][missing]", "[Literal] title"],
  );
});



test("blank lines separated by a list-contained fenced code block do not end the list", () => {
  const fence = String.fromCharCode(96).repeat(3);
  const body = [
    "## Why",
    "Reason.",
    "- list item",
    "",
    "  " + fence + "md",
    "  example",
    "  " + fence,
    "",
    "  ## 変更内容",
    "Changed.",
    "## 受け入れ条件との対応",
    "Done.",
  ].join("\n");

  const result = validatePullRequestBody(template, body);

  assert.equal(result.ok, false);
  assert.deepEqual(result.missingHeadings, ["変更内容"]);
  assert.deepEqual(extractH2Headings(body), ["Why", "受け入れ条件との対応"]);
});

test("reference-looking text inside an open paragraph is not a link definition", () => {
  const body = [
    "## [Why]",
    "Reason text",
    "[Why]: /url",
    "## 変更内容",
    "Changed.",
    "## 受け入れ条件との対応",
    "Done.",
  ].join("\n");

  const result = validatePullRequestBody(template, body);

  assert.equal(result.ok, false);
  assert.deepEqual(result.missingHeadings, ["Why"]);
  assert.deepEqual(extractH2Headings(body), [
    "[Why]",
    "変更内容",
    "受け入れ条件との対応",
  ]);

  // A real definition may follow a completed heading block directly.
  assert.deepEqual(extractH2Headings("## [Why]\n[Why]: /why"), ["Why"]);
});

test("inline HTML tags in H2 titles normalize to rendered heading text", () => {
  const body = [
    "## <strong>Why</strong>",
    "Reason.",
    "## <em>変更内容</em>",
    "Changed.",
    "## <span data-label='acceptance'>受け入れ条件との対応</span>",
    "Done.",
  ].join("\n");

  const result = validatePullRequestBody(template, body);

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingHeadings, []);
  assert.deepEqual(extractH2Headings(body), [
    "Why",
    "変更内容",
    "受け入れ条件との対応",
  ]);
});


test("malformed or escaped inline HTML tag-like text cannot satisfy required headings", () => {
  const bodies = [
    {
      heading: "## <strong foo=>Why</strong>",
      expected: "<strong foo=>Why",
    },
    {
      heading: "## <strong data-label='unterminated>Why</strong>",
      expected: "<strong data-label='unterminated>Why",
    },
    {
      heading: "## \\<strong>Why\\</strong>",
      expected: "\\<strong>Why\\</strong>",
    },
  ];

  for (const item of bodies) {
    const body = [
      item.heading,
      "Reason.",
      "## 変更内容",
      "Changed.",
      "## 受け入れ条件との対応",
      "Done.",
    ].join("\n");
    const result = validatePullRequestBody(template, body);

    assert.equal(result.ok, false, item.heading);
    assert.deepEqual(result.missingHeadings, ["Why"], item.heading);
    assert.equal(extractH2Headings(body)[0], item.expected, item.heading);
  }
});

test("valid inline HTML attributes normalize to their rendered heading text", () => {
  const body = [
    "## <strong data-label='a > b' disabled>Why</strong>",
    "Reason.",
    "## 変更内容",
    "Changed.",
    "## 受け入れ条件との対応",
    "Done.",
  ].join("\n");
  const result = validatePullRequestBody(template, body);

  assert.equal(result.ok, true);
  assert.deepEqual(result.missingHeadings, []);
});

test("four-space setext-like lines do not interrupt paragraphs before reference definitions", () => {
  const body = [
    "## [Why]",
    "Reason text",
    "    ----",
    "[Why]: /url",
    "## 変更内容",
    "Changed.",
    "## 受け入れ条件との対応",
    "Done.",
  ].join("\n");
  const result = validatePullRequestBody(template, body);

  assert.equal(result.ok, false);
  assert.deepEqual(result.missingHeadings, ["Why"]);
  assert.deepEqual(extractH2Headings(body), [
    "[Why]",
    "変更内容",
    "受け入れ条件との対応",
  ]);
});


test("invalid inline link destinations remain literal in H2 headings", () => {
  const body = [
    "## [Why](not a link)",
    "Reason.",
    "## 変更内容",
    "Changed.",
    "## 受け入れ条件との対応",
    "Done.",
  ].join("\n");
  const result = validatePullRequestBody(template, body);

  assert.equal(result.ok, false);
  assert.deepEqual(result.missingHeadings, ["Why"]);
  assert.deepEqual(extractH2Headings(body), [
    "[Why](not a link)",
    "変更内容",
    "受け入れ条件との対応",
  ]);
});

test("reference definitions reject unbalanced bare destinations", () => {
  const body = [
    "## [Why]",
    "[Why]: (broken",
    "## 変更内容",
    "Changed.",
    "## 受け入れ条件との対応",
    "Done.",
  ].join("\n");
  const result = validatePullRequestBody(template, body);

  assert.equal(result.ok, false);
  assert.deepEqual(result.missingHeadings, ["Why"]);
  assert.deepEqual(extractH2Headings(body), [
    "[Why]",
    "変更内容",
    "受け入れ条件との対応",
  ]);
});

test("invalid backtick-fence info strings do not interrupt an open paragraph", () => {
  const tick = String.fromCharCode(96);
  const body = [
    "## [Why]",
    "Reason text",
    tick.repeat(3) + "bad" + tick + "info",
    "[Why]: /url",
    "## 変更内容",
    "Changed.",
    "## 受け入れ条件との対応",
    "Done.",
  ].join("\n");
  const result = validatePullRequestBody(template, body);

  assert.equal(result.ok, false);
  assert.deepEqual(result.missingHeadings, ["Why"]);
  assert.deepEqual(extractH2Headings(body), [
    "[Why]",
    "変更内容",
    "受け入れ条件との対応",
  ]);
});

test("setext-like lines without a preceding paragraph do not interrupt definitions", () => {
  const body = [
    "## [Why]",
    "===",
    "[Why]: /url",
    "## 変更内容",
    "Changed.",
    "## 受け入れ条件との対応",
    "Done.",
  ].join("\n");
  const result = validatePullRequestBody(template, body);

  assert.equal(result.ok, false);
  assert.deepEqual(result.missingHeadings, ["Why"]);
  assert.deepEqual(extractH2Headings(body), [
    "[Why]",
    "変更内容",
    "受け入れ条件との対応",
  ]);
});
