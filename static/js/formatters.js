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

    var html = "";
    html += "<h2>Table 1: " + tableTitle(model.columnCount) + " for " + captionNames + ".</h2>";
    html += "<table class=\"tm-table\">";

    if (model.columnCount > 1) {
      html += "<thead><tr><th></th>";
      model.names.forEach(function (n) {
        html += "<th>" + F.escapeHtml(n) + "</th>";
      });
      html += "</tr></thead>";
    }

    html += "<tbody>";
    model.rows.forEach(function (row) {
      html += "<tr><td>" + row.labelHtml + "</td>";
      row.valuesHtml.forEach(function (v) {
        html += "<td>" + (v || "–") + "</td>";
      });
      html += "</tr>";
    });
    html += "</tbody></table>";

    return html;
  }

  function makeStandaloneHtml(model) {
    var body = renderHtml(model);

    return (
      "<!DOCTYPE html>\n" +
      "<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n" +
      "<title>" + F.escapeHtml(M.joinNamesForCaption(model.names)) + "</title>\n" +
      "<style>\n" +
      "body{font-family:Georgia,'Times New Roman',serif;max-width:900px;margin:2rem auto;color:#1f2933;}\n" +
      "table{border-collapse:collapse;width:100%;font-size:0.95rem;}\n" +
      "th,td{border:1px solid #999;padding:0.3rem 0.55rem;text-align:left;vertical-align:top;}\n" +
      "thead th{background:#f0f0f0;}\n" +
      "h2{font-size:1.05rem;}\n" +
      "</style>\n</head>\n<body>\n" + body + "\n</body>\n</html>\n"
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

    table.forEach(function (row, rowIndex) {
      if (rowIndex === 0 && !showHeader) {
        return;
      }

      var cells = row.map(function (cell, c) {
        return (cell || "").padEnd(widths[c] + 2, " ");
      });

      lines.push(cells.join("").replace(/\s+$/, ""));
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
      var cells = [row.labelText].concat(row.valuesText.map(function (v) {
        return v || "–";
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

  function rtfRow(cellsRtf, widthTwips, bold) {
    var n = cellsRtf.length;
    var out = "{\\trowd\\trgaph108\\trql";

    for (var i = 1; i <= n; i++) {
      out += "\\cellx" + (widthTwips * i);
    }

    cellsRtf.forEach(function (c) {
      var content = bold ? "{\\b " + c + "}" : c;
      out += "\\pard\\intbl \\f0\\fs22 " + content + "\\cell";
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

      if (model.columnCount > 1) {
        var headerCells = [""].concat(model.names).map(F.rtfEscape);
        body += rtfRow(headerCells, colWidth, true);
      }

      model.rows.forEach(function (row) {
        var cells = [F.rtfInlineFromHtml(row.labelHtml)].concat(
          row.valuesHtml.map(function (v) {
            return F.rtfInlineFromHtml(v || "–");
          })
        );
        body += rtfRow(cells, colWidth, false);
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
