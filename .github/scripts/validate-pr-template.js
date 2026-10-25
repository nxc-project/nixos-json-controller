"use strict";

const INLINE_CODE_TEXT_START = String.fromCharCode(0xe000);
const INLINE_CODE_TEXT_END = String.fromCharCode(0xe001);

function withoutInlineCodeAndHtmlComments(markdown) {
  const source = String(markdown || "");
  const output = [];
  const backtick = String.fromCharCode(96);

  function maskRange(start, end) {
    let masked = "";
    for (let cursor = start; cursor < end; cursor += 1) {
      masked += source[cursor] === "\n" || source[cursor] === "\r"
        ? source[cursor]
        : " ";
    }
    output.push(masked);
  }

  function isAtxH2HeadingLine(index) {
    const lineStart = source.lastIndexOf("\n", index - 1) + 1;
    const lineBreak = source.indexOf("\n", index);
    const lineEnd = lineBreak < 0 ? source.length : lineBreak;
    const line = source.slice(lineStart, lineEnd).replace(/\r$/, "");
    const headingStart = line.match(/^ {0,3}##[ \t]+/);

    // Check the whole physical line, not just the prefix before this code
    // span, so code spans anywhere in an ATX H2 title keep their text.
    return Boolean(headingStart && index >= lineStart + headingStart[0].length);
  }

  function isEscapedBacktick(index) {
    let backslashCount = 0;
    for (let cursor = index - 1; cursor >= 0 && source[cursor] === "\\"; cursor -= 1) {
      backslashCount += 1;
    }
    return backslashCount % 2 === 1;
  }

  function isBlockBoundaryLine(line) {
    const content = line.replace(/^ {0,3}/, "");
    return (
      /^[ \t]*$/.test(line) ||
      /^#{1,6}(?:[ \t]+|$)/.test(content) ||
      /^(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(content) ||
      /^(?:=+[ \t]*|-{1,2}[ \t]*)$/.test(content) ||
      /^>/.test(content) ||
      /^(?:[-+*][ \t]+|0{0,8}1[.)][ \t]+)/.test(content)
    );
  }

  function inlineBlockEnd(startIndex) {
    const firstLineStart = source.lastIndexOf("\n", startIndex - 1) + 1;
    const firstLineBreak = source.indexOf("\n", startIndex);
    const firstLineEnd = firstLineBreak < 0 ? source.length : firstLineBreak;
    const firstLine = source.slice(firstLineStart, firstLineEnd).replace(/\r$/, "");

    // Inline parsing inside a block-start line cannot continue into the next block.
    if (isBlockBoundaryLine(firstLine)) {
      return firstLineEnd;
    }

    let lineStart = firstLineBreak < 0 ? source.length : firstLineBreak + 1;
    while (lineStart < source.length) {
      const lineBreak = source.indexOf("\n", lineStart);
      const lineEnd = lineBreak < 0 ? source.length : lineBreak;
      const line = source.slice(lineStart, lineEnd).replace(/\r$/, "");
      if (isBlockBoundaryLine(line)) {
        return lineStart;
      }
      if (lineBreak < 0) {
        break;
      }
      lineStart = lineBreak + 1;
    }

    return source.length;
  }

  function rawHtmlTagEnd(startIndex) {
    const opening = source.slice(startIndex).match(/^<\/?[A-Za-z][A-Za-z0-9-]*(?=[\s/>])/);
    if (!opening) {
      return -1;
    }

    let quote = null;
    for (let cursor = startIndex + opening[0].length; cursor < source.length; cursor += 1) {
      const character = source[cursor];

      if (quote) {
        if (character === quote) {
          quote = null;
        }
        continue;
      }

      if (character === '"' || character === "'") {
        quote = character;
        continue;
      }

      if (character === ">") {
        return cursor + 1;
      }
    }

    return -1;
  }

  for (let index = 0; index < source.length;) {
    // Do not interpret comment-like text inside quoted HTML attributes as a
    // real comment. Treat a complete tag as one unit before checking <!--.
    const htmlTagEnd = source[index] === "<" ? rawHtmlTagEnd(index) : -1;
    if (htmlTagEnd > index) {
      output.push(source.slice(index, htmlTagEnd));
      index = htmlTagEnd;
      continue;
    }

    if (source[index] === backtick) {
      let openingEnd = index;
      while (source[openingEnd] === backtick) {
        openingEnd += 1;
      }

      if (isEscapedBacktick(index)) {
        output.push(source.slice(index, openingEnd));
        index = openingEnd;
        continue;
      }

      const delimiterLength = openingEnd - index;
      const blockEnd = inlineBlockEnd(index);
      let search = openingEnd;
      let closingEnd = -1;

      while (search < blockEnd) {
        if (source[search] !== backtick) {
          search += 1;
          continue;
        }

        let runEnd = search;
        while (source[runEnd] === backtick) {
          runEnd += 1;
        }

        if (runEnd - search === delimiterLength) {
          closingEnd = runEnd;
          break;
        }

        search = runEnd;
      }

      if (closingEnd >= 0) {
        if (isAtxH2HeadingLine(index)) {
          // Inline code is part of an ATX heading's title. Drop its delimiters
          // without adding replacement spaces, preserving the exact title text
          // (including the spacing around code spans).
          const closingStart = closingEnd - delimiterLength;
          // Preserve code-span text as literal heading content, marked so
          // emphasis normalization does not interpret '*' or '_' inside it.
          output.push(
            INLINE_CODE_TEXT_START +
            source.slice(openingEnd, closingStart) +
            INLINE_CODE_TEXT_END,
          );
        } else {
          // Elsewhere, code spans are masked to prevent heading-like content
          // inside inline code from being counted as a real section.
          maskRange(index, closingEnd);
        }
        index = closingEnd;
      } else {
        // An unmatched backtick run is literal Markdown, not an inline code span.
        output.push(source.slice(index, openingEnd));
        index = openingEnd;
      }
      continue;
    }

    if (source.startsWith("<!--", index)) {
      const commentClose = source.indexOf("-->", index + 4);
      const commentEnd = commentClose < 0 ? source.length : commentClose + 3;
      maskRange(index, commentEnd);
      index = commentEnd;
      continue;
    }

    output.push(source[index]);
    index += 1;
  }

  return output.join("");
}

const fs = require("node:fs");
const path = require("node:path");

function withoutCommentsAndCode(markdown) {
  // Handle block-level constructs first so fences inside raw HTML cannot end
  // that block, while fences outside HTML prevent their contents from being
  // interpreted as HTML.
  return withoutInlineCodeAndHtmlComments(withoutRawHtmlBlocks(String(markdown || "")));
}

function isCompleteHtmlTag(content) {
  const closingTag = content.match(/^<\/([A-Za-z][A-Za-z0-9-]*)[ \t]*>[ \t]*$/);
  if (closingTag) {
    return true;
  }

  const tagStart = content.match(/^<([A-Za-z][A-Za-z0-9-]*)/);
  if (!tagStart) {
    return false;
  }

  const tagName = tagStart[1].toLowerCase();
  let index = tagStart[0].length;

  while (index < content.length) {
    const whitespaceStart = index;
    while (content[index] === " " || content[index] === "\t") {
      index += 1;
    }
    const hadWhitespace = index > whitespaceStart;

    if (content[index] === ">") {
      return /^[ \t]*$/.test(content.slice(index + 1));
    }

    if (content[index] === "/" && content[index + 1] === ">") {
      return (
        /^[ \t]*$/.test(content.slice(index + 2)) &&
        !["pre", "script", "style", "textarea"].includes(tagName)
      );
    }

    // Attribute names must be separated from the tag name / previous
    // attribute by whitespace. This rejects malformed forms such as foo=>.
    if (!hadWhitespace) {
      return false;
    }

    const attributeName = content.slice(index).match(/^[A-Za-z_:][A-Za-z0-9_.:-]*/);
    if (!attributeName) {
      return false;
    }
    index += attributeName[0].length;

    const afterName = index;
    while (content[index] === " " || content[index] === "\t") {
      index += 1;
    }

    if (content[index] !== "=") {
      // Boolean attributes are valid; return to the attribute boundary so
      // the next loop can consume any separator before the next attribute.
      if (index === afterName && content[index] !== ">" &&
          !(content[index] === "/" && content[index + 1] === ">")) {
        return false;
      }
      index = afterName;
      continue;
    }

    index += 1;
    while (content[index] === " " || content[index] === "\t") {
      index += 1;
    }

    const quote = content[index];
    if (quote === '"' || quote === "'") {
      index += 1;
      const valueEnd = content.indexOf(quote, index);
      if (valueEnd < 0) {
        return false;
      }
      index = valueEnd + 1;
    } else {
      const value = content.slice(index).match(/^[^ \t"'=<> \x60]+/);
      if (!value) {
        return false;
      }
      index += value[0].length;
    }

    if (
      content[index] !== undefined &&
      content[index] !== " " &&
      content[index] !== "\t" &&
      content[index] !== ">" &&
      !(content[index] === "/" && content[index + 1] === ">")
    ) {
      return false;
    }
  }

  return false;
}
function withoutRawHtmlBlocks(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const visibleLines = [];
  const grave = String.fromCharCode(96);
  let activeBlock = null;
  let activeFence = null;
  let activeList = null;
  let paragraphOpen = false;
  const blockTags =
    "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|" +
    "dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|" +
    "frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|" +
    "menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|" +
    "summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";

  for (const line of lines) {
    if (activeBlock) {
      const closes = activeBlock.endPattern && activeBlock.endPattern.test(line);
      const endsAtBlank = activeBlock.untilBlank && line.trim() === "";
      if (closes) {
        activeBlock = null;
      } else if (endsAtBlank) {
        activeBlock = null;
        visibleLines.push(line);
      }
      if (line.trim() === "") {
        paragraphOpen = false;
      }
      // Fences inside a raw HTML block are literal HTML content, not Markdown.
      continue;
    }

    // Outside raw HTML, fenced code blocks take precedence over HTML parsing.
    if (activeFence) {
      // A fence nested in a list item may be indented to the list item's
      // content column (plus the usual three-space fence allowance).
      const maxFenceIndent = activeFence.listContentIndent === undefined
        ? 3
        : activeFence.listContentIndent + 3;
      const closing = line.match(new RegExp("^ {0," + maxFenceIndent + "}(" + grave + "+|~+)[ \\t]*$"));
      if (
        closing &&
        closing[1][0] === activeFence.character &&
        closing[1].length >= activeFence.length
      ) {
        activeFence = null;
      }
      visibleLines.push("");
      paragraphOpen = false;
      continue;
    }

    // CommonMark allows a fenced code block to begin immediately after a
    // list marker. Mask the opening list item line and its following fenced
    // content as a single block; otherwise an apparent H2 inside it could
    // incorrectly satisfy a required PR-template section.
    const listFenceOpening = line.match(new RegExp("^( {0,3})([-+*]|[0-9]{1,9}[.)])([ ]{1,4})(" + grave + "{3,}|~{3,})(.*)$"));
    if (listFenceOpening) {
      const character = listFenceOpening[4][0];
      const info = listFenceOpening[5];
      if (!(character === grave && info.includes(grave))) {
        activeFence = {
          character,
          length: listFenceOpening[4].length,
          listContentIndent:
            listFenceOpening[1].length +
            listFenceOpening[2].length +
            listFenceOpening[3].length,
        };
        visibleLines.push("");
        paragraphOpen = false;
        continue;
      }
    }

    const opening = line.match(new RegExp("^ {0,3}(" + grave + "{3,}|~{3,})(.*)$"));
    if (opening) {
      const character = opening[1][0];
      const info = opening[2];
      // CommonMark disallows backticks in a backtick fence info string.
      if (!(character === grave && info.includes(grave))) {
        activeFence = { character, length: opening[1].length };
        visibleLines.push("");
        paragraphOpen = false;
        continue;
      }
    }

    // Blank lines always close paragraphs, including lines made only of
    // spaces or tabs. Keep list state across blank lines because a following
    // sufficiently indented block may still belong to the list item.
    if (line.trim() === "") {
      visibleLines.push(line);
      paragraphOpen = false;
      continue;
    }

    const currentIndent = line.match(/^ */)[0].length;
    const listMarker = line.match(/^ {0,3}([-+*]|[0-9]{1,9}[.)])([ \t]+)/);

    // H2 headings inside a list item's content column are not top-level
    // template sections. Ignore them for section matching, but keep normal
    // parsing for the rest of the list content so existing HTML/code handling
    // continues to work. A non-indented line outside a sibling list item ends
    // the current list container.
    if (activeList) {
      const isSiblingOrOuterListItem =
        listMarker && listMarker[0].length > 0 &&
        listMarker[0].match(/^ */)[0].length <= activeList.markerIndent;
      if (isSiblingOrOuterListItem) {
        activeList = null;
      } else if (!listMarker && currentIndent < activeList.contentIndent) {
        activeList = null;
      } else if (currentIndent >= activeList.contentIndent) {
        const listContent = line.slice(activeList.contentIndent);
        if (/^ {0,3}##[ \t]+/.test(listContent)) {
          visibleLines.push("");
          paragraphOpen = false;
          continue;
        }
      }
    }

    // An indented line continues an already-open paragraph, but starts
    // an indented code block when no paragraph is open. Mask code-block
    // contents here so literal HTML comment markers are not parsed later.
    if (/^(?: {4,}|\t)/.test(line)) {
      visibleLines.push(paragraphOpen ? line : "");
      continue;
    }

    const contentMatch = line.match(/^ {0,3}(.*)$/);
    if (!contentMatch || !contentMatch[1]) {
      visibleLines.push(line);
      paragraphOpen = false;
      continue;
    }

    const content = contentMatch[1];

    // ATX headings interrupt paragraphs.
    if (/^#{1,6}(?:[ \t]+|$)/.test(content)) {
      visibleLines.push(line);
      paragraphOpen = false;
      continue;
    }

    // Thematic breaks and setext underlines close the current paragraph too.
    if (
      /^(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(content) ||
      /^(?:=+[ \t]*|-{1,2}[ \t]*)$/.test(content)
    ) {
      visibleLines.push(line);
      paragraphOpen = false;
      continue;
    }

    // Block quote and list item markers start block containers and close
    // a paragraph at the current nesting level. Track a list item's content
    // column so a child H2 cannot be mistaken for a top-level required section.
    const listItem = content.match(/^([-+*]|[0-9]{1,9}[.)])([ \t]+)/);
    const startsOrderedList = listItem && /^[0-9]{1,9}[.)]$/.test(listItem[1]) &&
      /^0{0,8}1[.)]$/.test(listItem[1]);
    const startsListItem = listItem && (
      !paragraphOpen ||
      !/^[0-9]/.test(listItem[1]) ||
      startsOrderedList ||
      (activeList && line.match(/^ */)[0].length >= activeList.contentIndent)
    );
    if (/^>/.test(content) || startsListItem) {
      if (listItem) {
        const markerIndent = line.match(/^ */)[0].length;
        if (!activeList || markerIndent <= activeList.markerIndent) {
          activeList = {
            markerIndent,
            contentIndent: markerIndent + listItem[1].length + listItem[2].length,
          };
        }
      }
      visibleLines.push(line);
      paragraphOpen = false;
      continue;
    }

    const rawTag = content.match(/^<(script|pre|style|textarea)(?=[ \t>]|$)/i);
    if (rawTag) {
      // CommonMark type 1 ends at any of these close tags, not only the tag
      // corresponding to the opening element.
      const tagEnd = /<\/(?:pre|script|style|textarea)\s*>/i;
      if (!tagEnd.test(content)) {
        activeBlock = { endPattern: tagEnd };
      }
      paragraphOpen = false;
      continue;
    }

    const specialBlocks = [
      { start: /^<!--/, end: /-->/ },
      { start: /^<\?/, end: /\?>/ },
      { start: /^<!\[CDATA\[/, end: /\]\]>/ },
      { start: /^<![A-Z]/i, end: />/ },
    ];
    const special = specialBlocks.find((block) => block.start.test(content));
    if (special) {
      if (!special.end.test(content)) {
        activeBlock = { endPattern: special.end };
      }
      paragraphOpen = false;
      continue;
    }

    const blockTag = new RegExp("^(?:</?(?:" + blockTags + ")(?=[ \t/>]|$))", "i");
    if (blockTag.test(content)) {
      activeBlock = { untilBlank: true };
      paragraphOpen = false;
      continue;
    }

    // CommonMark raw HTML block type 7 cannot interrupt an open paragraph.
    // Recognize a complete tag only when no paragraph is currently open,
    // while still ignoring '>' characters inside quoted attribute values.
    if (isCompleteHtmlTag(content) && !paragraphOpen) {
      activeBlock = { untilBlank: true };
      paragraphOpen = false;
      continue;
    }

    visibleLines.push(line);
    paragraphOpen = true;
  }

  return visibleLines.join("\n");
}
function stripInlineLinks(text) {
  const source = String(text || "");
  let output = "";
  let cursor = 0;

  while (cursor < source.length) {
    let open = source.indexOf("[", cursor);
    while (open >= 0) {
      let slashCount = 0;
      for (let index = open - 1; index >= 0 && source[index] === "\\"; index -= 1) {
        slashCount += 1;
      }
      if (slashCount % 2 === 0 && !(open > 0 && source[open - 1] === "!")) {
        break;
      }
      open = source.indexOf("[", open + 1);
    }

    if (open < 0) {
      output += source.slice(cursor);
      break;
    }

    let depth = 1;
    let labelEnd = open + 1;
    while (labelEnd < source.length && depth > 0) {
      if (source[labelEnd] === "\\") {
        labelEnd += 2;
        continue;
      }
      if (source[labelEnd] === "[") depth += 1;
      if (source[labelEnd] === "]") depth -= 1;
      if (depth > 0) labelEnd += 1;
    }

    if (depth !== 0) {
      output += source.slice(cursor);
      break;
    }

    if (source[labelEnd + 1] !== "(") {
      output += source.slice(cursor, labelEnd + 1);
      cursor = labelEnd + 1;
      continue;
    }

    depth = 1;
    let linkEnd = labelEnd + 2;
    while (linkEnd < source.length && depth > 0) {
      if (source[linkEnd] === "\\") {
        linkEnd += 2;
        continue;
      }
      if (source[linkEnd] === "(") depth += 1;
      if (source[linkEnd] === ")") depth -= 1;
      if (depth > 0) linkEnd += 1;
    }

    if (depth !== 0) {
      output += source.slice(cursor, labelEnd + 1);
      cursor = labelEnd + 1;
      continue;
    }

    output += source.slice(cursor, open) + source.slice(open + 1, labelEnd);
    cursor = linkEnd + 1;
  }

  return output;
}

