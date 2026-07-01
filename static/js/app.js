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

  // -- Multi-block CIF picker ----------------------------------------------
  //
  // A single .cif file can contain several structures (data_ blocks), e.g.
  // Acta E "sup1" files with one data_global block plus one block per
  // structure. When that happens we ask the user which structures to load,
  // instead of silently picking the first one.

  var blockPicker = {
    overlay: null,
    list: null,
    limitLabel: null,
    resolve: null
  };

  function initBlockPicker() {
    blockPicker.overlay = $("block-picker-overlay");
    blockPicker.list = $("block-picker-list");
    blockPicker.limitLabel = $("block-picker-limit");

    $("block-picker-select-all").addEventListener("click", function () {
      setPickerChecks(true);

      var total = blockPicker.list.querySelectorAll("input[type=checkbox]").length;
      var max = parseInt(blockPicker.overlay.getAttribute("data-max-selectable"), 10) || total;

      if (max < total) {
        showToast("Only " + max + " free slot" + (max === 1 ? "" : "s") + " — selected first " + max + " of " + total, "warning");
      }
    });
    $("block-picker-select-none").addEventListener("click", function () {
      setPickerChecks(false);
    });
    $("block-picker-cancel").addEventListener("click", function () {
      closeBlockPicker([]);
    });
    $("block-picker-confirm").addEventListener("click", function () {
      var chosen = Array.prototype.slice
        .call(blockPicker.list.querySelectorAll("input[type=checkbox]:checked"))
        .map(function (cb) { return parseInt(cb.value, 10); });
      closeBlockPicker(chosen);
    });
    blockPicker.overlay.addEventListener("click", function (e) {
      if (e.target === blockPicker.overlay) closeBlockPicker([]);
    });
  }

  function setPickerChecks(checked) {
    var boxes = Array.prototype.slice.call(blockPicker.list.querySelectorAll("input[type=checkbox]"));
    var max = parseInt(blockPicker.overlay.getAttribute("data-max-selectable"), 10) || boxes.length;

    boxes.forEach(function (cb, i) {
      cb.checked = checked && i < max;
    });

    updatePickerLimitState();
  }

  // Once the max-selectable count (= number of free slots) is reached,
  // remaining unchecked boxes are disabled so the user can't overbook slots.
  function updatePickerLimitState() {
    var boxes = blockPicker.list.querySelectorAll("input[type=checkbox]");
    var checkedCount = blockPicker.list.querySelectorAll("input[type=checkbox]:checked").length;
    var max = parseInt(blockPicker.overlay.getAttribute("data-max-selectable"), 10) || boxes.length;

    Array.prototype.forEach.call(boxes, function (cb) {
      cb.disabled = !cb.checked && checkedCount >= max;
    });

    $("block-picker-confirm").disabled = checkedCount === 0;
  }

  function blockSummary(block) {
    var formula = block.items._chemical_formula_sum || block.items._chemical_formula_moiety || "";
    return formula ? formula.replace(/^'+|'+$/g, "") : "(no formula found)";
  }

  // Shows the picker and resolves with the block indices the user checked,
  // in the order they were checked (so click order controls slot order).
  function askUserToPickBlocks(blocks, maxSelectable) {
    return new Promise(function (resolve) {
      blockPicker.resolve = resolve;
      blockPicker.overlay.setAttribute("data-max-selectable", String(maxSelectable));
      blockPicker.limitLabel.textContent = "up to " + maxSelectable + " of " + blocks.length;

      blockPicker.list.innerHTML = blocks.map(function (block, i) {
        return (
          '<label class="block-picker-item">' +
            '<input type="checkbox" value="' + i + '">' +
            '<span class="block-picker-name">' +
              Format.escapeHtml(block.dataName || ("block " + (i + 1))) +
            "</span>" +
            '<span class="block-picker-formula">' +
              Format.escapeHtml(blockSummary(block)) +
            "</span>" +
          "</label>"
        );
      }).join("");

      Array.prototype.forEach.call(
        blockPicker.list.querySelectorAll("input[type=checkbox]"),
        function (cb) { cb.addEventListener("change", updatePickerLimitState); }
      );

      updatePickerLimitState();
      blockPicker.overlay.classList.remove("hidden");
    });
  }

  function closeBlockPicker(chosenIndices) {
    blockPicker.overlay.classList.add("hidden");
    var resolve = blockPicker.resolve;
    blockPicker.resolve = null;
    if (resolve) resolve(chosenIndices);
  }

  // -- File loading ----------------------------------------------------

  function slotEnabled(index) {
    return index === 0 || store.slots[index - 1].loaded;
  }

  function freeSlotIndicesFrom(startIndex) {
    var indices = [];
    for (var i = startIndex; i < store.maxSlots; i++) {
      if (!store.slots[i].loaded) indices.push(i);
    }
    return indices;
  }

  // Reads and loads one file starting at `startIndex`. Calls `done()` when
  // finished (loaded, skipped, or cancelled) so a caller can chain the next
  // file in a drop batch. Handles both the plain single-structure case and
  // the multi-block picker case.
  function handleFile(file, startIndex, done) {
    var reader = new FileReader();

    reader.onload = function () {
      var text = String(reader.result || "");
      var parsed;

      try {
        parsed = window.CIFLord.Parser.parse(text);
      } catch (e) {
        showToast("Could not parse " + file.name, "error");
        done();
        return;
      }

      var structureBlocks = (parsed.blocks || []).filter(window.CIFLord.Parser.looksLikeStructureBlock);

      if (structureBlocks.length <= 1) {
        var slot = Store.loadIntoSlot(store, startIndex, file.name, text);

        if (!slot.dataName) {
          showToast("No 'data_' block found in " + file.name, "warning");
        } else {
          showToast("Loaded " + slot.dataName);
        }

        renderAll();
        done();
        return;
      }

      // Multiple structures in this one file: let the user pick which ones
      // and how many, capped at the number of currently free slots.
      var freeSlots = freeSlotIndicesFrom(startIndex);

      askUserToPickBlocks(structureBlocks, freeSlots.length).then(function (chosenIndices) {
        if (!chosenIndices.length) {
          showToast("No structures selected from " + file.name, "warning");
          done();
          return;
        }

        chosenIndices.forEach(function (blockIdx, order) {
          Store.loadBlockIntoSlot(store, freeSlots[order], file.name, structureBlocks[blockIdx]);
        });

        showToast(
          "Loaded " + chosenIndices.length + " of " + structureBlocks.length +
          " structures from " + file.name
        );

        renderAll();
        done();
      });
    };

    reader.onerror = function () {
      showToast("Could not read " + file.name, "error");
      done();
    };

    reader.readAsText(file);
  }

  // Processes several dropped files one after another (so the picker never
  // has to handle more than one file at a time), cascading each into the
  // next free slot after startIndex.
  function loadFilesCascading(files, startIndex) {
    var cifFiles = Array.prototype.filter.call(files, function (f) {
      return /\.cif$/i.test(f.name);
    });

    if (!cifFiles.length) {
      showToast("Drop a .cif file", "warning");
      return;
    }

    var queuePos = 0;
    var slotIndex = startIndex;

    function next() {
      if (queuePos >= cifFiles.length) return;

      while (slotIndex < store.maxSlots && store.slots[slotIndex].loaded) {
        slotIndex++;
      }

      if (slotIndex >= store.maxSlots) {
        showToast("Only " + store.maxSlots + " structures supported", "warning");
        return;
      }

      var file = cifFiles[queuePos++];

      handleFile(file, slotIndex, function () {
        next();
      });
    }

    next();
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
          if (file) handleFile(file, index, function () {});
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
    initBlockPicker();
    bindLoadButtons();
    bindClearAll();
    bindOptions();
    bindExportButtons();
    renderAll();
  });
})();
