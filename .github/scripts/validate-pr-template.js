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
  let consecutiveBlankLines = 0;
  let paragraphOpen = false;
  const blockTags =
    "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|" +
    "dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|" +
    "frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|" +
    "menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|" +
    "summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    // Reset the list-terminating blank-line counter on every nonblank line,
    // including fence and raw-HTML lines that exit through an early continue.
    if (line.trim() !== "") {
      consecutiveBlankLines = 0;
    }

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
      const marker = listFenceOpening[2];
      const markerIndent = listFenceOpening[1].length;
      const orderedListMayInterruptParagraph = /^0{0,8}1[.)]$/.test(marker);
      const continuesActiveList = activeList && markerIndent >= activeList.contentIndent;
      // Match the paragraph-interruption rules used by startsListItem below.
      // In an open paragraph, ordered markers other than 1 cannot start a new
      // list (unless this is a continuation inside an existing list item).
      const startsListItemHere =
        !paragraphOpen ||
        !/^[0-9]/.test(marker) ||
        orderedListMayInterruptParagraph ||
        continuesActiveList;

      const character = listFenceOpening[4][0];
      const info = listFenceOpening[5];
      if (startsListItemHere && !(character === grave && info.includes(grave))) {
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

    // A single blank line may separate loose list-item blocks, but two
    // consecutive blank lines end the list container. Do not let stale list
    // state mask a subsequent top-level H2 that happens to be indented.
    if (line.trim() === "") {
      consecutiveBlankLines += 1;
      if (consecutiveBlankLines >= 2) {
        activeList = null;
      }
      visibleLines.push(line);
      paragraphOpen = false;
      continue;
    }
    consecutiveBlankLines = 0;

    function indentationColumns(value) {
      let column = 0;
      for (const character of value) {
        if (character === " ") {
          column += 1;
        } else if (character === "\t") {
          column += 4 - (column % 4);
        } else {
          break;
        }
      }
      return column;
    }

    function listContentColumn(markerIndent, marker, separator) {
      let column = markerIndent + marker.length;
      for (const character of separator) {
        if (character === " ") {
          column += 1;
        } else if (character === "\t") {
          column += 4 - (column % 4);
        }
      }
      return column;
    }

    function afterIndentColumns(value, requestedColumns) {
      let column = 0;
      let index = 0;
      while (index < value.length && (value[index] === " " || value[index] === "\t") && column < requestedColumns) {
        column += value[index] === " " ? 1 : 4 - (column % 4);
        index += 1;
      }
      return column >= requestedColumns ? value.slice(index) : null;
    }

    const currentIndent = indentationColumns(line);
    const listMarker = line.match(/^ {0,3}([-+*]|[0-9]{1,9}[.)])([ \t]+)/);

    // H2 headings inside a list item's content column are not top-level
    // template sections. Ignore them for section matching, but keep normal
    // parsing for the rest of the list content so existing HTML/code handling
    // continues to work. A non-indented line outside a sibling list item ends
    // the current list container.
    if (activeList) {
      const isSiblingOrOuterListItem =
        listMarker && listMarker[0].length > 0 &&
        indentationColumns(line) <= activeList.markerIndent;
      if (isSiblingOrOuterListItem) {
        activeList = null;
      } else if (!listMarker && currentIndent < activeList.contentIndent) {
        activeList = null;
      } else if (currentIndent >= activeList.contentIndent) {
        const listContent = afterIndentColumns(line, activeList.contentIndent);
        if (listContent !== null && /^ {0,3}##[ \t]+/.test(listContent)) {
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

    // A valid reference definition is a block-level construct, not paragraph
    // text. Keep its paragraph state unchanged so a following type-7 HTML tag
    // starts a raw HTML block when Markdown permits it.
    const referenceDefinition = parseReferenceLinkDefinition(lines, lineIndex);
    if (referenceDefinition && !paragraphOpen) {
      // Link definitions are not rendered content. Mask continuation lines as
      // well so a destination or multi-line title cannot masquerade as an H2.
      visibleLines.push(line);
      for (let offset = 1; offset < referenceDefinition.lineCount; offset += 1) {
        // Keep a destination continuation visible to the reference-definition
        // collector; mask later title continuation lines so they cannot look
        // like H2 headings.
        visibleLines.push(
          offset < referenceDefinition.destinationLineCount
            ? lines[lineIndex + offset]
            : "",
        );
      }
      lineIndex += referenceDefinition.lineCount - 1;
      continue;
    }

    // ATX headings interrupt paragraphs.
    if (/^#{1,6}(?:[ \t]+|$)/.test(content)) {
      visibleLines.push(line);
      paragraphOpen = false;
      continue;
    }

    // Thematic breaks can interrupt a paragraph, but setext underlines
    // are valid only when there is a preceding open paragraph to underline.
    const isThematicBreak =
      /^(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(content);
    const isSetextUnderline =
      paragraphOpen && /^(?:=+[ \t]*|-{1,2}[ \t]*)$/.test(content);
    if (isThematicBreak || isSetextUnderline) {
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
        const markerIndent = indentationColumns(line);
        if (!activeList || markerIndent <= activeList.markerIndent) {
          activeList = {
            markerIndent,
            contentIndent: listContentColumn(markerIndent, listItem[1], listItem[2]),
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
function normalizeReferenceLinkLabel(label) {
  const source = String(label || "");
  let unescaped = "";
  for (let index = 0; index < source.length; index += 1) {
    if (
      source[index] === "\\" &&
      index + 1 < source.length &&
      /^[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]$/.test(source[index + 1])
    ) {
      unescaped += source[index + 1];
      index += 1;
    } else {
      unescaped += source[index];
    }
  }
  return unescaped.trim().replace(/[ \t\r\n]+/g, " ").toLowerCase();
}

function parseReferenceTitleAt(lines, lineIndex, offset) {
  const firstLine = String(lines[lineIndex] || "");
  const opening = firstLine[offset];
  if (opening !== '"' && opening !== "'" && opening !== "(") return null;

  const closing = opening === "(" ? ")" : opening;
  let depth = opening === "(" ? 1 : 0;
  let currentLineIndex = lineIndex;
  let cursor = offset + 1;

  while (currentLineIndex < lines.length) {
    const line = String(lines[currentLineIndex] || "");
    while (cursor < line.length) {
      const character = line[cursor];
      if (character === "\\" && cursor + 1 < line.length) {
        cursor += 2;
        continue;
      }

      if (opening === "(" && character === "(") {
        depth += 1;
      } else if (character === closing) {
        if (opening !== "(" || --depth === 0) {
          if (line.slice(cursor + 1).trim() !== "") return null;
          return { lineCount: currentLineIndex - lineIndex + 1 };
        }
      }
      cursor += 1;
    }

    const nextLineIndex = currentLineIndex + 1;
    if (nextLineIndex >= lines.length || String(lines[nextLineIndex] || "").trim() === "") {
      return null;
    }
    currentLineIndex = nextLineIndex;
    cursor = 0;
  }

  return null;
}

function parseReferenceDestinationAt(line, offset) {
  const source = String(line || "");
  if (offset >= source.length) return null;

  if (source[offset] === "<") {
    let cursor = offset + 1;
    while (cursor < source.length) {
      const character = source[cursor];
      if (
        character === "\\" &&
        cursor + 1 < source.length &&
        /^[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]$/.test(source[cursor + 1])
      ) {
        cursor += 2;
        continue;
      }
      if (character === "<") return null;
      if (character === ">") {
        const destination = source.slice(offset, cursor + 1);
        return isValidLinkDestinationToken(destination)
          ? { destination, end: cursor + 1 }
          : null;
      }
      if (character === "\r" || character === "\n") return null;
      cursor += 1;
    }
    return null;
  }

  let cursor = offset;
  let parentheses = 0;
  while (cursor < source.length && !/[ \t\r\n]/.test(source[cursor]) && !/[\x00-\x08\x0B-\x1F\x7F]/.test(source[cursor])) {
    const character = source[cursor];

    if (character === "<" || character === ">") return null;

    if (
      character === "\\" &&
      cursor + 1 < source.length &&
      /^[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]$/.test(source[cursor + 1])
    ) {
      cursor += 2;
      continue;
    }

    if (character === "(") parentheses += 1;
    if (character === ")") {
      parentheses -= 1;
      if (parentheses < 0) return null;
    }
    cursor += 1;
  }

  if (cursor === offset || parentheses !== 0) return null;
  const destination = source.slice(offset, cursor);
  return isValidLinkDestinationToken(destination)
    ? { destination, end: cursor }
    : null;
}

function parseReferenceLinkDefinition(linesOrLine, startIndex = 0) {
  const lines = Array.isArray(linesOrLine) ? linesOrLine : [String(linesOrLine || "")];
  const line = String(lines[startIndex] || "");
  // Reference labels end at the first unescaped closing bracket.
  const content = line.replace(/^ {0,3}/, "");
  if (!content.startsWith("[")) return null;

  let closingBracket = -1;
  for (let index = 1; index < content.length; index += 1) {
    if (content[index] === "\\") {
      index += 1;
      continue;
    }
    if (content[index] === "[") return null;
    if (content[index] === "]") {
      closingBracket = index;
      break;
    }
  }

  if (closingBracket <= 1 || content[closingBracket + 1] !== ":") return null;
  const label = content.slice(1, closingBracket);
  if (!label.trim()) return null;

  let destinationLineIndex = startIndex;
  let tail = content.slice(closingBracket + 2);
  let destinationLine = line;
  let destinationOffset = (line.length - content.length) + closingBracket + 2;

  if (/^[ \t]*$/.test(tail)) {
    // CommonMark permits the destination to begin on the next physical line.
    destinationLineIndex += 1;
    if (destinationLineIndex >= lines.length || String(lines[destinationLineIndex] || "").trim() === "") {
      return null;
    }
    destinationLine = String(lines[destinationLineIndex] || "");
    const indentation = destinationLine.match(/^[ \t]*/)[0].length;
    destinationOffset = indentation;
    tail = destinationLine.slice(destinationOffset);
  } else {
    const whitespace = tail.match(/^[ \t]*/)[0].length;
    destinationOffset += whitespace;
    tail = tail.slice(whitespace);
  }

  const destinationMatch = parseReferenceDestinationAt(destinationLine, destinationOffset);
  if (!destinationMatch) return null;

  const remainder = destinationLine.slice(destinationMatch.end);
  let consumedLines = destinationLineIndex - startIndex + 1;
  const trailing = remainder.trim();

  if (trailing !== "") {
    // A title must be separated from its destination by whitespace.
    if (!/^[ \t]+/.test(remainder)) return null;
    const titleOffset = destinationMatch.end + remainder.match(/^[ \t]*/)[0].length;
    const title = parseReferenceTitleAt(lines, destinationLineIndex, titleOffset);
    if (!title) return null;
    consumedLines = Math.max(consumedLines, destinationLineIndex - startIndex + title.lineCount);
  } else {
    // A title may start on the next line, and quoted / parenthesized titles
    // may continue across several lines as long as they contain no blank line.
    const nextTitleLineIndex = destinationLineIndex + 1;
    if (nextTitleLineIndex < lines.length) {
      const nextLine = String(lines[nextTitleLineIndex] || "");
      const indentation = nextLine.match(/^[ \t]*/)[0].length;
      if (/["'(]/.test(nextLine[indentation] || "")) {
        const title = parseReferenceTitleAt(lines, nextTitleLineIndex, indentation);
        if (title) {
          consumedLines = Math.max(consumedLines, nextTitleLineIndex - startIndex + title.lineCount);
        }
      }
    }
  }

  return {
    label,
    destination: destinationMatch.destination,
    lineCount: consumedLines,
    destinationLineCount: destinationLineIndex - startIndex + 1,
  };
}
function isValidLinkDestinationToken(destination) {
  const token = String(destination || "");
  if (token.startsWith("<") && token.endsWith(">")) {
    const inner = token.slice(1, -1);
    for (let index = 0; index < inner.length; index += 1) {
      if (inner[index] === "\n" || inner[index] === "\r") return false;
      if (inner[index] === "\\") {
        // A backslash must escape an actual following character; a final
        // backslash means the apparent closing angle bracket was escaped.
        if (index + 1 >= inner.length) return false;
        index += 1;
        continue;
      }
      if (inner[index] === "<" || inner[index] === ">") return false;
    }
    return true;
  }

  if (!token) return false;
  let parentheses = 0;
  for (let index = 0; index < token.length; index += 1) {
    const character = token[index];
    if (/\s/.test(character) || character === "<" || character === ">") return false;
    if (character === "\\") {
      // A backslash before ASCII punctuation escapes that punctuation. Other
      // backslashes, including one at the end of a bare destination, are literal.
      if (
        index + 1 < token.length &&
        /^[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]$/.test(token[index + 1])
      ) {
        index += 1;
      }
      continue;
    }
    if (character === "(") parentheses += 1;
    if (character === ")") {
      parentheses -= 1;
      if (parentheses < 0) return false;
    }
  }
  return parentheses === 0;
}

function parseInlineLinkEnd(source, openingParen) {
  if (source[openingParen] !== "(") return -1;
  let cursor = openingParen + 1;
  const skipWhitespace = () => {
    while (source[cursor] === " " || source[cursor] === "\t") cursor += 1;
  };
  skipWhitespace();

  if (source[cursor] === ")") return cursor;

  if (source[cursor] === "<") {
    cursor += 1;
    let closed = false;
    while (cursor < source.length) {
      const character = source[cursor];
      if (character === "\n" || character === "\r") return -1;
      if (character === "\\") {
        cursor += 2;
        continue;
      }
      if (character === "<") return -1;
      if (character === ">") {
        cursor += 1;
        closed = true;
        break;
      }
      cursor += 1;
    }
    if (!closed) return -1;
  } else {
    let depth = 0;
    const destinationStart = cursor;
    while (cursor < source.length) {
      const character = source[cursor];
      if (character === "\\") {
        const next = source[cursor + 1];
        if (next === " " || next === "\t" || next === "\n" || next === "\r") {
          // Whitespace is not escaped. Preserve the backslash literally, then
          // let the next loop iteration terminate the bare destination.
          cursor += 1;
          continue;
        }
        if (next !== undefined && /^[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]$/.test(next)) {
          cursor += 2;
          continue;
        }
        // A backslash before a non-punctuation character is literal. Leave
        // the next character to be parsed normally.
        cursor += 1;
        continue;
      }
      if (character === " " || character === "\t" || character === "\n" || character === "\r") {
        if (depth > 0) return -1;
        break;
      }
      if (character === "<" || character === ">") return -1;
      if (character === "(") depth += 1;
      if (character === ")") {
        if (depth === 0) break;
        depth -= 1;
      }
      cursor += 1;
    }
    if (depth !== 0) return -1;
    if (cursor === destinationStart && source[cursor] !== ")") return -1;
  }

  const beforeWhitespace = cursor;
  skipWhitespace();
  if (source[cursor] === ")") return cursor;
  if (cursor === beforeWhitespace) return -1;

  const titleOpen = source[cursor];
  if (titleOpen !== '"' && titleOpen !== "'" && titleOpen !== "(") return -1;
  const titleClose = titleOpen === "(" ? ")" : titleOpen;
  let titleDepth = titleOpen === "(" ? 1 : 0;
  cursor += 1;
  let titleClosed = false;
  while (cursor < source.length) {
    const character = source[cursor];
    if (character === "\\") {
      cursor += 2;
      continue;
    }
    if ((character === "\n" || character === "\r") && titleOpen !== "(") return -1;
    if (titleOpen === "(" && character === "(") titleDepth += 1;
    if (character === titleClose) {
      if (titleOpen !== "(" || --titleDepth === 0) {
        cursor += 1;
        titleClosed = true;
        break;
      }
    }
    cursor += 1;
  }
  if (!titleClosed) return -1;
  skipWhitespace();
  return source[cursor] === ")" ? cursor : -1;
}

function extractReferenceLinkDefinitions(markdown) {
  const definitions = new Set();
  const lines = String(markdown || "").split(/\r?\n/);
  let paragraphOpen = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (line.trim() === "") {
      paragraphOpen = false;
      continue;
    }

    const definition = parseReferenceLinkDefinition(lines, lineIndex);
    if (definition) {
      // A reference definition is a block-level construct and cannot interrupt
      // an open paragraph. Do not normalize shortcut links using a definition
      // that Markdown would render as literal paragraph text.
      if (!paragraphOpen) {
        definitions.add(normalizeReferenceLinkLabel(definition.label));
        lineIndex += definition.lineCount - 1;
      }
      continue;
    }

    const isAtxHeading = /^ {0,3}#{1,6}(?:[ \t]+|$)/.test(line);
    const fenceOpening = line.match(new RegExp("^ {0,3}(" + String.fromCharCode(96) + "{3,}|~{3,})(.*)$"));
    const isFence = Boolean(
      fenceOpening &&
      !(fenceOpening[1][0] === String.fromCharCode(96) && fenceOpening[2].includes(String.fromCharCode(96)))
    );
    const isThematicBreak = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})[ \t]*$/.test(line);
    const isListOrQuote = /^ {0,3}(?:>|[-+*][ \t]+|0{0,8}1[.)][ \t]+)/.test(line);
    const isSetextUnderline = paragraphOpen && /^ {0,3}(?:=+|-{1,})[ \t]*$/.test(line);

    if (isAtxHeading || isFence || isThematicBreak || isListOrQuote || isSetextUnderline) {
      paragraphOpen = false;
      continue;
    }

    // Ordinary nonblank text starts or continues a paragraph until a blank
    // line or another block-level construct closes it.
    paragraphOpen = true;
  }

  return definitions;
}
function stripInlineLinks(text, referenceDefinitions = new Set()) {
  const source = String(text || "");
  let output = "";
  let cursor = 0;

  function nextOpeningBracket(from) {
    let open = source.indexOf("[", from);
    while (open >= 0) {
      // Code-span contents are literal text: brackets inside them must not
      // start a link or affect the balance of a surrounding link label.
      const codeStart = source.lastIndexOf(INLINE_CODE_TEXT_START, open);
      const codeEnd = source.lastIndexOf(INLINE_CODE_TEXT_END, open);
      if (codeStart > codeEnd) {
        const closingCode = source.indexOf(INLINE_CODE_TEXT_END, open);
        open = closingCode < 0
          ? -1
          : source.indexOf("[", closingCode + INLINE_CODE_TEXT_END.length);
        continue;
      }

      let slashCount = 0;
      for (let index = open - 1; index >= 0 && source[index] === "\\"; index -= 1) {
        slashCount += 1;
      }
      if (slashCount % 2 === 0 && !(open > 0 && source[open - 1] === "!")) {
        return open;
      }
      open = source.indexOf("[", open + 1);
    }
    return -1;
  }

  while (cursor < source.length) {
    const open = nextOpeningBracket(cursor);
    if (open < 0) {
      output += source.slice(cursor);
      break;
    }

    let depth = 1;
    let labelEnd = open + 1;
    while (labelEnd < source.length && depth > 0) {
      if (source.startsWith(INLINE_CODE_TEXT_START, labelEnd)) {
        // Keep code-span punctuation out of the link-label delimiter parser.
        const codeEnd = source.indexOf(
          INLINE_CODE_TEXT_END,
          labelEnd + INLINE_CODE_TEXT_START.length,
        );
        if (codeEnd < 0) {
          labelEnd = source.length;
          break;
        }
        labelEnd = codeEnd + INLINE_CODE_TEXT_END.length;
        continue;
      }
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

    const afterLabel = source[labelEnd + 1];

    if (afterLabel === "[") {
      let referenceEnd = labelEnd + 2;
      while (referenceEnd < source.length && source[referenceEnd] !== "]") {
        if (source[referenceEnd] === "\\") referenceEnd += 1;
        referenceEnd += 1;
      }
      if (referenceEnd < source.length) {
        const explicitLabel = source.slice(labelEnd + 2, referenceEnd);
        const referenceLabel = normalizeReferenceLinkLabel(explicitLabel || source.slice(open + 1, labelEnd));
        if (referenceDefinitions.has(referenceLabel)) {
          output += source.slice(cursor, open) + source.slice(open + 1, labelEnd);
        } else {
          output += source.slice(cursor, referenceEnd + 1);
        }
        cursor = referenceEnd + 1;
        continue;
      }
    }

    if (afterLabel !== "(") {
      const shortcutLabel = normalizeReferenceLinkLabel(source.slice(open + 1, labelEnd));
      if (referenceDefinitions.has(shortcutLabel)) {
        output += source.slice(cursor, open) + source.slice(open + 1, labelEnd);
      } else {
        output += source.slice(cursor, labelEnd + 1);
      }
      cursor = labelEnd + 1;
      continue;
    }

    const linkEnd = parseInlineLinkEnd(source, labelEnd + 1);

    if (linkEnd < 0) {
      // Invalid destinations or titles are literal Markdown, not links.
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

function inlineHtmlTagEnd(source, startIndex) {
  // Backslash-escaped '<' is literal text, not an HTML tag opener.
  let backslashes = 0;
  for (let index = startIndex - 1; index >= 0 && source[index] === "\\"; index -= 1) {
    backslashes += 1;
  }
  if (backslashes % 2 === 1) {
    return -1;
  }

  const rest = source.slice(startIndex);
  const closing = rest.match(/^<\/([A-Za-z][A-Za-z0-9-]*)[ \t]*>/);
  if (closing) {
    return startIndex + closing[0].length;
  }

  const opening = rest.match(/^<([A-Za-z][A-Za-z0-9-]*)/);
  if (!opening) {
    return -1;
  }

  let cursor = startIndex + opening[0].length;
  const isWhitespace = (character) => character === " " || character === "\t" || character === "\r" || character === "\n";

  while (cursor < source.length) {
    while (isWhitespace(source[cursor])) {
      cursor += 1;
    }

    if (source[cursor] === ">") {
      return cursor + 1;
    }
    if (source[cursor] === "/" && source[cursor + 1] === ">") {
      return cursor + 2;
    }

    // Attribute names follow CommonMark's inline HTML grammar.
    const attribute = source.slice(cursor).match(/^[A-Za-z_:][A-Za-z0-9:._-]*/);
    if (!attribute) {
      return -1;
    }
    cursor += attribute[0].length;

    while (isWhitespace(source[cursor])) {
      cursor += 1;
    }

    if (source[cursor] !== "=") {
      // A boolean attribute is valid; the next loop validates its separator.
      continue;
    }

    cursor += 1;
    while (isWhitespace(source[cursor])) {
      cursor += 1;
    }

    const quote = source[cursor];
    if (quote === '"' || quote === "'") {
      cursor += 1;
      const valueEnd = source.indexOf(quote, cursor);
      if (valueEnd < 0) {
        return -1;
      }
      cursor = valueEnd + 1;
    } else {
      // Unquoted values cannot be empty or contain quotes, backticks, '=', '<', or '>'.
      const valueStart = cursor;
      while (
        cursor < source.length &&
        !isWhitespace(source[cursor]) &&
        source[cursor] !== '"' &&
        source[cursor] !== "'" &&
        source.charCodeAt(cursor) !== 96 &&
        source[cursor] !== "=" &&
        source[cursor] !== "<" &&
        source[cursor] !== ">"
      ) {
        cursor += 1;
      }
      if (cursor === valueStart) {
        return -1;
      }
    }

    if (
      source[cursor] !== undefined &&
      !isWhitespace(source[cursor]) &&
      source[cursor] !== ">" &&
      !(source[cursor] === "/" && source[cursor + 1] === ">")
    ) {
      return -1;
    }
  }

  return -1;
}

function stripInlineHtmlTags(text) {
  const source = String(text || "");
  let output = "";
  let cursor = 0;

  while (cursor < source.length) {
    if (source[cursor] !== "<") {
      output += source[cursor];
      cursor += 1;
      continue;
    }

    const tagEnd = inlineHtmlTagEnd(source, cursor);
    if (tagEnd < 0) {
      output += source[cursor];
      cursor += 1;
      continue;
    }

    // Only valid CommonMark inline HTML tags are omitted from rendered text.
    cursor = tagEnd;
  }

  return output;
}

function normalizeInlineHeadingText(text, referenceDefinitions = new Set()) {
  // Strip link syntax before protecting code spans. A link label may contain
  // inline code, and emphasis markers outside that span must still pair across it.
  const linkedText = stripInlineLinks(text, referenceDefinitions);
  const codeContents = [];
  const protectedText = linkedText.replace(
    new RegExp(INLINE_CODE_TEXT_START + "([\\s\\S]*?)" + INLINE_CODE_TEXT_END, "g"),
    (_match, content) => {
      const token = "\uE002" + codeContents.length + "\uE003";
      codeContents.push(content);
      return token;
    },
  );

  // The placeholder contains no Markdown delimiters, so code contents remain
  // literal while emphasis around a code span is normalized across the heading.
  let normalized = stripInlineHtmlTags(stripInlineEmphasis(protectedText));
  codeContents.forEach((content, index) => {
    normalized = normalized.replace("\uE002" + index + "\uE003", content);
  });
  return normalized;
}
function extractH2Headings(markdown) {
  const headings = [];
  const cleanedMarkdown = withoutCommentsAndCode(markdown);
  const referenceDefinitions = extractReferenceLinkDefinitions(cleanedMarkdown);

  for (const line of cleanedMarkdown.split(/\r?\n/)) {
    // CommonMark ATX headings allow up to three leading spaces and an optional
    // closing sequence of hash characters preceded by whitespace.
    const match = line.match(/^ {0,3}##[ \t]+(.+?)[ \t]*$/);
    if (!match) {
      continue;
    }

    const rawHeading = match[1].replace(/[ \t]+#+[ \t]*$/, "").trim();
    const heading = normalizeInlineHeadingText(rawHeading, referenceDefinitions).trim();
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