function stripInlineEmphasis(text) {
  // Normalize simple CommonMark emphasis and strong-emphasis delimiters so
  // headings with equivalent rendered text compare equally.
  let normalized = text;
  let previous;
  do {
    previous = normalized;
    normalized = normalized.replace(/(?<!\\)(\*{1,3})(?=\S)(.+?)(?<=\S)\1/g, "$2");
    // Underscore emphasis cannot open or close within an alphanumeric word.
    normalized = normalized.replace(
      /(?<![\p{L}\p{N}])(_{1,3})(?=\S)(.+?)(?<=\S)\1(?![\p{L}\p{N}])/gu,
      "$2",
    );
  } while (normalized !== previous);
  return normalized;
}

function normalizeInlineHeadingText(text) {
  const segments = [];
  let cursor = 0;

  while (cursor < text.length) {
    const codeStart = text.indexOf(INLINE_CODE_TEXT_START, cursor);
    if (codeStart < 0) {
      segments.push(stripInlineEmphasis(stripInlineLinks(text.slice(cursor))));
      break;
    }

    segments.push(stripInlineEmphasis(stripInlineLinks(text.slice(cursor, codeStart))));
    const codeContentStart = codeStart + INLINE_CODE_TEXT_START.length;
    const codeEnd = text.indexOf(INLINE_CODE_TEXT_END, codeContentStart);
    if (codeEnd < 0) {
      segments.push(text.slice(codeContentStart));
      break;
    }

    segments.push(text.slice(codeContentStart, codeEnd));
    cursor = codeEnd + INLINE_CODE_TEXT_END.length;
  }

  return segments.join("");
}

