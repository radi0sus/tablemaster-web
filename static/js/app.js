(function () {
  "use strict";

  var Store = window.TableMaster.Store;
  var Model = window.TableMaster.Model;
  var Formatters = window.TableMaster.Formatters;
  var Format = window.TableMaster.Format;

  var store = Store.createStore();

  var options = {
    siUnits: false,
    includeTemperature: true,
    includeMoiety: true,
    orientation: "auto" // auto | portrait | landscape (RTF page only)
  };

  function $(id) {
    return document.getElementById(id);
  }

  var toastTimer = null;
  function showToast(message, kind) {
    var toast = $("toast");
    if (!toast) return;

    toast.textContent = message;
    toast.className = "toast visible" + (kind ? " " + kind : "");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.className = "toast";
    }, 2400);
  }

  function currentModel() {
    var structures = Store.loadedSlots(store).map(function (s) {
      return { dataName: s.dataName, items: s.items };
    });

    return Model.buildModel(structures, options);
  }

  // -- Slot UI -------------------------------------------------------------

  function slotLabel(index) {
    var slot = store.slots[index];
    var label = $("load-cif-" + (index + 1));
    var card = $("slot-" + (index + 1));
    var clearBtn = $("slot-clear-" + (index + 1));

    if (slot.loaded) {
      label.textContent = slot.dataName || slot.fileName || ("Structure " + (index + 1));
      card.classList.add("is-loaded");
      card.title = slot.fileName ? "Loaded from " + slot.fileName : "";
      clearBtn.classList.remove("hidden");
    } else {
      label.textContent = "Load CIF " + (index + 1);
      card.classList.remove("is-loaded");
      card.title = "";
      clearBtn.classList.add("hidden");
    }
  }

  function refreshSlotButtons() {
    for (var i = 0; i < store.maxSlots; i++) {
      slotLabel(i);

      // Slot N+1 only becomes usable once slot N is loaded (mirrors the
      // original tool's "load in order" behaviour, but Clear all resets it).
      var card = $("slot-" + (i + 1));
      var enabled = i === 0 || store.slots[i - 1].loaded;

      card.classList.toggle("is-disabled", !enabled);
      card.setAttribute("aria-disabled", String(!enabled));
      card.tabIndex = enabled ? 0 : -1;
    }
  }

  function refreshWarnings() {
    var box = $("warnings-box");
    var allWarnings = [];

    store.slots.forEach(function (s, i) {
      if (s.loaded && s.warnings && s.warnings.length) {
        s.warnings.forEach(function (w) {
          allWarnings.push("Structure " + (i + 1) + ": " + w);
        });
      }
    });

    if (!allWarnings.length) {
      box.classList.add("hidden");
      box.innerHTML = "";
      return;
    }

    box.classList.remove("hidden");
    box.innerHTML = "<strong>Warnings</strong><ul>" +
      allWarnings.map(function (w) {
        return "<li>" + Format.escapeHtml(w) + "</li>";
      }).join("") +
      "</ul>";
  }

  function hasAnyLoaded() {
    return Store.loadedSlots(store).length > 0;
  }

  function setButtonsEnabled(enabled) {
    [
      "clear-all",
      "btn-copy-formatted", "btn-copy-md", "btn-copy-text",
      "btn-download-html", "btn-download-md", "btn-download-text", "btn-download-rtf"
    ].forEach(function (id) {
      var el = $(id);
      if (el) el.disabled = !enabled;
    });
  }

  function renderPreview() {
    var model = currentModel();
    $("report-preview").innerHTML = Formatters.renderHtml(model);
    setButtonsEnabled(hasAnyLoaded());
  }

  function renderAll() {
    refreshSlotButtons();
    refreshWarnings();
    renderPreview();
  }

  // -- File loading ----------------------------------------------------

  function slotEnabled(index) {
    return index === 0 || store.slots[index - 1].loaded;
  }

  function loadFileIntoSlot(index, file) {
    var reader = new FileReader();

    reader.onload = function () {
      try {
        var slot = Store.loadIntoSlot(store, index, file.name, String(reader.result || ""));

        if (!slot.dataName) {
          showToast("No 'data_' block found in " + file.name, "warning");
        } else {
          showToast("Loaded " + slot.dataName);
        }
      } catch (e) {
        showToast("Could not parse " + file.name, "error");
      }

      renderAll();
    };
    reader.onerror = function () {
      showToast("Could not read " + file.name, "error");
    };
    reader.readAsText(file);
  }

  // Drops the given files starting at `startIndex`, cascading any extra
  // files into the next free slots (so dropping several CIFs at once on
  // slot 1 fills 1, 2, 3, ... in one go).
  function loadFilesCascading(files, startIndex) {
    var cifFiles = Array.prototype.filter.call(files, function (f) {
      return /\.cif$/i.test(f.name);
    });

    if (!cifFiles.length) {
      showToast("Drop a .cif file", "warning");
      return;
    }

    var index = startIndex;

    cifFiles.forEach(function (file) {
      while (index < store.maxSlots && store.slots[index].loaded) {
        index++;
      }

      if (index >= store.maxSlots) {
        showToast("Only " + store.maxSlots + " structures supported", "warning");
        return;
      }

      loadFileIntoSlot(index, file);
      index++;
    });
  }

  function bindLoadButtons() {
    for (var i = 0; i < store.maxSlots; i++) {
      (function (index) {
        var card = $("slot-" + (index + 1));
        var input = $("file-input-" + (index + 1));
        var clearBtn = $("slot-clear-" + (index + 1));

        function openDialog() {
          if (!slotEnabled(index)) return;
          input.value = "";
          input.click();
        }

        card.addEventListener("click", openDialog);
        card.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openDialog();
          }
        });

        input.addEventListener("change", function () {
          var file = input.files && input.files[0];
          if (file) loadFileIntoSlot(index, file);
        });

        card.addEventListener("dragover", function (e) {
          if (!slotEnabled(index)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          card.classList.add("is-dragover");
        });

        card.addEventListener("dragleave", function () {
          card.classList.remove("is-dragover");
        });

        card.addEventListener("drop", function (e) {
          e.preventDefault();
          card.classList.remove("is-dragover");

          if (!slotEnabled(index)) {
            showToast("Load CIF " + index + " first", "warning");
            return;
          }

          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
            loadFilesCascading(e.dataTransfer.files, index);
          }
        });

        clearBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          Store.clearSlot(store, index);
          renderAll();
        });
      })(i);
    }
  }

  function bindClearAll() {
    $("clear-all").addEventListener("click", function () {
      Store.clearAll(store);
      renderAll();
      showToast("Cleared all structures");
    });
  }

  // -- Options -----------------------------------------------------------

  function bindOptions() {
    $("opt-si-units").checked = options.siUnits;
    $("opt-include-temperature").checked = options.includeTemperature;
    $("opt-include-moiety").checked = options.includeMoiety;
    $("opt-orientation-" + options.orientation).checked = true;

    $("opt-si-units").addEventListener("change", function (e) {
      options.siUnits = e.target.checked;
      renderPreview();
    });

    $("opt-include-temperature").addEventListener("change", function (e) {
      options.includeTemperature = e.target.checked;
      renderPreview();
    });

    $("opt-include-moiety").addEventListener("change", function (e) {
      options.includeMoiety = e.target.checked;
      renderPreview();
    });

    ["auto", "portrait", "landscape"].forEach(function (mode) {
      $("opt-orientation-" + mode).addEventListener("change", function (e) {
        if (e.target.checked) {
          options.orientation = mode;
        }
      });
    });
  }

  // -- Copy / Save ---------------------------------------------------------

  function baseName() {
    var names = Store.loadedSlots(store).map(function (s) {
      return s.dataName;
    }).filter(Boolean);

    return names.length ? names.join("_") : "tablemaster";
  }

  function requireLoaded() {
    if (!hasAnyLoaded()) {
      showToast("Load at least one CIF first", "warning");
      return false;
    }
    return true;
  }

  function bindExportButtons() {
    $("btn-copy-formatted").addEventListener("click", function () {
      if (!requireLoaded()) return;

      var ok = Format.copyFormattedNode($("report-preview"));
      showToast(ok ? "Copied formatted table (paste into Word etc.)" : "Formatted copy failed", ok ? null : "error");
    });

    $("btn-copy-md").addEventListener("click", function () {
      if (!requireLoaded()) return;

      Format.copyText(Formatters.renderMarkdown(currentModel())).then(function () {
        showToast("Copied Markdown to clipboard");
      });
    });

    $("btn-copy-text").addEventListener("click", function () {
      if (!requireLoaded()) return;

      Format.copyText(Formatters.renderPlainText(currentModel())).then(function () {
        showToast("Copied plain text to clipboard");
      });
    });

    $("btn-download-html").addEventListener("click", function () {
      if (!requireLoaded()) return;
      Format.download(baseName() + ".html", Formatters.makeStandaloneHtml(currentModel()), "text/html;charset=utf-8");
      showToast("Saved " + baseName() + ".html");
    });

    $("btn-download-md").addEventListener("click", function () {
      if (!requireLoaded()) return;
      Format.download(baseName() + ".md", Formatters.renderMarkdown(currentModel()), "text/markdown;charset=utf-8");
      showToast("Saved " + baseName() + ".md");
    });

    $("btn-download-text").addEventListener("click", function () {
      if (!requireLoaded()) return;
      Format.download(baseName() + ".txt", Formatters.renderPlainText(currentModel()), "text/plain;charset=utf-8");
      showToast("Saved " + baseName() + ".txt");
    });

    $("btn-download-rtf").addEventListener("click", function () {
      if (!requireLoaded()) return;
      Format.download(baseName() + ".rtf", Formatters.renderRtf(currentModel(), options.orientation), "application/rtf");
      showToast("Saved " + baseName() + ".rtf");
    });
  }

  // -- Init ----------------------------------------------------------------

  document.addEventListener("DOMContentLoaded", function () {
    bindLoadButtons();
    bindClearAll();
    bindOptions();
    bindExportButtons();
    renderAll();
  });
})();
