(function () {
  "use strict";

  window.TableMaster = window.TableMaster || {};
  var F = TableMaster.Format;
  var M = TableMaster.Model;

  function tableTitle(columnCount) {
    return columnCount > 1
      ? "Crystal data and refinement details"
      : "Crystal data and refinement details";
  }

  // -- HTML --------------------------------------------------------------

  function renderHtml(model) {
    if (!model.rows.length) {
      return "<p class=\"empty-hint\">Load at least one CIF file to see a preview here.</p>";
    }

    var captionNames = M.joinNamesForCaption(model.names, function (n) {
      return "<strong>" + F.escapeHtml(n) + "</strong>";
    });

    var hasHeader = model.columnCount > 1;
    var lastRowIndex = model.rows.length - 1;

    var html = "";
    html += "<h2>Table 1: " + tableTitle(model.columnCount) + " for " + captionNames + ".</h2>";
    html += "<table class=\"tm-table\">";

    if (hasHeader) {
      html += "<thead><tr><th></th>";
      model.names.forEach(function (n) {
        html += "<th>" + F.escapeHtml(n) + "</th>";
      });
      html += "</tr></thead>";
    }

    html += "<tbody>";
    model.rows.forEach(function (row, rowIndex) {
      var rowClasses = [];
      if (!hasHeader && rowIndex === 0) {
        rowClasses.push("tm-row-first");
      }
      if (rowIndex === lastRowIndex) {
        rowClasses.push("tm-row-last");
      }

      html += "<tr" + (rowClasses.length ? " class=\"" + rowClasses.join(" ") + "\"" : "") + ">" +
        "<td>" + row.labelHtml + "</td>";
      row.valuesHtml.forEach(function (v) {
        html += "<td>" + (v || "–") + "</td>";
      });
      html += "</tr>";
    });
    html += "</tbody></table>";

    return html;
  }

  // Saved/exported HTML always uses the light palette, matching the
  // look of the other radi0sus/ciflordg-web report exports - regardless
  // of whatever color scheme the browser/app UI is currently in.
  function makeStandaloneHtml(model) {
    var body = renderHtml(model);

    return (
      "<!DOCTYPE html>\n" +
      "<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n" +
      "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n" +
      "<title>" + F.escapeHtml(M.joinNamesForCaption(model.names)) + "</title>\n" +
      "<style>\n" +
      "html{background:#f3f4f6;}\n" +
      "body{margin:0;background:#f3f4f6;color:#111827;" +
      "font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" +
      "font-size:15px;line-height:1.45;}\n" +
      ".report-document{max-width:980px;margin:2rem auto;padding:2rem;background:#ffffff;" +
      "box-shadow:0 12px 30px rgba(15,23,42,0.12);}\n" +
      "h2{margin:1.6rem 0 0.55rem;font-size:1.02rem;line-height:1.3;}\n" +
      "h2:first-child{margin-top:0;}\n" +
      "table{width:100%;border-collapse:collapse;margin:0.55rem 0 1.1rem;font-size:0.92rem;" +
      "background:#ffffff;}\n" +
      "th,td{border:none;padding:0.34rem 0.45rem;vertical-align:top;text-align:left;}\n" +
      "thead th{font-weight:650;border-top:1px solid #333333;border-bottom:1px solid #333333;}\n" +
      "tbody tr.tm-row-first td{border-top:1px solid #333333;}\n" +
      "tbody tr.tm-row-last td{border-bottom:1px solid #333333;}\n" +
      "@media print{html,body{background:#ffffff;}" +
      ".report-document{max-width:none;margin:0;padding:0;box-shadow:none;}" +
      "table{break-inside:avoid;page-break-inside:avoid;}}\n" +
      "</style>\n</head>\n<body>\n<main class=\"report-document\">\n" +
      body + "\n</main>\n</body>\n</html>\n"
    );
  }

  // -- Plain text (aligned columns) --------------------------------------

  function renderPlainText(model) {
    if (!model.rows.length) {
      return "";
    }

    var captionNames = M.joinNamesForCaption(model.names);
    var lines = [];

    lines.push("Table 1: " + tableTitle(model.columnCount) + " for " + captionNames + ".");
    lines.push("");

    var header = [""].concat(model.names);
    var table = [header].concat(model.rows.map(function (row) {
      return [row.labelText].concat(row.valuesText.map(function (v) {
        return v || "-";
      }));
    }));

    var colCount = header.length;
    var widths = [];

    for (var c = 0; c < colCount; c++) {
      var max = 0;
      table.forEach(function (r) {
        max = Math.max(max, (r[c] || "").length);
      });
      widths.push(max);
    }

    var showHeader = model.columnCount > 1;
    var bodyLines = [];

    table.forEach(function (row, rowIndex) {
      if (rowIndex === 0 && !showHeader) {
        return;
      }

      var cells = row.map(function (cell, c) {
        return (cell || "").padEnd(widths[c] + 2, " ");
      });

      bodyLines.push(cells.join("").replace(/\s+$/, ""));
    });

    var ruleWidth = 0;
    bodyLines.forEach(function (l) {
      ruleWidth = Math.max(ruleWidth, l.length);
    });
    var rule = new Array(ruleWidth + 1).join("-");
    var headerLineIndex = showHeader ? 0 : -1;
    var lastLineIndex = bodyLines.length - 1;

    bodyLines.forEach(function (line, i) {
      if (i === 0) {
        lines.push(rule);
      }
      lines.push(line);
      if (i === headerLineIndex || i === lastLineIndex) {
        lines.push(rule);
      }
    });

    return lines.join("\n") + "\n";
  }

  // -- Markdown ------------------------------------------------------------

  function markdownCell(str) {
    return String(str || "").replace(/\|/g, "\\|");
  }

  function renderMarkdown(model) {
    if (!model.rows.length) {
      return "";
    }

    var captionNames = M.joinNamesForCaption(model.names, function (n) {
      return "**" + n + "**";
    });

    var lines = [];
    lines.push("**Table 1:** " + tableTitle(model.columnCount) + " for " + captionNames + ".");
    lines.push("");

    var header = [""].concat(model.names);
    lines.push("| " + header.map(markdownCell).join(" | ") + " |");
    lines.push("|" + header.map(function () { return " --- "; }).join("|") + "|");

    model.rows.forEach(function (row) {
      var cells = [F.htmlToMarkdown(row.labelHtml)].concat(row.valuesHtml.map(function (v) {
        return v ? F.htmlToMarkdown(v) : "–";
      }));
      lines.push("| " + cells.map(markdownCell).join(" | ") + " |");
    });

    return lines.join("\n") + "\n";
  }

  // -- RTF -------------------------------------------------------------

  function rtfParagraph(content) {
    return "{\\pard \\f0\\fs24 " + content + "\\par}\n";
  }

  function rtfBlankLine() {
    return "{\\pard\\plain \\f0\\fs24 \\par}\n";
  }

  // borders: { top: bool, bottom: bool } - draws a thin rule along the
  // top and/or bottom edge of every cell in this row (used for the
  // header row and the very last data row of the table).
  function rtfRow(cellsRtf, widthTwips, bold, borders) {
    borders = borders || {};
    var n = cellsRtf.length;

    var borderCode = "";
    if (borders.top) {
      borderCode += "\\clbrdrt\\brdrs\\brdrw10";
    }
    if (borders.bottom) {
      borderCode += "\\clbrdrb\\brdrs\\brdrw10";
    }

    var out = "{\\trowd\\trgaph108\\trql";

    for (var i = 1; i <= n; i++) {
      out += borderCode + "\\cellx" + (widthTwips * i);
    }

    cellsRtf.forEach(function (c) {
      var content = bold ? "{\\b " + c + "}" : c;
      // \sb40\sa40 = 2 pt space before/after the paragraph (Word's
      // "Abstand vor/nach"; RTF units are twips, 20 per point).
      out += "\\pard\\intbl\\sb40\\sa40 \\f0\\fs22 " + content + "\\cell";
    });

    out += "\\row}\n";
    return out;
  }

  // page geometry in twips (1/20 pt); matches the values already used
  // for the A4 RTF export in the original tool / ciflordg-web.
  var PAGE = {
    portrait: { w: 11909, h: 16834, marginSide: 1138 },
    landscape: { w: 16834, h: 11909, marginSide: 562 }
  };

  function resolveOrientation(orientation, columnCount) {
    if (orientation === "portrait" || orientation === "landscape") {
      return orientation;
    }
    // "auto": portrait for up to 3 structures, landscape for 4-5
    // (more columns need more page width).
    return columnCount >= 4 ? "landscape" : "portrait";
  }

  function renderRtf(model, orientation) {
    var page = PAGE[resolveOrientation(orientation, model.columnCount)];
    var usableWidth = page.w - 2 * page.marginSide;
    var colCount = model.columnCount + 1;
    var colWidth = Math.floor(usableWidth / Math.max(colCount, 2));

    var body = "";

    if (!model.rows.length) {
      body += rtfParagraph("Load at least one CIF file to see output here.");
    } else {
      var captionNames = M.joinNamesForCaption(model.names, function (n) {
        return "{\\b " + F.rtfEscape(n) + "}";
      });

      body += rtfParagraph(
        "{\\b Table 1: }" + F.rtfEscape(tableTitle(model.columnCount) + " for ") +
        captionNames + "."
      );
      body += rtfBlankLine();

      var hasHeader = model.columnCount > 1;

      if (hasHeader) {
        var headerCells = [""].concat(model.names).map(F.rtfEscape);
        body += rtfRow(headerCells, colWidth, true, { top: true, bottom: true });
      }

      var lastRowIndex = model.rows.length - 1;

      model.rows.forEach(function (row, rowIndex) {
        var cells = [F.rtfInlineFromHtml(row.labelHtml)].concat(
          row.valuesHtml.map(function (v) {
            return F.rtfInlineFromHtml(v || "–");
          })
        );

        var borders = {};
        if (!hasHeader && rowIndex === 0) {
          borders.top = true;
        }
        if (rowIndex === lastRowIndex) {
          borders.bottom = true;
        }

        body += rtfRow(cells, colWidth, false, borders);
      });

      body += rtfBlankLine();
    }

    return (
      "{\\rtf1\\ansi\\uc1\\deff0" +
      "{\\fonttbl{\\f0\\froman Times New Roman;}}" +
      "\\paperw" + page.w + "\\paperh" + page.h +
      "\\margl" + page.marginSide + "\\margt562\\margr" + page.marginSide + "\\margb562\n" +
      "\\f0\\fs24\n" +
      body +
      "\n}"
    );
  }

  TableMaster.Formatters = {
    renderHtml: renderHtml,
    makeStandaloneHtml: makeStandaloneHtml,
    renderPlainText: renderPlainText,
    renderMarkdown: renderMarkdown,
    renderRtf: renderRtf,
    resolveOrientation: resolveOrientation
  };
})();