function extractH2Headings(markdown) {
  const headings = [];

  for (const line of withoutCommentsAndCode(markdown).split(/\r?\n/)) {
    // CommonMark ATX headings allow up to three leading spaces and an optional
    // closing sequence of hash characters preceded by whitespace.
    const match = line.match(/^ {0,3}##[ \t]+(.+?)[ \t]*$/);
    if (!match) {
      continue;
    }

    const rawHeading = match[1].replace(/[ \t]+#+[ \t]*$/, "").trim();
    const heading = normalizeInlineHeadingText(rawHeading).trim();
    if (heading) {
      headings.push(heading);
    }
  }

  return headings;
}
function validatePullRequestBody(template, body) {
  const requiredHeadings = extractH2Headings(template);
  const presentHeadings = new Set(extractH2Headings(body));
  const missingHeadings = requiredHeadings.filter((heading) => !presentHeadings.has(heading));

  return {
    ok: requiredHeadings.length > 0 && missingHeadings.length === 0,
    requiredHeadings,
    missingHeadings,
  };
}

function validateEvent(eventPath, templatePath) {
  if (!eventPath) {
    throw new Error("Usage: node validate-pr-template.js <github-event-json-path>");
  }

  const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  const body = event.pull_request && event.pull_request.body;
  if (typeof body !== "string") {
    throw new Error("The GitHub event does not contain a pull request body.");
  }

  const template = fs.readFileSync(
    templatePath || path.join(__dirname, "..", "pull_request_template.md"),
    "utf8",
  );
  const result = validatePullRequestBody(template, body);

  if (!result.requiredHeadings.length) {
    throw new Error("No H2 headings were found in the pull request template.");
  }

  if (!result.ok) {
    process.stderr.write(
      [
        "PR body is missing sections from .github/pull_request_template.md:",
        ...result.missingHeadings.map((heading) => "- ## " + heading),
        "",
        "Fill every template section. Use '該当なし' when a section does not apply.",
      ].join("\n") + "\n",
    );
    return false;
  }

  process.stdout.write(
    "PR body contains all " + result.requiredHeadings.length + " required template sections.\n",
  );
  return true;
}

if (require.main === module) {
  try {
    process.exitCode = validateEvent(process.argv[2], process.argv[3]) ? 0 : 1;
  } catch (error) {
    process.stderr.write(error.message + "\n");
    process.exitCode = 1;
  }
}

module.exports = { extractH2Headings, validatePullRequestBody, validateEvent };
