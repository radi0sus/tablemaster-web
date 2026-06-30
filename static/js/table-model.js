(function () {
  "use strict";

  window.TableMaster = window.TableMaster || {};
  var F = TableMaster.Format;

  function getItem(items, names) {
    for (var i = 0; i < names.length; i++) {
      var value = items[names[i]];
      if (!F.isMissing(value)) {
        return F.cleanValue(value);
      }
    }
    return "";
  }

  function hklPart(min, max) {
    if (F.isMissing(min) || F.isMissing(max)) {
      return "";
    }

    var minNum = parseInt(min, 10);
    var maxNum = parseInt(max, 10);

    if (isFinite(minNum) && isFinite(maxNum) && minNum === -maxNum) {
      return "±" + Math.abs(maxNum);
    }

    return F.typographicMinus(min) + " - " + F.typographicMinus(max);
  }

  function hklRange(items) {
    var h = hklPart(
      getItem(items, ["_diffrn_reflns_limit_h_min"]),
      getItem(items, ["_diffrn_reflns_limit_h_max"])
    );
    var k = hklPart(
      getItem(items, ["_diffrn_reflns_limit_k_min"]),
      getItem(items, ["_diffrn_reflns_limit_k_max"])
    );
    var l = hklPart(
      getItem(items, ["_diffrn_reflns_limit_l_min"]),
      getItem(items, ["_diffrn_reflns_limit_l_max"])
    );

    return [h, k, l].filter(Boolean).join(", ");
  }

  // Joins 1-5 names with an Oxford comma:
  // "A." / "A and B." / "A, B, and C." / ...
  // `wrap` optionally formats each individual name (e.g. bold markup).
  function joinNamesForCaption(names, wrap) {
    wrap = wrap || function (s) { return s; };
    var n = names.length;
    var wrapped = names.map(wrap);

    if (n === 0) {
      return "";
    }
    if (n === 1) {
      return wrapped[0];
    }
    if (n === 2) {
      return wrapped[0] + " and " + wrapped[1];
    }

    return wrapped.slice(0, n - 1).join(", ") + ", and " + wrapped[n - 1];
  }

  // One row definition: a label (HTML + unit-aware) and a function that
  // extracts the display value (HTML string) for a single structure's
  // CIF items. A row is only included in the final table if at least
  // one loaded structure has a non-empty value for it.
  function buildFieldDefs(options) {
    var siUnits = !!options.siUnits;

    function unit(text, u) {
      return F.withUnit(siUnits, text, u);
    }

    var defs = [];

    defs.push({
      key: "formula",
      labelHtml: "empirical formula",
      value: function (items) {
        return F.formatFormulaText(getItem(items, ["_chemical_formula_sum"]));
      }
    });

    if (options.includeMoiety) {
      defs.push({
        key: "moiety",
        labelHtml: "moiety formula",
        value: function (items) {
          return F.formatFormulaText(getItem(items, ["_chemical_formula_moiety"]));
        }
      });
    }

    defs.push({
      key: "weight",
      labelHtml: "formula weight",
      value: function (items) {
        return getItem(items, ["_chemical_formula_weight"]);
      }
    });

    if (options.includeTemperature) {
      defs.push({
        key: "temperature",
        labelHtml: unit("<i>T</i>", "K"),
        value: function (items) {
          return getItem(items, ["_diffrn_ambient_temperature", "_cell_measurement_temperature"]);
        }
      });
    }

    defs.push({
      key: "crystalSize",
      labelHtml: unit("crystal size", "mm³"),
      value: function (items) {
        var max = getItem(items, ["_exptl_crystal_size_max"]);
        var mid = getItem(items, ["_exptl_crystal_size_mid"]);
        var min = getItem(items, ["_exptl_crystal_size_min"]);
        return [max, mid, min].filter(Boolean).join(" × ");
      }
    });

    defs.push({
      key: "crystalSystem",
      labelHtml: "crystal system",
      value: function (items) {
        return getItem(items, ["_space_group_crystal_system", "_symmetry_cell_setting"]);
      }
    });

    defs.push({
      key: "spaceGroup",
      labelHtml: "space group",
      value: function (items) {
        var sg = getItem(items, ["_space_group_name_H-M_alt", "_symmetry_space_group_name_H-M"]);
        var itNo = getItem(items, ["_space_group_IT_number"]);
        return sg ? F.formatSpaceGroupHtml(sg, itNo) : "";
      }
    });

    ["a", "b", "c"].forEach(function (axis) {
      defs.push({
        key: "cell_" + axis,
        labelHtml: unit("<i>" + axis + "</i>", "Å"),
        value: function (items) {
          return getItem(items, ["_cell_length_" + axis]);
        }
      });
    });

    [["alpha", "α"], ["beta", "β"], ["gamma", "γ"]].forEach(function (pair) {
      defs.push({
        key: "angle_" + pair[0],
        labelHtml: unit("<i>" + pair[1] + "</i>", "°"),
        value: function (items) {
          return getItem(items, ["_cell_angle_" + pair[0]]);
        }
      });
    });

    defs.push({
      key: "volume",
      labelHtml: unit("<i>V</i>", "Å³"),
      value: function (items) {
        return getItem(items, ["_cell_volume"]);
      }
    });

    defs.push({
      key: "z",
      labelHtml: "<i>Z</i>",
      value: function (items) {
        return getItem(items, ["_cell_formula_units_Z"]);
      }
    });

    defs.push({
      key: "density",
      labelHtml: unit("<i>ρ</i>", "g·cm⁻³"),
      value: function (items) {
        return getItem(items, ["_exptl_crystal_density_diffrn"]);
      }
    });

    defs.push({
      key: "f000",
      labelHtml: "<i>F</i>(000)",
      value: function (items) {
        return getItem(items, ["_exptl_crystal_F_000"]);
      }
    });

    defs.push({
      key: "mu",
      labelHtml: unit("<i>µ</i>", "mm⁻¹"),
      value: function (items) {
        return getItem(items, ["_exptl_absorpt_coefficient_mu"]);
      }
    });

    defs.push({
      key: "tminmax",
      labelHtml: "<i>T</i><sub>min</sub> / <i>T</i><sub>max</sub>",
      value: function (items) {
        var tMin = getItem(items, [
          "_exptl_absorpt_correction_T_min",
          "_exptl_transmission_factor_min",
          "_shelx_estimated_absorpt_T_min"
        ]);
        var tMax = getItem(items, [
          "_exptl_absorpt_correction_T_max",
          "_exptl_transmission_factor_max",
          "_shelx_estimated_absorpt_T_max"
        ]);
        if (!tMin && !tMax) {
          return "";
        }
        return (tMin || "?") + " / " + (tMax || "?");
      }
    });

    defs.push({
      key: "thetaRange",
      labelHtml: unit("<i>θ</i>-range", "°"),
      value: function (items) {
        var thetaMin = getItem(items, ["_diffrn_reflns_theta_min", "_cell_measurement_theta_min"]);
        var thetaMax = getItem(items, ["_diffrn_reflns_theta_max", "_cell_measurement_theta_max"]);
        if (!thetaMin && !thetaMax) {
          return "";
        }
        return F.typographicMinus(thetaMin || "?") + " - " + F.typographicMinus(thetaMax || "?");
      }
    });

    defs.push({
      key: "hklRange",
      labelHtml: "<i>hkl</i>-range",
      value: function (items) {
        return hklRange(items);
      }
    });

    defs.push({
      key: "measuredRefl",
      labelHtml: "measured refl.",
      value: function (items) {
        return getItem(items, ["_diffrn_reflns_number"]);
      }
    });

    defs.push({
      key: "uniqueRefl",
      labelHtml: "unique refl. [<i>R</i><sub>int</sub>]",
      value: function (items) {
        var unique = getItem(items, ["_reflns_number_total"]);
        var rInt = getItem(items, ["_diffrn_reflns_av_R_equivalents"]);
        if (!unique && !rInt) {
          return "";
        }
        return (unique || "?") + (rInt ? " [" + rInt + "]" : "");
      }
    });

    defs.push({
      key: "observedRefl",
      labelHtml: "observed refl. (<i>I</i> &gt; 2σ(<i>I</i>))",
      value: function (items) {
        return getItem(items, ["_reflns_number_gt"]);
      }
    });

    defs.push({
      key: "drp",
      labelHtml: "data / restraints / param.",
      value: function (items) {
        var reflns = getItem(items, ["_refine_ls_number_reflns", "_reflns_number_total"]);
        var restraints = getItem(items, ["_refine_ls_number_restraints"]);
        var params = getItem(items, ["_refine_ls_number_parameters"]);
        if (!reflns && !restraints && !params) {
          return "";
        }
        return [reflns || "?", restraints || "?", params || "?"].join(" / ");
      }
    });

    defs.push({
      key: "gof",
      labelHtml: "goodness-of-fit (<i>F</i>²)",
      value: function (items) {
        return getItem(items, ["_refine_ls_goodness_of_fit_ref"]);
      }
    });

    defs.push({
      key: "rGt",
      labelHtml: "<i>R</i>1, <i>wR</i>2 (<i>I</i> &gt; 2σ(<i>I</i>))",
      value: function (items) {
        var rGt = getItem(items, ["_refine_ls_R_factor_gt"]);
        var wrGt = getItem(items, ["_refine_ls_wR_factor_gt"]);
        if (!rGt && !wrGt) {
          return "";
        }
        return (rGt || "?") + " / " + (wrGt || "?");
      }
    });

    defs.push({
      key: "rAll",
      labelHtml: "<i>R</i>1, <i>wR</i>2 (all data)",
      value: function (items) {
        var rAll = getItem(items, ["_refine_ls_R_factor_all"]);
        var wrAll = getItem(items, ["_refine_ls_wR_factor_ref"]);
        if (!rAll && !wrAll) {
          return "";
        }
        return (rAll || "?") + " / " + (wrAll || "?");
      }
    });

    defs.push({
      key: "residualDensity",
      labelHtml: unit("res. el. dens.", "e·Å⁻³"),
      value: function (items) {
        var diffMin = getItem(items, ["_refine_diff_density_min"]);
        var diffMax = getItem(items, ["_refine_diff_density_max"]);
        if (!diffMin && !diffMax) {
          return "";
        }
        return F.typographicMinus(diffMin || "?") + " / " + F.typographicMinus(diffMax || "?");
      }
    });

    return defs;
  }

  // Builds the full comparison model for the currently loaded structures.
  //   structures: array of { dataName, items } (already filtered to loaded ones)
  //   options: { siUnits, includeTemperature, includeMoiety }
  function buildModel(structures, options) {
    options = options || {};

    var names = structures.map(function (s) {
      return s.dataName || "(unnamed)";
    });

    var caption = structures.length
      ? "Crystal data and refinement details for " + joinNamesForCaption(names) + "."
      : "";

    var defs = buildFieldDefs(options);

    var rows = defs.map(function (def) {
      var values = structures.map(function (s) {
        return def.value(s.items || {});
      });

      return {
        key: def.key,
        labelHtml: def.labelHtml,
        labelText: F.stripHtml(def.labelHtml),
        valuesHtml: values,
        valuesText: values.map(F.stripHtml)
      };
    }).filter(function (row) {
      return row.valuesHtml.some(function (v) {
        return !F.isMissing(v);
      });
    });

    return {
      names: names,
      caption: caption,
      columnCount: structures.length,
      rows: rows
    };
  }

  TableMaster.Model = {
    getItem: getItem,
    hklRange: hklRange,
    joinNamesForCaption: joinNamesForCaption,
    buildModel: buildModel
  };
})();
