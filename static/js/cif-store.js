(function () {
  "use strict";

  window.TableMaster = window.TableMaster || {};

  var MAX_SLOTS = 5;

  function emptySlot() {
    return {
      loaded: false,
      fileName: "",
      dataName: "",
      items: {},
      warnings: []
    };
  }

  function createStore() {
    var slots = [];

    for (var i = 0; i < MAX_SLOTS; i++) {
      slots.push(emptySlot());
    }

    return {
      slots: slots,
      maxSlots: MAX_SLOTS
    };
  }

  function loadIntoSlot(store, slotIndex, fileName, text) {
    var parsed = window.CIFLord.Parser.parse(text);
    return loadParsedIntoSlot(store, slotIndex, fileName, parsed);
  }

  // Same as loadIntoSlot, but takes an already-parsed result so callers
  // that had to parse the file anyway (e.g. to count structure blocks)
  // don't have to parse it a second time.
  function loadParsedIntoSlot(store, slotIndex, fileName, parsed) {
    var slot = {
      loaded: true,
      fileName: fileName,
      dataName: parsed.dataName || "",
      items: parsed.items || {},
      warnings: parsed.warnings || []
    };

    store.slots[slotIndex] = slot;
    return slot;
  }

  // Loads one already-selected block (from a multi-block CIF the user
  // picked structures from) directly into a slot, bypassing re-parsing.
  function loadBlockIntoSlot(store, slotIndex, fileName, block) {
    var slot = {
      loaded: true,
      fileName: fileName,
      dataName: block.dataName || "",
      items: block.items || {},
      warnings: []
    };

    store.slots[slotIndex] = slot;
    return slot;
  }

  function clearSlot(store, slotIndex) {
    store.slots[slotIndex] = emptySlot();
  }

  function clearAll(store) {
    for (var i = 0; i < store.slots.length; i++) {
      clearSlot(store, i);
    }
  }

  function loadedSlots(store) {
    return store.slots.filter(function (s) {
      return s.loaded;
    });
  }

  function nextFreeSlotIndex(store) {
    for (var i = 0; i < store.slots.length; i++) {
      if (!store.slots[i].loaded) {
        return i;
      }
    }
    return -1;
  }

  TableMaster.Store = {
    MAX_SLOTS: MAX_SLOTS,
    createStore: createStore,
    loadIntoSlot: loadIntoSlot,
    loadParsedIntoSlot: loadParsedIntoSlot,
    loadBlockIntoSlot: loadBlockIntoSlot,
    clearSlot: clearSlot,
    clearAll: clearAll,
    loadedSlots: loadedSlots,
    nextFreeSlotIndex: nextFreeSlotIndex
  };
})();
