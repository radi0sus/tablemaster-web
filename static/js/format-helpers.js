(function () {
  "use strict";

  window.TableMaster = window.TableMaster || {};

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function cleanValue(value) {
    value = String(value || "").trim();

    if (
      (value.charAt(0) === "'" && value.charAt(value.length - 1) === "'") ||
      (value.charAt(0) === "\"" && value.charAt(value.length - 1) === "\"")
    ) {
      value = value.slice(1, -1);
    }

    if (value === "?" || value === ".") {
      value = "";
    }

    return value;
  }

  function isMissing(value) {
    value = String(value || "").trim();
    return !value || value === "." || value === "?";
  }

  function typographicMinus(value) {
    return String(value || "").replace(/-/g, "–");
  }

  var subDigits = {
    "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄",
    "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", ".": "."
  };

  var supChars = {
    "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
    "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
    "+": "⁺", "-": "⁻"
  };

  function toSubscript(str) {
    return String(str || "").replace(/[0-9.]/g, function (ch) {
      return subDigits[ch] || ch;
    });
  }

  function toSuperscript(str) {
    return String(str || "").replace(/[0-9+-]/g, function (ch) {
      return supChars[ch] || ch;
    });
  }

  // "C12H18N2O4, 2(C7H8)" -> "C₁₂H₁₈N₂O₄·2(C₇H₈)" style text with
  // unicode sub/superscripts. Used identically for plain text, Markdown,
  // HTML (after escaping) and RTF (after rtfEscape, which handles unicode).
  function formatFormulaText(formula) {
    formula = cleanValue(formula);

    if (!formula) {
      return "";
    }

    var parts = formula.split(/(,\s*)/);

    return parts.map(function (part) {
      if (/^,\s*$/.test(part)) {
        return ", ";
      }

      var s = part.trim();

      s = s.replace(/([A-Z][a-z]?)(\d+(?:\.\d+)?)/g, function (_, el, num) {
        return el + toSubscript(num);
      });

      s = s.replace(/\s+/g, "");

      s = s.replace(/(\d+)([+-])/g, function (_, num, sign) {
        return toSuperscript(num + sign);
      });

      s = s.replace(/([+-])/g, function (_, sign) {
        return toSuperscript(sign);
      });

      return s;
    }).join("");
  }

  // "P21/c" + "14" -> "<i>P</i>2<sub>1</sub>/<i>c</i> (No. 14)"
  function formatSpaceGroupHtml(spaceGroup, itNumber) {
    var sg = cleanValue(spaceGroup).replace(/\s+/g, "");

    if (!sg) {
      return "";
    }

    sg = sg.replace(/([2346])([123456])/g, function (_, axis, screw) {
      return axis + toSubscript(screw);
    });

    sg = sg.replace(/[A-Za-z]/g, function (letter) {
      return "<i>" + letter + "</i>";
    });

    if (itNumber) {
      sg += " (No. " + escapeHtml(itNumber) + ")";
    }

    return sg;
  }

  function stripHtml(html) {
    return String(html || "")
      .replace(/<sub>(.*?)<\/sub>/g, "$1")
      .replace(/<sup>(.*?)<\/sup>/g, "$1")
      .replace(/<i>(.*?)<\/i>/g, "$1")
      .replace(/<b>(.*?)<\/b>/g, "$1")
      .replace(/<strong>(.*?)<\/strong>/g, "$1")
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&amp;/g, "&")
      .replace(/<[^>]+>/g, "");
  }

  // Converts the small subset of HTML used in this tool's cells
  // (<i>, <sub>, <sup>, <b>, <strong>) into Markdown inline syntax.
  // <sub>/<sup> have no portable Markdown equivalent, so those are
  // flattened to plain text (matching stripHtml's behaviour there).
  function htmlToMarkdown(html) {
    return String(html || "")
      .replace(/<sub>(.*?)<\/sub>/g, "$1")
      .replace(/<sup>(.*?)<\/sup>/g, "$1")
      .replace(/<strong>(.*?)<\/strong>/g, "**$1**")
      .replace(/<b>(.*?)<\/b>/g, "**$1**")
      .replace(/<i>(.*?)<\/i>/g, "*$1*")
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&amp;/g, "&")
      .replace(/<[^>]+>/g, "");
  }

  function decodeBasicEntities(str) {
    return String(str || "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  // label/value display, switches between SI ("/Å") and bracket ("[Å]")
  // notation. Purely notational - no unit conversion, matching the
  // original PureBasic tool's behaviour.
  function withUnit(siUnits, text, unit) {
    if (!unit) {
      return text;
    }

    return siUnits ? text + " /" + unit : text + " [" + unit + "]";
  }

  function rtfEscape(str) {
    str = String(str || "");
    var out = "";

    for (var i = 0; i < str.length; i++) {
      var ch = str.charAt(i);
      var code = ch.charCodeAt(0);

      if (ch === "\\") {
        out += "\\\\";
      } else if (ch === "{") {
        out += "\\{";
      } else if (ch === "}") {
        out += "\\}";
      } else if (ch === "\n") {
        out += "\\par\n";
      } else if (code > 127) {
        if (code > 32767) {
          code = code - 65536;
        }
        out += "\\u" + code + "?";
      } else {
        out += ch;
      }
    }

    return out;
  }

  // Converts the small subset of HTML used in this tool's cells
  // (<i>, <sub>, <sup>, <b>, <strong>) into RTF inline control words.
  function rtfInlineFromHtml(html) {
    var placeholders = [];

    function stash(rtf) {
      var key = "@@RTF_PLACEHOLDER_" + placeholders.length + "@@";
      placeholders.push({ key: key, rtf: rtf });
      return key;
    }

    var s = String(html || "");
    s = decodeBasicEntities(s);

    s = s.replace(/<sup>(.*?)<\/sup>/g, function (_, inner) {
      return stash("{\\super " + rtfEscape(decodeBasicEntities(inner)) + "}");
    });

    s = s.replace(/<sub>(.*?)<\/sub>/g, function (_, inner) {
      return stash("{\\sub " + rtfEscape(decodeBasicEntities(inner)) + "}");
    });

    s = s.replace(/<i>(.*?)<\/i>/g, function (_, inner) {
      return stash("{\\i " + rtfEscape(decodeBasicEntities(inner)) + "}");
    });

    s = s.replace(/<strong>(.*?)<\/strong>/g, function (_, inner) {
      return stash("{\\b " + rtfEscape(decodeBasicEntities(inner)) + "}");
    });

    s = s.replace(/<b>(.*?)<\/b>/g, function (_, inner) {
      return stash("{\\b " + rtfEscape(decodeBasicEntities(inner)) + "}");
    });

    s = s.replace(/<[^>]+>/g, "");
    s = rtfEscape(s);

    placeholders.forEach(function (p) {
      s = s.split(p.key).join(p.rtf);
    });

    return s;
  }

  // -- Clipboard / file download utilities -----------------------------

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");

    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }

    var textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(textarea);
    }

    return Promise.resolve();
  }

  // Copies the rendered HTML preview as a real selection so that
  // pasting into Word/LibreOffice/Mail produces a formatted table.
  // (Browsers do not allow writing a custom "text/rtf" clipboard type,
  // but they do allow writing rich "text/html" via a copied selection,
  // which every major word processor accepts and converts on paste.)
  function copyFormattedNode(node) {
    var copyNode = node.cloneNode(true);

    copyNode.style.position = "fixed";
    copyNode.style.left = "-10000px";
    copyNode.style.top = "0";
    copyNode.setAttribute("aria-hidden", "true");

    document.body.appendChild(copyNode);

    var range = document.createRange();
    var selection = window.getSelection();

    selection.removeAllRanges();
    range.selectNodeContents(copyNode);
    selection.addRange(range);

    var ok = false;

    try {
      ok = document.execCommand("copy");
    } catch (e) {
      ok = false;
    }

    selection.removeAllRanges();

    if (copyNode.parentNode) {
      copyNode.parentNode.removeChild(copyNode);
    }

    return ok;
  }

  TableMaster.Format = {
    escapeHtml: escapeHtml,
    cleanValue: cleanValue,
    isMissing: isMissing,
    typographicMinus: typographicMinus,
    toSubscript: toSubscript,
    toSuperscript: toSuperscript,
    formatFormulaText: formatFormulaText,
    formatSpaceGroupHtml: formatSpaceGroupHtml,
    stripHtml: stripHtml,
    htmlToMarkdown: htmlToMarkdown,
    decodeBasicEntities: decodeBasicEntities,
    withUnit: withUnit,
    rtfEscape: rtfEscape,
    rtfInlineFromHtml: rtfInlineFromHtml,
    download: download,
    copyText: copyText,
    copyFormattedNode: copyFormattedNode
  };
})();
