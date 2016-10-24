(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    module.exports = mod()
  else if (typeof define == "function" && define.amd) // AMD
    return define([], mod)
  else // Plain browser env
    (this || window).browserKeymap = mod()
})(function() {
  "use strict"

  var mac = typeof navigator != "undefined" ? /Mac/.test(navigator.platform)
          : typeof os != "undefined" ? os.platform() == "darwin" : false

  // :: Object<string>
  // A map from key codes to key names.
  var keyNames = {
    3: "Enter", 8: "Backspace", 9: "Tab", 13: "Enter", 16: "Shift", 17: "Ctrl", 18: "Alt",
    19: "Pause", 20: "CapsLock", 27: "Esc", 32: "Space", 33: "PageUp", 34: "PageDown", 35: "End",
    36: "Home", 37: "Left", 38: "Up", 39: "Right", 40: "Down", 44: "PrintScrn", 45: "Insert",
    46: "Delete", 59: ";", 61: "=", 91: "Mod", 92: "Mod", 93: "Mod",
    106: "*", 107: "=", 109: "-", 110: ".", 111: "/", 127: "Delete",
    173: "-", 186: ";", 187: "=", 188: ",", 189: "-", 190: ".", 191: "/", 192: "`", 219: "[", 220: "\\",
    221: "]", 222: "'", 63232: "Up", 63233: "Down", 63234: "Left", 63235: "Right", 63272: "Delete",
    63273: "Home", 63275: "End", 63276: "PageUp", 63277: "PageDown", 63302: "Insert"
  }

  // Number keys
  for (var i = 0; i < 10; i++) keyNames[i + 48] = keyNames[i + 96] = String(i)
  // Alphabetic keys
  for (var i = 65; i <= 90; i++) keyNames[i] = String.fromCharCode(i)
  // Function keys
  for (var i = 1; i <= 12; i++) keyNames[i + 111] = keyNames[i + 63235] = "F" + i

  // :: (KeyboardEvent) → ?string
  // Find a name for the given keydown event. If the keycode in the
  // event is not known, this will return `null`. Otherwise, it will
  // return a string like `"Shift-Cmd-Ctrl-Alt-Home"`. The parts before
  // the dashes give the modifiers (always in that order, if present),
  // and the last word gives the key name, which one of the names in
  // `keyNames`.
  //
  // The convention for keypress events is to use the pressed character
  // between single quotes. Due to limitations in the browser API,
  // keypress events can not have modifiers.
  function keyName(event) {
    if (event.type == "keypress") return "'" + String.fromCharCode(event.charCode) + "'"

    var base = keyNames[event.keyCode], name = base
    if (name == null || event.altGraphKey) return null

    if (event.altKey && base != "Alt") name = "Alt-" + name
    if (event.ctrlKey && base != "Ctrl") name = "Ctrl-" + name
    if (event.metaKey && base != "Cmd") name = "Cmd-" + name
    if (event.shiftKey && base != "Shift") name = "Shift-" + name
    return name
  }

  // :: (string) → bool
  // Test whether the given key name refers to a modifier key.
  function isModifierKey(name) {
    name = /[^-]*$/.exec(name)[0]
    return name == "Ctrl" || name == "Alt" || name == "Shift" || name == "Mod"
  }

  // :: (string) → string
  // Normalize a sloppy key name, which may have modifiers in the wrong
  // order or use shorthands for modifiers, to a properly formed key
  // name. Used to normalize names provided in keymaps.
  //
  // Note that the modifier `mod` is a shorthand for `Cmd` on Mac, and
  // `Ctrl` on other platforms.
  function normalizeKeyName(name) {
    var parts = name.split(/-(?!'?$)/), result = parts[parts.length - 1]
    var alt, ctrl, shift, cmd
    for (var i = 0; i < parts.length - 1; i++) {
      var mod = parts[i]
      if (/^(cmd|meta|m)$/i.test(mod)) cmd = true
      else if (/^a(lt)?$/i.test(mod)) alt = true
      else if (/^(c|ctrl|control)$/i.test(mod)) ctrl = true
      else if (/^s(hift)?$/i.test(mod)) shift = true
      else if (/^mod$/i.test(mod)) { if (mac) cmd = true; else ctrl = true }
      else throw new Error("Unrecognized modifier name: " + mod)
    }
    if (alt) result = "Alt-" + result
    if (ctrl) result = "Ctrl-" + result
    if (cmd) result = "Cmd-" + result
    if (shift) result = "Shift-" + result
    return result
  }

  // :: (Object, ?Object)
  // A keymap binds a set of [key names](#keyName) to commands names
  // or functions.
  //
  // Construct a keymap using the bindings in `keys`, whose properties
  // should be [key names](#keyName) or space-separated sequences of
  // key names. In the second case, the binding will be for a
  // multi-stroke key combination.
  //
  // When `options` has a property `call`, this will be a programmatic
  // keymap, meaning that instead of looking keys up in its set of
  // bindings, it will pass the key name to `options.call`, and use
  // the return value of that calls as the resolved binding.
  //
  // `options.name` can be used to give the keymap a name, making it
  // easier to [remove](#ProseMirror.removeKeymap) from an editor.
  function Keymap(keys, options) {
    this.options = options || {}
    this.bindings = Object.create(null)
    if (keys) this.addBindings(keys)
  }

  Keymap.prototype = {
    normalize: function(name) {
      return this.options.multi !== false ? name.split(/ +(?!\'$)/).map(normalizeKeyName) : [normalizeKeyName(name)]
    },

    // :: (string, any)
    // Add a binding for the given key or key sequence.
    addBinding: function(keyname, value) {
      var keys = this.normalize(keyname)
      for (var i = 0; i < keys.length; i++) {
        var name = keys.slice(0, i + 1).join(" ")
        var val = i == keys.length - 1 ? value : "..."
        var prev = this.bindings[name]
        if (!prev) this.bindings[name] = val
        else if (prev != val) throw new Error("Inconsistent bindings for " + name)
      }
    },

    // :: (Object<any>)
    // Add all the bindings in the given object to the keymap.
    addBindings: function(bindings) {
      for (var keyname in bindings) if (Object.prototype.hasOwnProperty.call(bindings, keyname))
        this.addBinding(keyname, bindings[keyname])
    },

    // :: (string)
    // Remove the binding for the given key or key sequence.
    removeBinding: function(keyname) {
      var keys = this.normalize(keyname)
      for (var i = keys.length - 1; i >= 0; i--) {
        var name = keys.slice(0, i).join(" ")
        var val = this.bindings[name]
        if (val == "..." && !this.unusedMulti(name))
          break
        else if (val)
          delete this.bindings[name]
      }
    },

    unusedMulti: function(name) {
      for (var binding in this.bindings)
        if (binding.length > name && binding.indexOf(name) == 0 && binding.charAt(name.length) == " ")
          return false
      return true
    },

    // :: (string, ?any) → any
    // Looks up the given key or key sequence in this keymap. Returns
    // the value the key is bound to (which may be undefined if it is
    // not bound), or the string `"..."` if the key is a prefix of a
    // multi-key sequence that is bound by this keymap.
    lookup: function(key, context) {
      return this.options.call ? this.options.call(key, context) : this.bindings[key]
    },

    // :: (any) → ?string
    reverseLookup: function(value) {
      for (var keyname in this.bindings)
        if (this.bindings[keyname] == value) return keyname
    },

    constructor: Keymap
  }

  Keymap.keyName = keyName
  Keymap.isModifierKey = isModifierKey
  Keymap.normalizeKeyName = normalizeKeyName

  return Keymap
})

},{}],2:[function(require,module,exports){
"use strict";

var Keymap = require("browserkeymap");

var _require = require("./selection");

var findSelectionFrom = _require.findSelectionFrom;
var verticalMotionLeavesTextblock = _require.verticalMotionLeavesTextblock;
var NodeSelection = _require.NodeSelection;
var TextSelection = _require.TextSelection;

var browser = require("../util/browser");

function nothing() {}

function moveSelectionBlock(pm, dir) {
  var _pm$selection = pm.selection;
  var $from = _pm$selection.$from;
  var $to = _pm$selection.$to;
  var node = _pm$selection.node;

  var $side = dir > 0 ? $to : $from;
  var $start = node && node.isBlock ? $side : $side.depth ? pm.doc.resolve(dir > 0 ? $side.after() : $side.before()) : null;
  return $start && findSelectionFrom($start, dir);
}

function selectNodeHorizontally(pm, dir) {
  var _pm$selection2 = pm.selection;
  var empty = _pm$selection2.empty;
  var node = _pm$selection2.node;
  var $from = _pm$selection2.$from;
  var $to = _pm$selection2.$to;

  if (!empty && !node) return false;

  if (node && node.isInline) {
    pm.setSelection(new TextSelection(dir > 0 ? $to : $from));
    return true;
  }

  if (!node) {
    var _ref = dir > 0 ? $from.parent.childAfter($from.parentOffset) : $from.parent.childBefore($from.parentOffset);

    var nextNode = _ref.node;
    var offset = _ref.offset;

    if (nextNode) {
      if (nextNode.type.selectable && offset == $from.parentOffset - (dir > 0 ? 0 : nextNode.nodeSize)) {
        pm.setSelection(new NodeSelection(dir < 0 ? pm.doc.resolve($from.pos - nextNode.nodeSize) : $from));
        return true;
      }
      return false;
    }
  }

  var next = moveSelectionBlock(pm, dir);
  if (next && (next instanceof NodeSelection || node)) {
    pm.setSelection(next);
    return true;
  }
  return false;
}

function horiz(dir) {
  return function (pm) {
    var done = selectNodeHorizontally(pm, dir);
    if (done) pm.scrollIntoView();
    return done;
  };
}

// : (ProseMirror, number)
// Check whether vertical selection motion would involve node
// selections. If so, apply it (if not, the result is left to the
// browser)
function selectNodeVertically(pm, dir) {
  var _pm$selection3 = pm.selection;
  var empty = _pm$selection3.empty;
  var node = _pm$selection3.node;
  var $from = _pm$selection3.$from;
  var $to = _pm$selection3.$to;

  if (!empty && !node) return false;

  var leavingTextblock = true,
      $start = dir < 0 ? $from : $to;
  if (!node || node.isInline) {
    pm.flush(); // verticalMotionLeavesTextblock needs an up-to-date DOM
    leavingTextblock = verticalMotionLeavesTextblock(pm, $start, dir);
  }

  if (leavingTextblock) {
    var next = moveSelectionBlock(pm, dir);
    if (next && next instanceof NodeSelection) {
      pm.setSelection(next);
      return true;
    }
  }

  if (!node || node.isInline) return false;

  var beyond = findSelectionFrom($start, dir);
  if (beyond) pm.setSelection(beyond);
  return true;
}

function vert(dir) {
  return function (pm) {
    var done = selectNodeVertically(pm, dir);
    if (done !== false) pm.scrollIntoView();
    return done;
  };
}

// A backdrop keymap used to make sure we always suppress keys that
// have a dangerous default effect, even if the commands they are
// bound to return false, and to make sure that cursor-motion keys
// find a cursor (as opposed to a node selection) when pressed. For
// cursor-motion keys, the code in the handlers also takes care of
// block selections.

var keys = {
  "Esc": nothing,
  "Enter": nothing,
  "Ctrl-Enter": nothing,
  "Mod-Enter": nothing,
  "Shift-Enter": nothing,
  "Backspace": browser.ios ? undefined : nothing,
  "Delete": nothing,
  "Mod-B": nothing,
  "Mod-I": nothing,
  "Mod-Backspace": nothing,
  "Mod-Delete": nothing,
  "Shift-Backspace": nothing,
  "Shift-Delete": nothing,
  "Shift-Mod-Backspace": nothing,
  "Shift-Mod-Delete": nothing,
  "Mod-Z": nothing,
  "Mod-Y": nothing,
  "Shift-Mod-Z": nothing,
  "Ctrl-D": nothing,
  "Ctrl-H": nothing,
  "Ctrl-Alt-Backspace": nothing,
  "Alt-D": nothing,
  "Alt-Delete": nothing,
  "Alt-Backspace": nothing,

  "Left": horiz(-1),
  "Mod-Left": horiz(-1),
  "Right": horiz(1),
  "Mod-Right": horiz(1),
  "Up": vert(-1),
  "Down": vert(1)
};

if (browser.mac) {
  keys["Alt-Left"] = horiz(-1);
  keys["Alt-Right"] = horiz(1);
  keys["Ctrl-Backspace"] = keys["Ctrl-Delete"] = nothing;
}

var captureKeys = new Keymap(keys);
exports.captureKeys = captureKeys;
},{"../util/browser":58,"./selection":17,"browserkeymap":1}],3:[function(require,module,exports){
"use strict";

var nonASCIISingleCaseWordChar = /[\u00df\u0587\u0590-\u05f4\u0600-\u06ff\u3040-\u309f\u30a0-\u30ff\u3400-\u4db5\u4e00-\u9fcc\uac00-\ud7af]/;

// Extending unicode characters. A series of a non-extending char +
// any number of extending chars is treated as a single unit as far
// as editing and measuring is concerned. This is not fully correct,
// since some scripts/fonts/browsers also treat other configurations
// of code points as a group.
var extendingChar = /[\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u065e\u0670\u06d6-\u06dc\u06de-\u06e4\u06e7\u06e8\u06ea-\u06ed\u0711\u0730-\u074a\u07a6-\u07b0\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0900-\u0902\u093c\u0941-\u0948\u094d\u0951-\u0955\u0962\u0963\u0981\u09bc\u09be\u09c1-\u09c4\u09cd\u09d7\u09e2\u09e3\u0a01\u0a02\u0a3c\u0a41\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a70\u0a71\u0a75\u0a81\u0a82\u0abc\u0ac1-\u0ac5\u0ac7\u0ac8\u0acd\u0ae2\u0ae3\u0b01\u0b3c\u0b3e\u0b3f\u0b41-\u0b44\u0b4d\u0b56\u0b57\u0b62\u0b63\u0b82\u0bbe\u0bc0\u0bcd\u0bd7\u0c3e-\u0c40\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0cbc\u0cbf\u0cc2\u0cc6\u0ccc\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0d3e\u0d41-\u0d44\u0d4d\u0d57\u0d62\u0d63\u0dca\u0dcf\u0dd2-\u0dd4\u0dd6\u0ddf\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0eb1\u0eb4-\u0eb9\u0ebb\u0ebc\u0ec8-\u0ecd\u0f18\u0f19\u0f35\u0f37\u0f39\u0f71-\u0f7e\u0f80-\u0f84\u0f86\u0f87\u0f90-\u0f97\u0f99-\u0fbc\u0fc6\u102d-\u1030\u1032-\u1037\u1039\u103a\u103d\u103e\u1058\u1059\u105e-\u1060\u1071-\u1074\u1082\u1085\u1086\u108d\u109d\u135f\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b7-\u17bd\u17c6\u17c9-\u17d3\u17dd\u180b-\u180d\u18a9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193b\u1a17\u1a18\u1a56\u1a58-\u1a5e\u1a60\u1a62\u1a65-\u1a6c\u1a73-\u1a7c\u1a7f\u1b00-\u1b03\u1b34\u1b36-\u1b3a\u1b3c\u1b42\u1b6b-\u1b73\u1b80\u1b81\u1ba2-\u1ba5\u1ba8\u1ba9\u1c2c-\u1c33\u1c36\u1c37\u1cd0-\u1cd2\u1cd4-\u1ce0\u1ce2-\u1ce8\u1ced\u1dc0-\u1de6\u1dfd-\u1dff\u200c\u200d\u20d0-\u20f0\u2cef-\u2cf1\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua66f-\ua672\ua67c\ua67d\ua6f0\ua6f1\ua802\ua806\ua80b\ua825\ua826\ua8c4\ua8e0-\ua8f1\ua926-\ua92d\ua947-\ua951\ua980-\ua982\ua9b3\ua9b6-\ua9b9\ua9bc\uaa29-\uaa2e\uaa31\uaa32\uaa35\uaa36\uaa43\uaa4c\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uabe5\uabe8\uabed\udc00-\udfff\ufb1e\ufe00-\ufe0f\ufe20-\ufe26\uff9e\uff9f]/;

function isWordChar(ch) {
  return (/\w/.test(ch) || ch > "\x80" && (ch < "�" || ch > "�") && (isExtendingChar(ch) || ch.toUpperCase() != ch.toLowerCase() || nonASCIISingleCaseWordChar.test(ch))
  );
}
exports.isWordChar = isWordChar;

// Get the category of a given character. Either a "space",
// a character that can be part of a word ("word"), or anything else ("other").
function charCategory(ch) {
  return (/\s/.test(ch) ? "space" : isWordChar(ch) ? "word" : "other"
  );
}
exports.charCategory = charCategory;

function isExtendingChar(ch) {
  return ch.charCodeAt(0) >= 768 && extendingChar.test(ch);
}
exports.isExtendingChar = isExtendingChar;
},{}],4:[function(require,module,exports){
"use strict";

var _require = require("../transform");

var joinPoint = _require.joinPoint;
var joinable = _require.joinable;
var findWrapping = _require.findWrapping;
var liftTarget = _require.liftTarget;
var canSplit = _require.canSplit;
var ReplaceAroundStep = _require.ReplaceAroundStep;

var _require2 = require("../model");

var Slice = _require2.Slice;
var Fragment = _require2.Fragment;
var NodeRange = _require2.NodeRange;

var browser = require("../util/browser");

var _require3 = require("./char");

var charCategory = _require3.charCategory;
var isExtendingChar = _require3.isExtendingChar;

var _require4 = require("./selection");

var findSelectionFrom = _require4.findSelectionFrom;
var TextSelection = _require4.TextSelection;
var NodeSelection = _require4.NodeSelection;

// :: Object
// This object contains a number of ‘commands‘, functions that take a
// ProseMirror instance and try to perform some action on it,
// returning `false` if they don't apply. These are used to bind keys
// to, and to define [menu items](#menu).
//
// Most of the command functions defined here take a second, optional,
// boolean parameter. This can be set to `false` to do a ‘dry run’,
// where the function won't take any actual action, but will return
// information about whether it applies.

var commands = Object.create(null);
exports.commands = commands;

// :: (...[(ProseMirror, ?bool) → bool]) → (ProseMirror, ?bool) → bool
// Combine a number of command functions into a single function (which
// calls them one by one until one returns something other than
// `false`).
commands.chainCommands = function () {
  for (var _len = arguments.length, commands = Array(_len), _key = 0; _key < _len; _key++) {
    commands[_key] = arguments[_key];
  }

  return function (pm, apply) {
    for (var i = 0; i < commands.length; i++) {
      var val = commands[i](pm, apply);
      if (val !== false) return val;
    }
    return false;
  };
};

// :: (ProseMirror, ?bool) → bool
// Delete the selection, if there is one.
commands.deleteSelection = function (pm, apply) {
  if (pm.selection.empty) return false;
  if (apply !== false) pm.tr.replaceSelection().applyAndScroll();
  return true;
};

// :: (ProseMirror, ?bool) → bool
// If the selection is empty and at the start of a textblock, move
// that block closer to the block before it, by lifting it out of its
// parent or, if it has no parent it doesn't share with the node
// before it, moving it into a parent of that node, or joining it with
// that.
commands.joinBackward = function (pm, apply) {
  var _pm$selection = pm.selection;
  var $head = _pm$selection.$head;
  var empty = _pm$selection.empty;

  if (!empty) return false;

  if ($head.parentOffset > 0) return false;

  // Find the node before this one
  var before = void 0,
      cut = void 0;
  for (var i = $head.depth - 1; !before && i >= 0; i--) {
    if ($head.index(i) > 0) {
      cut = $head.before(i + 1);
      before = $head.node(i).child($head.index(i) - 1);
    }
  } // If there is no node before this, try to lift
  if (!before) {
    var range = $head.blockRange(),
        target = range && liftTarget(range);
    if (target == null) return false;
    if (apply !== false) pm.tr.lift(range, target).applyAndScroll();
    return true;
  }

  // If the node below has no content and the node above is
  // selectable, delete the node below and select the one above.
  if (before.type.isLeaf && before.type.selectable && $head.parent.content.size == 0) {
    if (apply !== false) {
      var tr = pm.tr.delete(cut, cut + $head.parent.nodeSize);
      tr.setSelection(new NodeSelection(tr.doc.resolve(cut - before.nodeSize)));
      tr.applyAndScroll();
    }
    return true;
  }

  // If the node doesn't allow children, delete it
  if (before.type.isLeaf) {
    if (apply !== false) pm.tr.delete(cut - before.nodeSize, cut).applyAndScroll();
    return true;
  }

  // Apply the joining algorithm
  return deleteBarrier(pm, cut, apply);
};

// :: (ProseMirror, ?bool) → bool
// If the selection is empty and the cursor is at the end of a
// textblock, move the node after it closer to the node with the
// cursor (lifting it out of parents that aren't shared, moving it
// into parents of the cursor block, or joining the two when they are
// siblings).
commands.joinForward = function (pm, apply) {
  var _pm$selection2 = pm.selection;
  var $head = _pm$selection2.$head;
  var empty = _pm$selection2.empty;

  if (!empty || $head.parentOffset < $head.parent.content.size) return false;

  // Find the node after this one
  var after = void 0,
      cut = void 0;
  for (var i = $head.depth - 1; !after && i >= 0; i--) {
    var parent = $head.node(i);
    if ($head.index(i) + 1 < parent.childCount) {
      after = parent.child($head.index(i) + 1);
      cut = $head.after(i + 1);
    }
  }

  // If there is no node after this, there's nothing to do
  if (!after) return false;

  // If the node doesn't allow children, delete it
  if (after.type.isLeaf) {
    if (apply !== false) pm.tr.delete(cut, cut + after.nodeSize).applyAndScroll();
    return true;
  } else {
    // Apply the joining algorithm
    return deleteBarrier(pm, cut, true);
  }
};

// :: (ProseMirror, ?bool) → bool
// Delete the character before the cursor, if the selection is empty
// and the cursor isn't at the start of a textblock.
commands.deleteCharBefore = function (pm, apply) {
  if (browser.ios) return false;
  var _pm$selection3 = pm.selection;
  var $head = _pm$selection3.$head;
  var empty = _pm$selection3.empty;

  if (!empty || $head.parentOffset == 0) return false;
  if (apply !== false) {
    var dest = moveBackward($head, "char");
    pm.tr.delete(dest, $head.pos).applyAndScroll();
  }
  return true;
};

// :: (ProseMirror, ?bool) → bool
// Delete the word before the cursor, if the selection is empty and
// the cursor isn't at the start of a textblock.
commands.deleteWordBefore = function (pm, apply) {
  var _pm$selection4 = pm.selection;
  var $head = _pm$selection4.$head;
  var empty = _pm$selection4.empty;

  if (!empty || $head.parentOffset == 0) return false;
  if (apply !== false) {
    var dest = moveBackward($head, "word");
    pm.tr.delete(dest, $head.pos).applyAndScroll();
  }
  return true;
};

// :: (ProseMirror, ?bool) → bool
// Delete the character after the cursor, if the selection is empty
// and the cursor isn't at the end of its textblock.
commands.deleteCharAfter = function (pm, apply) {
  var _pm$selection5 = pm.selection;
  var $head = _pm$selection5.$head;
  var empty = _pm$selection5.empty;

  if (!empty || $head.parentOffset == $head.parent.content.size) return false;
  if (apply !== false) {
    var dest = moveForward($head, "char");
    pm.tr.delete($head.pos, dest).applyAndScroll();
  }
  return true;
};

// :: (ProseMirror, ?bool) → bool
// Delete the word after the cursor, if the selection is empty and the
// cursor isn't at the end of a textblock.
commands.deleteWordAfter = function (pm, apply) {
  var _pm$selection6 = pm.selection;
  var $head = _pm$selection6.$head;
  var empty = _pm$selection6.empty;

  if (!empty || $head.parentOffset == $head.parent.content.size) return false;
  if (apply !== false) {
    var dest = moveForward($head, "word");
    pm.tr.delete($head.pos, dest).applyAndScroll();
  }
  return true;
};

// :: (ProseMirror, ?bool) → bool
// Join the selected block or, if there is a text selection, the
// closest ancestor block of the selection that can be joined, with
// the sibling above it.
commands.joinUp = function (pm, apply) {
  var _pm$selection7 = pm.selection;
  var node = _pm$selection7.node;
  var from = _pm$selection7.from;var point = void 0;
  if (node) {
    if (node.isTextblock || !joinable(pm.doc, from)) return false;
    point = from;
  } else {
    point = joinPoint(pm.doc, from, -1);
    if (point == null) return false;
  }
  if (apply !== false) {
    var tr = pm.tr.join(point);
    if (pm.selection.node) tr.setSelection(new NodeSelection(tr.doc.resolve(point - pm.doc.resolve(point).nodeBefore.nodeSize)));
    tr.applyAndScroll();
  }
  return true;
};

// :: (ProseMirror, ?bool) → bool
// Join the selected block, or the closest ancestor of the selection
// that can be joined, with the sibling after it.
commands.joinDown = function (pm, apply) {
  var node = pm.selection.node,
      nodeAt = pm.selection.from;
  var point = joinPointBelow(pm);
  if (!point) return false;
  if (apply !== false) {
    var tr = pm.tr.join(point);
    if (node) tr.setSelection(new NodeSelection(tr.doc.resolve(nodeAt)));
    tr.applyAndScroll();
  }
  return true;
};

// :: (ProseMirror, ?bool) → bool
// Lift the selected block, or the closest ancestor block of the
// selection that can be lifted, out of its parent node.
commands.lift = function (pm, apply) {
  var _pm$selection8 = pm.selection;
  var $from = _pm$selection8.$from;
  var $to = _pm$selection8.$to;

  var range = $from.blockRange($to),
      target = range && liftTarget(range);
  if (target == null) return false;
  if (apply !== false) pm.tr.lift(range, target).applyAndScroll();
  return true;
};

// :: (ProseMirror, ?bool) → bool
// If the selection is in a node whose type has a truthy `isCode`
// property, replace the selection with a newline character.
commands.newlineInCode = function (pm, apply) {
  var _pm$selection9 = pm.selection;
  var $from = _pm$selection9.$from;
  var $to = _pm$selection9.$to;
  var node = _pm$selection9.node;

  if (node) return false;
  if (!$from.parent.type.isCode || $to.pos >= $from.end()) return false;
  if (apply !== false) pm.tr.typeText("\n").applyAndScroll();
  return true;
};

// :: (ProseMirror, ?bool) → bool
// If a block node is selected, create an empty paragraph before (if
// it is its parent's first child) or after it.
commands.createParagraphNear = function (pm, apply) {
  var _pm$selection10 = pm.selection;
  var $from = _pm$selection10.$from;
  var $to = _pm$selection10.$to;
  var node = _pm$selection10.node;

  if (!node || !node.isBlock) return false;
  var type = $from.parent.defaultContentType($to.indexAfter());
  if (!type || !type.isTextblock) return false;
  if (apply !== false) {
    var side = ($from.parentOffset ? $to : $from).pos;
    var tr = pm.tr.insert(side, type.createAndFill());
    tr.setSelection(new TextSelection(tr.doc.resolve(side + 1)));
    tr.applyAndScroll();
  }
  return true;
};

// :: (ProseMirror, ?bool) → bool
// If the cursor is in an empty textblock that can be lifted, lift the
// block.
commands.liftEmptyBlock = function (pm, apply) {
  var _pm$selection11 = pm.selection;
  var $head = _pm$selection11.$head;
  var empty = _pm$selection11.empty;

  if (!empty || $head.parent.content.size) return false;
  if ($head.depth > 1 && $head.after() != $head.end(-1)) {
    var before = $head.before();
    if (canSplit(pm.doc, before)) {
      if (apply !== false) pm.tr.split(before).applyAndScroll();
      return true;
    }
  }
  var range = $head.blockRange(),
      target = range && liftTarget(range);
  if (target == null) return false;
  if (apply !== false) pm.tr.lift(range, target).applyAndScroll();
  return true;
};

// :: (ProseMirror, ?bool) → bool
// Split the parent block of the selection. If the selection is a text
// selection, delete it.
commands.splitBlock = function (pm, apply) {
  var _pm$selection12 = pm.selection;
  var $from = _pm$selection12.$from;
  var $to = _pm$selection12.$to;
  var node = _pm$selection12.node;

  if (node && node.isBlock) {
    if (!$from.parentOffset || !canSplit(pm.doc, $from.pos)) return false;
    if (apply !== false) pm.tr.split($from.pos).applyAndScroll();
    return true;
  } else {
    if (apply === false) return true;
    var atEnd = $to.parentOffset == $to.parent.content.size;
    var tr = pm.tr.delete($from.pos, $to.pos);
    var deflt = $from.depth == 0 ? null : $from.node(-1).defaultContentType($from.indexAfter(-1));
    var type = atEnd ? deflt : null;
    var can = canSplit(tr.doc, $from.pos, 1, type);
    if (!type && !can && canSplit(tr.doc, $from.pos, 1, deflt)) {
      type = deflt;
      can = true;
    }
    if (can) {
      tr.split($from.pos, 1, type);
      if (!atEnd && !$from.parentOffset && $from.parent.type != deflt) tr.setNodeType($from.before(), deflt);
    }
    tr.applyAndScroll();
    return true;
  }
};

// :: (ProseMirror, ?bool) → bool
// Move the selection to the node wrapping the current selection, if
// any. (Will not select the document node.)
commands.selectParentNode = function (pm, apply) {
  var sel = pm.selection,
      pos = void 0;
  if (sel.node) {
    if (!sel.$from.depth) return false;
    pos = sel.$from.before();
  } else {
    var same = sel.$head.sameDepth(sel.$anchor);
    if (same == 0) return false;
    pos = sel.$head.before(same);
  }
  if (apply !== false) pm.setNodeSelection(pos);
  return true;
};

// :: (ProseMirror, ?bool) → bool
// Undo the most recent change event, if any.
commands.undo = function (pm, apply) {
  if (pm.history.undoDepth == 0) return false;
  if (apply !== false) {
    pm.scrollIntoView();
    pm.history.undo();
  }
  return true;
};

// :: (ProseMirror, ?bool) → bool
// Redo the most recently undone change event, if any.
commands.redo = function (pm, apply) {
  if (pm.history.redoDepth == 0) return false;
  if (apply !== false) {
    pm.scrollIntoView();
    pm.history.redo();
  }
  return true;
};

function deleteBarrier(pm, cut, apply) {
  var $cut = pm.doc.resolve(cut),
      before = $cut.nodeBefore,
      after = $cut.nodeAfter,
      conn = void 0;
  if (joinable(pm.doc, cut)) {
    if (apply === false) return true;
    var tr = pm.tr.join(cut);
    if (tr.steps.length && before.content.size == 0 && !before.sameMarkup(after) && $cut.parent.canReplace($cut.index() - 1, $cut.index())) tr.setNodeType(cut - before.nodeSize, after.type, after.attrs);
    tr.applyAndScroll();
    return true;
  } else if (after.isTextblock && (conn = before.contentMatchAt($cut.index()).findWrapping(after.type, after.attrs))) {
    if (apply === false) return true;
    var end = cut + after.nodeSize,
        wrap = Fragment.empty;
    for (var i = conn.length - 1; i >= 0; i--) {
      wrap = Fragment.from(conn[i].type.create(conn[i].attrs, wrap));
    }wrap = Fragment.from(before.copy(wrap));
    pm.tr.step(new ReplaceAroundStep(cut - 1, end, cut, end, new Slice(wrap, 1, 0), conn.length, true)).join(end + 2 * conn.length, 1, true).applyAndScroll();
    return true;
  } else {
    var selAfter = findSelectionFrom($cut, 1);
    var range = selAfter.$from.blockRange(selAfter.$to),
        target = range && liftTarget(range);
    if (target == null) return false;
    if (apply !== false) pm.tr.lift(range, target).applyAndScroll();
    return true;
  }
}

// Get an offset moving backward from a current offset inside a node.
function moveBackward($pos, by) {
  if (by != "char" && by != "word") throw new RangeError("Unknown motion unit: " + by);

  var parent = $pos.parent,
      offset = $pos.parentOffset;

  var cat = null,
      counted = 0,
      pos = $pos.pos;
  for (;;) {
    if (offset == 0) return pos;

    var _parent$childBefore = parent.childBefore(offset);

    var start = _parent$childBefore.offset;
    var node = _parent$childBefore.node;

    if (!node) return pos;
    if (!node.isText) return cat ? pos : pos - 1;

    if (by == "char") {
      for (var i = offset - start; i > 0; i--) {
        if (!isExtendingChar(node.text.charAt(i - 1))) return pos - 1;
        offset--;
        pos--;
      }
    } else if (by == "word") {
      // Work from the current position backwards through text of a singular
      // character category (e.g. "cat" of "#!*") until reaching a character in a
      // different category (i.e. the end of the word).
      for (var _i = offset - start; _i > 0; _i--) {
        var nextCharCat = charCategory(node.text.charAt(_i - 1));
        if (cat == null || counted == 1 && cat == "space") cat = nextCharCat;else if (cat != nextCharCat) return pos;
        offset--;
        pos--;
        counted++;
      }
    }
  }
}

function moveForward($pos, by) {
  if (by != "char" && by != "word") throw new RangeError("Unknown motion unit: " + by);

  var parent = $pos.parent,
      offset = $pos.parentOffset,
      pos = $pos.pos;

  var cat = null,
      counted = 0;
  for (;;) {
    if (offset == parent.content.size) return pos;

    var _parent$childAfter = parent.childAfter(offset);

    var start = _parent$childAfter.offset;
    var node = _parent$childAfter.node;

    if (!node) return pos;
    if (!node.isText) return cat ? pos : pos + 1;

    if (by == "char") {
      for (var i = offset - start; i < node.text.length; i++) {
        if (!isExtendingChar(node.text.charAt(i + 1))) return pos + 1;
        offset++;
        pos++;
      }
    } else if (by == "word") {
      for (var _i2 = offset - start; _i2 < node.text.length; _i2++) {
        var nextCharCat = charCategory(node.text.charAt(_i2));
        if (cat == null || counted == 1 && cat == "space") cat = nextCharCat;else if (cat != nextCharCat) return pos;
        offset++;
        pos++;
        counted++;
      }
    }
  }
}

// Parameterized commands

function joinPointBelow(pm) {
  var _pm$selection13 = pm.selection;
  var node = _pm$selection13.node;
  var to = _pm$selection13.to;

  if (node) return joinable(pm.doc, to) ? to : null;else return joinPoint(pm.doc, to, 1);
}

// :: (NodeType, ?Object) → (pm: ProseMirror, apply: ?bool) → bool
// Wrap the selection in a node of the given type with the given
// attributes. When `apply` is `false`, just tell whether this is
// possible, without performing any action.
commands.wrapIn = function (nodeType, attrs) {
  return function (pm, apply) {
    var _pm$selection14 = pm.selection;
    var $from = _pm$selection14.$from;
    var $to = _pm$selection14.$to;

    var range = $from.blockRange($to),
        wrapping = range && findWrapping(range, nodeType, attrs);
    if (!wrapping) return false;
    if (apply !== false) pm.tr.wrap(range, wrapping).applyAndScroll();
    return true;
  };
};

// :: (NodeType, ?Object) → (pm: ProseMirror, apply: ?bool) → bool
// Try to the textblock around the selection to the given node type
// with the given attributes. Return `true` when this is possible. If
// `apply` is `false`, just report whether the change is possible,
// don't perform any action.
commands.setBlockType = function (nodeType, attrs) {
  return function (pm, apply) {
    var _pm$selection15 = pm.selection;
    var $from = _pm$selection15.$from;
    var $to = _pm$selection15.$to;
    var node = _pm$selection15.node;var depth = void 0;
    if (node) {
      depth = $from.depth;
    } else {
      if (!$from.depth || $to.pos > $from.end()) return false;
      depth = $from.depth - 1;
    }
    var target = node || $from.parent;
    if (!target.isTextblock || target.hasMarkup(nodeType, attrs)) return false;
    var index = $from.index(depth);
    if (!$from.node(depth).canReplaceWith(index, index + 1, nodeType)) return false;
    if (apply !== false) {
      var where = $from.before(depth + 1);
      pm.tr.clearMarkupFor(where, nodeType, attrs).setNodeType(where, nodeType, attrs).applyAndScroll();
    }
    return true;
  };
};

// List-related commands

// :: (NodeType, ?Object) → (pm: ProseMirror, apply: ?bool) → bool
// Returns a command function that wraps the selection in a list with
// the given type an attributes. If `apply` is `false`, only return a
// value to indicate whether this is possible, but don't actually
// perform the change.
commands.wrapInList = function (nodeType, attrs) {
  return function (pm, apply) {
    var _pm$selection16 = pm.selection;
    var $from = _pm$selection16.$from;
    var $to = _pm$selection16.$to;

    var range = $from.blockRange($to),
        doJoin = false,
        outerRange = range;
    // This is at the top of an existing list item
    if (range.depth >= 2 && $from.node(range.depth - 1).type.compatibleContent(nodeType) && range.startIndex == 0) {
      // Don't do anything if this is the top of the list
      if ($from.index(range.depth - 1) == 0) return false;
      var $insert = pm.doc.resolve(range.start - 2);
      outerRange = new NodeRange($insert, $insert, range.depth);
      if (range.endIndex < range.parent.childCount) range = new NodeRange($from, pm.doc.resolve($to.end(range.depth)), range.depth);
      doJoin = true;
    }
    var wrap = findWrapping(outerRange, nodeType, attrs, range);
    if (!wrap) return false;
    if (apply !== false) doWrapInList(pm.tr, range, wrap, doJoin, nodeType).applyAndScroll();
    return true;
  };
};

function doWrapInList(tr, range, wrappers, joinBefore, nodeType) {
  var content = Fragment.empty;
  for (var i = wrappers.length - 1; i >= 0; i--) {
    content = Fragment.from(wrappers[i].type.create(wrappers[i].attrs, content));
  }tr.step(new ReplaceAroundStep(range.start - (joinBefore ? 2 : 0), range.end, range.start, range.end, new Slice(content, 0, 0), wrappers.length, true));

  var found = 0;
  for (var _i3 = 0; _i3 < wrappers.length; _i3++) {
    if (wrappers[_i3].type == nodeType) found = _i3 + 1;
  }var splitDepth = wrappers.length - found;

  var splitPos = range.start + wrappers.length - (joinBefore ? 2 : 0),
      parent = range.parent;
  for (var _i4 = range.startIndex, e = range.endIndex, first = true; _i4 < e; _i4++, first = false) {
    if (!first && canSplit(tr.doc, splitPos, splitDepth)) tr.split(splitPos, splitDepth);
    splitPos += parent.child(_i4).nodeSize + (first ? 0 : 2 * splitDepth);
  }
  return tr;
}

// :: (NodeType) → (pm: ProseMirror) → bool
// Build a command that splits a non-empty textblock at the top level
// of a list item by also splitting that list item.
commands.splitListItem = function (nodeType) {
  return function (pm) {
    var _pm$selection17 = pm.selection;
    var $from = _pm$selection17.$from;
    var $to = _pm$selection17.$to;
    var node = _pm$selection17.node;

    if (node && node.isBlock || !$from.parent.content.size || $from.depth < 2 || !$from.sameParent($to)) return false;
    var grandParent = $from.node(-1);
    if (grandParent.type != nodeType) return false;
    var nextType = $to.pos == $from.end() ? grandParent.defaultContentType($from.indexAfter(-1)) : null;
    var tr = pm.tr.delete($from.pos, $to.pos);
    if (!canSplit(tr.doc, $from.pos, 2, nextType)) return false;
    tr.split($from.pos, 2, nextType).applyAndScroll();
    return true;
  };
};

// :: (NodeType) → (pm: ProseMirror, apply: ?bool) → bool
// Create a command to lift the list item around the selection up into
// a wrapping list.
commands.liftListItem = function (nodeType) {
  return function (pm, apply) {
    var _pm$selection18 = pm.selection;
    var $from = _pm$selection18.$from;
    var $to = _pm$selection18.$to;

    var range = $from.blockRange($to, function (node) {
      return node.childCount && node.firstChild.type == nodeType;
    });
    if (!range || range.depth < 2 || $from.node(range.depth - 1).type != nodeType) return false;
    if (apply !== false) {
      var tr = pm.tr,
          end = range.end,
          endOfList = $to.end(range.depth);
      if (end < endOfList) {
        // There are siblings after the lifted items, which must become
        // children of the last item
        tr.step(new ReplaceAroundStep(end - 1, endOfList, end, endOfList, new Slice(Fragment.from(nodeType.create(null, range.parent.copy())), 1, 0), 1, true));
        range = new NodeRange(tr.doc.resolveNoCache($from.pos), tr.doc.resolveNoCache(endOfList), range.depth);
      }

      tr.lift(range, liftTarget(range)).applyAndScroll();
    }
    return true;
  };
};

// :: (NodeType) → (pm: ProseMirror, apply: ?bool) → bool
// Create a command to sink the list item around the selection down
// into an inner list.
commands.sinkListItem = function (nodeType) {
  return function (pm, apply) {
    var _pm$selection19 = pm.selection;
    var $from = _pm$selection19.$from;
    var $to = _pm$selection19.$to;

    var range = $from.blockRange($to, function (node) {
      return node.childCount && node.firstChild.type == nodeType;
    });
    if (!range) return false;
    var startIndex = range.startIndex;
    if (startIndex == 0) return false;
    var parent = range.parent,
        nodeBefore = parent.child(startIndex - 1);
    if (nodeBefore.type != nodeType) return false;
    if (apply !== false) {
      var nestedBefore = nodeBefore.lastChild && nodeBefore.lastChild.type == parent.type;
      var inner = Fragment.from(nestedBefore ? nodeType.create() : null);
      var slice = new Slice(Fragment.from(nodeType.create(null, Fragment.from(parent.copy(inner)))), nestedBefore ? 3 : 1, 0);
      var before = range.start,
          after = range.end;
      pm.tr.step(new ReplaceAroundStep(before - (nestedBefore ? 3 : 1), after, before, after, slice, 1, true)).applyAndScroll();
    }
    return true;
  };
};

function markApplies(doc, from, to, type) {
  var can = false;
  doc.nodesBetween(from, to, function (node) {
    if (can) return false;
    can = node.isTextblock && node.contentMatchAt(0).allowsMark(type);
  });
  return can;
}

// :: (MarkType, ?Object) → (pm: ProseMirror, apply: ?bool) → bool
// Create a command function that toggles the given mark with the
// given attributes. Will return `false` when the current selection
// doesn't support that mark. If `apply` is not `false`, it will
// remove the mark if any marks of that type exist in the selection,
// or add it otherwise. If the selection is empty, this applies to the
// [active marks](#ProseMirror.activeMarks) instead of a range of the
// document.
commands.toggleMark = function (markType, attrs) {
  return function (pm, apply) {
    var _pm$selection20 = pm.selection;
    var empty = _pm$selection20.empty;
    var from = _pm$selection20.from;
    var to = _pm$selection20.to;

    if (!markApplies(pm.doc, from, to, markType)) return false;
    if (apply === false) return true;
    if (empty) {
      if (markType.isInSet(pm.activeMarks())) pm.removeActiveMark(markType);else pm.addActiveMark(markType.create(attrs));
    } else {
      if (pm.doc.rangeHasMark(from, to, markType)) pm.tr.removeMark(from, to, markType).applyAndScroll();else pm.tr.addMark(from, to, markType.create(attrs)).applyAndScroll();
    }
    return true;
  };
};
},{"../model":37,"../transform":46,"../util/browser":58,"./char":3,"./selection":17}],5:[function(require,module,exports){
"use strict";

var _require = require("../util/dom");

var insertCSS = _require.insertCSS;


insertCSS("\n\n.ProseMirror {\n  position: relative;\n}\n\n.ProseMirror-content {\n  white-space: pre-wrap;\n}\n\n.ProseMirror-drop-target {\n  position: absolute;\n  width: 1px;\n  background: #666;\n  pointer-events: none;\n}\n\n.ProseMirror-content ul, .ProseMirror-content ol {\n  padding-left: 30px;\n  cursor: default;\n}\n\n.ProseMirror-content blockquote {\n  padding-left: 1em;\n  border-left: 3px solid #eee;\n  margin-left: 0; margin-right: 0;\n}\n\n.ProseMirror-content pre {\n  white-space: pre-wrap;\n}\n\n.ProseMirror-content li {\n  position: relative;\n  pointer-events: none; /* Don't do weird stuff with marker clicks */\n}\n.ProseMirror-content li > * {\n  pointer-events: auto;\n}\n\n.ProseMirror-nodeselection *::selection { background: transparent; }\n.ProseMirror-nodeselection *::-moz-selection { background: transparent; }\n\n.ProseMirror-selectednode {\n  outline: 2px solid #8cf;\n}\n\n/* Make sure li selections wrap around markers */\n\nli.ProseMirror-selectednode {\n  outline: none;\n}\n\nli.ProseMirror-selectednode:after {\n  content: \"\";\n  position: absolute;\n  left: -32px;\n  right: -2px; top: -2px; bottom: -2px;\n  border: 2px solid #8cf;\n  pointer-events: none;\n}\n\n");
},{"../util/dom":60}],6:[function(require,module,exports){
"use strict";

var _require = require("../model");

var Mark = _require.Mark;

var _require2 = require("../transform");

var mapThroughResult = _require2.mapThroughResult;

var _require3 = require("./selection");

var findSelectionFrom = _require3.findSelectionFrom;
var findSelectionNear = _require3.findSelectionNear;
var TextSelection = _require3.TextSelection;
var isCollapsed = _require3.isCollapsed;

var _require4 = require("./dompos");

var DOMFromPos = _require4.DOMFromPos;
var DOMFromPosFromEnd = _require4.DOMFromPosFromEnd;


function readInputChange(pm) {
  pm.ensureOperation({ readSelection: false });
  return readDOMChange(pm, rangeAroundSelection(pm));
}
exports.readInputChange = readInputChange;

function readCompositionChange(pm, margin) {
  return readDOMChange(pm, rangeAroundComposition(pm, margin));
}
exports.readCompositionChange = readCompositionChange;

// Note that all referencing and parsing is done with the
// start-of-operation selection and document, since that's the one
// that the DOM represents. If any changes came in in the meantime,
// the modification is mapped over those before it is applied, in
// readDOMChange.

function parseBetween(pm, from, to) {
  var _DOMFromPos = DOMFromPos(pm, from, true);

  var parent = _DOMFromPos.node;
  var startOff = _DOMFromPos.offset;

  var _DOMFromPosFromEnd = DOMFromPosFromEnd(pm, to);

  var parentRight = _DOMFromPosFromEnd.node;
  var endOff = _DOMFromPosFromEnd.offset;

  if (parent != parentRight) return null;
  while (startOff) {
    var prev = parent.childNodes[startOff - 1];
    if (prev.nodeType != 1 || !prev.hasAttribute("pm-offset")) --startOff;else break;
  }
  while (endOff < parent.childNodes.length) {
    var next = parent.childNodes[endOff];
    if (next.nodeType != 1 || !next.hasAttribute("pm-offset")) ++endOff;else break;
  }
  var domSel = pm.root.getSelection(),
      find = null;
  if (domSel.anchorNode && pm.content.contains(domSel.anchorNode)) {
    find = [{ node: domSel.anchorNode, offset: domSel.anchorOffset }];
    if (!isCollapsed(domSel)) find.push({ node: domSel.focusNode, offset: domSel.focusOffset });
  }
  var sel = null,
      doc = pm.schema.parseDOM(parent, {
    topNode: pm.operation.doc.resolve(from).parent.copy(),
    from: startOff,
    to: endOff,
    preserveWhitespace: true,
    editableContent: true,
    findPositions: find
  });
  if (find && find[0].pos != null) {
    var anchor = find[0].pos,
        head = find[1] && find[1].pos;
    if (head == null) head = anchor;
    sel = { anchor: anchor, head: head };
  }
  return { doc: doc, sel: sel };
}

function isAtEnd($pos, depth) {
  for (var i = depth || 0; i < $pos.depth; i++) {
    if ($pos.index(i) + 1 < $pos.node(i).childCount) return false;
  }return $pos.parentOffset == $pos.parent.content.size;
}
function isAtStart($pos, depth) {
  for (var i = depth || 0; i < $pos.depth; i++) {
    if ($pos.index(0) > 0) return false;
  }return $pos.parentOffset == 0;
}

function rangeAroundSelection(pm) {
  var _pm$operation$sel = pm.operation.sel;
  var $from = _pm$operation$sel.$from;
  var $to = _pm$operation$sel.$to;
  // When the selection is entirely inside a text block, use
  // rangeAroundComposition to get a narrow range.

  if ($from.sameParent($to) && $from.parent.isTextblock && $from.parentOffset && $to.parentOffset < $to.parent.content.size) return rangeAroundComposition(pm, 0);

  for (var depth = 0;; depth++) {
    var fromStart = isAtStart($from, depth + 1),
        toEnd = isAtEnd($to, depth + 1);
    if (fromStart || toEnd || $from.index(depth) != $to.index(depth) || $to.node(depth).isTextblock) {
      var from = $from.before(depth + 1),
          to = $to.after(depth + 1);
      if (fromStart && $from.index(depth) > 0) from -= $from.node(depth).child($from.index(depth) - 1).nodeSize;
      if (toEnd && $to.index(depth) + 1 < $to.node(depth).childCount) to += $to.node(depth).child($to.index(depth) + 1).nodeSize;
      return { from: from, to: to };
    }
  }
}

function rangeAroundComposition(pm, margin) {
  var _pm$operation$sel2 = pm.operation.sel;
  var $from = _pm$operation$sel2.$from;
  var $to = _pm$operation$sel2.$to;

  if (!$from.sameParent($to)) return rangeAroundSelection(pm);
  var startOff = Math.max(0, $from.parentOffset - margin);
  var size = $from.parent.content.size;
  var endOff = Math.min(size, $to.parentOffset + margin);

  if (startOff > 0) startOff = $from.parent.childBefore(startOff).offset;
  if (endOff < size) {
    var after = $from.parent.childAfter(endOff);
    endOff = after.offset + after.node.nodeSize;
  }
  var nodeStart = $from.start();
  return { from: nodeStart + startOff, to: nodeStart + endOff };
}

function readDOMChange(pm, range) {
  var op = pm.operation;
  // If the document was reset since the start of the current
  // operation, we can't do anything useful with the change to the
  // DOM, so we discard it.
  if (op.docSet) {
    pm.markAllDirty();
    return false;
  }

  var parseResult = void 0;
  for (;;) {
    parseResult = parseBetween(pm, range.from, range.to);
    if (parseResult) break;
    range = { from: op.doc.resolve(range.from).before(),
      to: op.doc.resolve(range.to).after() };
  }
  var _parseResult = parseResult;
  var parsed = _parseResult.doc;
  var parsedSel = _parseResult.sel;


  var compare = op.doc.slice(range.from, range.to);
  var change = findDiff(compare.content, parsed.content, range.from, op.sel.from);
  if (!change) return false;
  var fromMapped = mapThroughResult(op.mappings, change.start);
  var toMapped = mapThroughResult(op.mappings, change.endA);
  if (fromMapped.deleted && toMapped.deleted) return false;

  // Mark nodes touched by this change as 'to be redrawn'
  markDirtyFor(pm, op.doc, change.start, change.endA);

  function newSelection(doc) {
    if (!parsedSel) return false;
    var newSel = findSelectionNear(doc.resolve(range.from + parsedSel.head));
    if (parsedSel.anchor != parsedSel.head && newSel.$head) {
      var $anchor = doc.resolve(range.from + parsedSel.anchor);
      if ($anchor.parent.isTextblock) newSel = new TextSelection($anchor, newSel.$head);
    }
    return newSel;
  }

  var $from = parsed.resolveNoCache(change.start - range.from);
  var $to = parsed.resolveNoCache(change.endB - range.from);
  var nextSel = void 0,
      text = void 0;
  // If this looks like the effect of pressing Enter, just dispatch an
  // Enter key instead.
  if (!$from.sameParent($to) && $from.pos < parsed.content.size && (nextSel = findSelectionFrom(parsed.resolve($from.pos + 1), 1, true)) && nextSel.head == $to.pos) {
    pm.input.dispatchKey("Enter");
  } else if ($from.sameParent($to) && $from.parent.isTextblock && (text = uniformTextBetween(parsed, $from.pos, $to.pos)) != null) {
    pm.input.insertText(fromMapped.pos, toMapped.pos, text, newSelection);
  } else {
    var slice = parsed.slice(change.start - range.from, change.endB - range.from);
    var tr = pm.tr.replace(fromMapped.pos, toMapped.pos, slice);
    var sel = newSelection(tr.doc);
    if (sel) tr.setSelection(sel);
    tr.applyAndScroll();
  }
  return true;
}

function uniformTextBetween(node, from, to) {
  var result = "",
      valid = true,
      marks = null;
  node.nodesBetween(from, to, function (node, pos) {
    if (!node.isInline && pos < from) return;
    if (!node.isText) return valid = false;
    if (!marks) marks = node.marks;else if (!Mark.sameSet(marks, node.marks)) valid = false;
    result += node.text.slice(Math.max(0, from - pos), to - pos);
  });
  return valid ? result : null;
}

function findDiff(a, b, pos, preferedStart) {
  var start = a.findDiffStart(b, pos);
  if (!start) return null;

  var _a$findDiffEnd = a.findDiffEnd(b, pos + a.size, pos + b.size);

  var endA = _a$findDiffEnd.a;
  var endB = _a$findDiffEnd.b;

  if (endA < start) {
    var move = preferedStart <= start && preferedStart >= endA ? start - preferedStart : 0;
    start -= move;
    endB = start + (endB - endA);
    endA = start;
  } else if (endB < start) {
    var _move = preferedStart <= start && preferedStart >= endB ? start - preferedStart : 0;
    start -= _move;
    endA = start + (endA - endB);
    endB = start;
  }
  return { start: start, endA: endA, endB: endB };
}

function markDirtyFor(pm, doc, start, end) {
  var $start = doc.resolve(start),
      $end = doc.resolve(end),
      same = $start.sameDepth($end);
  if (same == 0) pm.markAllDirty();else pm.markRangeDirty($start.before(same), $start.after(same), doc);
}
},{"../model":37,"../transform":46,"./dompos":7,"./selection":17}],7:[function(require,module,exports){
"use strict";

var _require = require("../util/dom");

var contains = _require.contains;


function isEditorContent(dom) {
  return dom.classList.contains("ProseMirror-content");
}

// : (DOMNode) → number
// Get the position before a given a DOM node in a document.
function posBeforeFromDOM(node) {
  var pos = 0,
      add = 0;
  for (var cur = node; !isEditorContent(cur); cur = cur.parentNode) {
    var attr = cur.getAttribute("pm-offset");
    if (attr) {
      pos += +attr + add;add = 1;
    }
  }
  return pos;
}

var posFromDOMResult = { pos: 0, inLeaf: -1 };

// : (DOMNode, number) → number
function posFromDOM(dom, domOffset) {
  var bias = arguments.length <= 2 || arguments[2] === undefined ? 0 : arguments[2];

  if (domOffset == null) {
    domOffset = Array.prototype.indexOf.call(dom.parentNode.childNodes, dom);
    dom = dom.parentNode;
  }

  // Move up to the wrapping container, counting local offset along
  // the way.
  var innerOffset = 0,
      tag = void 0;
  for (;;) {
    var adjust = 0;
    if (dom.nodeType == 3) {
      innerOffset += domOffset;
    } else if (tag = dom.getAttribute("pm-offset") && !childContainer(dom)) {
      var size = +dom.getAttribute("pm-size");
      if (dom.nodeType == 1 && !dom.firstChild) innerOffset = bias > 0 ? size : 0;else if (domOffset == dom.childNodes.length) innerOffset = size;else innerOffset = Math.min(innerOffset, size);
      var inLeaf = posFromDOMResult.inLeaf = posBeforeFromDOM(dom);
      posFromDOMResult.pos = inLeaf + innerOffset;
      return posFromDOMResult;
    } else if (dom.hasAttribute("pm-container")) {
      break;
    } else if (domOffset == dom.childNodes.length) {
      if (domOffset) adjust = 1;else adjust = bias > 0 ? 1 : 0;
    }

    var parent = dom.parentNode;
    domOffset = adjust < 0 ? 0 : Array.prototype.indexOf.call(parent.childNodes, dom) + adjust;
    dom = parent;
    bias = 0;
  }

  var start = isEditorContent(dom) ? 0 : posBeforeFromDOM(dom) + 1,
      before = 0;

  for (var child = dom.childNodes[domOffset - 1]; child; child = child.previousSibling) {
    if (child.nodeType == 1 && (tag = child.getAttribute("pm-offset"))) {
      before += +tag + +child.getAttribute("pm-size");
      break;
    }
  }
  posFromDOMResult.inLeaf = -1;
  posFromDOMResult.pos = start + before + innerOffset;
  return posFromDOMResult;
}
exports.posFromDOM = posFromDOM;

// : (DOMNode) → ?DOMNode
function childContainer(dom) {
  return dom.hasAttribute("pm-container") ? dom : dom.querySelector("[pm-container]");
}
exports.childContainer = childContainer;

// : (ProseMirror, number) → {node: DOMNode, offset: number}
// Find the DOM node and offset into that node that the given document
// position refers to.
function DOMFromPos(pm, pos, loose) {
  if (!loose && pm.operation && pm.doc != pm.operation.doc) throw new RangeError("Resolving a position in an outdated DOM structure");

  var container = pm.content,
      offset = pos;
  for (;;) {
    for (var child = container.firstChild, i = 0;; child = child.nextSibling, i++) {
      if (!child) {
        if (offset && !loose) throw new RangeError("Failed to find node at " + pos);
        return { node: container, offset: i };
      }

      var size = child.nodeType == 1 && child.getAttribute("pm-size");
      if (size) {
        if (!offset) return { node: container, offset: i };
        size = +size;
        if (offset < size) {
          container = childContainer(child);
          if (!container) {
            return leafAt(child, offset);
          } else {
            offset--;
            break;
          }
        } else {
          offset -= size;
        }
      }
    }
  }
}
exports.DOMFromPos = DOMFromPos;

// : (ProseMirror, number) → {node: DOMNode, offset: number}
// The same as DOMFromPos, but searching from the bottom instead of
// the top. This is needed in domchange.js, when there is an arbitrary
// DOM change somewhere in our document, and we can no longer rely on
// the DOM structure around the selection.
function DOMFromPosFromEnd(pm, pos) {
  var container = pm.content,
      dist = (pm.operation ? pm.operation.doc : pm.doc).content.size - pos;
  for (;;) {
    for (var child = container.lastChild, i = container.childNodes.length;; child = child.previousSibling, i--) {
      if (!child) return { node: container, offset: i };

      var size = child.nodeType == 1 && child.getAttribute("pm-size");
      if (size) {
        if (!dist) return { node: container, offset: i };
        size = +size;
        if (dist < size) {
          container = childContainer(child);
          if (!container) {
            return leafAt(child, size - dist);
          } else {
            dist--;
            break;
          }
        } else {
          dist -= size;
        }
      }
    }
  }
}
exports.DOMFromPosFromEnd = DOMFromPosFromEnd;

// : (ProseMirror, number) → DOMNode
function DOMAfterPos(pm, pos) {
  var _DOMFromPos = DOMFromPos(pm, pos);

  var node = _DOMFromPos.node;
  var offset = _DOMFromPos.offset;

  if (node.nodeType != 1 || offset == node.childNodes.length) throw new RangeError("No node after pos " + pos);
  return node.childNodes[offset];
}
exports.DOMAfterPos = DOMAfterPos;

// : (DOMNode, number) → {node: DOMNode, offset: number}
function leafAt(node, offset) {
  for (;;) {
    var child = node.firstChild;
    if (!child) return { node: node, offset: offset };
    if (child.nodeType != 1) return { node: child, offset: offset };
    node = child;
  }
}

function windowRect() {
  return { left: 0, right: window.innerWidth,
    top: 0, bottom: window.innerHeight };
}

function parentNode(node) {
  var parent = node.parentNode;
  return parent.nodeType == 11 ? parent.host : parent;
}

function scrollIntoView(pm, pos) {
  if (!pos) pos = pm.sel.range.head || pm.sel.range.from;
  var coords = coordsAtPos(pm, pos);
  for (var parent = pm.content;; parent = parentNode(parent)) {
    var _pm$options = pm.options;
    var scrollThreshold = _pm$options.scrollThreshold;
    var scrollMargin = _pm$options.scrollMargin;

    var atBody = parent == document.body;
    var rect = atBody ? windowRect() : parent.getBoundingClientRect();
    var moveX = 0,
        moveY = 0;
    if (coords.top < rect.top + scrollThreshold) moveY = -(rect.top - coords.top + scrollMargin);else if (coords.bottom > rect.bottom - scrollThreshold) moveY = coords.bottom - rect.bottom + scrollMargin;
    if (coords.left < rect.left + scrollThreshold) moveX = -(rect.left - coords.left + scrollMargin);else if (coords.right > rect.right - scrollThreshold) moveX = coords.right - rect.right + scrollMargin;
    if (moveX || moveY) {
      if (atBody) {
        window.scrollBy(moveX, moveY);
      } else {
        if (moveY) parent.scrollTop += moveY;
        if (moveX) parent.scrollLeft += moveX;
      }
    }
    if (atBody) break;
  }
}
exports.scrollIntoView = scrollIntoView;

function findOffsetInNode(node, coords) {
  var closest = void 0,
      dxClosest = 2e8,
      coordsClosest = void 0,
      offset = 0;
  for (var child = node.firstChild, childIndex = 0; child; child = child.nextSibling, childIndex++) {
    var rects = void 0;
    if (child.nodeType == 1) rects = child.getClientRects();else if (child.nodeType == 3) rects = textRange(child).getClientRects();else continue;

    for (var i = 0; i < rects.length; i++) {
      var rect = rects[i];
      if (rect.top <= coords.top && rect.bottom >= coords.top) {
        var dx = rect.left > coords.left ? rect.left - coords.left : rect.right < coords.left ? coords.left - rect.right : 0;
        if (dx < dxClosest) {
          closest = child;
          dxClosest = dx;
          coordsClosest = dx && closest.nodeType == 3 ? { left: rect.right < coords.left ? rect.right : rect.left, top: coords.top } : coords;
          if (child.nodeType == 1 && dx) offset = childIndex + (coords.left >= (rect.left + rect.right) / 2 ? 1 : 0);
          continue;
        }
      }
      if (!closest && (coords.left >= rect.right || coords.left >= rect.left && coords.top >= rect.bottom)) offset = i + 1;
    }
  }
  if (closest && closest.nodeType == 3) return findOffsetInText(closest, coordsClosest);
  if (!closest || dxClosest && closest.nodeType == 1) return { node: node, offset: offset };
  return findOffsetInNode(closest, coordsClosest);
}

function findOffsetInText(node, coords) {
  var len = node.nodeValue.length;
  var range = document.createRange();
  for (var i = 0; i < len; i++) {
    range.setEnd(node, i + 1);
    range.setStart(node, i);
    var rect = singleRect(range, 1);
    if (rect.top == rect.bottom) continue;
    if (rect.left - 1 <= coords.left && rect.right + 1 >= coords.left && rect.top - 1 <= coords.top && rect.bottom + 1 >= coords.top) return { node: node, offset: i + (coords.left >= (rect.left + rect.right) / 2 ? 1 : 0) };
  }
  return { node: node, offset: 0 };
}

function targetKludge(dom, coords) {
  if (/^[uo]l$/i.test(dom.nodeName)) {
    for (var child = dom.firstChild; child; child = child.nextSibling) {
      if (child.nodeType != 1 || !child.hasAttribute("pm-offset") || !/^li$/i.test(child.nodeName)) continue;
      var childBox = child.getBoundingClientRect();
      if (coords.left > childBox.left - 2) break;
      if (childBox.top <= coords.top && childBox.bottom >= coords.top) return child;
    }
  }
  return dom;
}

// Given an x,y position on the editor, get the position in the document.
function posAtCoords(pm, coords) {
  var elt = targetKludge(pm.root.elementFromPoint(coords.left, coords.top + 1), coords);
  if (!contains(pm.content, elt)) return null;

  var _findOffsetInNode = findOffsetInNode(elt, coords);

  var node = _findOffsetInNode.node;
  var offset = _findOffsetInNode.offset;var bias = -1;
  if (node.nodeType == 1 && !node.firstChild) {
    var rect = node.getBoundingClientRect();
    bias = rect.left != rect.right && coords.left > (rect.left + rect.right) / 2 ? 1 : -1;
  }
  return posFromDOM(node, offset, bias);
}
exports.posAtCoords = posAtCoords;

function textRange(node, from, to) {
  var range = document.createRange();
  range.setEnd(node, to == null ? node.nodeValue.length : to);
  range.setStart(node, from || 0);
  return range;
}

function singleRect(object, bias) {
  var rects = object.getClientRects();
  return !rects.length ? object.getBoundingClientRect() : rects[bias < 0 ? 0 : rects.length - 1];
}

// : (ProseMirror, number) → ClientRect
// Given a position in the document model, get a bounding box of the
// character at that position, relative to the window.
function coordsAtPos(pm, pos) {
  var _DOMFromPos2 = DOMFromPos(pm, pos);

  var node = _DOMFromPos2.node;
  var offset = _DOMFromPos2.offset;

  var side = void 0,
      rect = void 0;
  if (node.nodeType == 3) {
    if (offset < node.nodeValue.length) {
      rect = singleRect(textRange(node, offset, offset + 1), -1);
      side = "left";
    }
    if ((!rect || rect.left == rect.right) && offset) {
      rect = singleRect(textRange(node, offset - 1, offset), 1);
      side = "right";
    }
  } else if (node.firstChild) {
    if (offset < node.childNodes.length) {
      var child = node.childNodes[offset];
      rect = singleRect(child.nodeType == 3 ? textRange(child) : child, -1);
      side = "left";
    }
    if ((!rect || rect.top == rect.bottom) && offset) {
      var _child = node.childNodes[offset - 1];
      rect = singleRect(_child.nodeType == 3 ? textRange(_child) : _child, 1);
      side = "right";
    }
  } else {
    rect = node.getBoundingClientRect();
    side = "left";
  }
  var x = rect[side];
  return { top: rect.top, bottom: rect.bottom, left: x, right: x };
}
exports.coordsAtPos = coordsAtPos;
},{"../util/dom":60}],8:[function(require,module,exports){
"use strict";

var _require = require("../util/dom");

var elt = _require.elt;

var browser = require("../util/browser");

var _require2 = require("./dompos");

var childContainer = _require2.childContainer;


var DIRTY_RESCAN = 1,
    DIRTY_REDRAW = 2;
exports.DIRTY_RESCAN = DIRTY_RESCAN;exports.DIRTY_REDRAW = DIRTY_REDRAW;

function options(ranges) {
  return {
    pos: 0,

    onRender: function onRender(node, dom, _pos, offset) {
      if (node.isBlock) {
        if (offset != null) dom.setAttribute("pm-offset", offset);
        dom.setAttribute("pm-size", node.nodeSize);
        if (node.isTextblock) adjustTrailingHacks(dom, node);
        if (dom.contentEditable == "false") dom = elt("div", null, dom);
      }

      return dom;
    },
    onContainer: function onContainer(dom) {
      dom.setAttribute("pm-container", true);
    },

    // : (Node, DOMNode, number, number) → DOMNode
    renderInlineFlat: function renderInlineFlat(node, dom, pos, offset) {
      if (dom.nodeType != 1) dom = elt("span", null, dom);

      var end = pos + node.nodeSize,
          fragment = void 0;
      for (;;) {
        ranges.advanceTo(pos);
        var nextCut = ranges.nextChangeBefore(end),
            nextDOM = void 0,
            size = void 0;
        if (nextCut > -1) {
          size = nextCut - pos;
          nextDOM = splitTextNode(dom, size);
        } else {
          size = end - pos;
        }

        dom.setAttribute("pm-offset", offset);
        dom.setAttribute("pm-size", size);
        if (ranges.current.length) dom.className = ranges.current.join(" ");

        if (!fragment && (nextCut > -1 || ranges.element)) fragment = document.createDocumentFragment();
        if (ranges.element) fragment.appendChild(elt("span", { contenteditable: false, "pm-ignore": true }, ranges.element));
        if (fragment) fragment.appendChild(dom);

        if (nextCut == -1) break;
        offset += size;
        pos += size;
        dom = nextDOM;
      }

      return fragment || dom;
    },

    document: document
  };
}

function splitTextNode(dom, at) {
  if (dom.nodeType == 3) {
    var text = document.createTextNode(dom.nodeValue.slice(at));
    dom.nodeValue = dom.nodeValue.slice(0, at);
    return text;
  } else {
    var clone = dom.cloneNode(false);
    clone.appendChild(splitTextNode(dom.firstChild, at));
    return clone;
  }
}

function draw(pm, doc) {
  pm.content.textContent = "";
  pm.content.appendChild(doc.content.toDOM(options(pm.ranges.activeRangeTracker())));
}
exports.draw = draw;

function adjustTrailingHacks(dom, node) {
  var needs = node.content.size == 0 || node.lastChild.type.isBR || node.type.isCode && node.lastChild.isText && /\n$/.test(node.lastChild.text) ? "br" : !node.lastChild.isText && node.lastChild.type.isLeaf ? "text" : null;
  var last = dom.lastChild;
  var has = !last || last.nodeType != 1 || !last.hasAttribute("pm-ignore") ? null : last.nodeName == "BR" ? "br" : "text";
  if (needs != has) {
    if (has) dom.removeChild(last);
    if (needs) dom.appendChild(needs == "br" ? elt("br", { "pm-ignore": "trailing-break" }) : elt("span", { "pm-ignore": "cursor-text" }, ""));
  }
}

function findNodeIn(parent, i, node) {
  for (; i < parent.childCount; i++) {
    var child = parent.child(i);
    if (child == node) return i;
  }
  return -1;
}

function movePast(dom) {
  var next = dom.nextSibling;
  dom.parentNode.removeChild(dom);
  return next;
}

function redraw(pm, dirty, doc, prev) {
  if (dirty.get(prev) == DIRTY_REDRAW) return draw(pm, doc);

  var opts = options(pm.ranges.activeRangeTracker());

  function scan(dom, node, prev, pos) {
    var iPrev = 0,
        oPrev = 0,
        pChild = prev.firstChild;
    var domPos = dom.firstChild;

    function syncDOM() {
      while (domPos) {
        var curOff = domPos.nodeType == 1 && domPos.getAttribute("pm-offset");
        if (!curOff || +curOff < oPrev) domPos = movePast(domPos);else return +curOff == oPrev;
      }
      return false;
    }

    for (var iNode = 0, offset = 0; iNode < node.childCount; iNode++) {
      var child = node.child(iNode),
          matching = void 0,
          reuseDOM = void 0;
      var found = pChild == child ? iPrev : findNodeIn(prev, iPrev + 1, child);
      if (found > -1) {
        matching = child;
        while (iPrev != found) {
          oPrev += pChild.nodeSize;
          pChild = prev.maybeChild(++iPrev);
        }
      }

      if (matching && !dirty.get(matching) && syncDOM()) {
        reuseDOM = true;
      } else if (pChild && !child.isText && child.sameMarkup(pChild) && dirty.get(pChild) != DIRTY_REDRAW && syncDOM()) {
        reuseDOM = true;
        if (!pChild.type.isLeaf) scan(childContainer(domPos), child, pChild, pos + offset + 1);
        domPos.setAttribute("pm-size", child.nodeSize);
      } else {
        opts.pos = pos + offset;
        opts.offset = offset;
        var rendered = child.toDOM(opts);
        dom.insertBefore(rendered, domPos);
        reuseDOM = false;
      }

      if (reuseDOM) {
        // Text nodes might be split into smaller segments
        if (child.isText) {
          for (var off = offset, end = off + child.nodeSize; off < end;) {
            if (offset != oPrev) domPos.setAttribute("pm-offset", off);
            off += +domPos.getAttribute("pm-size");
            domPos = domPos.nextSibling;
          }
        } else {
          if (offset != oPrev) domPos.setAttribute("pm-offset", offset);
          domPos = domPos.nextSibling;
        }
        oPrev += pChild.nodeSize;
        pChild = prev.maybeChild(++iPrev);
      }
      offset += child.nodeSize;
    }

    while (domPos) {
      domPos = movePast(domPos);
    }if (node.isTextblock) adjustTrailingHacks(dom, node);

    if (browser.ios) iosHacks(dom);
  }
  scan(pm.content, doc, prev, 0);
}
exports.redraw = redraw;

function iosHacks(dom) {
  if (dom.nodeName == "UL" || dom.nodeName == "OL") {
    var oldCSS = dom.style.cssText;
    dom.style.cssText = oldCSS + "; list-style: square !important";
    window.getComputedStyle(dom).listStyle;
    dom.style.cssText = oldCSS;
  }
}
},{"../util/browser":58,"../util/dom":60,"./dompos":7}],9:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require("../transform");

var Transform = _require.Transform;
var Remapping = _require.Remapping;

// ProseMirror's history implements not a way to roll back to a
// previous state, because ProseMirror supports applying changes
// without adding them to the history (for example during
// collaboration).
//
// To this end, each 'Branch' (one for the undo history and one for
// the redo history) keeps an array of 'Items', which can optionally
// hold a step (an actual undoable change), and always hold a position
// map (which is needed to move changes below them to apply to the
// current document).
//
// An item that has both a step and a selection token field is the
// start of an 'event' -- a group of changes that will be undone or
// redone at once. (It stores only a token, since that way we don't
// have to provide a document until the selection is actually applied,
// which is useful when compressing.)

// Used to schedule history compression

var max_empty_items = 500;

var Branch = function () {
  function Branch(maxEvents) {
    _classCallCheck(this, Branch);

    this.events = 0;
    this.maxEvents = maxEvents;
    // Item 0 is always a dummy that's only used to have an id to
    // refer to at the start of the history.
    this.items = [new Item()];
  }

  // : (Node, bool, ?Item) → ?{transform: Transform, selection: SelectionToken, ids: [number]}
  // Pop the latest event off the branch's history and apply it
  // to a document transform, returning the transform and the step IDs.


  _createClass(Branch, [{
    key: "popEvent",
    value: function popEvent(doc, preserveItems, upto) {
      var preserve = preserveItems,
          transform = new Transform(doc);
      var remap = new BranchRemapping();
      var selection = void 0,
          ids = [],
          i = this.items.length;

      for (;;) {
        var cur = this.items[--i];
        if (upto && cur == upto) break;
        if (!cur.map) return null;

        if (!cur.step) {
          remap.add(cur);
          preserve = true;
          continue;
        }

        if (preserve) {
          var step = cur.step.map(remap.remap),
              map = void 0;

          this.items[i] = new MapItem(cur.map);
          if (step && transform.maybeStep(step).doc) {
            map = transform.maps[transform.maps.length - 1];
            this.items.push(new MapItem(map, this.items[i].id));
          }
          remap.movePastStep(cur, map);
        } else {
          this.items.pop();
          transform.maybeStep(cur.step);
        }

        ids.push(cur.id);
        if (cur.selection) {
          this.events--;
          if (!upto) {
            selection = cur.selection.type.mapToken(cur.selection, remap.remap);
            break;
          }
        }
      }

      return { transform: transform, selection: selection, ids: ids };
    }
  }, {
    key: "clear",
    value: function clear() {
      this.items.length = 1;
      this.events = 0;
    }

    // : (Transform, Selection, ?[number])
    // Create a new branch with the given transform added.

  }, {
    key: "addTransform",
    value: function addTransform(transform, selection, ids) {
      for (var i = 0; i < transform.steps.length; i++) {
        var step = transform.steps[i].invert(transform.docs[i]);
        this.items.push(new StepItem(transform.maps[i], ids && ids[i], step, selection));
        if (selection) {
          this.events++;
          selection = null;
        }
      }
      if (this.events > this.maxEvents) this.clip();
    }

    // Clip this branch to the max number of events.

  }, {
    key: "clip",
    value: function clip() {
      var seen = 0,
          toClip = this.events - this.maxEvents;
      for (var i = 0;; i++) {
        var cur = this.items[i];
        if (cur.selection) {
          if (seen < toClip) {
            ++seen;
          } else {
            this.items.splice(0, i, new Item(null, this.events[toClip - 1]));
            this.events = this.maxEvents;
            return;
          }
        }
      }
    }
  }, {
    key: "addMaps",
    value: function addMaps(array) {
      if (this.events == 0) return;
      for (var i = 0; i < array.length; i++) {
        this.items.push(new MapItem(array[i]));
      }
    }
  }, {
    key: "findChangeID",
    value: function findChangeID(id) {
      if (id == this.items[0].id) return this.items[0];

      for (var i = this.items.length - 1; i >= 0; i--) {
        var cur = this.items[i];
        if (cur.step) {
          if (cur.id == id) return cur;
          if (cur.id < id) return null;
        }
      }
    }

    // : ([PosMap], Transform, [number])
    // When the collab module receives remote changes, the history has
    // to know about those, so that it can adjust the steps that were
    // rebased on top of the remote changes, and include the position
    // maps for the remote changes in its array of items.

  }, {
    key: "rebased",
    value: function rebased(newMaps, rebasedTransform, positions) {
      if (this.events == 0) return;

      var rebasedItems = [],
          start = this.items.length - positions.length,
          startPos = 0;
      if (start < 1) {
        startPos = 1 - start;
        start = 1;
        this.items[0] = new Item();
      }

      if (positions.length) {
        var remap = new Remapping([], newMaps.slice());
        for (var iItem = start, iPosition = startPos; iItem < this.items.length; iItem++) {
          var item = this.items[iItem],
              pos = positions[iPosition++],
              id = void 0;
          if (pos != -1) {
            var map = rebasedTransform.maps[pos];
            if (item.step) {
              var step = rebasedTransform.steps[pos].invert(rebasedTransform.docs[pos]);
              var selection = item.selection && item.selection.type.mapToken(item.selection, remap);
              rebasedItems.push(new StepItem(map, item.id, step, selection));
            } else {
              rebasedItems.push(new MapItem(map));
            }
            id = remap.addToBack(map);
          }
          remap.addToFront(item.map.invert(), id);
        }

        this.items.length = start;
      }

      for (var i = 0; i < newMaps.length; i++) {
        this.items.push(new MapItem(newMaps[i]));
      }for (var _i = 0; _i < rebasedItems.length; _i++) {
        this.items.push(rebasedItems[_i]);
      }if (!this.compressing && this.emptyItems(start) + newMaps.length > max_empty_items) this.compress(start + newMaps.length);
    }
  }, {
    key: "emptyItems",
    value: function emptyItems(upto) {
      var count = 0;
      for (var i = 1; i < upto; i++) {
        if (!this.items[i].step) count++;
      }return count;
    }

    // Compressing a branch means rewriting it to push the air (map-only
    // items) out. During collaboration, these naturally accumulate
    // because each remote change adds one. The `upto` argument is used
    // to ensure that only the items below a given level are compressed,
    // because `rebased` relies on a clean, untouched set of items in
    // order to associate old ids to rebased steps.

  }, {
    key: "compress",
    value: function compress(upto) {
      var remap = new BranchRemapping();
      var items = [],
          events = 0;
      for (var i = this.items.length - 1; i >= 0; i--) {
        var item = this.items[i];
        if (i >= upto) {
          items.push(item);
        } else if (item.step) {
          var step = item.step.map(remap.remap),
              map = step && step.posMap();
          remap.movePastStep(item, map);
          if (step) {
            var selection = item.selection && item.selection.type.mapToken(item.selection, remap.remap);
            items.push(new StepItem(map.invert(), item.id, step, selection));
            if (selection) events++;
          }
        } else if (item.map) {
          remap.add(item);
        } else {
          items.push(item);
        }
      }
      this.items = items.reverse();
      this.events = events;
    }
  }, {
    key: "toString",
    value: function toString() {
      return this.items.join("\n");
    }
  }, {
    key: "changeID",
    get: function get() {
      for (var i = this.items.length - 1; i > 0; i--) {
        if (this.items[i].step) return this.items[i].id;
      }return this.items[0].id;
    }
  }]);

  return Branch;
}();

// History items all have ids, but the meaning of these is somewhat
// complicated.
//
// - For StepItems, the ids are kept ordered (inside a given branch),
//   and are kept associated with a given change (if you undo and then
//   redo it, the resulting item gets the old id)
//
// - For MapItems, the ids are just opaque identifiers, not
//   necessarily ordered.
//
// - The placeholder item at the base of a branch's list


var nextID = 1;

var Item = function () {
  function Item(map, id) {
    _classCallCheck(this, Item);

    this.map = map;
    this.id = id || nextID++;
  }

  _createClass(Item, [{
    key: "toString",
    value: function toString() {
      return this.id + ":" + (this.map || "") + (this.step ? ":" + this.step : "") + (this.mirror != null ? "->" + this.mirror : "");
    }
  }]);

  return Item;
}();

var StepItem = function (_Item) {
  _inherits(StepItem, _Item);

  function StepItem(map, id, step, selection) {
    _classCallCheck(this, StepItem);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(StepItem).call(this, map, id));

    _this.step = step;
    _this.selection = selection;
    return _this;
  }

  return StepItem;
}(Item);

var MapItem = function (_Item2) {
  _inherits(MapItem, _Item2);

  function MapItem(map, mirror) {
    _classCallCheck(this, MapItem);

    var _this2 = _possibleConstructorReturn(this, Object.getPrototypeOf(MapItem).call(this, map));

    _this2.mirror = mirror;
    return _this2;
  }

  return MapItem;
}(Item);

// Assists with remapping a step with other changes that have been
// made since the step was first applied.


var BranchRemapping = function () {
  function BranchRemapping() {
    _classCallCheck(this, BranchRemapping);

    this.remap = new Remapping();
    this.mirrorBuffer = Object.create(null);
  }

  _createClass(BranchRemapping, [{
    key: "add",
    value: function add(item) {
      var id = this.remap.addToFront(item.map, this.mirrorBuffer[item.id]);
      if (item.mirror != null) this.mirrorBuffer[item.mirror] = id;
      return id;
    }
  }, {
    key: "movePastStep",
    value: function movePastStep(item, map) {
      var id = this.add(item);
      if (map) this.remap.addToBack(map, id);
    }
  }]);

  return BranchRemapping;
}();

// ;; An undo/redo history manager for an editor instance.


var History = function () {
  function History(pm) {
    _classCallCheck(this, History);

    this.pm = pm;

    this.done = new Branch(pm.options.historyDepth);
    this.undone = new Branch(pm.options.historyDepth);

    this.lastAddedAt = 0;
    this.ignoreTransform = false;
    this.preserveItems = 0;

    pm.on.transform.add(this.recordTransform.bind(this));
  }

  // : (Transform, Selection, Object)
  // Record a transformation in undo history.


  _createClass(History, [{
    key: "recordTransform",
    value: function recordTransform(transform, selection, options) {
      if (this.ignoreTransform) return;

      if (options.addToHistory == false) {
        this.done.addMaps(transform.maps);
        this.undone.addMaps(transform.maps);
      } else {
        var now = Date.now();
        // Group transforms that occur in quick succession into one event.
        var newGroup = now > this.lastAddedAt + this.pm.options.historyEventDelay;
        this.done.addTransform(transform, newGroup ? selection.token : null);
        this.undone.clear();
        this.lastAddedAt = now;
      }
    }

    // :: () → bool
    // Undo one history event. The return value indicates whether
    // anything was actually undone. Note that in a collaborative
    // context, or when changes are [applied](#ProseMirror.apply)
    // without adding them to the history, it is possible for
    // [`undoDepth`](#History.undoDepth) to have a positive value, but
    // this method to still return `false`, when non-history changes
    // overwrote all remaining changes in the history.

  }, {
    key: "undo",
    value: function undo() {
      return this.shift(this.done, this.undone);
    }

    // :: () → bool
    // Redo one history event. The return value indicates whether
    // anything was actually redone.

  }, {
    key: "redo",
    value: function redo() {
      return this.shift(this.undone, this.done);
    }

    // :: number
    // The amount of undoable events available.

  }, {
    key: "shift",


    // : (Branch, Branch) → bool
    // Apply the latest event from one branch to the document and optionally
    // shift the event onto the other branch. Returns true when an event could
    // be shifted.
    value: function shift(from, to) {
      var pop = from.popEvent(this.pm.doc, this.preserveItems > 0);
      if (!pop) return false;
      var selectionBeforeTransform = this.pm.selection;

      if (!pop.transform.steps.length) return this.shift(from, to);

      var selection = pop.selection.type.fromToken(pop.selection, pop.transform.doc);
      this.applyIgnoring(pop.transform, selection);

      // Store the selection before transform on the event so that
      // it can be reapplied if the event is undone or redone (e.g.
      // redoing a character addition should place the cursor after
      // the character).
      to.addTransform(pop.transform, selectionBeforeTransform.token, pop.ids);

      this.lastAddedAt = 0;

      return true;
    }
  }, {
    key: "applyIgnoring",
    value: function applyIgnoring(transform, selection) {
      this.ignoreTransform = true;
      this.pm.apply(transform, { selection: selection, filter: false });
      this.ignoreTransform = false;
    }

    // :: () → Object
    // Get the current ‘version’ of the editor content. This can be used
    // to later [check](#History.isAtVersion) whether anything changed, or
    // to [roll back](#History.backToVersion) to this version.

  }, {
    key: "getVersion",
    value: function getVersion() {
      return this.done.changeID;
    }

    // :: (Object) → bool
    // Returns `true` when the editor history is in the state that it
    // was when the given [version](#History.getVersion) was recorded.
    // That means either no changes were made, or changes were
    // done/undone and then undone/redone again.

  }, {
    key: "isAtVersion",
    value: function isAtVersion(version) {
      return this.done.changeID == version;
    }

    // :: (Object) → bool
    // Rolls back all changes made since the given
    // [version](#History.getVersion) was recorded. Returns `false` if
    // that version was no longer found in the history, and thus the
    // action could not be completed.

  }, {
    key: "backToVersion",
    value: function backToVersion(version) {
      var found = this.done.findChangeID(version);
      if (!found) return false;

      var _done$popEvent = this.done.popEvent(this.pm.doc, this.preserveItems > 0, found);

      var transform = _done$popEvent.transform;

      this.applyIgnoring(transform);
      this.undone.clear();
      return true;
    }

    // Used by the collab module to tell the history that some of its
    // content has been rebased.

  }, {
    key: "rebased",
    value: function rebased(newMaps, rebasedTransform, positions) {
      this.done.rebased(newMaps, rebasedTransform, positions);
      this.undone.rebased(newMaps, rebasedTransform, positions);
    }
  }, {
    key: "undoDepth",
    get: function get() {
      return this.done.events;
    }

    // :: number
    // The amount of redoable events available.

  }, {
    key: "redoDepth",
    get: function get() {
      return this.undone.events;
    }
  }]);

  return History;
}();

exports.History = History;
},{"../transform":46}],10:[function(require,module,exports){
"use strict";

// !! This module implements the ProseMirror editor. It contains
// functionality related to editing, selection, and integration with
// the browser. `ProseMirror` is the class you'll want to instantiate
// and interact with when using the editor.

exports.ProseMirror = require("./main").ProseMirror;
var _require = require("./selection");

exports.Selection = _require.Selection;
exports.TextSelection = _require.TextSelection;
exports.NodeSelection = _require.NodeSelection;

var _require2 = require("./range");

exports.MarkedRange = _require2.MarkedRange;

exports.baseKeymap = require("./keymap").baseKeymap;
var _require3 = require("./plugin");

exports.Plugin = _require3.Plugin;

exports.commands = require("./commands").commands;

exports.Keymap = require("browserkeymap");
},{"./commands":4,"./keymap":12,"./main":13,"./plugin":15,"./range":16,"./selection":17,"browserkeymap":1}],11:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Keymap = require("browserkeymap");
var browser = require("../util/browser");

var _require = require("../model");

var Slice = _require.Slice;
var Fragment = _require.Fragment;
var parseDOMInContext = _require.parseDOMInContext;

var _require2 = require("./capturekeys");

var captureKeys = _require2.captureKeys;

var _require3 = require("../util/dom");

var elt = _require3.elt;
var contains = _require3.contains;

var _require4 = require("./domchange");

var readInputChange = _require4.readInputChange;
var readCompositionChange = _require4.readCompositionChange;

var _require5 = require("./selection");

var findSelectionNear = _require5.findSelectionNear;
var hasFocus = _require5.hasFocus;


var stopSeq = null;

// A collection of DOM events that occur within the editor, and callback functions
// to invoke when the event fires.
var handlers = {};

var Input = function () {
  function Input(pm) {
    var _this = this;

    _classCallCheck(this, Input);

    this.pm = pm;

    this.keySeq = null;

    this.mouseDown = null;
    this.dragging = null;
    this.dropTarget = null;
    this.shiftKey = false;
    this.finishComposing = null;

    this.keymaps = [];

    this.storedMarks = null;

    var _loop = function _loop(event) {
      var handler = handlers[event];
      pm.content.addEventListener(event, function (e) {
        return handler(pm, e);
      });
    };

    for (var event in handlers) {
      _loop(event);
    }

    pm.on.selectionChange.add(function () {
      return _this.storedMarks = null;
    });
  }

  // Dispatch a key press to the internal keymaps, which will override the default
  // DOM behavior.


  _createClass(Input, [{
    key: "dispatchKey",
    value: function dispatchKey(name, e) {
      var pm = this.pm,
          seq = pm.input.keySeq;
      // If the previous key should be used in sequence with this one, modify the name accordingly.
      if (seq) {
        if (Keymap.isModifierKey(name)) return true;
        clearTimeout(stopSeq);
        stopSeq = setTimeout(function () {
          if (pm.input.keySeq == seq) pm.input.keySeq = null;
        }, 50);
        name = seq + " " + name;
      }

      var handle = function handle(bound) {
        if (bound === false) return "nothing";
        if (bound == "...") return "multi";
        if (bound == null) return false;
        return bound(pm) == false ? false : "handled";
      };

      var result = void 0;
      for (var i = 0; !result && i < pm.input.keymaps.length; i++) {
        result = handle(pm.input.keymaps[i].map.lookup(name, pm));
      }if (!result) result = handle(captureKeys.lookup(name));

      // If the key should be used in sequence with the next key, store the keyname internally.
      if (result == "multi") pm.input.keySeq = name;

      if ((result == "handled" || result == "multi") && e) e.preventDefault();

      if (seq && !result && /\'$/.test(name)) {
        if (e) e.preventDefault();
        return true;
      }
      return !!result;
    }

    // : (ProseMirror, TextSelection, string, ?(Node) → Selection)
    // Insert text into a document.

  }, {
    key: "insertText",
    value: function insertText(from, to, text, findSelection) {
      if (from == to && !text) return;
      var pm = this.pm,
          marks = pm.input.storedMarks || pm.doc.marksAt(from);
      var tr = pm.tr.replaceWith(from, to, text ? pm.schema.text(text, marks) : null);
      tr.setSelection(findSelection && findSelection(tr.doc) || findSelectionNear(tr.doc.resolve(tr.map(to)), -1, true));
      tr.applyAndScroll();
      if (text) pm.on.textInput.dispatch(text);
    }
  }, {
    key: "startComposition",
    value: function startComposition(dataLen, realStart) {
      this.pm.ensureOperation({ noFlush: true, readSelection: realStart }).composing = {
        ended: false,
        applied: false,
        margin: dataLen
      };
      this.pm.unscheduleFlush();
    }
  }, {
    key: "applyComposition",
    value: function applyComposition(andFlush) {
      var composing = this.composing;
      if (composing.applied) return;
      readCompositionChange(this.pm, composing.margin);
      composing.applied = true;
      // Operations that read DOM changes must be flushed, to make sure
      // subsequent DOM changes find a clean DOM.
      if (andFlush) this.pm.flush();
    }
  }, {
    key: "composing",
    get: function get() {
      return this.pm.operation && this.pm.operation.composing;
    }
  }]);

  return Input;
}();

exports.Input = Input;

handlers.keydown = function (pm, e) {
  if (!hasFocus(pm)) return;
  pm.on.interaction.dispatch();
  if (e.keyCode == 16) pm.input.shiftKey = true;
  if (pm.input.composing) return;
  var name = Keymap.keyName(e);
  if (name && pm.input.dispatchKey(name, e)) return;
  pm.sel.fastPoll();
};

handlers.keyup = function (pm, e) {
  if (e.keyCode == 16) pm.input.shiftKey = false;
};

handlers.keypress = function (pm, e) {
  if (!hasFocus(pm) || pm.input.composing || !e.charCode || e.ctrlKey && !e.altKey || browser.mac && e.metaKey) return;
  if (pm.input.dispatchKey(Keymap.keyName(e), e)) return;
  var sel = pm.selection;
  // On iOS, let input through, because if we handle it the virtual
  // keyboard's default case doesn't update (it only does so when the
  // user types or taps, not on selection updates from JavaScript).
  if (!browser.ios) {
    pm.input.insertText(sel.from, sel.to, String.fromCharCode(e.charCode));
    e.preventDefault();
  }
};

function contextFromEvent(pm, event) {
  return pm.contextAtCoords({ left: event.clientX, top: event.clientY });
}

function selectClickedNode(pm, context) {
  var _pm$selection = pm.selection;
  var selectedNode = _pm$selection.node;
  var $from = _pm$selection.$from;var selectAt = void 0;

  for (var i = context.inside.length - 1; i >= 0; i--) {
    var _context$inside$i = context.inside[i];
    var pos = _context$inside$i.pos;
    var node = _context$inside$i.node;

    if (node.type.selectable) {
      selectAt = pos;
      if (selectedNode && $from.depth > 0) {
        var $pos = pm.doc.resolve(pos);
        if ($pos.depth >= $from.depth && $pos.before($from.depth + 1) == $from.pos) selectAt = $pos.before($from.depth);
      }
      break;
    }
  }

  if (selectAt != null) {
    pm.setNodeSelection(selectAt);
    pm.focus();
    return true;
  } else {
    return false;
  }
}

var lastClick = { time: 0, x: 0, y: 0 },
    oneButLastClick = lastClick;

function isNear(event, click) {
  var dx = click.x - event.clientX,
      dy = click.y - event.clientY;
  return dx * dx + dy * dy < 100;
}

function handleTripleClick(pm, context) {
  for (var i = context.inside.length - 1; i >= 0; i--) {
    var _context$inside$i2 = context.inside[i];
    var pos = _context$inside$i2.pos;
    var node = _context$inside$i2.node;

    if (node.isTextblock) pm.setTextSelection(pos + 1, pos + 1 + node.content.size);else if (node.type.selectable) pm.setNodeSelection(pos);else continue;
    pm.focus();
    break;
  }
}

function runHandlerOnContext(handler, context, event) {
  for (var i = context.inside.length - 1; i >= 0; i--) {
    if (handler.dispatch(context.pos, context.inside[i].node, context.inside[i].pos, event)) return true;
  }
}

handlers.mousedown = function (pm, e) {
  pm.on.interaction.dispatch();
  var now = Date.now();
  var doubleClick = now - lastClick.time < 500 && isNear(e, lastClick);
  var tripleClick = doubleClick && now - oneButLastClick.time < 600 && isNear(e, oneButLastClick);
  oneButLastClick = lastClick;
  lastClick = { time: now, x: e.clientX, y: e.clientY };

  var context = contextFromEvent(pm, e);
  if (context == null) return;
  if (tripleClick) {
    e.preventDefault();
    handleTripleClick(pm, context);
  } else if (doubleClick) {
    if (runHandlerOnContext(pm.on.doubleClickOn, context, e) || pm.on.doubleClick.dispatch(context.pos, e)) e.preventDefault();else pm.sel.fastPoll();
  } else {
    pm.input.mouseDown = new MouseDown(pm, e, context, doubleClick);
  }
};

var MouseDown = function () {
  function MouseDown(pm, event, context, doubleClick) {
    _classCallCheck(this, MouseDown);

    this.pm = pm;
    this.event = event;
    this.context = context;
    this.leaveToBrowser = pm.input.shiftKey || doubleClick;
    this.x = event.clientX;this.y = event.clientY;

    var inner = context.inside[context.inside.length - 1];
    this.mightDrag = inner && (inner.node.type.draggable || inner.node == pm.sel.range.node) ? inner : null;
    this.target = event.target;
    if (this.mightDrag) {
      if (!contains(pm.content, this.target)) this.target = pm.root.elementFromPoint(this.x, this.y);
      this.target.draggable = true;
      if (browser.gecko && (this.setContentEditable = !this.target.hasAttribute("contentEditable"))) this.target.setAttribute("contentEditable", "false");
    }

    window.addEventListener("mouseup", this.up = this.up.bind(this));
    window.addEventListener("mousemove", this.move = this.move.bind(this));
    pm.sel.fastPoll();
  }

  _createClass(MouseDown, [{
    key: "done",
    value: function done() {
      window.removeEventListener("mouseup", this.up);
      window.removeEventListener("mousemove", this.move);
      if (this.mightDrag) {
        this.target.draggable = false;
        if (browser.gecko && this.setContentEditable) this.target.removeAttribute("contentEditable");
      }
    }
  }, {
    key: "up",
    value: function up(event) {
      this.done();

      if (this.leaveToBrowser || !contains(this.pm.content, event.target)) return this.pm.sel.fastPoll();

      var context = contextFromEvent(this.pm, event);
      if (this.event.ctrlKey && selectClickedNode(this.pm, context)) {
        event.preventDefault();
      } else if (runHandlerOnContext(this.pm.on.clickOn, this.context, event) || this.pm.on.click.dispatch(this.context.pos, event)) {
        event.preventDefault();
      } else {
        var inner = this.context.inside[this.context.inside.length - 1];
        if (inner && inner.node.type.isLeaf && inner.node.type.selectable) {
          this.pm.setNodeSelection(inner.pos);
          this.pm.focus();
        } else {
          this.pm.sel.fastPoll();
        }
      }
    }
  }, {
    key: "move",
    value: function move(event) {
      if (!this.leaveToBrowser && (Math.abs(this.x - event.clientX) > 4 || Math.abs(this.y - event.clientY) > 4)) this.leaveToBrowser = true;
      this.pm.sel.fastPoll();
    }
  }]);

  return MouseDown;
}();

handlers.touchdown = function (pm) {
  pm.sel.fastPoll();
};

handlers.contextmenu = function (pm, e) {
  var context = contextFromEvent(pm, e);
  if (context) {
    var inner = context.inside[context.inside.length - 1];
    if (pm.on.contextMenu.dispatch(context.pos, inner ? inner.node : pm.doc, e)) e.preventDefault();
  }
};

// Input compositions are hard. Mostly because the events fired by
// browsers are A) very unpredictable and inconsistent, and B) not
// cancelable.
//
// ProseMirror has the problem that it must not update the DOM during
// a composition, or the browser will cancel it. What it does is keep
// long-running operations (delayed DOM updates) when a composition is
// active.
//
// We _do not_ trust the information in the composition events which,
// apart from being very uninformative to begin with, is often just
// plain wrong. Instead, when a composition ends, we parse the dom
// around the original selection, and derive an update from that.

handlers.compositionstart = function (pm, e) {
  if (!pm.input.composing && hasFocus(pm)) pm.input.startComposition(e.data ? e.data.length : 0, true);
};

handlers.compositionupdate = function (pm) {
  if (!pm.input.composing && hasFocus(pm)) pm.input.startComposition(0, false);
};

handlers.compositionend = function (pm, e) {
  if (!hasFocus(pm)) return;
  var composing = pm.input.composing;
  if (!composing) {
    // We received a compositionend without having seen any previous
    // events for the composition. If there's data in the event
    // object, we assume that it's a real change, and start a
    // composition. Otherwise, we just ignore it.
    if (e.data) pm.input.startComposition(e.data.length, false);else return;
  } else if (composing.applied) {
    // This happens when a flush during composition causes a
    // syncronous compositionend.
    return;
  }

  clearTimeout(pm.input.finishComposing);
  pm.operation.composing.ended = true;
  // Applying the composition right away from this event confuses
  // Chrome (and probably other browsers), causing them to re-update
  // the DOM afterwards. So we apply the composition either in the
  // next input event, or after a short interval.
  pm.input.finishComposing = window.setTimeout(function () {
    var composing = pm.input.composing;
    if (composing && composing.ended) pm.input.applyComposition(true);
  }, 20);
};

function readInput(pm) {
  var composing = pm.input.composing;
  if (composing) {
    // Ignore input events during composition, except when the
    // composition has ended, in which case we can apply it.
    if (composing.ended) pm.input.applyComposition(true);
    return true;
  }

  // Read the changed DOM and derive an update from that.
  var result = readInputChange(pm);
  pm.flush();
  return result;
}

function readInputSoon(pm) {
  window.setTimeout(function () {
    if (!readInput(pm)) window.setTimeout(function () {
      return readInput(pm);
    }, 80);
  }, 20);
}

handlers.input = function (pm) {
  if (hasFocus(pm)) readInput(pm);
};

function toClipboard(doc, from, to, dataTransfer) {
  var $from = doc.resolve(from),
      start = from;
  for (var d = $from.depth; d > 0 && $from.end(d) == start; d--) {
    start++;
  }var slice = doc.slice(start, to);
  if (slice.possibleParent.type != doc.type.schema.nodes.doc) slice = new Slice(Fragment.from(slice.possibleParent.copy(slice.content)), slice.openLeft + 1, slice.openRight + 1);
  var dom = slice.content.toDOM(),
      wrap = document.createElement("div");
  if (dom.firstChild && dom.firstChild.nodeType == 1) dom.firstChild.setAttribute("pm-open-left", slice.openLeft);
  wrap.appendChild(dom);
  dataTransfer.clearData();
  dataTransfer.setData("text/html", wrap.innerHTML);
  dataTransfer.setData("text/plain", slice.content.textBetween(0, slice.content.size, "\n\n"));
  return slice;
}

var cachedCanUpdateClipboard = null;

function canUpdateClipboard(dataTransfer) {
  if (cachedCanUpdateClipboard != null) return cachedCanUpdateClipboard;
  dataTransfer.setData("text/html", "<hr>");
  return cachedCanUpdateClipboard = dataTransfer.getData("text/html") == "<hr>";
}

// : (ProseMirror, DataTransfer, ?bool, ResolvedPos) → ?Slice
function fromClipboard(pm, dataTransfer, plainText, $target) {
  var txt = dataTransfer.getData("text/plain");
  var html = dataTransfer.getData("text/html");
  if (!html && !txt) return null;
  var dom = void 0;
  if ((plainText || !html) && txt) {
    dom = document.createElement("div");
    pm.on.transformPastedText.dispatch(txt).split(/(?:\r\n?|\n){2,}/).forEach(function (block) {
      var para = dom.appendChild(document.createElement("p"));
      block.split(/\r\n?|\n/).forEach(function (line, i) {
        if (i) para.appendChild(document.createElement("br"));
        para.appendChild(document.createTextNode(line));
      });
    });
  } else {
    dom = readHTML(pm.on.transformPastedHTML.dispatch(html));
  }
  var openLeft = null,
      m = void 0;
  var foundLeft = dom.querySelector("[pm-open-left]");
  if (foundLeft && (m = /^\d+$/.exec(foundLeft.getAttribute("pm-open-left")))) openLeft = +m[0];
  var slice = parseDOMInContext($target, dom, { openLeft: openLeft, preserveWhiteSpace: true });
  return pm.on.transformPasted.dispatch(slice);
}

function insertRange($from, $to) {
  var from = $from.pos,
      to = $to.pos;
  for (var d = $to.depth; d > 0 && $to.end(d) == to; d--) {
    to++;
  }for (var _d = $from.depth; _d > 0 && $from.start(_d) == from && $from.end(_d) <= to; _d--) {
    from--;
  }return { from: from, to: to };
}

// Trick from jQuery -- some elements must be wrapped in other
// elements for innerHTML to work. I.e. if you do `div.innerHTML =
// "<td>..</td>"` the table cells are ignored.
var wrapMap = { thead: "table", colgroup: "table", col: "table colgroup",
  tr: "table tbody", td: "table tbody tr", th: "table tbody tr" };
function readHTML(html) {
  var metas = /(\s*<meta [^>]*>)*/.exec(html);
  if (metas) html = html.slice(metas[0].length);
  var elt = document.createElement("div");
  var firstTag = /(?:<meta [^>]*>)*<([a-z][^>\s]+)/i.exec(html),
      wrap = void 0,
      depth = 0;
  if (wrap = firstTag && wrapMap[firstTag[1].toLowerCase()]) {
    var nodes = wrap.split(" ");
    html = nodes.map(function (n) {
      return "<" + n + ">";
    }).join("") + html + nodes.map(function (n) {
      return "</" + n + ">";
    }).reverse().join("");
    depth = nodes.length;
  }
  elt.innerHTML = html;
  for (var i = 0; i < depth; i++) {
    elt = elt.firstChild;
  }return elt;
}

handlers.copy = handlers.cut = function (pm, e) {
  var _pm$selection2 = pm.selection;
  var from = _pm$selection2.from;
  var to = _pm$selection2.to;
  var empty = _pm$selection2.empty;var cut = e.type == "cut";
  if (empty) return;
  if (!e.clipboardData || !canUpdateClipboard(e.clipboardData)) {
    if (cut && browser.ie && browser.ie_version <= 11) readInputSoon(pm);
    return;
  }
  toClipboard(pm.doc, from, to, e.clipboardData);
  e.preventDefault();
  if (cut) pm.tr.delete(from, to).apply();
};

handlers.paste = function (pm, e) {
  if (!hasFocus(pm) || pm.on.domPaste.dispatch(e)) return;
  if (!e.clipboardData) {
    if (browser.ie && browser.ie_version <= 11) readInputSoon(pm);
    return;
  }
  var sel = pm.selection,
      range = insertRange(sel.$from, sel.$to);
  var slice = fromClipboard(pm, e.clipboardData, pm.input.shiftKey, pm.doc.resolve(range.from));
  if (slice) {
    e.preventDefault();
    var tr = pm.tr.replace(range.from, range.to, slice);
    tr.setSelection(findSelectionNear(tr.doc.resolve(tr.map(range.to)), -1));
    tr.applyAndScroll();
  }
};

var Dragging = function Dragging(slice, from, to) {
  _classCallCheck(this, Dragging);

  this.slice = slice;
  this.from = from;
  this.to = to;
};

function dropPos(slice, $pos) {
  if (!slice || !slice.content.size) return $pos.pos;
  var content = slice.content;
  for (var i = 0; i < slice.openLeft; i++) {
    content = content.firstChild.content;
  }for (var d = $pos.depth; d >= 0; d--) {
    var bias = d == $pos.depth ? 0 : $pos.pos <= ($pos.start(d + 1) + $pos.end(d + 1)) / 2 ? -1 : 1;
    var insertPos = $pos.index(d) + (bias > 0 ? 1 : 0);
    if ($pos.node(d).canReplace(insertPos, insertPos, content)) return bias == 0 ? $pos.pos : bias < 0 ? $pos.before(d + 1) : $pos.after(d + 1);
  }
  return $pos.pos;
}

function removeDropTarget(pm) {
  if (pm.input.dropTarget) {
    pm.wrapper.removeChild(pm.input.dropTarget);
    pm.input.dropTarget = null;
  }
}

handlers.dragstart = function (pm, e) {
  var mouseDown = pm.input.mouseDown;
  if (mouseDown) mouseDown.done();

  if (!e.dataTransfer) return;

  var _pm$selection3 = pm.selection;
  var from = _pm$selection3.from;
  var to = _pm$selection3.to;
  var empty = _pm$selection3.empty;var dragging = void 0;
  var pos = !empty && pm.posAtCoords({ left: e.clientX, top: e.clientY });
  if (pos != null && pos >= from && pos <= to) {
    dragging = { from: from, to: to };
  } else if (mouseDown && mouseDown.mightDrag) {
    var _pos = mouseDown.mightDrag.pos;
    dragging = { from: _pos, to: _pos + mouseDown.mightDrag.node.nodeSize };
  }

  if (dragging) {
    var slice = toClipboard(pm.doc, dragging.from, dragging.to, e.dataTransfer);
    // FIXME the document could change during a drag, invalidating this range
    // use a marked range?
    pm.input.dragging = new Dragging(slice, dragging.from, dragging.to);
  }
};

handlers.dragend = function (pm) {
  removeDropTarget(pm);
  window.setTimeout(function () {
    return pm.input.dragging = null;
  }, 50);
};

handlers.dragover = handlers.dragenter = function (pm, e) {
  e.preventDefault();

  var target = pm.input.dropTarget;
  if (!target) target = pm.input.dropTarget = pm.wrapper.appendChild(elt("div", { class: "ProseMirror-drop-target" }));

  var mousePos = pm.posAtCoords({ left: e.clientX, top: e.clientY });
  var pos = mousePos == null ? null : dropPos(pm.input.dragging && pm.input.dragging.slice, pm.doc.resolve(mousePos));
  if (pos == null) return;
  var coords = pm.coordsAtPos(pos);
  var rect = pm.wrapper.getBoundingClientRect();
  coords.top -= rect.top;
  coords.right -= rect.left;
  coords.bottom -= rect.top;
  coords.left -= rect.left;
  target.style.left = coords.left - 1 + "px";
  target.style.top = coords.top + "px";
  target.style.height = coords.bottom - coords.top + "px";
};

handlers.dragleave = function (pm, e) {
  if (e.target == pm.content) removeDropTarget(pm);
};

handlers.drop = function (pm, e) {
  var dragging = pm.input.dragging;
  pm.input.dragging = null;
  removeDropTarget(pm);

  if (!e.dataTransfer || pm.on.domDrop.dispatch(e)) return;

  var $mouse = pm.doc.resolve(pm.posAtCoords({ left: e.clientX, top: e.clientY }));
  if (!$mouse) return;
  var range = insertRange($mouse, $mouse);
  var slice = dragging && dragging.slice || fromClipboard(pm, e.dataTransfer, pm.doc.resolve(range.from));
  if (!slice) return;
  var insertPos = dropPos(slice, pm.doc.resolve(range.from));

  e.preventDefault();
  var tr = pm.tr;
  if (dragging && !e.ctrlKey && dragging.from != null) tr.delete(dragging.from, dragging.to);
  var start = tr.map(insertPos),
      found = void 0;
  tr.replace(start, tr.map(insertPos), slice).apply();

  if (slice.content.childCount == 1 && slice.openLeft == 0 && slice.openRight == 0 && slice.content.child(0).type.selectable && (found = pm.doc.nodeAt(start)) && found.sameMarkup(slice.content.child(0))) {
    pm.setNodeSelection(start);
  } else {
    var left = findSelectionNear(pm.doc.resolve(start), 1, true).from;
    var right = findSelectionNear(pm.doc.resolve(tr.map(insertPos)), -1, true).to;
    pm.setTextSelection(left, right);
  }
  pm.focus();
};

handlers.focus = function (pm) {
  pm.wrapper.classList.add("ProseMirror-focused");
  pm.on.focus.dispatch();
};

handlers.blur = function (pm) {
  pm.wrapper.classList.remove("ProseMirror-focused");
  pm.on.blur.dispatch();
};
},{"../model":37,"../util/browser":58,"../util/dom":60,"./capturekeys":2,"./domchange":6,"./selection":17,"browserkeymap":1}],12:[function(require,module,exports){
"use strict";

var Keymap = require("browserkeymap");
var browser = require("../util/browser");

var c = require("./commands").commands;

// :: Keymap

// A basic keymap containing bindings not specific to any schema.
// Binds the following keys (when multiple commands are listed, they
// are chained with [`chainCommands`](#commands.chainCommands):
//
// * **Enter** to `newlineInCode`, `createParagraphNear`, `liftEmptyBlock`, `splitBlock`
// * **Backspace** to `deleteSelection`, `joinBackward`, `deleteCharBefore`
// * **Mod-Backspace** to `deleteSelection`, `joinBackward`, `deleteWordBefore`
// * **Delete** to `deleteSelection`, `joinForward`, `deleteCharAfter`
// * **Mod-Delete** to `deleteSelection`, `joinForward`, `deleteWordAfter`
// * **Alt-Up** to `joinUp`
// * **Alt-Down** to `joinDown`
// * **Mod-[** to `lift`
// * **Esc** to `selectParentNode`
// * **Mod-Z** to `undo`
// * **Mod-Y** and **Shift-Mod-Z** to `redo`
var baseKeymap = new Keymap({
  "Enter": c.chainCommands(c.newlineInCode, c.createParagraphNear, c.liftEmptyBlock, c.splitBlock),

  "Backspace": c.chainCommands(c.deleteSelection, c.joinBackward, c.deleteCharBefore),
  "Mod-Backspace": c.chainCommands(c.deleteSelection, c.joinBackward, c.deleteWordBefore),
  "Delete": c.chainCommands(c.deleteSelection, c.joinForward, c.deleteCharAfter),
  "Mod-Delete": c.chainCommands(c.deleteSelection, c.joinForward, c.deleteWordAfter),

  "Alt-Up": c.joinUp,
  "Alt-Down": c.joinDown,
  "Mod-[": c.lift,
  "Esc": c.selectParentNode,

  "Mod-Z": c.undo,
  "Mod-Y": c.redo,
  "Shift-Mod-Z": c.redo
});
exports.baseKeymap = baseKeymap;

if (browser.mac) baseKeymap.addBindings({
  "Ctrl-H": baseKeymap.lookup("Backspace"),
  "Alt-Backspace": baseKeymap.lookup("Cmd-Backspace"),
  "Ctrl-D": baseKeymap.lookup("Delete"),
  "Ctrl-Alt-Backspace": baseKeymap.lookup("Cmd-Delete"),
  "Alt-Delete": baseKeymap.lookup("Cmd-Delete"),
  "Alt-D": baseKeymap.lookup("Cmd-Delete")
});
},{"../util/browser":58,"./commands":4,"browserkeymap":1}],13:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

require("./css");

var _require = require("../util/map");

var Map = _require.Map;

var _require2 = require("subscription");

var Subscription = _require2.Subscription;
var PipelineSubscription = _require2.PipelineSubscription;
var StoppableSubscription = _require2.StoppableSubscription;
var DOMSubscription = _require2.DOMSubscription;

var _require3 = require("../util/dom");

var requestAnimationFrame = _require3.requestAnimationFrame;
var cancelAnimationFrame = _require3.cancelAnimationFrame;
var elt = _require3.elt;
var ensureCSSAdded = _require3.ensureCSSAdded;

var _require4 = require("../transform");

var mapThrough = _require4.mapThrough;

var _require5 = require("../model");

var Mark = _require5.Mark;

var _require6 = require("./options");

var parseOptions = _require6.parseOptions;

var _require7 = require("./selection");

var SelectionState = _require7.SelectionState;
var TextSelection = _require7.TextSelection;
var NodeSelection = _require7.NodeSelection;
var findSelectionAtStart = _require7.findSelectionAtStart;
var _hasFocus = _require7.hasFocus;

var _require8 = require("./dompos");

var scrollIntoView = _require8.scrollIntoView;
var posAtCoords = _require8.posAtCoords;
var _coordsAtPos = _require8.coordsAtPos;

var _require9 = require("./draw");

var draw = _require9.draw;
var redraw = _require9.redraw;
var DIRTY_REDRAW = _require9.DIRTY_REDRAW;
var DIRTY_RESCAN = _require9.DIRTY_RESCAN;

var _require10 = require("./input");

var Input = _require10.Input;

var _require11 = require("./history");

var History = _require11.History;

var _require12 = require("./range");

var RangeStore = _require12.RangeStore;
var MarkedRange = _require12.MarkedRange;

var _require13 = require("./transform");

var EditorTransform = _require13.EditorTransform;

var _require14 = require("./update");

var EditorScheduler = _require14.EditorScheduler;
var UpdateScheduler = _require14.UpdateScheduler;

// ;; This is the class used to represent instances of the editor. A
// ProseMirror editor holds a [document](#Node) and a
// [selection](#Selection), and displays an editable surface
// representing that document in the browser document.

var ProseMirror = function () {
  // :: (Object)
  // Construct a new editor from a set of [options](#edit_options)
  // and, if it has a [`place`](#place) option, add it to the
  // document.

  function ProseMirror(opts) {
    var _this = this;

    _classCallCheck(this, ProseMirror);

    ensureCSSAdded();

    opts = this.options = parseOptions(opts);
    // :: Schema
    // The schema for this editor's document.
    this.schema = opts.schema || opts.doc && opts.doc.type.schema;
    if (!this.schema) throw new RangeError("You must specify a schema option");
    if (opts.doc == null) opts.doc = this.schema.nodes.doc.createAndFill();
    if (opts.doc.type.schema != this.schema) throw new RangeError("Schema option does not correspond to schema used in doc option");
    // :: DOMNode
    // The editable DOM node containing the document.
    this.content = elt("div", { class: "ProseMirror-content", "pm-container": true });
    // :: DOMNode
    // The outer DOM element of the editor.
    this.wrapper = elt("div", { class: "ProseMirror" }, this.content);
    this.wrapper.ProseMirror = this;

    // :: Object<Subscription>
    // A wrapper object containing the various [event
    // subscriptions](https://github.com/marijnh/subscription#readme)
    // exposed by an editor instance.
    this.on = {
      // :: Subscription<()>
      // Dispatched when the document has changed. See
      // [`setDoc`](#ProseMirror.on.setDoc) and
      // [`transform`](#ProseMirror.on.transform) for more specific
      // change-related events.
      change: new Subscription(),
      // :: Subscription<()>
      // Indicates that the editor's selection has changed.
      selectionChange: new Subscription(),
      // :: Subscription<(text: string)>
      // Dispatched when the user types text into the editor.
      textInput: new Subscription(),
      // :: Subscription<(doc: Node, selection: Selection)>
      // Dispatched when [`setDoc`](#ProseMirror.setDoc) is called, before
      // the document is actually updated.
      beforeSetDoc: new Subscription(),
      // :: Subscription<(doc: Node, selection: Selection)>
      // Dispatched when [`setDoc`](#ProseMirror.setDoc) is called, after
      // the document is updated.
      setDoc: new Subscription(),
      // :: Subscription<()>
      // Dispatched when the user interacts with the editor, for example by
      // clicking on it or pressing a key while it is focused. Mostly
      // useful for closing or resetting transient UI state such as open
      // menus.
      interaction: new Subscription(),
      // :: Subscription<()>
      // Dispatched when the editor gains focus.
      focus: new Subscription(),
      // :: Subscription<()>
      // Dispatched when the editor loses focus.
      blur: new Subscription(),
      // :: StoppableSubscription<(pos: number, event: DOMEvent)>
      // Dispatched when the editor is clicked. Return a truthy
      // value to indicate that the click was handled, and no further
      // action needs to be taken.
      click: new StoppableSubscription(),
      // :: StoppableSubscription<(pos: number, node: Node, nodePos: number, event: DOMEvent)>
      // Dispatched for every node around a click in the editor, before
      // `click` is dispatched, from inner to outer nodes. `pos` is
      // the position neares to the click, `nodePos` is the position
      // directly in front of `node`.
      clickOn: new StoppableSubscription(),
      // :: StoppableSubscription<(pos: number, event: DOMEvent)>
      // Dispatched when the editor is double-clicked.
      doubleClick: new StoppableSubscription(),
      // :: StoppableSubscription<(pos: number, node: Node, nodePos: number, event: DOMEvent)>
      // Dispatched for every node around a double click in the
      // editor, before `doubleClick` is dispatched.
      doubleClickOn: new StoppableSubscription(),
      // :: StoppableSubscription<(pos: number, node: Node, event: DOMEvent)>
      // Dispatched when the context menu is opened on the editor.
      // Return a truthy value to indicate that you handled the event.
      contextMenu: new StoppableSubscription(),
      // :: PipelineSubscription<(slice: Slice) → Slice>
      // Dispatched when something is pasted or dragged into the editor. The
      // given slice represents the pasted content, and your handler can
      // return a modified version to manipulate it before it is inserted
      // into the document.
      transformPasted: new PipelineSubscription(),
      // :: PipelineSubscription<(text: string) → string>
      // Dispatched when plain text is pasted. Handlers must return the given
      // string or a transformed version of it.
      transformPastedText: new PipelineSubscription(),
      // :: PipelineSubscription<(html: string) → string>
      // Dispatched when html content is pasted or dragged into the editor.
      // Handlers must return the given string or a transformed
      // version of it.
      transformPastedHTML: new PipelineSubscription(),
      // :: Subscription<(transform: Transform, selectionBeforeTransform: Selection, options: Object)>
      // Signals that a (non-empty) transformation has been aplied to
      // the editor. Passes the `Transform`, the selection before the
      // transform, and the options given to [`apply`](#ProseMirror.apply)
      // as arguments to the handler.
      transform: new Subscription(),
      // :: Subscription<(transform: Transform, options: Object)>
      // Indicates that the given transform is about to be
      // [applied](#ProseMirror.apply). The handler may add additional
      // [steps](#Step) to the transform, but it it not allowed to
      // interfere with the editor's state.
      beforeTransform: new Subscription(),
      // :: StoppableSubscription<(transform: Transform)>
      // Dispatched before a transform (applied without `filter: false`) is
      // applied. The handler can return a truthy value to cancel the
      // transform.
      filterTransform: new StoppableSubscription(),
      // :: Subscription<()>
      // Dispatched when the editor is about to [flush](#ProseMirror.flush)
      // an update to the DOM.
      flushing: new Subscription(),
      // :: Subscription<()>
      // Dispatched when the editor has finished
      // [flushing](#ProseMirror.flush) an update to the DOM.
      flush: new Subscription(),
      // :: Subscription<()>
      // Dispatched when the editor redrew its document in the DOM.
      draw: new Subscription(),
      // :: Subscription<()>
      // Dispatched when the set of [active marks](#ProseMirror.activeMarks) changes.
      activeMarkChange: new Subscription(),
      // :: StoppableSubscription<(DOMEvent)>
      // Dispatched when a DOM `paste` event happens on the editor.
      // Handlers may declare the event as being handled by calling
      // `preventDefault` on it or returning a truthy value.
      domPaste: new DOMSubscription(),
      // :: StoppableSubscription<(DOMEvent)>
      // Dispatched when a DOM `drop` event happens on the editor.
      // Handlers may declare the event as being handled by calling
      // `preventDefault` on it or returning a truthy value.
      domDrop: new DOMSubscription()
    };

    if (opts.place && opts.place.appendChild) opts.place.appendChild(this.wrapper);else if (opts.place) opts.place(this.wrapper);

    this._root = null;

    this.setDocInner(opts.doc);
    draw(this, this.doc);
    this.content.contentEditable = true;
    if (opts.label) this.content.setAttribute("aria-label", opts.label);

    // A namespace where plugins can store their state. See the `Plugin` class.
    this.plugin = Object.create(null);
    this.cached = Object.create(null);
    this.operation = null;
    this.dirtyNodes = new Map(); // Maps node object to 1 (re-scan content) or 2 (redraw entirely)
    this.flushScheduled = null;
    this.centralScheduler = new EditorScheduler(this);

    this.sel = new SelectionState(this, findSelectionAtStart(this.doc));
    this.accurateSelection = false;
    this.input = new Input(this);
    this.addKeymap(this.options.keymap, -100);

    this.options.plugins.forEach(function (plugin) {
      return plugin.attach(_this);
    });
  }

  // :: DOMDocument
  // The root document that the editor is part of. Initialized lazily
  // (falling back to the top-level document until the editor is
  // placed in the DOM) to make sure asynchronously adding the editor
  // to a shadow DOM works correctly.


  _createClass(ProseMirror, [{
    key: "getOption",


    // :: (string) → any
    // Get the value of the given [option](#edit_options).
    value: function getOption(name) {
      return this.options[name];
    }

    // :: Selection
    // Get the current selection.

  }, {
    key: "setTextSelection",


    // :: (number, ?number)
    // Set the selection to a [text selection](#TextSelection) from
    // `anchor` to `head`, or, if `head` is null, a cursor selection at
    // `anchor`.
    value: function setTextSelection(anchor) {
      var head = arguments.length <= 1 || arguments[1] === undefined ? anchor : arguments[1];

      var $anchor = this.doc.resolve(anchor),
          $head = this.doc.resolve(head);
      if (!$anchor.parent.isTextblock || !$head.parent.isTextblock) throw new RangeError("Setting text selection with an end not in a textblock");
      this.setSelection(new TextSelection($anchor, $head));
    }

    // :: (number)
    // Set the selection to a node selection on the node after `pos`.

  }, {
    key: "setNodeSelection",
    value: function setNodeSelection(pos) {
      var $pos = this.doc.resolve(pos),
          node = $pos.nodeAfter;
      if (!node || !node.type.selectable) throw new RangeError("Trying to create a node selection that doesn't point at a selectable node");
      this.setSelection(new NodeSelection($pos));
    }

    // :: (Selection)
    // Set the selection to the given selection object.

  }, {
    key: "setSelection",
    value: function setSelection(selection) {
      this.ensureOperation();
      if (!selection.eq(this.sel.range)) this.sel.setAndSignal(selection);
    }
  }, {
    key: "setDocInner",
    value: function setDocInner(doc) {
      if (doc.type != this.schema.nodes.doc) throw new RangeError("Trying to set a document with a different schema");
      // :: Node The current document.
      this.doc = doc;
      this.ranges = new RangeStore(this);
      // :: History The edit history for the editor.
      this.history = new History(this);
    }

    // :: (Node, ?Selection)
    // Set the editor's content, and optionally include a new selection.

  }, {
    key: "setDoc",
    value: function setDoc(doc, sel) {
      if (!sel) sel = findSelectionAtStart(doc);
      this.on.beforeSetDoc.dispatch(doc, sel);
      this.ensureOperation();
      this.setDocInner(doc);
      this.operation.docSet = true;
      this.sel.set(sel, true);
      this.on.setDoc.dispatch(doc, sel);
    }
  }, {
    key: "updateDoc",
    value: function updateDoc(doc, mapping, selection) {
      this.ensureOperation();
      this.ranges.transform(mapping);
      this.operation.mappings.push(mapping);
      this.doc = doc;
      this.sel.setAndSignal(selection || this.sel.range.map(doc, mapping));
      this.on.change.dispatch();
    }

    // :: EditorTransform
    // Create an editor- and selection-aware `Transform` object for this
    // editor.

  }, {
    key: "apply",


    // :: (Transform, ?Object) → Transform
    // Apply a transformation (which you might want to create with the
    // [`tr` getter](#ProseMirror.tr)) to the document in the editor.
    // The following options are supported:
    //
    // **`scrollIntoView`**: ?bool
    //   : When true, scroll the selection into view on the next
    //     [redraw](#ProseMirror.flush).
    //
    // **`selection`**`: ?Selection`
    //   : A new selection to set after the transformation is applied.
    //     If `transform` is an `EditorTransform`, this will default to
    //     that object's current selection. If no selection is provided,
    //     the new selection is determined by [mapping](#Selection.map)
    //     the existing selection through the transform.
    //
    // **`filter`**: ?bool
    //   : When set to false, suppresses the ability of the
    //     [`filterTransform` event](#ProseMirror.on.filterTransform)
    //     to cancel this transform.
    //
    // Returns the transform itself.
    value: function apply(transform) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? nullOptions : arguments[1];

      if (!transform.steps.length) return transform;
      if (!transform.docs[0].eq(this.doc)) throw new RangeError("Applying a transform that does not start with the current document");

      if (options.filter !== false && this.on.filterTransform.dispatch(transform)) return transform;

      var selectionBeforeTransform = this.selection;

      this.on.beforeTransform.dispatch(transform, options);
      this.updateDoc(transform.doc, transform, options.selection || transform.selection);
      this.on.transform.dispatch(transform, selectionBeforeTransform, options);
      if (options.scrollIntoView) this.scrollIntoView();
      return transform;
    }

    // : (?Object) → Operation
    // Ensure that an operation has started.

  }, {
    key: "ensureOperation",
    value: function ensureOperation(options) {
      return this.operation || this.startOperation(options);
    }

    // : (?Object) → Operation
    // Start an operation and schedule a flush so that any effect of
    // the operation shows up in the DOM.

  }, {
    key: "startOperation",
    value: function startOperation(options) {
      var _this2 = this;

      this.operation = new Operation(this, options);
      if (!(options && options.readSelection === false) && this.sel.readFromDOM()) this.operation.sel = this.sel.range;

      if (this.flushScheduled == null) this.flushScheduled = requestAnimationFrame(function () {
        return _this2.flush();
      });
      return this.operation;
    }

    // Cancel any scheduled operation flush.

  }, {
    key: "unscheduleFlush",
    value: function unscheduleFlush() {
      if (this.flushScheduled != null) {
        cancelAnimationFrame(this.flushScheduled);
        this.flushScheduled = null;
      }
    }

    // :: () → bool
    // Flush any pending changes to the DOM. When the document,
    // selection, or marked ranges in an editor change, the DOM isn't
    // updated immediately, but rather scheduled to be updated the next
    // time the browser redraws the screen. This method can be used to
    // force this to happen immediately. It can be useful when you, for
    // example, want to measure where on the screen a part of the
    // document ends up, immediately after changing the document.
    //
    // Returns true when it updated the document DOM.

  }, {
    key: "flush",
    value: function flush() {
      this.unscheduleFlush();

      // IE does not support calling contains() on document
      var root = this.root.body || this.root;
      if (!root.contains(this.wrapper) || !this.operation) return false;
      this.on.flushing.dispatch();

      var op = this.operation,
          redrawn = false;
      if (!op) return false;
      if (op.composing) this.input.applyComposition();

      this.operation = null;
      this.accurateSelection = true;

      if (op.doc != this.doc || this.dirtyNodes.size) {
        redraw(this, this.dirtyNodes, this.doc, op.doc);
        this.dirtyNodes.clear();
        redrawn = true;
      }

      if (redrawn || !op.sel.eq(this.sel.range) || op.focus) this.sel.toDOM(op.focus);

      // FIXME somehow schedule this relative to ui/update so that it
      // doesn't cause extra layout
      if (op.scrollIntoView !== false) scrollIntoView(this, op.scrollIntoView);
      if (redrawn) this.on.draw.dispatch();
      this.on.flush.dispatch();
      this.accurateSelection = false;
      return redrawn;
    }

    // :: (Keymap, ?number)
    // Add a
    // [keymap](https://github.com/marijnh/browserkeymap#an-object-type-for-keymaps)
    // to the editor. Keymaps added in this way are queried before the
    // base keymap. The `priority` parameter can be used to
    // control when they are queried relative to other maps added like
    // this. Maps with a higher priority get queried first.

  }, {
    key: "addKeymap",
    value: function addKeymap(map) {
      var priority = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];

      var i = 0,
          maps = this.input.keymaps;
      for (; i < maps.length; i++) {
        if (maps[i].priority < priority) break;
      }maps.splice(i, 0, { map: map, priority: priority });
    }

    // :: (union<string, Keymap>)
    // Remove the given keymap, or the keymap with the given name, from
    // the editor.

  }, {
    key: "removeKeymap",
    value: function removeKeymap(map) {
      var maps = this.input.keymaps;
      for (var i = 0; i < maps.length; ++i) {
        if (maps[i].map == map || maps[i].map.options.name == map) {
          maps.splice(i, 1);
          return true;
        }
      }
    }

    // :: (number, number, ?Object) → MarkedRange
    // Create a marked range between the given positions. Marked ranges
    // “track” the part of the document they point to—as the document
    // changes, they are updated to move, grow, and shrink along with
    // their content.
    //
    // The `options` parameter may be an object containing these properties:
    //
    // **`inclusiveLeft`**`: bool = false`
    //   : Whether the left side of the range is inclusive. When it is,
    //     content inserted at that point will become part of the range.
    //     When not, it will be outside of the range.
    //
    // **`inclusiveRight`**`: bool = false`
    //   : Whether the right side of the range is inclusive.
    //
    // **`removeWhenEmpty`**`: bool = true`
    //   : Whether the range should be forgotten when it becomes empty
    //     (because all of its content was deleted).
    //
    // **`className`**`: string`
    //   : A CSS class to add to the inline content that is part of this
    //     range.
    //
    // **`onRemove`**`: fn(number, number)`
    //   : When given, this function will be called when the range is
    //     removed from the editor.

  }, {
    key: "markRange",
    value: function markRange(from, to, options) {
      var range = new MarkedRange(from, to, options);
      this.ranges.addRange(range);
      return range;
    }

    // :: (MarkedRange)
    // Remove the given range from the editor.

  }, {
    key: "removeRange",
    value: function removeRange(range) {
      this.ranges.removeRange(range);
    }

    // :: () → [Mark]
    // Get the marks at the cursor. By default, this yields the marks
    // associated with the content at the cursor, as per `Node.marksAt`.
    // But if the set of active marks was updated with
    // [`addActiveMark`](#ProseMirror.addActiveMark) or
    // [`removeActiveMark`](#ProseMirror.removeActiveMark), the updated
    // set is returned.

  }, {
    key: "activeMarks",
    value: function activeMarks() {
      return this.input.storedMarks || currentMarks(this);
    }

    // :: (Mark)
    // Add a mark to the set of overridden active marks that will be
    // applied to subsequently typed text. Does not do anything when the
    // selection isn't collapsed.

  }, {
    key: "addActiveMark",
    value: function addActiveMark(mark) {
      if (this.selection.empty) {
        this.input.storedMarks = mark.addToSet(this.input.storedMarks || currentMarks(this));
        this.on.activeMarkChange.dispatch();
      }
    }

    // :: (MarkType)
    // Remove any mark of the given type from the set of overidden active marks.

  }, {
    key: "removeActiveMark",
    value: function removeActiveMark(markType) {
      if (this.selection.empty) {
        this.input.storedMarks = markType.removeFromSet(this.input.storedMarks || currentMarks(this));
        this.on.activeMarkChange.dispatch();
      }
    }

    // :: ()
    // Give the editor focus.

  }, {
    key: "focus",
    value: function focus() {
      if (this.operation) this.operation.focus = true;else this.sel.toDOM(true);
    }

    // :: () → bool
    // Query whether the editor has focus.

  }, {
    key: "hasFocus",
    value: function hasFocus() {
      if (this.sel.range instanceof NodeSelection) return this.root.activeElement == this.content;else return _hasFocus(this);
    }

    // :: ({top: number, left: number}) → ?number
    // If the given coordinates (which should be relative to the top
    // left corner of the window—not the page) fall within the editable
    // content, this method will return the document position that
    // corresponds to those coordinates.

  }, {
    key: "posAtCoords",
    value: function posAtCoords(coords) {
      var result = mappedPosAtCoords(this, coords);
      return result && result.pos;
    }

    // :: ({top: number, left: number}) → ?{pos: number, inside: [{pos: number, node: Node}]}
    // If the given coordinates fall within the editable content, this
    // method will return the document position that corresponds to
    // those coordinates, along with a stack of nodes and their
    // positions (excluding the top node) that the coordinates fall
    // into.

  }, {
    key: "contextAtCoords",
    value: function contextAtCoords(coords) {
      var result = mappedPosAtCoords(this, coords);
      if (!result) return null;

      var $pos = this.doc.resolve(result.inLeaf == -1 ? result.pos : result.inLeaf),
          inside = [];
      for (var i = 1; i <= $pos.depth; i++) {
        inside.push({ pos: $pos.before(i), node: $pos.node(i) });
      }if (result.inLeaf > -1) {
        var after = $pos.nodeAfter;
        if (after && !after.isText && after.type.isLeaf) inside.push({ pos: result.inLeaf, node: after });
      }
      return { pos: result.pos, inside: inside };
    }

    // :: (number) → {top: number, left: number, bottom: number}
    // Find the screen coordinates (relative to top left corner of the
    // window) of the given document position.

  }, {
    key: "coordsAtPos",
    value: function coordsAtPos(pos) {
      this.flush();
      return _coordsAtPos(this, pos);
    }

    // :: (?number)
    // Scroll the given position, or the cursor position if `pos` isn't
    // given, into view.

  }, {
    key: "scrollIntoView",
    value: function scrollIntoView() {
      var pos = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];

      this.ensureOperation();
      this.operation.scrollIntoView = pos;
    }
  }, {
    key: "markRangeDirty",
    value: function markRangeDirty(from, to) {
      var doc = arguments.length <= 2 || arguments[2] === undefined ? this.doc : arguments[2];

      this.ensureOperation();
      var dirty = this.dirtyNodes;
      var $from = doc.resolve(from),
          $to = doc.resolve(to);
      var same = $from.sameDepth($to);
      for (var depth = 0; depth <= same; depth++) {
        var child = $from.node(depth);
        if (!dirty.has(child)) dirty.set(child, DIRTY_RESCAN);
      }
      var start = $from.index(same),
          end = $to.index(same) + (same == $to.depth && $to.atNodeBoundary ? 0 : 1);
      var parent = $from.node(same);
      for (var i = start; i < end; i++) {
        dirty.set(parent.child(i), DIRTY_REDRAW);
      }
    }
  }, {
    key: "markAllDirty",
    value: function markAllDirty() {
      this.dirtyNodes.set(this.doc, DIRTY_REDRAW);
    }

    // :: (string) → string
    // Return a translated string, if a [translate function](#translate)
    // has been supplied, or the original string.

  }, {
    key: "translate",
    value: function translate(string) {
      var trans = this.options.translate;
      return trans ? trans(string) : string;
    }

    // :: (() -> ?() -> ?())
    // Schedule a DOM update function to be called either the next time
    // the editor is [flushed](#ProseMirror.flush), or if no flush happens
    // immediately, after 200 milliseconds. This is used to synchronize
    // DOM updates and read to prevent [DOM layout
    // thrashing](http://eloquentjavascript.net/13_dom.html#p_nnTb9RktUT).
    //
    // Often, your updates will need to both read and write from the DOM.
    // To schedule such access in lockstep with other modules, the
    // function you give can return another function, which may return
    // another function, and so on. The first call should _write_ to the
    // DOM, and _not read_. If a _read_ needs to happen, that should be
    // done in the function returned from the first call. If that has to
    // be followed by another _write_, that should be done in a function
    // returned from the second function, and so on.

  }, {
    key: "scheduleDOMUpdate",
    value: function scheduleDOMUpdate(f) {
      this.centralScheduler.set(f);
    }

    // :: (() -> ?() -> ?())
    // Cancel an update scheduled with `scheduleDOMUpdate`. Calling this
    // with a function that is not actually scheduled is harmless.

  }, {
    key: "unscheduleDOMUpdate",
    value: function unscheduleDOMUpdate(f) {
      this.centralScheduler.unset(f);
    }

    // :: ([Subscription], () -> ?()) → UpdateScheduler
    // Creates an update scheduler for this editor. `subscriptions`
    // should be an array of subscriptions to listen for. `start` should
    // be a function as expected by
    // [`scheduleDOMUpdate`](ProseMirror.scheduleDOMUpdate).

  }, {
    key: "updateScheduler",
    value: function updateScheduler(subscriptions, start) {
      return new UpdateScheduler(this, subscriptions, start);
    }
  }, {
    key: "root",
    get: function get() {
      var cached = this._root;
      if (cached == null) for (var search = this.wrapper.parentNode; search; search = search.parentNode) {
        if (search.nodeType == 9 || search.nodeType == 11 && search.host) return this._root = search;
      }
      return cached || document;
    }
  }, {
    key: "selection",
    get: function get() {
      if (!this.accurateSelection) this.ensureOperation();
      return this.sel.range;
    }
  }, {
    key: "tr",
    get: function get() {
      return new EditorTransform(this);
    }
  }]);

  return ProseMirror;
}();

exports.ProseMirror = ProseMirror;

function mappedPosAtCoords(pm, coords) {
  // If the DOM has been changed, flush so that we have a proper DOM to read
  if (pm.operation && (pm.dirtyNodes.size > 0 || pm.operation.composing || pm.operation.docSet)) pm.flush();
  var result = posAtCoords(pm, coords);
  if (!result) return null;

  // If there's an active operation, we need to map forward through
  // its changes to get a position that applies to the current
  // document
  if (pm.operation) return { pos: mapThrough(pm.operation.mappings, result.pos),
    inLeaf: result.inLeaf < 0 ? null : mapThrough(pm.operation.mappings, result.inLeaf) };else return result;
}

function currentMarks(pm) {
  var head = pm.selection.head;
  return head == null ? Mark.none : pm.doc.marksAt(head);
}

var nullOptions = {};

// Operations are used to delay/batch DOM updates. When a change to
// the editor state happens, it is not immediately flushed to the DOM,
// but rather a call to `ProseMirror.flush` is scheduled using
// `requestAnimationFrame`. An object of this class is stored in the
// editor's `operation` property, and holds information about the
// state at the start of the operation, which can be used to determine
// the minimal DOM update needed. It also stores information about
// whether a focus needs to happen on flush, and whether something
// needs to be scrolled into view.

var Operation = function Operation(pm, options) {
  _classCallCheck(this, Operation);

  this.doc = pm.doc;
  this.docSet = false;
  this.sel = options && options.selection || pm.sel.range;
  this.scrollIntoView = false;
  this.focus = false;
  this.mappings = [];
  this.composing = null;
};
},{"../model":37,"../transform":46,"../util/dom":60,"../util/map":62,"./css":5,"./dompos":7,"./draw":8,"./history":9,"./input":11,"./options":14,"./range":16,"./selection":17,"./transform":18,"./update":19,"subscription":65}],14:[function(require,module,exports){
"use strict";

var _require = require("./keymap");

var baseKeymap = _require.baseKeymap;

// Object mapping option names to default values.

var options = Object.create(null);

// :: Schema #path=schema #kind=option
// The [schema](#Schema) that the editor's document should use. Will
// default to the schema of the `doc` option, if that is given.
options.schema = null;

// :: Node #path=doc #kind=option
// The starting document.
options.doc = null;

// :: ?union<DOMNode, (DOMNode)> #path=place #kind=option
// Determines the placement of the editor in the page. When `null`,
// the editor is not placed. When a DOM node is given, the editor is
// appended to that node. When a function is given, it is called
// with the editor's wrapping DOM node, and is expected to place it
// into the document.
options.place = null;

// :: number #path=historyDepth #kind=option
// The amount of history events that are collected before the oldest
// events are discarded. Defaults to 100.
options.historyDepth = 100;

// :: number #path=historyEventDelay #kind=option
// The amount of milliseconds that must pass between changes to
// start a new history event. Defaults to 500.
options.historyEventDelay = 500;

// :: number #path=scrollThreshold #kind=option
// The minimum distance to keep between the position of document
// changes and the editor bounding rectangle before scrolling the view.
// Defaults to 0.
options.scrollThreshold = 0;

// :: number #path=scrollMargin #kind=option
// Determines how far to scroll when the scroll threshold is
// surpassed. Defaults to 5.
options.scrollMargin = 5;

// :: Keymap #path=keymap #kind=option
// Sets the base keymap for the editor. Defaults to `baseKeymap`.
options.keymap = baseKeymap;

// :: ?string #path=label #kind=option
// The label of the editor. When set, the editable DOM node gets an
// `aria-label` attribute with this value.
options.label = null;

// :: ?(string) → string #path=translate #kind=option
// Optional function to translate strings such as menu labels and prompts.
// When set, should be a function that takes a string as argument and returns
// a string, i.e. :: (string) → string
options.translate = null;

// :: [Plugin] #path=plugins #kind=option
// A set of plugins to enable when the editor is initialized. Defaults
// to the empty array.
options.plugins = [];

function parseOptions(obj) {
  var result = Object.create(null);
  for (var option in options) {
    result[option] = Object.prototype.hasOwnProperty.call(obj, option) ? obj[option] : options[option];
  }return result;
}
exports.parseOptions = parseOptions;
},{"./keymap":12}],15:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var pluginProps = Object.create(null);

// Each plugin gets assigned a unique property name, so that its state
// can be stored in the editor's `plugin` object.
function registerProp() {
  var name = arguments.length <= 0 || arguments[0] === undefined ? "plugin" : arguments[0];

  for (var i = 1;; i++) {
    var prop = name + (i > 1 ? "_" + i : "");
    if (!(prop in pluginProps)) return pluginProps[prop] = prop;
  }
}

// ;; A plugin is a piece of functionality that can be attached to a
// ProseMirror instance. It may do something like show a
// [menu](#menubar) or wire in [collaborative editing](#collab). The
// plugin object is the interface to enabling and disabling the
// plugin, and for those where this is relevant, for accessing its
// state.

var Plugin = function () {
  // :: (constructor, ?Object)
  // Create a plugin object for the given state class. If desired, you
  // can pass a collection of options. When initializing the plugin,
  // it will receive the ProseMirror instance and the options as
  // arguments to its constructor.

  function Plugin(State, options, prop) {
    _classCallCheck(this, Plugin);

    this.State = State;
    this.options = options || Object.create(null);
    this.prop = prop || registerProp(State.name);
  }

  // :: (ProseMirror) → ?any
  // Return the plugin state for the given editor, if any.


  _createClass(Plugin, [{
    key: "get",
    value: function get(pm) {
      return pm.plugin[this.prop];
    }

    // :: (ProseMirror) → any
    // Initialize the plugin for the given editor. If it was already
    // enabled, this throws an error.

  }, {
    key: "attach",
    value: function attach(pm) {
      if (this.get(pm)) throw new RangeError("Attaching plugin multiple times");
      return pm.plugin[this.prop] = new this.State(pm, this.options);
    }

    // :: (ProseMirror)
    // Disable the plugin in the given editor. If the state has a
    // `detach` method, that will be called with the editor as argument,
    // to give it a chance to clean up.

  }, {
    key: "detach",
    value: function detach(pm) {
      var found = this.get(pm);
      if (found) {
        if (found.detach) found.detach(pm);
        delete pm.plugin[this.prop];
      }
    }

    // :: (ProseMirror) → any
    // Get the plugin state for an editor. Initializes the plugin if it
    // wasn't already active.

  }, {
    key: "ensure",
    value: function ensure(pm) {
      return this.get(pm) || this.attach(pm);
    }

    // :: (?Object) → Plugin
    // Configure the plugin. The given options will be combined with the
    // existing (default) options, with the newly provided ones taking
    // precedence. Returns a new plugin object with the new
    // configuration.

  }, {
    key: "config",
    value: function config(options) {
      if (!options) return this;
      var result = Object.create(null);
      for (var prop in this.options) {
        result[prop] = this.options[prop];
      }for (var _prop in options) {
        result[_prop] = options[_prop];
      }return new Plugin(this.State, result, this.prop);
    }
  }]);

  return Plugin;
}();

exports.Plugin = Plugin;
},{}],16:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// ;; A marked range as created by
// [`markRange`](#ProseMirror.markRange).

var MarkedRange = function () {
  function MarkedRange(from, to, options) {
    _classCallCheck(this, MarkedRange);

    this.options = options || {};
    // :: ?number
    // The current start position of the range. Updated whenever the
    // editor's document is changed. Set to `null` when the marked
    // range is [removed](#ProseMirror.removeRange).
    this.from = from;
    // :: ?number
    // The current end position of the range. Updated whenever the
    // editor's document is changed. Set to `null` when the marked
    // range is [removed](#ProseMirror.removeRange).
    this.to = to;
  }

  _createClass(MarkedRange, [{
    key: "remove",
    value: function remove() {
      if (this.options.onRemove) this.options.onRemove(this.from, Math.max(this.to, this.from));
      this.from = this.to = null;
    }
  }]);

  return MarkedRange;
}();

exports.MarkedRange = MarkedRange;

var RangeSorter = function () {
  function RangeSorter() {
    _classCallCheck(this, RangeSorter);

    this.sorted = [];
  }

  _createClass(RangeSorter, [{
    key: "find",
    value: function find(at) {
      var min = 0,
          max = this.sorted.length;
      for (;;) {
        if (max < min + 10) {
          for (var i = min; i < max; i++) {
            if (this.sorted[i].at >= at) return i;
          }return max;
        }
        var mid = min + max >> 1;
        if (this.sorted[mid].at > at) max = mid;else min = mid;
      }
    }
  }, {
    key: "insert",
    value: function insert(obj) {
      this.sorted.splice(this.find(obj.at), 0, obj);
    }
  }, {
    key: "remove",
    value: function remove(at, range) {
      var pos = this.find(at);
      for (var dist = 0;; dist++) {
        var leftPos = pos - dist - 1,
            rightPos = pos + dist;
        if (leftPos >= 0 && this.sorted[leftPos].range == range) {
          this.sorted.splice(leftPos, 1);
          return;
        } else if (rightPos < this.sorted.length && this.sorted[rightPos].range == range) {
          this.sorted.splice(rightPos, 1);
          return;
        }
      }
    }
  }, {
    key: "resort",
    value: function resort() {
      for (var i = 0; i < this.sorted.length; i++) {
        var cur = this.sorted[i];
        var at = cur.at = cur.type == "open" ? cur.range.from : cur.range.to;
        var pos = i;
        while (pos > 0 && this.sorted[pos - 1].at > at) {
          this.sorted[pos] = this.sorted[pos - 1];
          this.sorted[--pos] = cur;
        }
      }
    }
  }]);

  return RangeSorter;
}();

var RangeStore = function () {
  function RangeStore(pm) {
    _classCallCheck(this, RangeStore);

    this.pm = pm;
    this.ranges = [];
    this.sorted = new RangeSorter();
  }

  _createClass(RangeStore, [{
    key: "addRange",
    value: function addRange(range) {
      this.ranges.push(range);
      this.sorted.insert({ type: "open", at: range.from, range: range });
      this.sorted.insert({ type: "close", at: range.to, range: range });
      if (range.options.className) this.pm.markRangeDirty(range.from, range.to);
    }
  }, {
    key: "removeRange",
    value: function removeRange(range) {
      var found = this.ranges.indexOf(range);
      if (found > -1) {
        this.ranges.splice(found, 1);
        this.sorted.remove(range.from, range);
        this.sorted.remove(range.to, range);
        if (range.options.className) this.pm.markRangeDirty(range.from, range.to);
        range.remove();
      }
    }
  }, {
    key: "transform",
    value: function transform(mapping) {
      for (var i = 0; i < this.ranges.length; i++) {
        var range = this.ranges[i];
        range.from = mapping.map(range.from, range.options.inclusiveLeft ? -1 : 1);
        range.to = mapping.map(range.to, range.options.inclusiveRight ? 1 : -1);
        if (range.options.removeWhenEmpty !== false && range.from >= range.to) {
          this.removeRange(range);
          i--;
        } else if (range.from > range.to) {
          range.to = range.from;
        }
      }
      this.sorted.resort();
    }
  }, {
    key: "activeRangeTracker",
    value: function activeRangeTracker() {
      return new RangeTracker(this.sorted.sorted);
    }
  }]);

  return RangeStore;
}();

exports.RangeStore = RangeStore;

function significant(obj) {
  var range = obj.range;
  return range.options.className && range.from != range.to || range.options.elementBefore && obj.type == "open" || range.options.elementAfter && obj.type == "close";
}

var RangeTracker = function () {
  function RangeTracker(sorted) {
    _classCallCheck(this, RangeTracker);

    this.sorted = sorted;
    this.pos = 0;
    this.current = [];
    this.element = null;
  }

  _createClass(RangeTracker, [{
    key: "advanceTo",
    value: function advanceTo(pos) {
      var next = void 0;
      this.element = null;
      while (this.pos < this.sorted.length && (next = this.sorted[this.pos]).at <= pos) {
        if (significant(next)) {
          var className = next.range.options.className,
              element = next.range.options.elementBefore;
          if (className) {
            if (next.type == "open") this.current.push(className);else this.current.splice(this.current.indexOf(className), 1);
          }
          if (element && next.type == "open" && next.at == pos) this.element = element;
        }
        this.pos++;
      }
    }
  }, {
    key: "nextChangeBefore",
    value: function nextChangeBefore(pos) {
      for (;;) {
        if (this.pos == this.sorted.length) return -1;
        var next = this.sorted[this.pos];
        if (!significant(next)) this.pos++;else if (next.at >= pos) return -1;else return next.at;
      }
    }
  }]);

  return RangeTracker;
}();
},{}],17:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require("../util/dom");

var contains = _require.contains;

var browser = require("../util/browser");

var _require2 = require("./dompos");

var posFromDOM = _require2.posFromDOM;
var DOMAfterPos = _require2.DOMAfterPos;
var DOMFromPos = _require2.DOMFromPos;
var coordsAtPos = _require2.coordsAtPos;

// Track the state of the current editor selection. Keeps the editor
// selection in sync with the DOM selection by polling for changes,
// as there is no DOM event for DOM selection changes.

var SelectionState = function () {
  function SelectionState(pm, range) {
    var _this = this;

    _classCallCheck(this, SelectionState);

    this.pm = pm;
    // The current editor selection.
    this.range = range;

    // The timeout ID for the poller when active.
    this.polling = null;
    // Track the state of the DOM selection.
    this.lastAnchorNode = this.lastHeadNode = this.lastAnchorOffset = this.lastHeadOffset = null;
    // The corresponding DOM node when a node selection is active.
    this.lastNode = null;

    pm.content.addEventListener("focus", function () {
      return _this.receivedFocus();
    });

    this.poller = this.poller.bind(this);
  }

  // : (Selection, boolean)
  // Set the current selection and signal an event on the editor.


  _createClass(SelectionState, [{
    key: "setAndSignal",
    value: function setAndSignal(range, clearLast) {
      this.set(range, clearLast);
      this.pm.on.selectionChange.dispatch();
    }

    // : (Selection, boolean)
    // Set the current selection.

  }, {
    key: "set",
    value: function set(range, clearLast) {
      this.pm.ensureOperation({ readSelection: false, selection: range });
      this.range = range;
      if (clearLast !== false) this.lastAnchorNode = null;
    }
  }, {
    key: "poller",
    value: function poller() {
      if (hasFocus(this.pm)) {
        if (!this.pm.operation) this.readFromDOM();
        this.polling = setTimeout(this.poller, 100);
      } else {
        this.polling = null;
      }
    }
  }, {
    key: "startPolling",
    value: function startPolling() {
      clearTimeout(this.polling);
      this.polling = setTimeout(this.poller, 50);
    }
  }, {
    key: "fastPoll",
    value: function fastPoll() {
      this.startPolling();
    }
  }, {
    key: "stopPolling",
    value: function stopPolling() {
      clearTimeout(this.polling);
      this.polling = null;
    }

    // : () → bool
    // Whether the DOM selection has changed from the last known state.

  }, {
    key: "domChanged",
    value: function domChanged() {
      var sel = this.pm.root.getSelection();
      return sel.anchorNode != this.lastAnchorNode || sel.anchorOffset != this.lastAnchorOffset || sel.focusNode != this.lastHeadNode || sel.focusOffset != this.lastHeadOffset;
    }

    // Store the current state of the DOM selection.

  }, {
    key: "storeDOMState",
    value: function storeDOMState() {
      var sel = this.pm.root.getSelection();
      this.lastAnchorNode = sel.anchorNode;this.lastAnchorOffset = sel.anchorOffset;
      this.lastHeadNode = sel.focusNode;this.lastHeadOffset = sel.focusOffset;
    }

    // : () → bool
    // When the DOM selection changes in a notable manner, modify the
    // current selection state to match.

  }, {
    key: "readFromDOM",
    value: function readFromDOM() {
      if (!hasFocus(this.pm) || !this.domChanged()) return false;

      var _selectionFromDOM = selectionFromDOM(this.pm, this.range.head);

      var range = _selectionFromDOM.range;
      var adjusted = _selectionFromDOM.adjusted;

      this.setAndSignal(range);

      if (range instanceof NodeSelection || adjusted) {
        this.toDOM();
      } else {
        this.clearNode();
        this.storeDOMState();
      }
      return true;
    }
  }, {
    key: "toDOM",
    value: function toDOM(takeFocus) {
      if (!hasFocus(this.pm)) {
        if (!takeFocus) return;
        // See https://bugzilla.mozilla.org/show_bug.cgi?id=921444
        else if (browser.gecko) this.pm.content.focus();
      }
      if (this.range instanceof NodeSelection) this.nodeToDOM();else this.rangeToDOM();
    }

    // Make changes to the DOM for a node selection.

  }, {
    key: "nodeToDOM",
    value: function nodeToDOM() {
      var dom = DOMAfterPos(this.pm, this.range.from);
      if (dom != this.lastNode) {
        this.clearNode();
        dom.classList.add("ProseMirror-selectednode");
        this.pm.content.classList.add("ProseMirror-nodeselection");
        this.lastNode = dom;
      }
      var range = document.createRange(),
          sel = this.pm.root.getSelection();
      range.selectNode(dom);
      sel.removeAllRanges();
      sel.addRange(range);
      this.storeDOMState();
    }

    // Make changes to the DOM for a text selection.

  }, {
    key: "rangeToDOM",
    value: function rangeToDOM() {
      this.clearNode();

      var anchor = DOMFromPos(this.pm, this.range.anchor);
      var head = DOMFromPos(this.pm, this.range.head);

      var sel = this.pm.root.getSelection(),
          range = document.createRange();
      if (sel.extend) {
        range.setEnd(anchor.node, anchor.offset);
        range.collapse(false);
      } else {
        if (this.range.anchor > this.range.head) {
          var tmp = anchor;anchor = head;head = tmp;
        }
        range.setEnd(head.node, head.offset);
        range.setStart(anchor.node, anchor.offset);
      }
      sel.removeAllRanges();
      sel.addRange(range);
      if (sel.extend) sel.extend(head.node, head.offset);
      this.storeDOMState();
    }

    // Clear all DOM statefulness of the last node selection.

  }, {
    key: "clearNode",
    value: function clearNode() {
      if (this.lastNode) {
        this.lastNode.classList.remove("ProseMirror-selectednode");
        this.pm.content.classList.remove("ProseMirror-nodeselection");
        this.lastNode = null;
        return true;
      }
    }
  }, {
    key: "receivedFocus",
    value: function receivedFocus() {
      if (this.polling == null) this.startPolling();
    }
  }]);

  return SelectionState;
}();

exports.SelectionState = SelectionState;

// ;; An editor selection. Can be one of two selection types:
// `TextSelection` or `NodeSelection`. Both have the properties
// listed here, but also contain more information (such as the
// selected [node](#NodeSelection.node) or the
// [head](#TextSelection.head) and [anchor](#TextSelection.anchor)).

var Selection = function () {
  _createClass(Selection, [{
    key: "from",

    // :: number
    // The left bound of the selection.
    get: function get() {
      return this.$from.pos;
    }

    // :: number
    // The right bound of the selection.

  }, {
    key: "to",
    get: function get() {
      return this.$to.pos;
    }
  }]);

  function Selection($from, $to) {
    _classCallCheck(this, Selection);

    // :: ResolvedPos
    // The resolved left bound of the selection
    this.$from = $from;
    // :: ResolvedPos
    // The resolved right bound of the selection
    this.$to = $to;
  }

  // :: bool
  // True if the selection is an empty text selection (head an anchor
  // are the same).


  _createClass(Selection, [{
    key: "empty",
    get: function get() {
      return this.from == this.to;
    }

    // :: (other: Selection) → bool #path=Selection.prototype.eq
    // Test whether the selection is the same as another selection.

    // :: (doc: Node, mapping: Mappable) → Selection #path=Selection.prototype.map
    // Map this selection through a [mappable](#Mappable) thing. `doc`
    // should be the new document, to which we are mapping.

  }]);

  return Selection;
}();

exports.Selection = Selection;

// ;; A text selection represents a classical editor
// selection, with a head (the moving side) and anchor (immobile
// side), both of which point into textblock nodes. It can be empty (a
// regular cursor position).

var TextSelection = function (_Selection) {
  _inherits(TextSelection, _Selection);

  _createClass(TextSelection, [{
    key: "anchor",

    // :: number
    // The selection's immobile side (does not move when pressing
    // shift-arrow).
    get: function get() {
      return this.$anchor.pos;
    }
    // :: number
    // The selection's mobile side (the side that moves when pressing
    // shift-arrow).

  }, {
    key: "head",
    get: function get() {
      return this.$head.pos;
    }

    // :: (ResolvedPos, ?ResolvedPos)
    // Construct a text selection. When `head` is not given, it defaults
    // to `anchor`.

  }]);

  function TextSelection($anchor) {
    var $head = arguments.length <= 1 || arguments[1] === undefined ? $anchor : arguments[1];

    _classCallCheck(this, TextSelection);

    var inv = $anchor.pos > $head.pos;

    // :: ResolvedPos The resolved anchor of the selection.

    var _this2 = _possibleConstructorReturn(this, Object.getPrototypeOf(TextSelection).call(this, inv ? $head : $anchor, inv ? $anchor : $head));

    _this2.$anchor = $anchor;
    // :: ResolvedPos The resolved head of the selection.
    _this2.$head = $head;
    return _this2;
  }

  _createClass(TextSelection, [{
    key: "eq",
    value: function eq(other) {
      return other instanceof TextSelection && other.head == this.head && other.anchor == this.anchor;
    }
  }, {
    key: "map",
    value: function map(doc, mapping) {
      var $head = doc.resolve(mapping.map(this.head));
      if (!$head.parent.isTextblock) return findSelectionNear($head);
      var $anchor = doc.resolve(mapping.map(this.anchor));
      return new TextSelection($anchor.parent.isTextblock ? $anchor : $head, $head);
    }
  }, {
    key: "inverted",
    get: function get() {
      return this.anchor > this.head;
    }
  }, {
    key: "token",
    get: function get() {
      return new SelectionToken(TextSelection, this.anchor, this.head);
    }
  }], [{
    key: "mapToken",
    value: function mapToken(token, mapping) {
      return new SelectionToken(TextSelection, mapping.map(token.a), mapping.map(token.b));
    }
  }, {
    key: "fromToken",
    value: function fromToken(token, doc) {
      var $head = doc.resolve(token.b);
      if (!$head.parent.isTextblock) return findSelectionNear($head);
      var $anchor = doc.resolve(token.a);
      return new TextSelection($anchor.parent.isTextblock ? $anchor : $head, $head);
    }
  }]);

  return TextSelection;
}(Selection);

exports.TextSelection = TextSelection;

// ;; A node selection is a selection that points at a
// single node. All nodes marked [selectable](#NodeType.selectable)
// can be the target of a node selection. In such an object, `from`
// and `to` point directly before and after the selected node.

var NodeSelection = function (_Selection2) {
  _inherits(NodeSelection, _Selection2);

  // :: (ResolvedPos)
  // Create a node selection. Does not verify the validity of its
  // argument. Use `ProseMirror.setNodeSelection` for an easier,
  // error-checking way to create a node selection.

  function NodeSelection($from) {
    _classCallCheck(this, NodeSelection);

    var $to = $from.plusOne();

    // :: Node The selected node.

    var _this3 = _possibleConstructorReturn(this, Object.getPrototypeOf(NodeSelection).call(this, $from, $to));

    _this3.node = $from.nodeAfter;
    return _this3;
  }

  _createClass(NodeSelection, [{
    key: "eq",
    value: function eq(other) {
      return other instanceof NodeSelection && this.from == other.from;
    }
  }, {
    key: "map",
    value: function map(doc, mapping) {
      var $from = doc.resolve(mapping.map(this.from, 1));
      var to = mapping.map(this.to, -1);
      var node = $from.nodeAfter;
      if (node && to == $from.pos + node.nodeSize && node.type.selectable) return new NodeSelection($from);
      return findSelectionNear($from);
    }
  }, {
    key: "token",
    get: function get() {
      return new SelectionToken(NodeSelection, this.from, this.to);
    }
  }], [{
    key: "mapToken",
    value: function mapToken(token, mapping) {
      return new SelectionToken(NodeSelection, mapping.map(token.a, 1), mapping.map(token.b, -1));
    }
  }, {
    key: "fromToken",
    value: function fromToken(token, doc) {
      var $from = doc.resolve(token.a),
          node = $from.nodeAfter;
      if (node && token.b == token.a + node.nodeSize && node.type.selectable) return new NodeSelection($from);
      return findSelectionNear($from);
    }
  }]);

  return NodeSelection;
}(Selection);

exports.NodeSelection = NodeSelection;

var SelectionToken = function SelectionToken(type, a, b) {
  _classCallCheck(this, SelectionToken);

  this.type = type;
  this.a = a;
  this.b = b;
};

function isCollapsed(sel) {
  // Selection.isCollapsed is broken in Chrome 52.
  // See https://bugs.chromium.org/p/chromium/issues/detail?id=447523
  return sel.focusNode === sel.anchorNode && sel.focusOffset === sel.anchorOffset;
}
exports.isCollapsed = isCollapsed;

function selectionFromDOM(pm, oldHead) {
  var sel = pm.root.getSelection();
  var doc = pm.doc;

  var _posFromDOM = posFromDOM(sel.focusNode, sel.focusOffset);

  var head = _posFromDOM.pos;
  var headLeaf = _posFromDOM.inLeaf;

  if (headLeaf > -1 && isCollapsed(sel)) {
    var $leaf = doc.resolve(headLeaf),
        node = $leaf.nodeAfter;
    if (node.type.selectable && !node.type.isInline) return { range: new NodeSelection($leaf), adjusted: true };
  }
  var anchor = isCollapsed(sel) ? head : posFromDOM(sel.anchorNode, sel.anchorOffset).pos;

  var range = findSelectionNear(doc.resolve(head), oldHead != null && oldHead < head ? 1 : -1);
  if (range instanceof TextSelection) {
    var selNearAnchor = findSelectionNear(doc.resolve(anchor), anchor > range.to ? -1 : 1, true);
    range = new TextSelection(selNearAnchor.$anchor, range.$head);
  } else if (anchor < range.from || anchor > range.to) {
    // If head falls on a node, but anchor falls outside of it,
    // create a text selection between them
    var inv = anchor > range.to;
    range = new TextSelection(findSelectionNear(doc.resolve(anchor), inv ? -1 : 1, true).$anchor, findSelectionNear(inv ? range.$from : range.$to, inv ? 1 : -1, true).$head);
  }
  return { range: range, adjusted: head != range.head || anchor != range.anchor };
}

function hasFocus(pm) {
  if (pm.root.activeElement != pm.content) return false;
  var sel = pm.root.getSelection();
  return sel.rangeCount && contains(pm.content, sel.anchorNode);
}
exports.hasFocus = hasFocus;

// Try to find a selection inside the given node. `pos` points at the
// position where the search starts. When `text` is true, only return
// text selections.
function findSelectionIn(doc, node, pos, index, dir, text) {
  if (node.isTextblock) return new TextSelection(doc.resolve(pos));
  for (var i = index - (dir > 0 ? 0 : 1); dir > 0 ? i < node.childCount : i >= 0; i += dir) {
    var child = node.child(i);
    if (!child.type.isLeaf) {
      var inner = findSelectionIn(doc, child, pos + dir, dir < 0 ? child.childCount : 0, dir, text);
      if (inner) return inner;
    } else if (!text && child.type.selectable) {
      return new NodeSelection(doc.resolve(pos - (dir < 0 ? child.nodeSize : 0)));
    }
    pos += child.nodeSize * dir;
  }
}

// FIXME we'll need some awareness of text direction when scanning for selections

// Create a selection which is moved relative to a position in a
// given direction. When a selection isn't found at the given position,
// walks up the document tree one level and one step in the
// desired direction.
function findSelectionFrom($pos, dir, text) {
  var inner = $pos.parent.isTextblock ? new TextSelection($pos) : findSelectionIn($pos.node(0), $pos.parent, $pos.pos, $pos.index(), dir, text);
  if (inner) return inner;

  for (var depth = $pos.depth - 1; depth >= 0; depth--) {
    var found = dir < 0 ? findSelectionIn($pos.node(0), $pos.node(depth), $pos.before(depth + 1), $pos.index(depth), dir, text) : findSelectionIn($pos.node(0), $pos.node(depth), $pos.after(depth + 1), $pos.index(depth) + 1, dir, text);
    if (found) return found;
  }
}
exports.findSelectionFrom = findSelectionFrom;

function findSelectionNear($pos) {
  var bias = arguments.length <= 1 || arguments[1] === undefined ? 1 : arguments[1];
  var text = arguments[2];

  var result = findSelectionFrom($pos, bias, text) || findSelectionFrom($pos, -bias, text);
  if (!result) throw new RangeError("Searching for selection in invalid document " + $pos.node(0));
  return result;
}
exports.findSelectionNear = findSelectionNear;

// Find the selection closest to the start of the given node. `pos`,
// if given, should point at the start of the node's content.
function findSelectionAtStart(doc, text) {
  return findSelectionIn(doc, doc, 0, 0, 1, text);
}
exports.findSelectionAtStart = findSelectionAtStart;

// Find the selection closest to the end of the given node.
function findSelectionAtEnd(doc, text) {
  return findSelectionIn(doc, doc, doc.content.size, doc.childCount, -1, text);
}
exports.findSelectionAtEnd = findSelectionAtEnd;

// : (ProseMirror, number, number)
// Whether vertical position motion in a given direction
// from a position would leave a text block.
function verticalMotionLeavesTextblock(pm, $pos, dir) {
  var dom = $pos.depth ? DOMAfterPos(pm, $pos.before()) : pm.content;
  var coords = coordsAtPos(pm, $pos.pos);
  for (var child = dom.firstChild; child; child = child.nextSibling) {
    if (child.nodeType != 1) continue;
    var boxes = child.getClientRects();
    for (var i = 0; i < boxes.length; i++) {
      var box = boxes[i];
      if (dir < 0 ? box.bottom < coords.top : box.top > coords.bottom) return false;
    }
  }
  return true;
}
exports.verticalMotionLeavesTextblock = verticalMotionLeavesTextblock;
},{"../util/browser":58,"../util/dom":60,"./dompos":7}],18:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require("../model");

var Fragment = _require.Fragment;

var _require2 = require("../transform");

var Transform = _require2.Transform;
var insertPoint = _require2.insertPoint;

var _require3 = require("./selection");

var findSelectionNear = _require3.findSelectionNear;


var _applyAndScroll = { scrollIntoView: true };

// ;; A selection-aware extension of `Transform`. Use
// `ProseMirror.tr` to create an instance.

var EditorTransform = function (_Transform) {
  _inherits(EditorTransform, _Transform);

  function EditorTransform(pm) {
    _classCallCheck(this, EditorTransform);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(EditorTransform).call(this, pm.doc));

    _this.pm = pm;
    _this.curSelection = pm.selection;
    _this.curSelectionAt = 0;
    return _this;
  }

  // :: (?Object) → EditorTransform
  // Apply the transformation. Returns the transform, or `false` it is
  // was empty.


  _createClass(EditorTransform, [{
    key: "apply",
    value: function apply(options) {
      return this.pm.apply(this, options);
    }

    // :: () → EditorTransform
    // Apply this transform with a `{scrollIntoView: true}` option.

  }, {
    key: "applyAndScroll",
    value: function applyAndScroll() {
      return this.pm.apply(this, _applyAndScroll);
    }

    // :: Selection
    // The transform's current selection. This defaults to the
    // editor selection [mapped](#Selection.map) through the steps in
    // this transform, but can be overwritten with
    // [`setSelection`](#EditorTransform.setSelection).

  }, {
    key: "setSelection",


    // :: (Selection) → EditorTransform
    // Update the transform's current selection. This will determine the
    // selection that the editor gets when the transform is applied.
    value: function setSelection(selection) {
      this.curSelection = selection;
      this.curSelectionAt = this.steps.length;
      return this;
    }

    // :: (?Node, ?bool) → EditorTransform
    // Replace the selection with the given node, or delete it if `node`
    // is null. When `inheritMarks` is true and the node is an inline
    // node, it inherits the marks from the place where it is inserted.

  }, {
    key: "replaceSelection",
    value: function replaceSelection(node, inheritMarks) {
      var _selection = this.selection;
      var empty = _selection.empty;
      var $from = _selection.$from;
      var $to = _selection.$to;
      var from = _selection.from;
      var to = _selection.to;
      var selNode = _selection.node;


      if (node && node.isInline && inheritMarks !== false) node = node.mark(empty ? this.pm.input.storedMarks : this.doc.marksAt(from));
      var fragment = Fragment.from(node);

      if (selNode && selNode.isTextblock && node && node.isInline) {
        // Putting inline stuff onto a selected textblock puts it
        // inside, so cut off the sides
        from++;
        to--;
      } else if (selNode) {
        var depth = $from.depth;
        // This node can not simply be removed/replaced. Remove its parent as well
        while (depth && $from.node(depth).childCount == 1 && !$from.node(depth).canReplace($from.index(depth), $to.indexAfter(depth), fragment)) {
          depth--;
        }
        if (depth < $from.depth) {
          from = $from.before(depth + 1);
          to = $from.after(depth + 1);
        }
      } else if (node && from == to) {
        var point = insertPoint(this.doc, from, node.type, node.attrs);
        if (point != null) from = to = point;
      }

      this.replaceWith(from, to, fragment);
      var map = this.maps[this.maps.length - 1];
      this.setSelection(findSelectionNear(this.doc.resolve(map.map(to))));
      return this;
    }

    // :: () → EditorTransform
    // Delete the selection.

  }, {
    key: "deleteSelection",
    value: function deleteSelection() {
      return this.replaceSelection();
    }

    // :: (string) → EditorTransform
    // Replace the selection with a text node containing the given string.

  }, {
    key: "typeText",
    value: function typeText(text) {
      return this.replaceSelection(this.pm.schema.text(text), true);
    }
  }, {
    key: "selection",
    get: function get() {
      if (this.curSelectionAt < this.steps.length) {
        if (this.curSelectionAt) {
          for (var i = this.curSelectionAt; i < this.steps.length; i++) {
            this.curSelection = this.curSelection.map(i == this.steps.length - 1 ? this.doc : this.docs[i + 1], this.maps[i]);
          }
        } else {
          this.curSelection = this.curSelection.map(this.doc, this);
        }
        this.curSelectionAt = this.steps.length;
      }
      return this.curSelection;
    }
  }]);

  return EditorTransform;
}(Transform);

exports.EditorTransform = EditorTransform;
},{"../model":37,"../transform":46,"./selection":17}],19:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var UPDATE_TIMEOUT = 50;
var MIN_FLUSH_DELAY = 100;

var EditorScheduler = function () {
  function EditorScheduler(pm) {
    var _this = this;

    _classCallCheck(this, EditorScheduler);

    this.waiting = [];
    this.timeout = null;
    this.lastForce = 0;
    this.pm = pm;
    this.timedOut = function () {
      if (_this.pm.operation) _this.timeout = setTimeout(_this.timedOut, UPDATE_TIMEOUT);else _this.force();
    };
    pm.on.flush.add(this.onFlush.bind(this));
  }

  _createClass(EditorScheduler, [{
    key: "set",
    value: function set(f) {
      if (this.waiting.length == 0) this.timeout = setTimeout(this.timedOut, UPDATE_TIMEOUT);
      if (this.waiting.indexOf(f) == -1) this.waiting.push(f);
    }
  }, {
    key: "unset",
    value: function unset(f) {
      var index = this.waiting.indexOf(f);
      if (index > -1) this.waiting.splice(index, 1);
    }
  }, {
    key: "force",
    value: function force() {
      clearTimeout(this.timeout);
      this.lastForce = Date.now();

      while (this.waiting.length) {
        for (var i = 0; i < this.waiting.length; i++) {
          var result = this.waiting[i]();
          if (result) this.waiting[i] = result;else this.waiting.splice(i--, 1);
        }
      }
    }
  }, {
    key: "onFlush",
    value: function onFlush() {
      if (this.waiting.length && Date.now() - this.lastForce > MIN_FLUSH_DELAY) this.force();
    }
  }]);

  return EditorScheduler;
}();

exports.EditorScheduler = EditorScheduler;

// ;; Helper for scheduling updates whenever any of a series of events
// happen. Created with the
// [`updateScheduler`](#ProseMirror.updateScheduler) method.

var UpdateScheduler = function () {
  function UpdateScheduler(pm, subscriptions, start) {
    var _this2 = this;

    _classCallCheck(this, UpdateScheduler);

    this.pm = pm;
    this.start = start;

    this.subscriptions = subscriptions;
    this.onEvent = this.onEvent.bind(this);
    this.subscriptions.forEach(function (sub) {
      return sub.add(_this2.onEvent);
    });
  }

  // :: ()
  // Detach the event handlers registered by this scheduler.


  _createClass(UpdateScheduler, [{
    key: "detach",
    value: function detach() {
      var _this3 = this;

      this.pm.unscheduleDOMUpdate(this.start);
      this.subscriptions.forEach(function (sub) {
        return sub.remove(_this3.onEvent);
      });
    }
  }, {
    key: "onEvent",
    value: function onEvent() {
      this.pm.scheduleDOMUpdate(this.start);
    }

    // :: ()
    // Force an update. Note that if the editor has scheduled a flush,
    // the update is still delayed until the flush occurs.

  }, {
    key: "force",
    value: function force() {
      if (this.pm.operation) {
        this.onEvent();
      } else {
        this.pm.unscheduleDOMUpdate(this.start);
        for (var run = this.start; run; run = run()) {}
      }
    }
  }]);

  return UpdateScheduler;
}();

exports.UpdateScheduler = UpdateScheduler;
},{}],20:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require("../inputrules");

var blockQuoteRule = _require.blockQuoteRule;
var orderedListRule = _require.orderedListRule;
var bulletListRule = _require.bulletListRule;
var codeBlockRule = _require.codeBlockRule;
var headingRule = _require.headingRule;
var inputRules = _require.inputRules;
var allInputRules = _require.allInputRules;

var _require2 = require("../schema-basic");

var BlockQuote = _require2.BlockQuote;
var OrderedList = _require2.OrderedList;
var BulletList = _require2.BulletList;
var CodeBlock = _require2.CodeBlock;
var Heading = _require2.Heading;

var _require3 = require("../edit");

var Plugin = _require3.Plugin;

var _require4 = require("../menu");

var menuBar = _require4.menuBar;
var tooltipMenu = _require4.tooltipMenu;

var _require5 = require("./style");

var className = _require5.className;

var _require6 = require("./menu");

var buildMenuItems = _require6.buildMenuItems;

exports.buildMenuItems = buildMenuItems;

var _require7 = require("./keymap");

var buildKeymap = _require7.buildKeymap;

exports.buildKeymap = buildKeymap;

// !! This module exports helper functions for deriving a set of basic
// menu items, input rules, or key bindings from a schema. These
// values need to know about the schema for two reasons—they need
// access to specific instances of node and mark types, and they need
// to know which of the node and mark types that they know about are
// actually present in the schema.
//
// The `exampleSetup` plugin ties these together into a plugin that
// will automatically enable this basic functionality in an editor.

// :: Plugin
// A convenience plugin that bundles together a simple menu with basic
// key bindings, input rules, and styling for the example schema.
// Probably only useful for quickly setting up a passable
// editor—you'll need more control over your settings in most
// real-world situations. The following options are recognized:
//
// **`menuBar`**`: union<bool, Object> = true`
//   : Enable or configure the menu bar. `false` turns it off, `true`
//     enables it with the default options, and passing an object will
//     pass that value on as the options for the menu bar.
//
// **`tooltipMenu`**`: union<bool, Object> = false`
//   : Enable or configure the tooltip menu. Interpreted the same way
//     as `menuBar`.
//
// **`mapKeys`**: ?Object = null`
//   : Can be used to [adjust](#buildKeymap) the key bindings created.
exports.exampleSetup = new Plugin(function () {
  function _class(pm, options) {
    _classCallCheck(this, _class);

    pm.wrapper.classList.add(className);
    this.keymap = buildKeymap(pm.schema, options.mapKeys);
    pm.addKeymap(this.keymap);
    this.inputRules = allInputRules.concat(buildInputRules(pm.schema));
    var rules = inputRules.ensure(pm);
    this.inputRules.forEach(function (rule) {
      return rules.addRule(rule);
    });

    var builtMenu = void 0;
    this.barConf = options.menuBar;
    this.tooltipConf = options.tooltipMenu;

    if (this.barConf === true) {
      builtMenu = buildMenuItems(pm.schema);
      this.barConf = { float: true, content: builtMenu.fullMenu };
    }
    if (this.barConf) menuBar.config(this.barConf).attach(pm);

    if (this.tooltipConf === true) {
      if (!builtMenu) builtMenu = buildMenuItems(pm.schema);
      this.tooltipConf = { selectedBlockMenu: true,
        inlineContent: builtMenu.inlineMenu,
        blockContent: builtMenu.blockMenu };
    }
    if (this.tooltipConf) tooltipMenu.config(this.tooltipConf).attach(pm);
  }

  _createClass(_class, [{
    key: "detach",
    value: function detach(pm) {
      pm.wrapper.classList.remove(className);
      pm.removeKeymap(this.keymap);
      var rules = inputRules.ensure(pm);
      this.inputRules.forEach(function (rule) {
        return rules.removeRule(rule);
      });
      if (this.barConf) menuBar.detach(pm);
      if (this.tooltipConf) tooltipMenu.detach(pm);
    }
  }]);

  return _class;
}(), {
  menuBar: true,
  tooltipMenu: false,
  mapKeys: null
});

// :: (Schema) → [InputRule]
// A set of input rules for creating the basic block quotes, lists,
// code blocks, and heading.
function buildInputRules(schema) {
  var result = [];
  for (var name in schema.nodes) {
    var node = schema.nodes[name];
    if (node instanceof BlockQuote) result.push(blockQuoteRule(node));
    if (node instanceof OrderedList) result.push(orderedListRule(node));
    if (node instanceof BulletList) result.push(bulletListRule(node));
    if (node instanceof CodeBlock) result.push(codeBlockRule(node));
    if (node instanceof Heading) result.push(headingRule(node, 6));
  }
  return result;
}
exports.buildInputRules = buildInputRules;
},{"../edit":10,"../inputrules":24,"../menu":29,"../schema-basic":44,"./keymap":21,"./menu":22,"./style":23}],21:[function(require,module,exports){
"use strict";

var Keymap = require("browserkeymap");

var _require = require("../schema-basic");

var HardBreak = _require.HardBreak;
var BulletList = _require.BulletList;
var OrderedList = _require.OrderedList;
var ListItem = _require.ListItem;
var BlockQuote = _require.BlockQuote;
var HorizontalRule = _require.HorizontalRule;
var Paragraph = _require.Paragraph;
var CodeBlock = _require.CodeBlock;
var Heading = _require.Heading;
var StrongMark = _require.StrongMark;
var EmMark = _require.EmMark;
var CodeMark = _require.CodeMark;

var browser = require("../util/browser");

var _require$commands = require("../edit").commands;

var wrapIn = _require$commands.wrapIn;
var setBlockType = _require$commands.setBlockType;
var wrapInList = _require$commands.wrapInList;
var splitListItem = _require$commands.splitListItem;
var liftListItem = _require$commands.liftListItem;
var sinkListItem = _require$commands.sinkListItem;
var chainCommands = _require$commands.chainCommands;
var newlineInCode = _require$commands.newlineInCode;
var toggleMark = _require$commands.toggleMark;

// :: (Schema, ?Object) → Keymap
// Inspect the given schema looking for marks and nodes from the
// basic schema, and if found, add key bindings related to them.
// This will add:
//
// * **Mod-B** for toggling [strong](#StrongMark)
// * **Mod-I** for toggling [emphasis](#EmMark)
// * **Mod-\`** for toggling [code font](#CodeMark)
// * **Ctrl-Shift-0** for making the current textblock a paragraph
// * **Ctrl-Shift-1** to **Ctrl-Shift-6** for making the current
//   textblock a heading of the corresponding level
// * **Ctrl-Shift-\\** to make the current textblock a code block
// * **Ctrl-Shift-8** to wrap the selection in an ordered list
// * **Ctrl-Shift-9** to wrap the selection in a bullet list
// * **Ctrl-Shift-.** to wrap the selection in a block quote
// * **Enter** to split a non-empty textblock in a list item while at
//   the same time splitting the list item
// * **Mod-Enter** to insert a hard break
// * **Mod-Shift-minus** to insert a horizontal rule
//
// You can suppress or map these bindings by passing a `mapKeys`
// argument, which maps key names (say `"Mod-B"` to either `false`, to
// remove the binding, or a new key name string.

function buildKeymap(schema, mapKeys) {
  var keys = {};
  function bind(key, cmd) {
    if (mapKeys) {
      var mapped = mapKeys[key];
      if (mapped === false) return;
      if (mapped) key = mapped;
    }
    keys[key] = cmd;
  }

  for (var name in schema.marks) {
    var mark = schema.marks[name];
    if (mark instanceof StrongMark) bind("Mod-B", toggleMark(mark));
    if (mark instanceof EmMark) bind("Mod-I", toggleMark(mark));
    if (mark instanceof CodeMark) bind("Mod-`", toggleMark(mark));
  }

  var _loop = function _loop(_name) {
    var node = schema.nodes[_name];
    if (node instanceof BulletList) bind("Shift-Ctrl-8", wrapInList(node));
    if (node instanceof OrderedList) bind("Shift-Ctrl-9", wrapInList(node));
    if (node instanceof BlockQuote) bind("Shift-Ctrl-.", wrapIn(node));
    if (node instanceof HardBreak) {
      var cmd = chainCommands(newlineInCode, function (pm) {
        return pm.tr.replaceSelection(node.create()).applyAndScroll();
      });
      bind("Mod-Enter", cmd);
      bind("Shift-Enter", cmd);
      if (browser.mac) bind("Ctrl-Enter", cmd);
    }
    if (node instanceof ListItem) {
      bind("Enter", splitListItem(node));
      bind("Mod-[", liftListItem(node));
      bind("Mod-]", sinkListItem(node));
    }
    if (node instanceof Paragraph) bind("Shift-Ctrl-0", setBlockType(node));
    if (node instanceof CodeBlock) bind("Shift-Ctrl-\\", setBlockType(node));
    if (node instanceof Heading) for (var i = 1; i <= 6; i++) {
      bind("Shift-Ctrl-" + i, setBlockType(node, { level: i }));
    }if (node instanceof HorizontalRule) bind("Mod-Shift--", function (pm) {
      return pm.tr.replaceSelection(node.create()).applyAndScroll();
    });
  };

  for (var _name in schema.nodes) {
    _loop(_name);
  }
  return new Keymap(keys);
}
exports.buildKeymap = buildKeymap;
},{"../edit":10,"../schema-basic":44,"../util/browser":58,"browserkeymap":1}],22:[function(require,module,exports){
"use strict";

var _require = require("../schema-basic");

var StrongMark = _require.StrongMark;
var EmMark = _require.EmMark;
var CodeMark = _require.CodeMark;
var LinkMark = _require.LinkMark;
var Image = _require.Image;
var BulletList = _require.BulletList;
var OrderedList = _require.OrderedList;
var BlockQuote = _require.BlockQuote;
var Heading = _require.Heading;
var Paragraph = _require.Paragraph;
var CodeBlock = _require.CodeBlock;
var HorizontalRule = _require.HorizontalRule;

var _require2 = require("../menu");

var toggleMarkItem = _require2.toggleMarkItem;
var insertItem = _require2.insertItem;
var wrapItem = _require2.wrapItem;
var blockTypeItem = _require2.blockTypeItem;
var Dropdown = _require2.Dropdown;
var DropdownSubmenu = _require2.DropdownSubmenu;
var joinUpItem = _require2.joinUpItem;
var liftItem = _require2.liftItem;
var selectParentNodeItem = _require2.selectParentNodeItem;
var undoItem = _require2.undoItem;
var redoItem = _require2.redoItem;
var wrapListItem = _require2.wrapListItem;
var icons = _require2.icons;
var MenuItem = _require2.MenuItem;

var _require3 = require("../schema-table");

var Table = _require3.Table;
var TableRow = _require3.TableRow;
var createTable = _require3.createTable;
var addColumnBefore = _require3.addColumnBefore;
var addColumnAfter = _require3.addColumnAfter;
var removeColumn = _require3.removeColumn;
var addRowBefore = _require3.addRowBefore;
var addRowAfter = _require3.addRowAfter;
var removeRow = _require3.removeRow;

var _require4 = require("../ui");

var FieldPrompt = _require4.FieldPrompt;
var TextField = _require4.TextField;

// Helpers to create specific types of items

// : (ProseMirror, (attrs: ?Object))
// A function that will prompt for the attributes of a [link
// mark](#LinkMark) (using `FieldPrompt`), and call a callback with
// the result.

function promptLinkAttrs(pm, callback) {
  new FieldPrompt(pm, "Create a link", {
    href: new TextField({
      label: "Link target",
      required: true,
      clean: function clean(val) {
        if (!/^https?:\/\//i.test(val)) val = 'http://' + val;
        return val;
      }
    }),
    title: new TextField({ label: "Title" })
  }).open(callback);
}

// : (ProseMirror, (attrs: ?Object))
// A function that will prompt for the attributes of an [image
// node](#Image) (using `FieldPrompt`), and call a callback with the
// result.
function promptImageAttrs(pm, callback, nodeType) {
  var _pm$selection = pm.selection;
  var node = _pm$selection.node;
  var from = _pm$selection.from;
  var to = _pm$selection.to;var attrs = nodeType && node && node.type == nodeType && node.attrs;
  new FieldPrompt(pm, "Insert image", {
    src: new TextField({ label: "Location", required: true, value: attrs && attrs.src }),
    title: new TextField({ label: "Title", value: attrs && attrs.title }),
    alt: new TextField({ label: "Description",
      value: attrs ? attrs.title : pm.doc.textBetween(from, to, " ") })
  }).open(callback);
}

function positiveInteger(value) {
  if (!/^[1-9]\d*$/.test(value)) return "Should be a positive integer";
}

function promptTableSize(pm, callback) {
  new FieldPrompt(pm, "Insert table", {
    rows: new TextField({ label: "Rows", validate: positiveInteger }),
    cols: new TextField({ label: "Columns", validate: positiveInteger })
  }).open(callback);
}

function insertTableItem(tableType) {
  return new MenuItem({
    title: "Insert a table",
    run: function run(pm) {
      promptTableSize(pm, function (_ref) {
        var rows = _ref.rows;
        var cols = _ref.cols;

        pm.tr.replaceSelection(createTable(tableType, +rows, +cols)).applyAndScroll();
      });
    },
    select: function select(pm) {
      var $from = pm.selection.$from;
      for (var d = $from.depth; d >= 0; d--) {
        var index = $from.index(d);
        if ($from.node(d).canReplaceWith(index, index, tableType)) return true;
      }
      return false;
    },

    label: "Table"
  });
}

function simpleItem(label, cmd) {
  return new MenuItem({
    title: label,
    label: label,
    run: cmd,
    select: function select(pm) {
      return cmd(pm, false);
    }
  });
}

// :: (Schema) → Object
// Given a schema, look for default mark and node types in it and
// return an object with relevant menu items relating to those marks:
//
// **`toggleStrong`**`: MenuItem`
//   : A menu item to toggle the [strong mark](#StrongMark).
//
// **`toggleEm`**`: MenuItem`
//   : A menu item to toggle the [emphasis mark](#EmMark).
//
// **`toggleCode`**`: MenuItem`
//   : A menu item to toggle the [code font mark](#CodeMark).
//
// **`toggleLink`**`: MenuItem`
//   : A menu item to toggle the [link mark](#LinkMark).
//
// **`insertImage`**`: MenuItem`
//   : A menu item to insert an [image](#Image).
//
// **`wrapBulletList`**`: MenuItem`
//   : A menu item to wrap the selection in a [bullet list](#BulletList).
//
// **`wrapOrderedList`**`: MenuItem`
//   : A menu item to wrap the selection in an [ordered list](#OrderedList).
//
// **`wrapBlockQuote`**`: MenuItem`
//   : A menu item to wrap the selection in a [block quote](#BlockQuote).
//
// **`makeParagraph`**`: MenuItem`
//   : A menu item to set the current textblock to be a normal
//     [paragraph](#Paragraph).
//
// **`makeCodeBlock`**`: MenuItem`
//   : A menu item to set the current textblock to be a
//     [code block](#CodeBlock).
//
// **`insertTable`**`: MenuItem`
//   : An item to insert a [table](#schema-table).
//
// **`addRowBefore`**, **`addRowAfter`**, **`removeRow`**, **`addColumnBefore`**, **`addColumnAfter`**, **`removeColumn`**`: MenuItem`
//   : Table-manipulation items.
//
// **`makeHead[N]`**`: MenuItem`
//   : Where _N_ is 1 to 6. Menu items to set the current textblock to
//     be a [heading](#Heading) of level _N_.
//
// **`insertHorizontalRule`**`: MenuItem`
//   : A menu item to insert a horizontal rule.
//
// The return value also contains some prefabricated menu elements and
// menus, that you can use instead of composing your own menu from
// scratch:
//
// **`insertMenu`**`: Dropdown`
//   : A dropdown containing the `insertImage` and
//     `insertHorizontalRule` items.
//
// **`typeMenu`**`: Dropdown`
//   : A dropdown containing the items for making the current
//     textblock a paragraph, code block, or heading.
//
// **`inlineMenu`**`: [[MenuElement]]`
//   : An array of arrays of menu elements for use as the inline menu
//     to, for example, a [tooltip menu](#menu/tooltipmenu).
//
// **`blockMenu`**`: [[MenuElement]]`
//   : An array of arrays of menu elements for use as the block menu
//     to, for example, a [tooltip menu](#menu/tooltipmenu).
//
// **`fullMenu`**`: [[MenuElement]]`
//   : An array of arrays of menu elements for use as the full menu
//     for, for example the [menu bar](#menuBar).
function buildMenuItems(schema) {
  var r = {};
  for (var name in schema.marks) {
    var mark = schema.marks[name];
    if (mark instanceof StrongMark) r.toggleStrong = toggleMarkItem(mark, { title: "Toggle strong style", icon: icons.strong });
    if (mark instanceof EmMark) r.toggleEm = toggleMarkItem(mark, { title: "Toggle emphasis", icon: icons.em });
    if (mark instanceof CodeMark) r.toggleCode = toggleMarkItem(mark, { title: "Toggle code font", icon: icons.code });
    if (mark instanceof LinkMark) r.toggleLink = toggleMarkItem(mark, { title: "Add or remove link", icon: icons.link, attrs: promptLinkAttrs });
  }

  var _loop = function _loop(_name) {
    var node = schema.nodes[_name];
    if (node instanceof Image) r.insertImage = insertItem(node, {
      title: "Insert image",
      label: "Image",
      attrs: function attrs(pm, c) {
        return promptImageAttrs(pm, c, node);
      }
    });
    if (node instanceof BulletList) r.wrapBulletList = wrapListItem(node, {
      title: "Wrap in bullet list",
      icon: icons.bulletList
    });
    if (node instanceof OrderedList) r.wrapOrderedList = wrapListItem(node, {
      title: "Wrap in ordered list",
      icon: icons.orderedList
    });
    if (node instanceof BlockQuote) r.wrapBlockQuote = wrapItem(node, {
      title: "Wrap in block quote",
      icon: icons.blockquote
    });
    if (node instanceof Paragraph) r.makeParagraph = blockTypeItem(node, {
      title: "Change to paragraph",
      label: "Plain"
    });
    if (node instanceof CodeBlock) r.makeCodeBlock = blockTypeItem(node, {
      title: "Change to code block",
      label: "Code"
    });
    if (node instanceof Heading) for (var i = 1; i <= 10; i++) {
      r["makeHead" + i] = blockTypeItem(node, {
        title: "Change to heading " + i,
        label: "Level " + i,
        attrs: { level: i }
      });
    }if (node instanceof HorizontalRule) r.insertHorizontalRule = insertItem(node, {
      title: "Insert horizontal rule",
      label: "Horizontal rule"
    });
    if (node instanceof Table) r.insertTable = insertTableItem(node);
    if (node instanceof TableRow) {
      r.addRowBefore = simpleItem("Add row before", addRowBefore);
      r.addRowAfter = simpleItem("Add row after", addRowAfter);
      r.removeRow = simpleItem("Remove row", removeRow);
      r.addColumnBefore = simpleItem("Add column before", addColumnBefore);
      r.addColumnAfter = simpleItem("Add column after", addColumnAfter);
      r.removeColumn = simpleItem("Remove column", removeColumn);
    }
  };

  for (var _name in schema.nodes) {
    _loop(_name);
  }

  var cut = function cut(arr) {
    return arr.filter(function (x) {
      return x;
    });
  };
  r.insertMenu = new Dropdown(cut([r.insertImage, r.insertHorizontalRule, r.insertTable]), { label: "Insert" });
  r.typeMenu = new Dropdown(cut([r.makeParagraph, r.makeCodeBlock, r.makeHead1 && new DropdownSubmenu(cut([r.makeHead1, r.makeHead2, r.makeHead3, r.makeHead4, r.makeHead5, r.makeHead6]), { label: "Heading" })]), { label: "Type..." });
  var tableItems = cut([r.addRowBefore, r.addRowAfter, r.removeRow, r.addColumnBefore, r.addColumnAfter, r.removeColumn]);
  if (tableItems.length) r.tableMenu = new Dropdown(tableItems, { label: "Table" });

  r.inlineMenu = [cut([r.toggleStrong, r.toggleEm, r.toggleCode, r.toggleLink]), [r.insertMenu]];
  r.blockMenu = [cut([r.typeMenu, r.tableMenu, r.wrapBulletList, r.wrapOrderedList, r.wrapBlockQuote, joinUpItem, liftItem, selectParentNodeItem])];
  r.fullMenu = r.inlineMenu.concat(r.blockMenu).concat([[undoItem, redoItem]]);

  return r;
}
exports.buildMenuItems = buildMenuItems;
},{"../menu":29,"../schema-basic":44,"../schema-table":45,"../ui":55}],23:[function(require,module,exports){
"use strict";

var _require = require("../util/dom");

var insertCSS = _require.insertCSS;


var cls = "ProseMirror-example-setup-style";
exports.className = cls;
var scope = "." + cls + " .ProseMirror-content";

insertCSS("\n\n/* Add space around the hr to make clicking it easier */\n\n" + scope + " hr {\n  position: relative;\n  height: 6px;\n  border: none;\n}\n\n" + scope + " hr:after {\n  content: \"\";\n  position: absolute;\n  left: 10px;\n  right: 10px;\n  top: 2px;\n  border-top: 2px solid silver;\n}\n\n" + scope + " img {\n  cursor: default;\n}\n\n" + scope + " table {\n  border-collapse: collapse;\n}\n\n" + scope + " td {\n  vertical-align: top;\n  border: 1px solid #ddd;\n  padding: 3px 5px;\n}\n\n");
},{"../util/dom":60}],24:[function(require,module,exports){
"use strict";

// !! This module defines a plugin for attaching ‘input rules’ to an
// editor, which can react to or transform text typed by the user. It
// also comes with a bunch of default rules that can be enabled in
// this plugin.

;
var _require = require("./inputrules");

exports.InputRule = _require.InputRule;
exports.inputRules = _require.inputRules;
exports.InputRules = _require.InputRules;

var _require2 = require("./rules");

exports.emDash = _require2.emDash;
exports.ellipsis = _require2.ellipsis;
exports.openDoubleQuote = _require2.openDoubleQuote;
exports.closeDoubleQuote = _require2.closeDoubleQuote;
exports.openSingleQuote = _require2.openSingleQuote;
exports.closeSingleQuote = _require2.closeSingleQuote;
exports.smartQuotes = _require2.smartQuotes;
exports.allInputRules = _require2.allInputRules;

var _require3 = require("./util");

exports.wrappingInputRule = _require3.wrappingInputRule;
exports.textblockTypeInputRule = _require3.textblockTypeInputRule;
exports.blockQuoteRule = _require3.blockQuoteRule;
exports.orderedListRule = _require3.orderedListRule;
exports.bulletListRule = _require3.bulletListRule;
exports.codeBlockRule = _require3.codeBlockRule;
exports.headingRule = _require3.headingRule;
_require3;
},{"./inputrules":25,"./rules":26,"./util":27}],25:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require("../edit");

var Keymap = _require.Keymap;
var Plugin = _require.Plugin;

// ;; Input rules are regular expressions describing a piece of text
// that, when typed, causes something to happen. This might be
// changing two dashes into an emdash, wrapping a paragraph starting
// with `"> "` into a blockquote, or something entirely different.

var InputRule =
// :: (RegExp, ?string, union<string, (pm: ProseMirror, match: [string], pos: number)>)
// Create an input rule. The rule applies when the user typed
// something and the text directly in front of the cursor matches
// `match`, which should probably end with `$`. You can optionally
// provide a filter, which should be a single character that always
// appears at the end of the match, and will be used to only apply
// the rule when there's an actual chance of it succeeding.
//
// The `handler` can be a string, in which case the matched text
// will simply be replaced by that string, or a function, which will
// be called with the match array produced by
// [`RegExp.exec`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec),
// and should produce the effect of the rule.
function InputRule(match, filter, handler) {
  _classCallCheck(this, InputRule);

  this.filter = filter;
  this.match = match;
  this.handler = handler;
};

exports.InputRule = InputRule;

// ;; Manages the set of active input rules for an editor. Created
// with the `inputRules` plugin.

var InputRules = function () {
  function InputRules(pm, options) {
    var _this = this;

    _classCallCheck(this, InputRules);

    this.pm = pm;
    this.rules = [];
    this.cancelVersion = null;

    pm.on.selectionChange.add(this.onSelChange = function () {
      return _this.cancelVersion = null;
    });
    pm.on.textInput.add(this.onTextInput = this.onTextInput.bind(this));
    pm.addKeymap(new Keymap({ Backspace: function Backspace(pm) {
        return _this.backspace(pm);
      } }, { name: "inputRules" }), 20);

    options.rules.forEach(function (rule) {
      return _this.addRule(rule);
    });
  }

  _createClass(InputRules, [{
    key: "detach",
    value: function detach() {
      this.pm.on.selectionChange.remove(this.onSelChange);
      this.pm.on.textInput.remove(this.onTextInput);
      this.pm.removeKeymap("inputRules");
    }

    // :: (InputRule)
    // Add the given input rule to the editor.

  }, {
    key: "addRule",
    value: function addRule(rule) {
      this.rules.push(rule);
    }

    // :: (InputRule) → bool
    // Remove the given input rule from the editor. Returns false if the
    // rule wasn't found.

  }, {
    key: "removeRule",
    value: function removeRule(rule) {
      var found = this.rules.indexOf(rule);
      if (found > -1) {
        this.rules.splice(found, 1);
        return true;
      }
      return false;
    }
  }, {
    key: "onTextInput",
    value: function onTextInput(text) {
      var $pos = this.pm.selection.$head;
      if (!$pos) return;

      var textBefore = void 0,
          isCode = void 0;
      var lastCh = text[text.length - 1];

      for (var i = 0; i < this.rules.length; i++) {
        var rule = this.rules[i],
            match = void 0;
        if (rule.filter && rule.filter != lastCh) continue;
        if (textBefore == null) {
          ;
          var _getContext = getContext($pos);

          textBefore = _getContext.textBefore;
          isCode = _getContext.isCode;

          if (isCode) return;
        }
        if (match = rule.match.exec(textBefore)) {
          var startVersion = this.pm.history.getVersion();
          if (typeof rule.handler == "string") {
            var start = $pos.pos - (match[1] || match[0]).length;
            var marks = this.pm.doc.marksAt($pos.pos);
            this.pm.tr.delete(start, $pos.pos).insert(start, this.pm.schema.text(rule.handler, marks)).apply();
          } else {
            rule.handler(this.pm, match, $pos.pos);
          }
          this.cancelVersion = startVersion;
          return;
        }
      }
    }
  }, {
    key: "backspace",
    value: function backspace() {
      if (this.cancelVersion) {
        this.pm.history.backToVersion(this.cancelVersion);
        this.cancelVersion = null;
      } else {
        return false;
      }
    }
  }]);

  return InputRules;
}();

function getContext($pos) {
  var parent = $pos.parent,
      isCode = parent.type.isCode;
  var textBefore = "";
  for (var i = 0, rem = $pos.parentOffset; rem > 0; i++) {
    var child = parent.child(i);
    if (child.isText) textBefore += child.text.slice(0, rem);else textBefore += "￼";
    rem -= child.nodeSize;
    if (rem <= 0 && child.marks.some(function (st) {
      return st.type.isCode;
    })) isCode = true;
  }
  return { textBefore: textBefore, isCode: isCode };
}

// :: Plugin
// A plugin for adding input rules to an editor. A common pattern of
// use is to call `inputRules.ensure(editor).addRule(...)` to get an
// instance of the plugin state and add a rule to it.
//
// Takes a single option, `rules`, which may be an array of
// `InputRules` objects to initially add.
var inputRules = new Plugin(InputRules, {
  rules: []
});
exports.inputRules = inputRules;
},{"../edit":10}],26:[function(require,module,exports){
"use strict";

var _require = require("./inputrules");

var InputRule = _require.InputRule;

// :: InputRule Converts double dashes to an emdash.

var emDash = new InputRule(/--$/, "-", "—");
exports.emDash = emDash;
// :: InputRule Converts three dots to an ellipsis character.
var ellipsis = new InputRule(/\.\.\.$/, ".", "…");
exports.ellipsis = ellipsis;
// :: InputRule “Smart” opening double quotes.
var openDoubleQuote = new InputRule(/(?:^|[\s\{\[\(\<'"\u2018\u201C])(")$/, '"', "“");
exports.openDoubleQuote = openDoubleQuote;
// :: InputRule “Smart” closing double quotes.
var closeDoubleQuote = new InputRule(/"$/, '"', "”");
exports.closeDoubleQuote = closeDoubleQuote;
// :: InputRule “Smart” opening single quotes.
var openSingleQuote = new InputRule(/(?:^|[\s\{\[\(\<'"\u2018\u201C])(')$/, "'", "‘");
exports.openSingleQuote = openSingleQuote;
// :: InputRule “Smart” closing single quotes.
var closeSingleQuote = new InputRule(/'$/, "'", "’");
exports.closeSingleQuote = closeSingleQuote;

// :: [InputRule] Smart-quote related input rules.
var smartQuotes = [openDoubleQuote, closeDoubleQuote, openSingleQuote, closeSingleQuote];
exports.smartQuotes = smartQuotes;

// :: [InputRule] All schema-independent input rules defined in this module.
var allInputRules = [emDash, ellipsis].concat(smartQuotes);
exports.allInputRules = allInputRules;
},{"./inputrules":25}],27:[function(require,module,exports){
"use strict";

var _require = require("./inputrules");

var InputRule = _require.InputRule;

var _require2 = require("../transform");

var findWrapping = _require2.findWrapping;
var joinable = _require2.joinable;

// :: (RegExp, string, NodeType, ?union<Object, ([string]) → ?Object>, ?([string], Node) → bool) → InputRule
// Build an input rule for automatically wrapping a textblock when a
// given string is typed. The `regexp` and `filter` arguments are
// directly passed through to the `InputRule` constructor. You'll
// probably want the regexp to start with `^`, so that the pattern can
// only occur at the start of a textblock.
//
// `nodeType` is the type of node to wrap in. If it needs attributes,
// you can either pass them directly, or pass a function that will
// compute them from the regular expression match.
//
// By default, if there's a node with the same type above the newly
// wrapped node, the rule will try to [join](#Transform.join) those
// two nodes. You can pass a join predicate, which takes a regular
// expression match and the node before the wrapped node, and can
// return a boolean to indicate whether a join should happen.

function wrappingInputRule(regexp, filter, nodeType, getAttrs, joinPredicate) {
  return new InputRule(regexp, filter, function (pm, match, pos) {
    var start = pos - match[0].length;
    var attrs = getAttrs instanceof Function ? getAttrs(match) : getAttrs;
    var tr = pm.tr.delete(start, pos);
    var $pos = tr.doc.resolve(start),
        range = $pos.blockRange(),
        wrapping = range && findWrapping(range, nodeType, attrs);
    if (!wrapping) return;
    tr.wrap(range, wrapping);
    var before = tr.doc.resolve(start - 1).nodeBefore;
    if (before && before.type == nodeType && joinable(tr.doc, start - 1) && (!joinPredicate || joinPredicate(match, before))) tr.join(start - 1);
    tr.apply();
  });
}
exports.wrappingInputRule = wrappingInputRule;

// :: (RegExp, string, NodeType, ?union<Object, ([string]) → ?Object>) → InputRule
// Build an input rule that changes the type of a textblock when the
// matched text is typed into it. You'll usually want to start your
// regexp with `^` to that it is only matched at the start of a
// textblock. The optional `getAttrs` parameter can be used to compute
// the new node's attributes, and works the same as in the
// `wrappingInputRule` function.
function textblockTypeInputRule(regexp, filter, nodeType, getAttrs) {
  return new InputRule(regexp, filter, function (pm, match, pos) {
    var $pos = pm.doc.resolve(pos),
        start = pos - match[0].length;
    var attrs = getAttrs instanceof Function ? getAttrs(match) : getAttrs;
    if (!$pos.node(-1).canReplaceWith($pos.index(-1), $pos.indexAfter(-1), nodeType, attrs)) return;
    return pm.tr.delete(start, pos).setBlockType(start, start, nodeType, attrs).apply();
  });
}
exports.textblockTypeInputRule = textblockTypeInputRule;

// :: (NodeType) → InputRule
// Given a blockquote node type, returns an input rule that turns `"> "`
// at the start of a textblock into a blockquote.
function blockQuoteRule(nodeType) {
  return wrappingInputRule(/^\s*> $/, " ", nodeType);
}
exports.blockQuoteRule = blockQuoteRule;

// :: (NodeType) → InputRule
// Given a list node type, returns an input rule that turns a number
// followed by a dot at the start of a textblock into an ordered list.
function orderedListRule(nodeType) {
  return wrappingInputRule(/^(\d+)\. $/, " ", nodeType, function (match) {
    return { order: +match[1] };
  }, function (match, node) {
    return node.childCount + node.attrs.order == +match[1];
  });
}
exports.orderedListRule = orderedListRule;

// :: (NodeType) → InputRule
// Given a list node type, returns an input rule that turns a bullet
// (dash, plush, or asterisk) at the start of a textblock into a
// bullet list.
function bulletListRule(nodeType) {
  return wrappingInputRule(/^\s*([-+*]) $/, " ", nodeType);
}
exports.bulletListRule = bulletListRule;

// :: (NodeType) → InputRule
// Given a code block node type, returns an input rule that turns a
// textblock starting with three backticks into a code block.
function codeBlockRule(nodeType) {
  return textblockTypeInputRule(/^```$/, "`", nodeType);
}
exports.codeBlockRule = codeBlockRule;

// :: (NodeType, number) → InputRule
// Given a node type and a maximum level, creates an input rule that
// turns up to that number of `#` characters followed by a space at
// the start of a textblock into a heading whose level corresponds to
// the number of `#` signs.
function headingRule(nodeType, maxLevel) {
  return textblockTypeInputRule(new RegExp("^(#{1," + maxLevel + "}) $"), " ", nodeType, function (match) {
    return { level: match[1].length };
  });
}
exports.headingRule = headingRule;
},{"../transform":46,"./inputrules":25}],28:[function(require,module,exports){
"use strict";

var _require = require("../util/dom");

var insertCSS = _require.insertCSS;


var SVG = "http://www.w3.org/2000/svg";
var XLINK = "http://www.w3.org/1999/xlink";

var prefix = "ProseMirror-icon";

function hashPath(path) {
  var hash = 0;
  for (var i = 0; i < path.length; i++) {
    hash = (hash << 5) - hash + path.charCodeAt(i) | 0;
  }return hash;
}

function getIcon(icon) {
  var node = document.createElement("div");
  node.className = prefix;
  if (icon.path) {
    var name = "pm-icon-" + hashPath(icon.path).toString(16);
    if (!document.getElementById(name)) buildSVG(name, icon);
    var svg = node.appendChild(document.createElementNS(SVG, "svg"));
    svg.style.width = icon.width / icon.height + "em";
    var use = svg.appendChild(document.createElementNS(SVG, "use"));
    use.setAttributeNS(XLINK, "href", /([^#]*)/.exec(document.location)[1] + "#" + name);
  } else if (icon.dom) {
    node.appendChild(icon.dom.cloneNode(true));
  } else {
    node.appendChild(document.createElement("span")).textContent = icon.text || '';
    if (icon.css) node.firstChild.style.cssText = icon.css;
  }
  return node;
}
exports.getIcon = getIcon;

function buildSVG(name, data) {
  var collection = document.getElementById(prefix + "-collection");
  if (!collection) {
    collection = document.createElementNS(SVG, "svg");
    collection.id = prefix + "-collection";
    collection.style.display = "none";
    document.body.insertBefore(collection, document.body.firstChild);
  }
  var sym = document.createElementNS(SVG, "symbol");
  sym.id = name;
  sym.setAttribute("viewBox", "0 0 " + data.width + " " + data.height);
  var path = sym.appendChild(document.createElementNS(SVG, "path"));
  path.setAttribute("d", data.path);
  collection.appendChild(sym);
}

insertCSS("\n." + prefix + " {\n  display: inline-block;\n  line-height: .8;\n  vertical-align: -2px; /* Compensate for padding */\n  padding: 2px 8px;\n  cursor: pointer;\n}\n\n." + prefix + " svg {\n  fill: currentColor;\n  height: 1em;\n}\n\n." + prefix + " span {\n  vertical-align: text-top;\n}");
},{"../util/dom":60}],29:[function(require,module,exports){
"use strict";

var _require = require("../util/obj");

var copyObj = _require.copyObj;


copyObj(require("./menu"), exports);
exports.menuBar = require("./menubar").menuBar;
exports.tooltipMenu = require("./tooltipmenu").tooltipMenu;

// !! This module defines a number of building blocks for ProseMirror
// menus, along with two menu styles, [`menubar`](#menuBar) and
// [`tooltipmenu`](#tooltipMenu).

// ;; #path=MenuElement #kind=interface
// The types defined in this module aren't the only thing you can
// display in your menu. Anything that conforms to this interface can
// be put into a menu structure.

// :: (pm: ProseMirror) → ?DOMNode #path=MenuElement.render
// Render the element for display in the menu. Returning `null` can be
// used to signal that this element shouldn't be displayed for the
// given editor state.
},{"../util/obj":63,"./menu":30,"./menubar":31,"./tooltipmenu":32}],30:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require("../util/dom");

var elt = _require.elt;
var insertCSS = _require.insertCSS;

var _require$commands = require("../edit").commands;

var undo = _require$commands.undo;
var redo = _require$commands.redo;
var lift = _require$commands.lift;
var joinUp = _require$commands.joinUp;
var selectParentNode = _require$commands.selectParentNode;
var wrapIn = _require$commands.wrapIn;
var setBlockType = _require$commands.setBlockType;
var wrapInList = _require$commands.wrapInList;
var toggleMark = _require$commands.toggleMark;

var _require2 = require("../util/obj");

var copyObj = _require2.copyObj;

var _require3 = require("./icons");

var getIcon = _require3.getIcon;


var prefix = "ProseMirror-menu";

// ;; An icon or label that, when clicked, executes a command.

var MenuItem = function () {
  // :: (MenuItemSpec)

  function MenuItem(spec) {
    _classCallCheck(this, MenuItem);

    // :: MenuItemSpec
    // The spec used to create the menu item.
    this.spec = spec;
  }

  // :: (ProseMirror) → DOMNode
  // Renders the icon according to its [display
  // spec](#MenuItemSpec.display), and adds an event handler which
  // executes the command when the representation is clicked.


  _createClass(MenuItem, [{
    key: "render",
    value: function render(pm) {
      var disabled = false,
          spec = this.spec;
      if (spec.select && !spec.select(pm)) {
        if (spec.onDeselected == "disable") disabled = true;else return null;
      }
      var active = spec.active && !disabled && spec.active(pm);

      var dom = void 0;
      if (spec.render) {
        dom = spec.render(pm);
      } else if (spec.icon) {
        dom = getIcon(spec.icon);
        if (active) dom.classList.add(prefix + "-active");
      } else if (spec.label) {
        dom = elt("div", null, pm.translate(spec.label));
      } else {
        throw new RangeError("MenuItem without render, icon, or label property");
      }

      if (spec.title) dom.setAttribute("title", pm.translate(spec.title));
      if (spec.class) dom.classList.add(spec.class);
      if (disabled) dom.classList.add(prefix + "-disabled");
      if (spec.css) dom.style.cssText += spec.css;
      if (!disabled) dom.addEventListener(spec.execEvent || "mousedown", function (e) {
        e.preventDefault();e.stopPropagation();
        pm.on.interaction.dispatch();
        spec.run(pm);
      });
      return dom;
    }
  }]);

  return MenuItem;
}();

exports.MenuItem = MenuItem;

// :: Object #path=MenuItemSpec #kind=interface
// The configuration object passed to the `MenuItem` constructor.

// :: (ProseMirror) #path=MenuItemSpec.run
// The function to execute when the menu item is activated.

// :: ?(ProseMirror) → bool #path=MenuItemSpec.select
// Optional function that is used to determine whether the item is
// appropriate at the moment.

// :: ?string #path=MenuItemSpec.onDeselect
// Determines what happens when [`select`](#MenuItemSpec.select)
// returns false. The default is to hide the item, you can set this to
// `"disable"` to instead render the item with a disabled style.

// :: ?(ProseMirror) → bool #path=MenuItemSpec.active
// A predicate function to determine whether the item is 'active' (for
// example, the item for toggling the strong mark might be active then
// the cursor is in strong text).

// :: ?(ProseMirror) → DOMNode #path=MenuItemSpec.render
// A function that renders the item. You must provide either this,
// [`icon`](#MenuItemSpec.icon), or [`label`](#MenuItemSpec.label).

// :: ?Object #path=MenuItemSpec.icon
// Describes an icon to show for this item. The object may specify an
// SVG icon, in which case its `path` property should be an [SVG path
// spec](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d),
// and `width` and `height` should provide the viewbox in which that
// path exists. Alternatively, it may have a `text` property
// specifying a string of text that makes up the icon, with an
// optional `css` property giving additional CSS styling for the text.
// _Or_ it may contain `dom` property containing a DOM node.

// :: ?string #path=MenuItemSpec.label
// Makes the item show up as a text label. Mostly useful for items
// wrapped in a [drop-down](#Dropdown) or similar menu. The object
// should have a `label` property providing the text to display.

// :: ?string #path=MenuItemSpec.title
// Defines DOM title (mouseover) text for the item.

// :: string #path=MenuItemSpec.class
// Optionally adds a CSS class to the item's DOM representation.

// :: string #path=MenuItemSpec.css
// Optionally adds a string of inline CSS to the item's DOM
// representation.

// :: string #path=MenuItemSpec.execEvent
// Defines which event on the command's DOM representation should
// trigger the execution of the command. Defaults to mousedown.

// ;; A drop-down menu, displayed as a label with a downwards-pointing
// triangle to the right of it.

var Dropdown = function () {
  // :: ([MenuElement], ?Object)
  // Create a dropdown wrapping the elements. Options may include
  // the following properties:
  //
  // **`label`**`: string`
  //   : The label to show on the drop-down control.
  //
  // **`title`**`: string`
  //   : Sets the
  //     [`title`](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/title)
  //     attribute given to the menu control.
  //
  // **`class`**`: string`
  //   : When given, adds an extra CSS class to the menu control.
  //
  // **`css`**`: string`
  //   : When given, adds an extra set of CSS styles to the menu control.

  function Dropdown(content, options) {
    _classCallCheck(this, Dropdown);

    this.options = options || {};
    this.content = Array.isArray(content) ? content : [content];
  }

  // :: (ProseMirror) → DOMNode
  // Returns a node showing the collapsed menu, which expands when clicked.


  _createClass(Dropdown, [{
    key: "render",
    value: function render(pm) {
      var _this = this;

      var items = renderDropdownItems(this.content, pm);
      if (!items.length) return null;

      var dom = elt("div", { class: prefix + "-dropdown " + (this.options.class || ""),
        style: this.options.css,
        title: this.options.title && pm.translate(this.options.title) }, pm.translate(this.options.label));
      var open = null;
      dom.addEventListener("mousedown", function (e) {
        e.preventDefault();e.stopPropagation();
        if (open && open()) open = null;else open = _this.expand(pm, dom, items);
      });
      return dom;
    }
  }, {
    key: "expand",
    value: function expand(pm, dom, items) {
      var box = dom.getBoundingClientRect(),
          outer = pm.wrapper.getBoundingClientRect();
      var menuDOM = elt("div", { class: prefix + "-dropdown-menu " + (this.options.class || ""),
        style: "left: " + (box.left - outer.left) + "px; top: " + (box.bottom - outer.top) + "px" }, items);

      var done = false;
      function finish() {
        if (done) return;
        done = true;
        pm.on.interaction.remove(finish);
        pm.wrapper.removeChild(menuDOM);
        return true;
      }
      pm.on.interaction.dispatch();
      pm.wrapper.appendChild(menuDOM);
      pm.on.interaction.add(finish);
      return finish;
    }
  }]);

  return Dropdown;
}();

exports.Dropdown = Dropdown;

function renderDropdownItems(items, pm) {
  var rendered = [];
  for (var i = 0; i < items.length; i++) {
    var inner = items[i].render(pm);
    if (inner) rendered.push(elt("div", { class: prefix + "-dropdown-item" }, inner));
  }
  return rendered;
}

// ;; Represents a submenu wrapping a group of elements that start
// hidden and expand to the right when hovered over or tapped.

var DropdownSubmenu = function () {
  // :: ([MenuElement], ?Object)
  // Creates a submenu for the given group of menu elements. The
  // following options are recognized:
  //
  // **`label`**`: string`
  //   : The label to show on the submenu.

  function DropdownSubmenu(content, options) {
    _classCallCheck(this, DropdownSubmenu);

    this.options = options || {};
    this.content = Array.isArray(content) ? content : [content];
  }

  // :: (ProseMirror) → DOMNode
  // Renders the submenu.


  _createClass(DropdownSubmenu, [{
    key: "render",
    value: function render(pm) {
      var items = renderDropdownItems(this.content, pm);
      if (!items.length) return null;

      var label = elt("div", { class: prefix + "-submenu-label" }, pm.translate(this.options.label));
      var wrap = elt("div", { class: prefix + "-submenu-wrap" }, label, elt("div", { class: prefix + "-submenu" }, items));
      label.addEventListener("mousedown", function (e) {
        e.preventDefault();e.stopPropagation();
        wrap.classList.toggle(prefix + "-submenu-wrap-active");
      });
      return wrap;
    }
  }]);

  return DropdownSubmenu;
}();

exports.DropdownSubmenu = DropdownSubmenu;

// :: (ProseMirror, [union<MenuElement, [MenuElement]>]) → ?DOMFragment
// Render the given, possibly nested, array of menu elements into a
// document fragment, placing separators between them (and ensuring no
// superfluous separators appear when some of the groups turn out to
// be empty).
function renderGrouped(pm, content) {
  var result = document.createDocumentFragment(),
      needSep = false;
  for (var i = 0; i < content.length; i++) {
    var items = content[i],
        added = false;
    for (var j = 0; j < items.length; j++) {
      var rendered = items[j].render(pm);
      if (rendered) {
        if (!added && needSep) result.appendChild(separator());
        result.appendChild(elt("span", { class: prefix + "item" }, rendered));
        added = true;
      }
    }
    if (added) needSep = true;
  }
  return result;
}
exports.renderGrouped = renderGrouped;

function separator() {
  return elt("span", { class: prefix + "separator" });
}

// :: Object
// A set of basic editor-related icons. Contains the properties
// `join`, `lift`, `selectParentNode`, `undo`, `redo`, `strong`, `em`,
// `code`, `link`, `bulletList`, `orderedList`, and `blockquote`, each
// holding an object that can be used as the `icon` option to
// `MenuItem`.
var icons = {
  join: {
    width: 800, height: 900,
    path: "M0 75h800v125h-800z M0 825h800v-125h-800z M250 400h100v-100h100v100h100v100h-100v100h-100v-100h-100z"
  },
  lift: {
    width: 1024, height: 1024,
    path: "M219 310v329q0 7-5 12t-12 5q-8 0-13-5l-164-164q-5-5-5-13t5-13l164-164q5-5 13-5 7 0 12 5t5 12zM1024 749v109q0 7-5 12t-12 5h-987q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h987q7 0 12 5t5 12zM1024 530v109q0 7-5 12t-12 5h-621q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h621q7 0 12 5t5 12zM1024 310v109q0 7-5 12t-12 5h-621q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h621q7 0 12 5t5 12zM1024 91v109q0 7-5 12t-12 5h-987q-7 0-12-5t-5-12v-109q0-7 5-12t12-5h987q7 0 12 5t5 12z"
  },
  selectParentNode: { text: "⬚", css: "font-weight: bold" },
  undo: {
    width: 1024, height: 1024,
    path: "M761 1024c113-206 132-520-313-509v253l-384-384 384-384v248c534-13 594 472 313 775z"
  },
  redo: {
    width: 1024, height: 1024,
    path: "M576 248v-248l384 384-384 384v-253c-446-10-427 303-313 509-280-303-221-789 313-775z"
  },
  strong: {
    width: 805, height: 1024,
    path: "M317 869q42 18 80 18 214 0 214-191 0-65-23-102-15-25-35-42t-38-26-46-14-48-6-54-1q-41 0-57 5 0 30-0 90t-0 90q0 4-0 38t-0 55 2 47 6 38zM309 442q24 4 62 4 46 0 81-7t62-25 42-51 14-81q0-40-16-70t-45-46-61-24-70-8q-28 0-74 7 0 28 2 86t2 86q0 15-0 45t-0 45q0 26 0 39zM0 950l1-53q8-2 48-9t60-15q4-6 7-15t4-19 3-18 1-21 0-19v-37q0-561-12-585-2-4-12-8t-25-6-28-4-27-2-17-1l-2-47q56-1 194-6t213-5q13 0 39 0t38 0q40 0 78 7t73 24 61 40 42 59 16 78q0 29-9 54t-22 41-36 32-41 25-48 22q88 20 146 76t58 141q0 57-20 102t-53 74-78 48-93 27-100 8q-25 0-75-1t-75-1q-60 0-175 6t-132 6z"
  },
  em: {
    width: 585, height: 1024,
    path: "M0 949l9-48q3-1 46-12t63-21q16-20 23-57 0-4 35-165t65-310 29-169v-14q-13-7-31-10t-39-4-33-3l10-58q18 1 68 3t85 4 68 1q27 0 56-1t69-4 56-3q-2 22-10 50-17 5-58 16t-62 19q-4 10-8 24t-5 22-4 26-3 24q-15 84-50 239t-44 203q-1 5-7 33t-11 51-9 47-3 32l0 10q9 2 105 17-1 25-9 56-6 0-18 0t-18 0q-16 0-49-5t-49-5q-78-1-117-1-29 0-81 5t-69 6z"
  },
  code: {
    width: 896, height: 1024,
    path: "M608 192l-96 96 224 224-224 224 96 96 288-320-288-320zM288 192l-288 320 288 320 96-96-224-224 224-224-96-96z"
  },
  link: {
    width: 951, height: 1024,
    path: "M832 694q0-22-16-38l-118-118q-16-16-38-16-24 0-41 18 1 1 10 10t12 12 8 10 7 14 2 15q0 22-16 38t-38 16q-8 0-15-2t-14-7-10-8-12-12-10-10q-18 17-18 41 0 22 16 38l117 118q15 15 38 15 22 0 38-14l84-83q16-16 16-38zM430 292q0-22-16-38l-117-118q-16-16-38-16-22 0-38 15l-84 83q-16 16-16 38 0 22 16 38l118 118q15 15 38 15 24 0 41-17-1-1-10-10t-12-12-8-10-7-14-2-15q0-22 16-38t38-16q8 0 15 2t14 7 10 8 12 12 10 10q18-17 18-41zM941 694q0 68-48 116l-84 83q-47 47-116 47-69 0-116-48l-117-118q-47-47-47-116 0-70 50-119l-50-50q-49 50-118 50-68 0-116-48l-118-118q-48-48-48-116t48-116l84-83q47-47 116-47 69 0 116 48l117 118q47 47 47 116 0 70-50 119l50 50q49-50 118-50 68 0 116 48l118 118q48 48 48 116z"
  },
  bulletList: {
    width: 768, height: 896,
    path: "M0 512h128v-128h-128v128zM0 256h128v-128h-128v128zM0 768h128v-128h-128v128zM256 512h512v-128h-512v128zM256 256h512v-128h-512v128zM256 768h512v-128h-512v128z"
  },
  orderedList: {
    width: 768, height: 896,
    path: "M320 512h448v-128h-448v128zM320 768h448v-128h-448v128zM320 128v128h448v-128h-448zM79 384h78v-256h-36l-85 23v50l43-2v185zM189 590c0-36-12-78-96-78-33 0-64 6-83 16l1 66c21-10 42-15 67-15s32 11 32 28c0 26-30 58-110 112v50h192v-67l-91 2c49-30 87-66 87-113l1-1z"
  },
  blockquote: {
    width: 640, height: 896,
    path: "M0 448v256h256v-256h-128c0 0 0-128 128-128v-128c0 0-256 0-256 256zM640 320v-128c0 0-256 0-256 256v256h256v-256h-128c0 0 0-128 128-128z"
  }
};
exports.icons = icons;

// :: MenuItem
// Menu item for the `joinUp` command.
var joinUpItem = new MenuItem({
  title: "Join with above block",
  run: joinUp,
  select: function select(pm) {
    return joinUp(pm, false);
  },
  icon: icons.join
});
exports.joinUpItem = joinUpItem;

// :: MenuItem
// Menu item for the `lift` command.
var liftItem = new MenuItem({
  title: "Lift out of enclosing block",
  run: lift,
  select: function select(pm) {
    return lift(pm, false);
  },
  icon: icons.lift
});
exports.liftItem = liftItem;

// :: MenuItem
// Menu item for the `selectParentNode` command.
var selectParentNodeItem = new MenuItem({
  title: "Select parent node",
  run: selectParentNode,
  select: function select(pm) {
    return selectParentNode(pm, false);
  },
  icon: icons.selectParentNode
});
exports.selectParentNodeItem = selectParentNodeItem;

// :: MenuItem
// Menu item for the `undo` command.
var undoItem = new MenuItem({
  title: "Undo last change",
  run: undo,
  select: function select(pm) {
    return undo(pm, false);
  },
  icon: icons.undo
});
exports.undoItem = undoItem;

// :: MenuItem
// Menu item for the `redo` command.
var redoItem = new MenuItem({
  title: "Redo last undone change",
  run: redo,
  select: function select(pm) {
    return redo(pm, false);
  },
  icon: icons.redo
});
exports.redoItem = redoItem;

function markActive(pm, type) {
  var _pm$selection = pm.selection;
  var from = _pm$selection.from;
  var to = _pm$selection.to;
  var empty = _pm$selection.empty;

  if (empty) return type.isInSet(pm.activeMarks());else return pm.doc.rangeHasMark(from, to, type);
}

// :: (MarkType, Object) → MenuItem
// Create a menu item for toggling a mark on the selection. Will create
// `run`, `active`, and `select` properties. Other properties have to
// be supplied in the `options` object. When `options.attrs` is a
// function, it will be called with `(pm: ProseMirror, callback:
// (attrs: ?Object))` arguments, and should produce the attributes for
// the mark and then call the callback. Otherwise, it may be an object
// providing the attributes directly.
function toggleMarkItem(markType, options) {
  var command = toggleMark(markType, options.attrs);
  var base = {
    run: function run(pm) {
      command(pm);
    },
    active: function active(pm) {
      return markActive(pm, markType);
    },
    select: function select(pm) {
      return command(pm, false);
    }
  };
  if (options.attrs instanceof Function) base.run = function (pm) {
    if (markActive(pm, markType)) command(pm);else options.attrs(pm, function (attrs) {
      return toggleMark(markType, attrs)(pm);
    });
  };

  return new MenuItem(copyObj(options, base));
}
exports.toggleMarkItem = toggleMarkItem;

// :: (NodeType, Object) → MenuItem
// Create a menu item for inserting a node of the given type. Adds
// `run` and `select` properties to the ones provided in `options`.
// `options.attrs` can be an object or a function, like in
// `toggleMarkItem`.
function insertItem(nodeType, options) {
  return new MenuItem(copyObj(options, {
    select: function select(pm) {
      var $from = pm.selection.$from;
      for (var d = $from.depth; d >= 0; d--) {
        var index = $from.index(d);
        if ($from.node(d).canReplaceWith(index, index, nodeType, options.attrs instanceof Function ? null : options.attrs)) return true;
      }
    },
    run: function run(pm) {
      function done(attrs) {
        pm.tr.replaceSelection(nodeType.createAndFill(attrs)).apply();
      }
      if (options.attrs instanceof Function) options.attrs(pm, done);else done(options.attrs);
    }
  }));
}
exports.insertItem = insertItem;

// :: (NodeType, Object) → MenuItem
// Build a menu item for wrapping the selection in a given node type.
// Adds `run` and `select` properties to the ones present in
// `options`. `options.attrs` may be an object or a function, as in
// `toggleMarkItem`.
function wrapItem(nodeType, options) {
  return new MenuItem(copyObj(options, {
    run: function run(pm) {
      if (options.attrs instanceof Function) options.attrs(pm, function (attrs) {
        return wrapIn(nodeType, attrs)(pm);
      });else wrapIn(nodeType, options.attrs)(pm);
    },
    select: function select(pm) {
      return wrapIn(nodeType, options.attrs instanceof Function ? null : options.attrs)(pm, false);
    }
  }));
}
exports.wrapItem = wrapItem;

// :: (NodeType, Object) → MenuItem
// Build a menu item for changing the type of the textblock around the
// selection to the given type. Provides `run`, `active`, and `select`
// properties. Others must be given in `options`. `options.attrs` may
// be an object to provide the attributes for the textblock node.
function blockTypeItem(nodeType, options) {
  var command = setBlockType(nodeType, options.attrs);
  return new MenuItem(copyObj(options, {
    run: command,
    select: function select(pm) {
      return command(pm, false);
    },
    active: function active(pm) {
      var _pm$selection2 = pm.selection;
      var $from = _pm$selection2.$from;
      var to = _pm$selection2.to;
      var node = _pm$selection2.node;

      if (node) return node.hasMarkup(nodeType, options.attrs);
      return to <= $from.end() && $from.parent.hasMarkup(nodeType, options.attrs);
    }
  }));
}
exports.blockTypeItem = blockTypeItem;

// :: (NodeType, Object) → MenuItem
// Build a menu item for wrapping the selection in a list.
// `options.attrs` may be an object to provide the attributes for the
// list node.
function wrapListItem(nodeType, options) {
  var command = wrapInList(nodeType, options.attrs);
  return new MenuItem(copyObj(options, {
    run: command,
    select: function select(pm) {
      return command(pm, false);
    }
  }));
}
exports.wrapListItem = wrapListItem;

insertCSS("\n\n.ProseMirror-textblock-dropdown {\n  min-width: 3em;\n}\n\n." + prefix + " {\n  margin: 0 -4px;\n  line-height: 1;\n}\n\n.ProseMirror-tooltip ." + prefix + " {\n  width: -webkit-fit-content;\n  width: fit-content;\n  white-space: pre;\n}\n\n." + prefix + "item {\n  margin-right: 3px;\n  display: inline-block;\n}\n\n." + prefix + "separator {\n  border-right: 1px solid #ddd;\n  margin-right: 3px;\n}\n\n." + prefix + "-dropdown, ." + prefix + "-dropdown-menu {\n  font-size: 90%;\n  white-space: nowrap;\n}\n\n." + prefix + "-dropdown {\n  padding: 1px 14px 1px 4px;\n  display: inline-block;\n  vertical-align: 1px;\n  position: relative;\n  cursor: pointer;\n}\n\n." + prefix + "-dropdown:after {\n  content: \"\";\n  border-left: 4px solid transparent;\n  border-right: 4px solid transparent;\n  border-top: 4px solid currentColor;\n  opacity: .6;\n  position: absolute;\n  right: 2px;\n  top: calc(50% - 2px);\n}\n\n." + prefix + "-dropdown-menu, ." + prefix + "-submenu {\n  position: absolute;\n  background: white;\n  color: #666;\n  border: 1px solid #aaa;\n  padding: 2px;\n}\n\n." + prefix + "-dropdown-menu {\n  z-index: 15;\n  min-width: 6em;\n}\n\n." + prefix + "-dropdown-item {\n  cursor: pointer;\n  padding: 2px 8px 2px 4px;\n}\n\n." + prefix + "-dropdown-item:hover {\n  background: #f2f2f2;\n}\n\n." + prefix + "-submenu-wrap {\n  position: relative;\n  margin-right: -4px;\n}\n\n." + prefix + "-submenu-label:after {\n  content: \"\";\n  border-top: 4px solid transparent;\n  border-bottom: 4px solid transparent;\n  border-left: 4px solid currentColor;\n  opacity: .6;\n  position: absolute;\n  right: 4px;\n  top: calc(50% - 4px);\n}\n\n." + prefix + "-submenu {\n  display: none;\n  min-width: 4em;\n  left: 100%;\n  top: -3px;\n}\n\n." + prefix + "-active {\n  background: #eee;\n  border-radius: 4px;\n}\n\n." + prefix + "-active {\n  background: #eee;\n  border-radius: 4px;\n}\n\n." + prefix + "-disabled {\n  opacity: .3;\n}\n\n." + prefix + "-submenu-wrap:hover ." + prefix + "-submenu, ." + prefix + "-submenu-wrap-active ." + prefix + "-submenu {\n  display: block;\n}\n");
},{"../edit":10,"../util/dom":60,"../util/obj":63,"./icons":28}],31:[function(require,module,exports){
"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require("../edit");

var Plugin = _require.Plugin;

var _require2 = require("../util/dom");

var elt = _require2.elt;
var insertCSS = _require2.insertCSS;

var _require3 = require("./menu");

var renderGrouped = _require3.renderGrouped;


var prefix = "ProseMirror-menubar";

var MenuBar = function () {
  function MenuBar(pm, config) {
    var _this = this;

    _classCallCheck(this, MenuBar);

    this.pm = pm;

    this.wrapper = pm.wrapper.insertBefore(elt("div", { class: prefix }), pm.wrapper.firstChild);
    this.spacer = null;
    this.maxHeight = 0;
    this.widthForMaxHeight = 0;

    this.updater = pm.updateScheduler([pm.on.selectionChange, pm.on.change, pm.on.activeMarkChange], function () {
      return _this.update();
    });
    this.content = config.content;
    this.updater.force();

    this.floating = false;
    if (config.float) {
      this.updateFloat();
      this.scrollFunc = function () {
        if (!document.body.contains(_this.pm.wrapper)) window.removeEventListener("scroll", _this.scrollFunc);else _this.updateFloat();
      };
      window.addEventListener("scroll", this.scrollFunc);
    }
  }

  _createClass(MenuBar, [{
    key: "detach",
    value: function detach() {
      this.updater.detach();
      this.wrapper.parentNode.removeChild(this.wrapper);
      if (this.spacer) this.spacer.parentNode.removeChild(this.spacer);

      if (this.scrollFunc) window.removeEventListener("scroll", this.scrollFunc);
    }
  }, {
    key: "update",
    value: function update() {
      var _this2 = this;

      this.wrapper.textContent = "";
      this.wrapper.appendChild(renderGrouped(this.pm, this.content));

      return this.floating ? this.updateScrollCursor() : function () {
        if (_this2.wrapper.offsetWidth != _this2.widthForMaxHeight) {
          _this2.widthForMaxHeight = _this2.wrapper.offsetWidth;
          _this2.maxHeight = 0;
        }
        if (_this2.wrapper.offsetHeight > _this2.maxHeight) {
          _this2.maxHeight = _this2.wrapper.offsetHeight;
          return function () {
            _this2.wrapper.style.minHeight = _this2.maxHeight + "px";
          };
        }
      };
    }
  }, {
    key: "updateFloat",
    value: function updateFloat() {
      var editorRect = this.pm.wrapper.getBoundingClientRect();
      if (this.floating) {
        if (editorRect.top >= 0 || editorRect.bottom < this.wrapper.offsetHeight + 10) {
          this.floating = false;
          this.wrapper.style.position = this.wrapper.style.left = this.wrapper.style.width = "";
          this.wrapper.style.display = "";
          this.spacer.parentNode.removeChild(this.spacer);
          this.spacer = null;
        } else {
          var border = (this.pm.wrapper.offsetWidth - this.pm.wrapper.clientWidth) / 2;
          this.wrapper.style.left = editorRect.left + border + "px";
          this.wrapper.style.display = editorRect.top > window.innerHeight ? "none" : "";
        }
      } else {
        if (editorRect.top < 0 && editorRect.bottom >= this.wrapper.offsetHeight + 10) {
          this.floating = true;
          var menuRect = this.wrapper.getBoundingClientRect();
          this.wrapper.style.left = menuRect.left + "px";
          this.wrapper.style.width = menuRect.width + "px";
          this.wrapper.style.position = "fixed";
          this.spacer = elt("div", { class: prefix + "-spacer", style: "height: " + menuRect.height + "px" });
          this.pm.wrapper.insertBefore(this.spacer, this.wrapper);
        }
      }
    }
  }, {
    key: "updateScrollCursor",
    value: function updateScrollCursor() {
      var _this3 = this;

      if (!this.floating) return null;
      var head = this.pm.selection.head;
      if (!head) return null;
      return function () {
        var cursorPos = _this3.pm.coordsAtPos(head);
        var menuRect = _this3.wrapper.getBoundingClientRect();
        if (cursorPos.top < menuRect.bottom && cursorPos.bottom > menuRect.top) {
          var _ret = function () {
            var scrollable = findWrappingScrollable(_this3.pm.wrapper);
            if (scrollable) return {
                v: function v() {
                  scrollable.scrollTop -= menuRect.bottom - cursorPos.top;
                }
              };
          }();

          if ((typeof _ret === "undefined" ? "undefined" : _typeof(_ret)) === "object") return _ret.v;
        }
      };
    }
  }]);

  return MenuBar;
}();

function findWrappingScrollable(node) {
  for (var cur = node.parentNode; cur; cur = cur.parentNode) {
    if (cur.scrollHeight > cur.clientHeight) return cur;
  }
}

// :: Plugin
// Plugin that enables the menu bar for an editor. The menu bar takes
// up space above the editor, showing currently available commands
// (that have been [added](#CommandSpec.menuGroup) to the menu). The
// following options are supported:
//
// **`float`**`: bool = false`
//   : When enabled, causes the menu bar to stay visible when the
//     editor is partially scrolled out of view, by making it float at
//     the top of the viewport.
//
// **`content`**`: [`[`MenuGroup`](#MenuGroup)`]`
//   : Determines the content of the menu.
var menuBar = new Plugin(MenuBar, {
  content: [],
  float: false
});
exports.menuBar = menuBar;

insertCSS("\n." + prefix + " {\n  border-top-left-radius: inherit;\n  border-top-right-radius: inherit;\n  position: relative;\n  min-height: 1em;\n  color: #666;\n  padding: 1px 6px;\n  top: 0; left: 0; right: 0;\n  border-bottom: 1px solid silver;\n  background: white;\n  z-index: 10;\n  -moz-box-sizing: border-box;\n  box-sizing: border-box;\n  overflow: visible;\n}\n");
},{"../edit":10,"../util/dom":60,"./menu":30}],32:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require("../edit");

var Plugin = _require.Plugin;

var _require2 = require("../util/dom");

var elt = _require2.elt;
var insertCSS = _require2.insertCSS;

var _require3 = require("../ui");

var Tooltip = _require3.Tooltip;

var _require4 = require("./menu");

var renderGrouped = _require4.renderGrouped;


var classPrefix = "ProseMirror-tooltipmenu";

var TooltipMenu = function () {
  function TooltipMenu(pm, config) {
    var _this = this;

    _classCallCheck(this, TooltipMenu);

    this.pm = pm;
    this.config = config;

    this.selectedBlockMenu = this.config.selectedBlockMenu;
    this.updater = pm.updateScheduler([pm.on.change, pm.on.selectionChange, pm.on.blur, pm.on.focus], function () {
      return _this.update();
    });
    this.onContextMenu = this.onContextMenu.bind(this);
    pm.content.addEventListener("contextmenu", this.onContextMenu);

    this.tooltip = new Tooltip(pm.wrapper, this.config.position);
    this.selectedBlockContent = this.config.selectedBlockContent || this.config.inlineContent.concat(this.config.blockContent);
  }

  _createClass(TooltipMenu, [{
    key: "detach",
    value: function detach() {
      this.updater.detach();
      this.tooltip.detach();
      this.pm.content.removeEventListener("contextmenu", this.onContextMenu);
    }
  }, {
    key: "show",
    value: function show(content, coords) {
      var rendered = renderGrouped(this.pm, content);
      if (rendered.childNodes.length) this.tooltip.open(elt("div", null, rendered), coords);else this.tooltip.close();
    }
  }, {
    key: "update",
    value: function update() {
      var _this2 = this;

      var _pm$selection = this.pm.selection;
      var empty = _pm$selection.empty;
      var node = _pm$selection.node;
      var $from = _pm$selection.$from;
      var to = _pm$selection.to;var link = void 0;
      if (!this.pm.hasFocus()) {
        this.tooltip.close();
      } else if (node && node.isBlock) {
        return function () {
          var coords = _this2.nodeSelectionCoords();
          return function () {
            return _this2.show(_this2.config.blockContent, coords);
          };
        };
      } else if (!empty) {
        return function () {
          var coords = node ? _this2.nodeSelectionCoords() : _this2.selectionCoords();
          var showBlock = _this2.selectedBlockMenu && $from.parentOffset == 0 && $from.end() == to;
          return function () {
            return _this2.show(showBlock ? _this2.selectedBlockContent : _this2.config.inlineContent, coords);
          };
        };
      } else if (this.selectedBlockMenu && $from.parent.content.size == 0) {
        return function () {
          var coords = _this2.selectionCoords();
          return function () {
            return _this2.show(_this2.config.blockContent, coords);
          };
        };
      } else if (this.config.showLinks && (link = this.linkUnderCursor())) {
        return function () {
          var coords = _this2.selectionCoords();
          return function () {
            return _this2.showLink(link, coords);
          };
        };
      } else {
        this.tooltip.close();
      }
    }
  }, {
    key: "selectionCoords",
    value: function selectionCoords() {
      var pos = this.config.position == "above" ? topCenterOfSelection(this.pm.root) : bottomCenterOfSelection(this.pm.root);
      if (pos.top != 0) return pos;
      var realPos = this.pm.coordsAtPos(this.pm.selection.from);
      return { left: realPos.left, top: this.config.position == "above" ? realPos.top : realPos.bottom };
    }
  }, {
    key: "nodeSelectionCoords",
    value: function nodeSelectionCoords() {
      var selected = this.pm.content.querySelector(".ProseMirror-selectednode");
      if (!selected) return { left: 0, top: 0 };
      var box = selected.getBoundingClientRect();
      return { left: Math.min((box.left + box.right) / 2, box.left + 20),
        top: this.config.position == "above" ? box.top : box.bottom };
    }
  }, {
    key: "linkUnderCursor",
    value: function linkUnderCursor() {
      var head = this.pm.selection.head;
      if (!head) return null;
      var marks = this.pm.doc.marksAt(head);
      return marks.reduce(function (found, m) {
        return found || m.type.name == "link" && m;
      }, null);
    }
  }, {
    key: "showLink",
    value: function showLink(link, pos) {
      var node = elt("div", { class: classPrefix + "-linktext" }, elt("a", { href: link.attrs.href,
        title: link.attrs.title,
        rel: "noreferrer noopener",
        target: "_blank" }, link.attrs.href));
      this.tooltip.open(node, pos);
    }
  }, {
    key: "onContextMenu",
    value: function onContextMenu(e) {
      if (!this.pm.selection.empty) return;
      var pos = this.pm.posAtCoords({ left: e.clientX, top: e.clientY });
      if (!pos || !this.pm.doc.resolve(pos).parent.isTextblock) return;

      this.pm.setTextSelection(pos, pos);
      this.pm.flush();
      this.show(this.config.inlineContent, this.selectionCoords());
    }
  }]);

  return TooltipMenu;
}();

// Get the x and y coordinates at the top center of the current DOM selection.


function topCenterOfSelection(root) {
  var range = root.getSelection().getRangeAt(0),
      rects = range.getClientRects();
  if (!rects.length) return range.getBoundingClientRect();
  var left = void 0,
      right = void 0,
      top = void 0,
      bottom = void 0;
  for (var i = 0; i < rects.length; i++) {
    var rect = rects[i];
    if (left == right) {
      ;left = rect.left;
      right = rect.right;
      top = rect.top;
      bottom = rect.bottom;
    } else if (rect.top < bottom - 1 && (
    // Chrome bug where bogus rectangles are inserted at span boundaries
    i == rects.length - 1 || Math.abs(rects[i + 1].left - rect.left) > 1)) {
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
      top = Math.min(top, rect.top);
    }
  }
  return { top: top, left: (left + right) / 2 };
}

function bottomCenterOfSelection(root) {
  var range = root.getSelection().getRangeAt(0),
      rects = range.getClientRects();
  if (!rects.length) {
    var rect = range.getBoundingClientRect();
    return { left: rect.left, top: rect.bottom };
  }

  var left = void 0,
      right = void 0,
      bottom = void 0,
      top = void 0;
  for (var i = rects.length - 1; i >= 0; i--) {
    var _rect = rects[i];
    if (left == right) {
      ;left = _rect.left;
      right = _rect.right;
      bottom = _rect.bottom;
      top = _rect.top;
    } else if (_rect.bottom > top + 1 && (i == 0 || Math.abs(rects[i - 1].left - _rect.left) > 1)) {
      left = Math.min(left, _rect.left);
      right = Math.max(right, _rect.right);
      bottom = Math.min(bottom, _rect.bottom);
    }
  }
  return { top: bottom, left: (left + right) / 2 };
}

// :: Plugin
// Enables the tooltip menu for this editor. This menu shows up when
// there is a selection, and optionally in certain other
// circumstances, providing context-relevant commands.
//
// By default, the tooltip will show inline menu commands (registered
// with the [`menuGroup`](#CommandSpec.menuGroup) command property)
// when there is an inline selection, and block related commands when
// there is a node selection on a block.
//
// The plugin supports the following options:
//
// **`showLinks`**`: bool = true`
//   : Causes a tooltip with the link target to show up when the
//     cursor is inside of a link (without a selection).
//
// **`selectedBlockMenu`**`: bool = false`
//   : When enabled, and a whole block is selected or the cursor is
//     inside an empty block, the block menu gets shown.
//
// **`inlineContent`**`: [`[`MenuGroup`](#MenuGroup)`]`
//   : The menu elements to show when displaying the menu for inline
//     content.
//
// **`blockContent`**`: [`[`MenuGroup`](#MenuGroup)`]`
//   : The menu elements to show when displaying the menu for block
//     content.
//
// **`selectedBlockContent`**`: [MenuGroup]`
//   : The elements to show when a full block has been selected and
//     `selectedBlockMenu` is enabled. Defaults to concatenating
//     `inlineContent` and `blockContent`.
//
// **`position`**`: string`
//  : Where, relative to the selection, the tooltip should appear.
//    Defaults to `"above"`. Can also be set to `"below"`.
var tooltipMenu = new Plugin(TooltipMenu, {
  showLinks: true,
  selectedBlockMenu: false,
  inlineContent: [],
  blockContent: [],
  selectedBlockContent: null,
  position: "above"
});
exports.tooltipMenu = tooltipMenu;

insertCSS("\n\n." + classPrefix + "-linktext a {\n  color: #444;\n  text-decoration: none;\n  padding: 0 5px;\n}\n\n." + classPrefix + "-linktext a:hover {\n  text-decoration: underline;\n}\n\n");
},{"../edit":10,"../ui":55,"../util/dom":60,"./menu":30}],33:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require("./fragment");

var Fragment = _require.Fragment;

var _require2 = require("./mark");

var Mark = _require2.Mark;

var ContentExpr = function () {
  function ContentExpr(nodeType, elements, inlineContent) {
    _classCallCheck(this, ContentExpr);

    this.nodeType = nodeType;
    this.elements = elements;
    this.inlineContent = inlineContent;
  }

  _createClass(ContentExpr, [{
    key: "start",
    value: function start(attrs) {
      return new ContentMatch(this, attrs, 0, 0);
    }
  }, {
    key: "matches",
    value: function matches(attrs, fragment, from, to) {
      return this.start(attrs).matchToEnd(fragment, from, to);
    }

    // Get a position in a known-valid fragment. If this is a simple
    // (single-element) expression, we don't have to do any matching,
    // and can simply skip to the position with count `index`.

  }, {
    key: "getMatchAt",
    value: function getMatchAt(attrs, fragment) {
      var index = arguments.length <= 2 || arguments[2] === undefined ? fragment.childCount : arguments[2];

      if (this.elements.length == 1) return new ContentMatch(this, attrs, 0, index);else return this.start(attrs).matchFragment(fragment, 0, index);
    }
  }, {
    key: "checkReplace",
    value: function checkReplace(attrs, content, from, to) {
      var replacement = arguments.length <= 4 || arguments[4] === undefined ? Fragment.empty : arguments[4];
      var start = arguments.length <= 5 || arguments[5] === undefined ? 0 : arguments[5];
      var end = arguments.length <= 6 || arguments[6] === undefined ? replacement.childCount : arguments[6];

      // Check for simple case, where the expression only has a single element
      // (Optimization to avoid matching more than we need)
      if (this.elements.length == 1) {
        var elt = this.elements[0];
        if (!checkCount(elt, content.childCount - (to - from) + (end - start), attrs, this)) return false;
        for (var i = start; i < end; i++) {
          if (!elt.matches(replacement.child(i), attrs, this)) return false;
        }return true;
      }

      var match = this.getMatchAt(attrs, content, from).matchFragment(replacement, start, end);
      return match ? match.matchToEnd(content, to) : false;
    }
  }, {
    key: "checkReplaceWith",
    value: function checkReplaceWith(attrs, content, from, to, type, typeAttrs, marks) {
      if (this.elements.length == 1) {
        var elt = this.elements[0];
        if (!checkCount(elt, content.childCount - (to - from) + 1, attrs, this)) return false;
        return elt.matchesType(type, typeAttrs, marks, attrs, this);
      }

      var match = this.getMatchAt(attrs, content, from).matchType(type, typeAttrs, marks);
      return match ? match.matchToEnd(content, to) : false;
    }
  }, {
    key: "compatible",
    value: function compatible(other) {
      for (var i = 0; i < this.elements.length; i++) {
        var elt = this.elements[i];
        for (var j = 0; j < other.elements.length; j++) {
          if (other.elements[j].compatible(elt)) return true;
        }
      }
      return false;
    }
  }, {
    key: "generateContent",
    value: function generateContent(attrs) {
      return this.start(attrs).fillBefore(Fragment.empty, true);
    }
  }, {
    key: "isLeaf",
    get: function get() {
      return this.elements.length == 0;
    }
  }], [{
    key: "parse",
    value: function parse(nodeType, expr, specs) {
      var elements = [],
          pos = 0,
          inline = null;
      for (;;) {
        pos += /^\s*/.exec(expr.slice(pos))[0].length;
        if (pos == expr.length) break;

        var types = /^(?:(\w+)|\(\s*(\w+(?:\s*\|\s*\w+)*)\s*\))/.exec(expr.slice(pos));
        if (!types) throw new SyntaxError("Invalid content expression '" + expr + "' at " + pos);
        pos += types[0].length;
        var attrs = /^\[([^\]]+)\]/.exec(expr.slice(pos));
        if (attrs) pos += attrs[0].length;
        var marks = /^<(?:(_)|\s*(\w+(?:\s+\w+)*)\s*)>/.exec(expr.slice(pos));
        if (marks) pos += marks[0].length;
        var repeat = /^(?:([+*?])|\{\s*(\d+|\.\w+)\s*(,\s*(\d+|\.\w+)?)?\s*\})/.exec(expr.slice(pos));
        if (repeat) pos += repeat[0].length;

        var nodeTypes = expandTypes(nodeType.schema, specs, types[1] ? [types[1]] : types[2].split(/\s*\|\s*/));
        for (var i = 0; i < nodeTypes.length; i++) {
          if (inline == null) inline = nodeTypes[i].isInline;else if (inline != nodeTypes[i].isInline) throw new SyntaxError("Mixing inline and block content in a single node");
        }
        var attrSet = !attrs ? null : parseAttrs(nodeType, attrs[1]);
        var markSet = !marks ? false : marks[1] ? true : checkMarks(nodeType.schema, marks[2].split(/\s+/));

        var _parseRepeat = parseRepeat(nodeType, repeat);

        var min = _parseRepeat.min;
        var max = _parseRepeat.max;

        if (min != 0 && nodeTypes[0].hasRequiredAttrs(attrSet)) throw new SyntaxError("Node type " + types[0] + " in type " + nodeType.name + " is required, but has non-optional attributes");
        var newElt = new ContentElement(nodeTypes, attrSet, markSet, min, max);
        for (var _i = elements.length - 1; _i >= 0; _i--) {
          var prev = elements[_i];
          if (prev.min != prev.max && prev.overlaps(newElt)) throw new SyntaxError("Possibly ambiguous overlapping adjacent content expressions in '" + expr + "'");
          if (prev.min != 0) break;
        }
        elements.push(newElt);
      }

      return new ContentExpr(nodeType, elements, !!inline);
    }
  }]);

  return ContentExpr;
}();

exports.ContentExpr = ContentExpr;

var ContentElement = function () {
  function ContentElement(nodeTypes, attrs, marks, min, max) {
    _classCallCheck(this, ContentElement);

    this.nodeTypes = nodeTypes;
    this.attrs = attrs;
    this.marks = marks;
    this.min = min;
    this.max = max;
  }

  _createClass(ContentElement, [{
    key: "matchesType",
    value: function matchesType(type, attrs, marks, parentAttrs, parentExpr) {
      if (this.nodeTypes.indexOf(type) == -1) return false;
      if (this.attrs) {
        if (!attrs) return false;
        for (var prop in this.attrs) {
          if (attrs[prop] != _resolveValue(this.attrs[prop], parentAttrs, parentExpr)) return false;
        }
      }
      if (this.marks === true) return true;
      if (this.marks === false) return marks.length == 0;
      for (var i = 0; i < marks.length; i++) {
        if (this.marks.indexOf(marks[i].type) == -1) return false;
      }return true;
    }
  }, {
    key: "matches",
    value: function matches(node, parentAttrs, parentExpr) {
      return this.matchesType(node.type, node.attrs, node.marks, parentAttrs, parentExpr);
    }
  }, {
    key: "compatible",
    value: function compatible(other) {
      for (var i = 0; i < this.nodeTypes.length; i++) {
        if (other.nodeTypes.indexOf(this.nodeTypes[i]) != -1) return true;
      }return false;
    }
  }, {
    key: "constrainedAttrs",
    value: function constrainedAttrs(parentAttrs, expr) {
      if (!this.attrs) return null;
      var attrs = Object.create(null);
      for (var prop in this.attrs) {
        attrs[prop] = _resolveValue(this.attrs[prop], parentAttrs, expr);
      }return attrs;
    }
  }, {
    key: "createFiller",
    value: function createFiller(parentAttrs, expr) {
      var type = this.nodeTypes[0],
          attrs = type.computeAttrs(this.constrainedAttrs(parentAttrs, expr));
      return type.create(attrs, type.contentExpr.generateContent(attrs));
    }
  }, {
    key: "defaultType",
    value: function defaultType() {
      return this.nodeTypes[0].defaultAttrs && this.nodeTypes[0];
    }
  }, {
    key: "overlaps",
    value: function overlaps(other) {
      return this.nodeTypes.some(function (t) {
        return other.nodeTypes.indexOf(t) > -1;
      });
    }
  }, {
    key: "allowsMark",
    value: function allowsMark(markType) {
      return this.marks === true || this.marks && this.marks.indexOf(markType) > -1;
    }
  }]);

  return ContentElement;
}();

// ;; Represents a partial match of a node type's [content
// expression](#NodeSpec), and can be used to find out whether further
// content matches here, and whether a given position is a valid end
// of the parent node.


var ContentMatch = function () {
  function ContentMatch(expr, attrs, index, count) {
    _classCallCheck(this, ContentMatch);

    this.expr = expr;
    this.attrs = attrs;
    this.index = index;
    this.count = count;
  }

  _createClass(ContentMatch, [{
    key: "move",
    value: function move(index, count) {
      return new ContentMatch(this.expr, this.attrs, index, count);
    }
  }, {
    key: "resolveValue",
    value: function resolveValue(value) {
      return value instanceof AttrValue ? _resolveValue(value, this.attrs, this.expr) : value;
    }

    // :: (Node) → ?ContentMatch
    // Match a node, returning a new match after the node if successful.

  }, {
    key: "matchNode",
    value: function matchNode(node) {
      return this.matchType(node.type, node.attrs, node.marks);
    }

    // :: (NodeType, ?Object, [Mark]) → ?ContentMatch
    // Match a node type and marks, returning an match after that node
    // if successful.

  }, {
    key: "matchType",
    value: function matchType(type, attrs) {
      var marks = arguments.length <= 2 || arguments[2] === undefined ? Mark.none : arguments[2];

      // FIXME `var` to work around Babel bug T7293
      for (index = this.index, count = this.count, void 0; index < this.expr.elements.length; index++, count = 0) {
        var index, count;

        var elt = this.expr.elements[index],
            max = this.resolveValue(elt.max);
        if (count < max && elt.matchesType(type, attrs, marks, this.attrs, this.expr)) {
          count++;
          return this.move(index, count);
        }
        if (count < this.resolveValue(elt.min)) return null;
      }
    }

    // :: (Fragment, ?number, ?number) → ?union<ContentMatch, bool>
    // Try to match a fragment. Returns a new match when successful,
    // `null` when it ran into a required element it couldn't fit, and
    // `false` if it reached the end of the expression without
    // matching all nodes.

  }, {
    key: "matchFragment",
    value: function matchFragment(fragment) {
      var from = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];
      var to = arguments.length <= 2 || arguments[2] === undefined ? fragment.childCount : arguments[2];

      if (from == to) return this;
      var fragPos = from,
          end = this.expr.elements.length;
      for (index = this.index, count = this.count, void 0; index < end; index++, count = 0) {
        var index, count;

        var elt = this.expr.elements[index],
            max = this.resolveValue(elt.max);

        while (count < max) {
          if (elt.matches(fragment.child(fragPos), this.attrs, this.expr)) {
            count++;
            if (++fragPos == to) return this.move(index, count);
          } else {
            break;
          }
        }
        if (count < this.resolveValue(elt.min)) return null;
      }
      return false;
    }

    // :: (Fragment, ?number, ?number) → bool
    // Returns true only if the fragment matches here, and reaches all
    // the way to the end of the content expression.

  }, {
    key: "matchToEnd",
    value: function matchToEnd(fragment, start, end) {
      var matched = this.matchFragment(fragment, start, end);
      return matched && matched.validEnd() || false;
    }

    // :: () → bool
    // Returns true if this position represents a valid end of the
    // expression (no required content follows after it).

  }, {
    key: "validEnd",
    value: function validEnd() {
      for (var i = this.index, count = this.count; i < this.expr.elements.length; i++, count = 0) {
        if (count < this.resolveValue(this.expr.elements[i].min)) return false;
      }return true;
    }

    // :: (Fragment, bool, ?number) → ?Fragment
    // Try to match the given fragment, and if that fails, see if it can
    // be made to match by inserting nodes in front of it. When
    // successful, return a fragment of inserted nodes (which may be
    // empty if nothing had to be inserted). When `toEnd` is true, only
    // return a fragment if the resulting match goes to the end of the
    // content expression.

  }, {
    key: "fillBefore",
    value: function fillBefore(after, toEnd, startIndex) {
      var added = [],
          match = this,
          index = startIndex || 0,
          end = this.expr.elements.length;
      for (;;) {
        var fits = match.matchFragment(after, index);
        if (fits && (!toEnd || fits.validEnd())) return Fragment.from(added);
        if (fits === false) return null; // Matched to end with content remaining

        var elt = match.element;
        if (match.count < this.resolveValue(elt.min)) {
          added.push(elt.createFiller(this.attrs, this.expr));
          match = match.move(match.index, match.count + 1);
        } else if (match.index < end) {
          match = match.move(match.index + 1, 0);
        } else if (after.childCount > index) {
          return null;
        } else {
          return Fragment.from(added);
        }
      }
    }
  }, {
    key: "possibleContent",
    value: function possibleContent() {
      var found = [];
      for (var i = this.index, count = this.count; i < this.expr.elements.length; i++, count = 0) {
        var elt = this.expr.elements[i],
            attrs = elt.constrainedAttrs(this.attrs, this.expr);
        if (count < this.resolveValue(elt.max)) for (var j = 0; j < elt.nodeTypes.length; j++) {
          var type = elt.nodeTypes[j];
          if (!type.hasRequiredAttrs(attrs)) found.push({ type: type, attrs: attrs });
        }
        if (this.resolveValue(elt.min) > count) break;
      }
      return found;
    }

    // :: (MarkType) → bool
    // Check whether a node with the given mark type is allowed after
    // this position.

  }, {
    key: "allowsMark",
    value: function allowsMark(markType) {
      return this.element.allowsMark(markType);
    }

    // :: (NodeType, ?Object) → ?[{type: NodeType, attrs: Object}]
    // Find a set of wrapping node types that would allow a node of type
    // `target` with attributes `targetAttrs` to appear at this
    // position. The result may be empty (when it fits directly) and
    // will be null when no such wrapping exists.

  }, {
    key: "findWrapping",
    value: function findWrapping(target, targetAttrs) {
      // FIXME find out how expensive this is. Try to reintroduce caching?
      var seen = Object.create(null),
          first = { match: this, via: null },
          active = [first];
      while (active.length) {
        var current = active.shift(),
            match = current.match;
        if (match.matchType(target, targetAttrs)) {
          var result = [];
          for (var obj = current; obj != first; obj = obj.via) {
            result.push({ type: obj.match.expr.nodeType, attrs: obj.match.attrs });
          }return result.reverse();
        }
        var possible = match.possibleContent();
        for (var i = 0; i < possible.length; i++) {
          var _possible$i = possible[i];
          var type = _possible$i.type;
          var attrs = _possible$i.attrs;var fullAttrs = type.computeAttrs(attrs);
          if (!type.isLeaf && !(type.name in seen) && (current == first || match.matchType(type, fullAttrs).validEnd())) {
            active.push({ match: type.contentExpr.start(fullAttrs), via: current });
            seen[type.name] = true;
          }
        }
      }
    }
  }, {
    key: "element",
    get: function get() {
      return this.expr.elements[this.index];
    }
  }, {
    key: "nextElement",
    get: function get() {
      for (var i = this.index, count = this.count; i < this.expr.elements.length; i++) {
        var element = this.expr.elements[i];
        if (this.resolveValue(element.max) > count) return element;
        count = 0;
      }
    }
  }]);

  return ContentMatch;
}();

exports.ContentMatch = ContentMatch;

var AttrValue = function AttrValue(attr) {
  _classCallCheck(this, AttrValue);

  this.attr = attr;
};

function parseValue(nodeType, value) {
  if (value.charAt(0) == ".") {
    var attr = value.slice(1);
    if (!nodeType.attrs[attr]) throw new SyntaxError("Node type " + nodeType.name + " has no attribute " + attr);
    return new AttrValue(attr);
  } else {
    return JSON.parse(value);
  }
}

function checkMarks(schema, marks) {
  var found = [];
  for (var i = 0; i < marks.length; i++) {
    var mark = schema.marks[marks[i]];
    if (mark) found.push(mark);else throw new SyntaxError("Unknown mark type: '" + marks[i] + "'");
  }
  return found;
}

function _resolveValue(value, attrs, expr) {
  if (!(value instanceof AttrValue)) return value;
  var attrVal = attrs && attrs[value.attr];
  return attrVal !== undefined ? attrVal : expr.nodeType.defaultAttrs[value.attr];
}

function checkCount(elt, count, attrs, expr) {
  return count >= _resolveValue(elt.min, attrs, expr) && count <= _resolveValue(elt.max, attrs, expr);
}

function expandTypes(schema, specs, types) {
  var result = [];
  types.forEach(function (type) {
    var found = schema.nodes[type];
    if (found) {
      if (result.indexOf(found) == -1) result.push(found);
    } else {
      specs.forEach(function (name, spec) {
        if (spec.group && spec.group.split(" ").indexOf(type) > -1) {
          found = schema.nodes[name];
          if (result.indexOf(found) == -1) result.push(found);
        }
      });
    }
    if (!found) throw new SyntaxError("Node type or group '" + type + "' does not exist");
  });
  return result;
}

var many = 2e9; // Big number representable as a 32-bit int

function parseRepeat(nodeType, match) {
  var min = 1,
      max = 1;
  if (match) {
    if (match[1] == "+") {
      max = many;
    } else if (match[1] == "*") {
      min = 0;
      max = many;
    } else if (match[1] == "?") {
      min = 0;
    } else if (match[2]) {
      min = parseValue(nodeType, match[2]);
      if (match[3]) max = match[4] ? parseValue(nodeType, match[4]) : many;else max = min;
    }
    if (max == 0 || min > max) throw new SyntaxError("Invalid repeat count in '" + match[0] + "'");
  }
  return { min: min, max: max };
}

function parseAttrs(nodeType, expr) {
  var parts = expr.split(/\s*,\s*/);
  var attrs = Object.create(null);
  for (var i = 0; i < parts.length; i++) {
    var match = /^(\w+)=(\w+|\"(?:\\.|[^\\])*\"|\.\w+)$/.exec(parts[i]);
    if (!match) throw new SyntaxError("Invalid attribute syntax: " + parts[i]);
    attrs[match[1]] = parseValue(nodeType, match[2]);
  }
  return attrs;
}
},{"./fragment":35,"./mark":38}],34:[function(require,module,exports){
"use strict";

function findDiffStart(a, b, pos) {
  for (var i = 0;; i++) {
    if (i == a.childCount || i == b.childCount) return a.childCount == b.childCount ? null : pos;

    var childA = a.child(i),
        childB = b.child(i);
    if (childA == childB) {
      pos += childA.nodeSize;continue;
    }

    if (!childA.sameMarkup(childB)) return pos;

    if (childA.isText && childA.text != childB.text) {
      for (var j = 0; childA.text[j] == childB.text[j]; j++) {
        pos++;
      }return pos;
    }
    if (childA.content.size || childB.content.size) {
      var inner = findDiffStart(childA.content, childB.content, pos + 1);
      if (inner != null) return inner;
    }
    pos += childA.nodeSize;
  }
}
exports.findDiffStart = findDiffStart;

function findDiffEnd(a, b, posA, posB) {
  for (var iA = a.childCount, iB = b.childCount;;) {
    if (iA == 0 || iB == 0) return iA == iB ? null : { a: posA, b: posB };

    var childA = a.child(--iA),
        childB = b.child(--iB),
        size = childA.nodeSize;
    if (childA == childB) {
      posA -= size;posB -= size;
      continue;
    }

    if (!childA.sameMarkup(childB)) return { a: posA, b: posB };

    if (childA.isText && childA.text != childB.text) {
      var same = 0,
          minSize = Math.min(childA.text.length, childB.text.length);
      while (same < minSize && childA.text[childA.text.length - same - 1] == childB.text[childB.text.length - same - 1]) {
        same++;posA--;posB--;
      }
      return { a: posA, b: posB };
    }
    if (childA.content.size || childB.content.size) {
      var inner = findDiffEnd(childA.content, childB.content, posA - 1, posB - 1);
      if (inner) return inner;
    }
    posA -= size;posB -= size;
  }
}
exports.findDiffEnd = findDiffEnd;
},{}],35:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require("./to_dom");

var fragmentToDOM = _require.fragmentToDOM;

var _require2 = require("./diff");

var _findDiffStart = _require2.findDiffStart;
var _findDiffEnd = _require2.findDiffEnd;

// ;; Fragment is the type used to represent a node's collection of
// child nodes.
//
// Fragments are persistent data structures. That means you should
// _not_ mutate them or their content, but create new instances
// whenever needed. The API tries to make this easy.

var Fragment = function () {
  function Fragment(content, size) {
    _classCallCheck(this, Fragment);

    this.content = content;
    this.size = size || 0;
    if (size == null) for (var i = 0; i < content.length; i++) {
      this.size += content[i].nodeSize;
    }
  }

  // :: () → string
  // Return a debugging string that describes this fragment.


  _createClass(Fragment, [{
    key: "toString",
    value: function toString() {
      return "<" + this.toStringInner() + ">";
    }
  }, {
    key: "toStringInner",
    value: function toStringInner() {
      return this.content.join(", ");
    }
  }, {
    key: "nodesBetween",
    value: function nodesBetween(from, to, f, nodeStart, parent) {
      for (var i = 0, pos = 0; pos < to; i++) {
        var child = this.content[i],
            end = pos + child.nodeSize;
        if (end > from && f(child, nodeStart + pos, parent, i) !== false && child.content.size) {
          var start = pos + 1;
          child.nodesBetween(Math.max(0, from - start), Math.min(child.content.size, to - start), f, nodeStart + start);
        }
        pos = end;
      }
    }

    // : (number, number, string) → string

  }, {
    key: "textBetween",
    value: function textBetween(from, to, separator) {
      var text = "",
          separated = true;
      this.nodesBetween(from, to, function (node, pos) {
        if (node.isText) {
          text += node.text.slice(Math.max(from, pos) - pos, to - pos);
          separated = !separator;
        } else if (!separated && node.isBlock) {
          text += separator;
          separated = true;
        }
      }, 0);
      return text;
    }

    // :: (number, ?number) → Fragment
    // Cut out the sub-fragment between the two given positions.

  }, {
    key: "cut",
    value: function cut(from, to) {
      if (to == null) to = this.size;
      if (from == 0 && to == this.size) return this;
      var result = [],
          size = 0;
      if (to > from) for (var i = 0, pos = 0; pos < to; i++) {
        var child = this.content[i],
            end = pos + child.nodeSize;
        if (end > from) {
          if (pos < from || end > to) {
            if (child.isText) child = child.cut(Math.max(0, from - pos), Math.min(child.text.length, to - pos));else child = child.cut(Math.max(0, from - pos - 1), Math.min(child.content.size, to - pos - 1));
          }
          result.push(child);
          size += child.nodeSize;
        }
        pos = end;
      }
      return new Fragment(result, size);
    }
  }, {
    key: "cutByIndex",
    value: function cutByIndex(from, to) {
      if (from == to) return Fragment.empty;
      if (from == 0 && to == this.content.length) return this;
      return new Fragment(this.content.slice(from, to));
    }

    // :: (Fragment) → Fragment
    // Create a new fragment containing the content of this fragment and
    // `other`.

  }, {
    key: "append",
    value: function append(other) {
      if (!other.size) return this;
      if (!this.size) return other;
      var last = this.lastChild,
          first = other.firstChild,
          content = this.content.slice(),
          i = 0;
      if (last.isText && last.sameMarkup(first)) {
        content[content.length - 1] = last.withText(last.text + first.text);
        i = 1;
      }
      for (; i < other.content.length; i++) {
        content.push(other.content[i]);
      }return new Fragment(content, this.size + other.size);
    }

    // :: (number, Node) → Fragment
    // Create a new fragment in which the node at the given index is
    // replaced by the given node.

  }, {
    key: "replaceChild",
    value: function replaceChild(index, node) {
      var current = this.content[index];
      if (current == node) return this;
      var copy = this.content.slice();
      var size = this.size + node.nodeSize - current.nodeSize;
      copy[index] = node;
      return new Fragment(copy, size);
    }

    // (Node) → Fragment
    // Create a new fragment by prepending the given node to this
    // fragment.

  }, {
    key: "addToStart",
    value: function addToStart(node) {
      return new Fragment([node].concat(this.content), this.size + node.nodeSize);
    }

    // (Node) → Fragment
    // Create a new fragment by appending the given node to this
    // fragment.

  }, {
    key: "addToEnd",
    value: function addToEnd(node) {
      return new Fragment(this.content.concat(node), this.size + node.nodeSize);
    }

    // :: () → ?Object
    // Create a JSON-serializeable representation of this fragment.

  }, {
    key: "toJSON",
    value: function toJSON() {
      return this.content.length ? this.content.map(function (n) {
        return n.toJSON();
      }) : null;
    }

    // :: (Schema, ?Object) → Fragment
    // Deserialize a fragment from its JSON representation.

  }, {
    key: "eq",


    // :: (Fragment) → bool
    // Compare this fragment to another one.
    value: function eq(other) {
      if (this.content.length != other.content.length) return false;
      for (var i = 0; i < this.content.length; i++) {
        if (!this.content[i].eq(other.content[i])) return false;
      }return true;
    }

    // :: (?union<Fragment, Node, [Node]>) → Fragment
    // Create a fragment from something that can be interpreted as a set
    // of nodes. For `null`, it returns the empty fragment. For a
    // fragment, the fragment itself. For a node or array of nodes, a
    // fragment containing those nodes.

  }, {
    key: "child",


    // :: (number) → Node
    // Get the child node at the given index. Raise an error when the
    // index is out of range.
    value: function child(index) {
      var found = this.content[index];
      if (!found) throw new RangeError("Index " + index + " out of range for " + this);
      return found;
    }

    // :: (number) → ?Node
    // Get the child node at the given index, if it exists.

  }, {
    key: "maybeChild",
    value: function maybeChild(index) {
      return this.content[index];
    }

    // :: ((node: Node, offset: number, index: number))
    // Call `f` for every child node, passing the node, its offset
    // into this parent node, and its index.

  }, {
    key: "forEach",
    value: function forEach(f) {
      for (var i = 0, p = 0; i < this.content.length; i++) {
        var child = this.content[i];
        f(child, p, i);
        p += child.nodeSize;
      }
    }

    // :: (Fragment) → ?number
    // Find the first position at which this fragment and another
    // fragment differ, or `null` if they are the same.

  }, {
    key: "findDiffStart",
    value: function findDiffStart(other) {
      var pos = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];

      return _findDiffStart(this, other, pos);
    }

    // :: (Node) → ?{a: number, b: number}
    // Find the first position, searching from the end, at which this
    // fragment and the given fragment differ, or `null` if they are the
    // same. Since this position will not be the same in both nodes, an
    // object with two separate positions is returned.

  }, {
    key: "findDiffEnd",
    value: function findDiffEnd(other) {
      var pos = arguments.length <= 1 || arguments[1] === undefined ? this.size : arguments[1];
      var otherPos = arguments.length <= 2 || arguments[2] === undefined ? other.size : arguments[2];

      return _findDiffEnd(this, other, pos, otherPos);
    }

    // : (number, ?number) → {index: number, offset: number}
    // Find the index and inner offset corresponding to a given relative
    // position in this fragment. The result object will be reused
    // (overwritten) the next time the function is called. (Not public.)

  }, {
    key: "findIndex",
    value: function findIndex(pos) {
      var round = arguments.length <= 1 || arguments[1] === undefined ? -1 : arguments[1];

      if (pos == 0) return retIndex(0, pos);
      if (pos == this.size) return retIndex(this.content.length, pos);
      if (pos > this.size || pos < 0) throw new RangeError("Position " + pos + " outside of fragment (" + this + ")");
      for (var i = 0, curPos = 0;; i++) {
        var cur = this.child(i),
            end = curPos + cur.nodeSize;
        if (end >= pos) {
          if (end == pos || round > 0) return retIndex(i + 1, end);
          return retIndex(i, curPos);
        }
        curPos = end;
      }
    }

    // :: (?Object) → DOMFragment
    // Serialize the content of this fragment to a DOM fragment. When
    // not in the browser, the `document` option, containing a DOM
    // document, should be passed so that the serialize can create
    // nodes.
    //
    // To specify rendering behavior for your own [node](#NodeType) and
    // [mark](#MarkType) types, define a [`toDOM`](#NodeType.toDOM)
    // method on them.

  }, {
    key: "toDOM",
    value: function toDOM() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
      return fragmentToDOM(this, options);
    }
  }, {
    key: "firstChild",


    // :: ?Node
    // The first child of the fragment, or `null` if it is empty.
    get: function get() {
      return this.content.length ? this.content[0] : null;
    }

    // :: ?Node
    // The last child of the fragment, or `null` if it is empty.

  }, {
    key: "lastChild",
    get: function get() {
      return this.content.length ? this.content[this.content.length - 1] : null;
    }

    // :: number
    // The number of child nodes in this fragment.

  }, {
    key: "childCount",
    get: function get() {
      return this.content.length;
    }
  }], [{
    key: "fromJSON",
    value: function fromJSON(schema, value) {
      return value ? new Fragment(value.map(schema.nodeFromJSON)) : Fragment.empty;
    }

    // :: ([Node]) → Fragment
    // Build a fragment from an array of nodes. Ensures that adjacent
    // text nodes with the same style are joined together.

  }, {
    key: "fromArray",
    value: function fromArray(array) {
      if (!array.length) return Fragment.empty;
      var joined = void 0,
          size = 0;
      for (var i = 0; i < array.length; i++) {
        var node = array[i];
        size += node.nodeSize;
        if (i && node.isText && array[i - 1].sameMarkup(node)) {
          if (!joined) joined = array.slice(0, i);
          joined[joined.length - 1] = node.withText(joined[joined.length - 1].text + node.text);
        } else if (joined) {
          joined.push(node);
        }
      }
      return new Fragment(joined || array, size);
    }
  }, {
    key: "from",
    value: function from(nodes) {
      if (!nodes) return Fragment.empty;
      if (nodes instanceof Fragment) return nodes;
      if (Array.isArray(nodes)) return this.fromArray(nodes);
      return new Fragment([nodes], nodes.nodeSize);
    }
  }]);

  return Fragment;
}();

exports.Fragment = Fragment;

var found = { index: 0, offset: 0 };
function retIndex(index, offset) {
  found.index = index;
  found.offset = offset;
  return found;
}

// :: Fragment
// An empty fragment. Intended to be reused whenever a node doesn't
// contain anything (rather than allocating a new empty fragment for
// each leaf node).
Fragment.empty = new Fragment([], 0);
},{"./diff":34,"./to_dom":43}],36:[function(require,module,exports){
"use strict";

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require("./fragment");

var Fragment = _require.Fragment;

var _require2 = require("./mark");

var Mark = _require2.Mark;


function parseDOM(schema, dom, options) {
  var topNode = options.topNode;
  var top = new NodeBuilder(topNode ? topNode.type : schema.nodes.doc, topNode ? topNode.attrs : null, true, null, null, options.preserveWhitespace);
  var state = new DOMParseState(schema, options, top);
  state.addAll(dom, null, options.from, options.to);
  return top.finish(null);
}
exports.parseDOM = parseDOM;

// : (ResolvedPos, DOMNode, ?Object) → Slice
// Parse a DOM fragment into a `Slice`, starting with the context at
// `$context`. If the DOM nodes are known to be 'open' (as in
// `Slice`), pass their left open depth as the `openLeft` option.
function parseDOMInContext($context, dom) {
  var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

  var schema = $context.parent.type.schema;

  var _builderFromContext = builderFromContext($context, options.preserveWhitespace);

  var builder = _builderFromContext.builder;
  var top = _builderFromContext.top;

  var openLeft = options.openLeft,
      startPos = $context.depth;

  var state = new (function (_DOMParseState) {
    _inherits(_class, _DOMParseState);

    function _class() {
      _classCallCheck(this, _class);

      return _possibleConstructorReturn(this, Object.getPrototypeOf(_class).apply(this, arguments));
    }

    _createClass(_class, [{
      key: "enter",
      value: function enter(type, attrs, preserveWhitespace) {
        if (openLeft == null) openLeft = type.isTextblock ? 1 : 0;
        if (openLeft > 0 && this.top.match.matchType(type, attrs)) openLeft = 0;
        if (openLeft == 0) return _get(Object.getPrototypeOf(_class.prototype), "enter", this).call(this, type, attrs, preserveWhitespace);

        openLeft--;
        return null;
      }
    }]);

    return _class;
  }(DOMParseState))(schema, options, builder);
  state.addAll(dom);

  var openTo = top.openDepth,
      doc = top.finish(openTo),
      $startPos = doc.resolve(startPos);
  for (var d = $startPos.depth; d >= 0 && startPos == $startPos.end(d); d--) {
    ++startPos;
  }return doc.slice(startPos, doc.content.size - openTo);
}
exports.parseDOMInContext = parseDOMInContext;

function builderFromContext($context, preserveWhitespace) {
  var top = void 0,
      builder = void 0;
  for (var i = 0; i <= $context.depth; i++) {
    var node = $context.node(i),
        match = node.contentMatchAt($context.index(i));
    if (i == 0) builder = top = new NodeBuilder(node.type, node.attrs, true, null, match, preserveWhitespace);else builder = builder.start(node.type, node.attrs, false, match, preserveWhitespace);
  }
  return { builder: builder, top: top };
}

// ;; #path=ParseSpec #kind=interface
// A value that describes how to parse a given DOM node as a
// ProseMirror node or mark type. Specifies the attributes of the new
// node or mark, along with optional information about the way the
// node's content should be treated.
//
// May either be a set of attributes, where `null` indicates the
// node's default attributes, or an array containing first a set of
// attributes and then an object describing the treatment of the
// node's content. Such an object may have the following properties:
//
// **`content`**`: ?union<bool, DOMNode>`
//   : If this is `false`, the content will be ignored. If it is not
//     given, the DOM node's children will be parsed as content of the
//     ProseMirror node or mark. If it is a DOM node, that DOM node's
//     content is treated as the content of the new node or mark (this
//     is useful if, for example, your DOM representation puts its
//     child nodes in an inner wrapping node).
//
// **`preserveWhitespace`**`: ?bool`
//   : When given, this enables or disables preserving of whitespace
//     when parsing the content.

var NodeBuilder = function () {
  function NodeBuilder(type, attrs, solid, prev, match, preserveWhitespace) {
    _classCallCheck(this, NodeBuilder);

    // : NodeType
    // The type of the node being built
    this.type = type;
    // : ContentMatch
    // The content match at this point, used to determine whether
    // other nodes may be added here.
    this.match = match || type.contentExpr.start(attrs);
    // : bool
    // True when the node is found in the source, and thus should be
    // preserved until its end. False when it was made up to provide a
    // wrapper for another node.
    this.solid = solid;
    // : [Node]
    // The nodes that have been added so far.
    this.content = [];
    // : ?NodeBuilder
    // The builder for the parent node, if any.
    this.prev = prev;
    // : ?NodeBuilder
    // The builder for the last child, if that is still open (see
    // `NodeBuilder.start`)
    this.openChild = null;
    // : bool
    this.preserveWhitespace = preserveWhitespace;
  }

  // : (Node) → ?Node
  // Try to add a node. Strip it of marks if necessary. Returns null
  // when the node doesn't fit here.


  _createClass(NodeBuilder, [{
    key: "add",
    value: function add(node) {
      var _this2 = this;

      var matched = this.match.matchNode(node);
      if (!matched && node.marks.length) {
        node = node.mark(node.marks.filter(function (mark) {
          return _this2.match.allowsMark(mark.type);
        }));
        matched = this.match.matchNode(node);
      }
      if (!matched) return null;
      this.closeChild();
      this.content.push(node);
      this.match = matched;
      return node;
    }

    // : (NodeType, ?Object, bool, ?ContentMatch) → ?NodeBuilder
    // Try to start a new node at this point.

  }, {
    key: "start",
    value: function start(type, attrs, solid, match, preserveWhitespace) {
      var matched = this.match.matchType(type, attrs);
      if (!matched) return null;
      this.closeChild();
      this.match = matched;
      return this.openChild = new NodeBuilder(type, attrs, solid, this, match, preserveWhitespace);
    }
  }, {
    key: "closeChild",
    value: function closeChild(openRight) {
      if (this.openChild) {
        this.content.push(this.openChild.finish(openRight && openRight - 1));
        this.openChild = null;
      }
    }

    // : ()
    // Strip any trailing space text from the builder's content.

  }, {
    key: "stripTrailingSpace",
    value: function stripTrailingSpace() {
      if (this.openChild) return;
      var last = this.content[this.content.length - 1],
          m = void 0;
      if (last && last.isText && (m = /\s+$/.exec(last.text))) {
        if (last.text.length == m[0].length) this.content.pop();else this.content[this.content.length - 1] = last.withText(last.text.slice(0, last.text.length - m[0].length));
      }
    }

    // : (?number) → Node
    // Finish this node. If `openRight` is > 0, the node (and `openRight
    // - 1` last children) is partial, and we don't need to 'close' it
    // by filling in required content.

  }, {
    key: "finish",
    value: function finish(openRight) {
      if (!this.preserveWhitespace) this.stripTrailingSpace();
      this.closeChild(openRight);
      var content = Fragment.from(this.content);
      if (!openRight) content = content.append(this.match.fillBefore(Fragment.empty, true));
      this.content = null;
      return this.type.create(this.match.attrs, content);
    }

    // : (NodeType, ?Object, ?Node) → ?NodeBuilder
    // Try to find a valid place to add a node with the given type and
    // attributes. When successful, if `node` was given, add it in its
    // entirety and return the builder to which it was added. If not,
    // start a node of the given type and return the builder for it.

  }, {
    key: "findPlace",
    value: function findPlace(type, attrs, node, preserveWhitespace) {
      var route = void 0,
          builder = void 0;
      for (var top = this;; top = top.prev) {
        var found = top.match.findWrapping(type, attrs);
        if (found && (!route || route.length > found.length)) {
          route = found;
          builder = top;
          if (!found.length) break;
        }
        if (top.solid) break;
      }

      if (!route) return null;
      for (var i = 0; i < route.length; i++) {
        builder = builder.start(route[i].type, route[i].attrs, false);
      }return node ? builder.add(node) && builder : builder.start(type, attrs, true, null, preserveWhitespace);
    }
  }, {
    key: "depth",
    get: function get() {
      var d = 0;
      for (var b = this.prev; b; b = b.prev) {
        d++;
      }return d;
    }
  }, {
    key: "openDepth",
    get: function get() {
      var d = 0;
      for (var c = this.openChild; c; c = c.openChild) {
        d++;
      }return d;
    }
  }, {
    key: "posBeforeLastChild",
    get: function get() {
      var pos = this.prev ? this.prev.posBeforeLastChild + 1 : 0;
      for (var i = 0; i < this.content.length; i++) {
        pos += this.content[i].nodeSize;
      }return pos;
    }
  }, {
    key: "currentPos",
    get: function get() {
      this.closeChild();
      return this.posBeforeLastChild;
    }
  }]);

  return NodeBuilder;
}();

// : Object<bool> The block-level tags in HTML5


var blockTags = {
  address: true, article: true, aside: true, blockquote: true, canvas: true,
  dd: true, div: true, dl: true, fieldset: true, figcaption: true, figure: true,
  footer: true, form: true, h1: true, h2: true, h3: true, h4: true, h5: true,
  h6: true, header: true, hgroup: true, hr: true, li: true, noscript: true, ol: true,
  output: true, p: true, pre: true, section: true, table: true, tfoot: true, ul: true
};

// : Object<bool> The tags that we normally ignore.
var ignoreTags = {
  head: true, noscript: true, object: true, script: true, style: true, title: true
};

// : Object<bool> List tags.
var listTags = { ol: true, ul: true };

// A state object used to track context during a parse.

var DOMParseState = function () {
  // : (Schema, Object, NodeBuilder)

  function DOMParseState(schema, options, top) {
    _classCallCheck(this, DOMParseState);

    // : Object The options passed to this parse.
    this.options = options || {};
    // : Schema The schema that we are parsing into.
    this.schema = schema;
    this.top = top;
    // : [Mark] The current set of marks
    this.marks = Mark.none;
    this.info = schemaInfo(schema);
    this.find = options.findPositions;
  }

  // : (Mark) → [Mark]
  // Add a mark to the current set of marks, return the old set.


  _createClass(DOMParseState, [{
    key: "addMark",
    value: function addMark(mark) {
      var old = this.marks;
      this.marks = mark.addToSet(this.marks);
      return old;
    }

    // : (DOMNode)
    // Add a DOM node to the content. Text is inserted as text node,
    // otherwise, the node is passed to `addElement` or, if it has a
    // `style` attribute, `addElementWithStyles`.

  }, {
    key: "addDOM",
    value: function addDOM(dom) {
      if (dom.nodeType == 3) {
        var value = dom.nodeValue;
        var top = this.top;
        if (/\S/.test(value) || top.type.isTextblock) {
          if (!this.top.preserveWhitespace) {
            value = value.replace(/\s+/g, " ");
            // If this starts with whitespace, and there is either no node
            // before it or a node that ends with whitespace, strip the
            // leading space.
            if (/^\s/.test(value)) top.stripTrailingSpace();
          }
          if (value) this.insertNode(this.schema.text(value, this.marks));
          this.findInText(dom);
        } else {
          this.findInside(dom);
        }
      } else if (dom.nodeType == 1 && !dom.hasAttribute("pm-ignore")) {
        var style = dom.getAttribute("style");
        if (style) this.addElementWithStyles(parseStyles(style), dom);else this.addElement(dom);
      }
    }

    // : (DOMNode)
    // Try to find a handler for the given tag and use that to parse. If
    // none is found, the element's content nodes are added directly.

  }, {
    key: "addElement",
    value: function addElement(dom) {
      var name = dom.nodeName.toLowerCase();
      if (listTags.hasOwnProperty(name)) this.normalizeList(dom);
      // Ignore trailing BR nodes, which browsers create during editing
      if (this.options.editableContent && name == "br" && !dom.nextSibling) return;
      if (!this.parseNodeType(dom, name)) {
        if (ignoreTags.hasOwnProperty(name)) {
          this.findInside(dom);
        } else {
          var sync = blockTags.hasOwnProperty(name) && this.top;
          this.addAll(dom);
          if (sync) this.sync(sync);
        }
      }
    }

    // Run any style parser associated with the node's styles. After
    // that, if no style parser suppressed the node's content, pass it
    // through to `addElement`.

  }, {
    key: "addElementWithStyles",
    value: function addElementWithStyles(styles, dom) {
      var oldMarks = this.marks,
          marks = this.marks;
      for (var i = 0; i < styles.length; i += 2) {
        var result = matchStyle(this.info.styles, styles[i], styles[i + 1]);
        if (!result) continue;
        if (result.attrs === false) return;
        marks = result.mark.create(result.attrs).addToSet(marks);
      }
      this.marks = marks;
      this.addElement(dom);
      this.marks = oldMarks;
    }

    // (DOMNode, string) → bool
    // Look up a handler for the given node. If none are found, return
    // false. Otherwise, apply it, use its return value to drive the way
    // the node's content is wrapped, and return true.

  }, {
    key: "parseNodeType",
    value: function parseNodeType(dom) {
      var result = matchTag(this.info.selectors, dom);
      if (!result) return false;

      var sync = void 0,
          before = void 0,
          contentNode = dom,
          preserve = this.top.preserveWhitespace;
      if (result.content) {
        if (result.content.content === false) contentNode = null;else if (result.content.content) contentNode = result.content.content;
        if (result.content.preserveWhitespace != null) preserve = result.content.preserveWhitespace;
      } else if (result.node && result.node.isLeaf) {
        contentNode = null;
      }

      if (result.node && result.node.isLeaf) this.insertNode(result.node.create(result.attrs));else if (result.node) sync = this.enter(result.node, result.attrs, preserve);else before = this.addMark(result.mark.create(result.attrs));

      if (contentNode) {
        this.findAround(dom, contentNode, true);
        this.addAll(contentNode, sync);
        if (sync) this.sync(sync.prev);else if (before) this.marks = before;
        this.findAround(dom, contentNode, true);
      } else {
        this.findInside(dom);
      }
      return true;
    }

    // : (DOMNode, ?NodeBuilder, ?number, ?number)
    // Add all child nodes between `startIndex` and `endIndex` (or the
    // whole node, if not given). If `sync` is passed, use it to
    // synchronize after every block element.

  }, {
    key: "addAll",
    value: function addAll(parent, sync, startIndex, endIndex) {
      var index = startIndex || 0;
      for (var dom = startIndex ? parent.childNodes[startIndex] : parent.firstChild, end = endIndex == null ? null : parent.childNodes[endIndex]; dom != end; dom = dom.nextSibling, ++index) {
        this.findAtPoint(parent, index);
        this.addDOM(dom);
        if (sync && blockTags.hasOwnProperty(dom.nodeName.toLowerCase())) this.sync(sync);
      }
      this.findAtPoint(parent, index);
    }

    // : (Node) → ?Node
    // Try to insert the given node, adjusting the context when needed.

  }, {
    key: "insertNode",
    value: function insertNode(node) {
      var ok = this.top.findPlace(node.type, node.attrs, node);
      if (ok) {
        this.sync(ok);
        return true;
      }
    }

    // : (NodeType, ?Object) → ?NodeBuilder
    // Try to start a node of the given type, adjusting the context when
    // necessary.

  }, {
    key: "enter",
    value: function enter(type, attrs, preserveWhitespace) {
      var ok = this.top.findPlace(type, attrs, null, preserveWhitespace);
      if (ok) {
        this.sync(ok);
        return ok;
      }
    }

    // : ()
    // Leave the node currently at the top.

  }, {
    key: "leave",
    value: function leave() {
      this.top = this.top.prev;
    }
  }, {
    key: "sync",
    value: function sync(to) {
      for (;;) {
        for (var cur = to; cur; cur = cur.prev) {
          if (cur == this.top) {
            this.top = to;
            return;
          }
        }this.leave();
      }
    }

    // Kludge to work around directly nested list nodes produced by some
    // tools and allowed by browsers to mean that the nested list is
    // actually part of the list item above it.

  }, {
    key: "normalizeList",
    value: function normalizeList(dom) {
      for (var child = dom.firstChild, prevItem = null; child; child = child.nextSibling) {
        var name = child.nodeType == 1 ? child.nodeName.toLowerCase() : null;
        if (name && listTags.hasOwnProperty(name) && prevItem) {
          prevItem.appendChild(child);
          child = prevItem;
        } else if (name == "li") {
          prevItem = child;
        } else if (name) {
          prevItem = null;
        }
      }
    }
  }, {
    key: "findAtPoint",
    value: function findAtPoint(parent, offset) {
      if (this.find) for (var i = 0; i < this.find.length; i++) {
        if (this.find[i].node == parent && this.find[i].offset == offset) this.find[i].pos = this.top.currentPos;
      }
    }
  }, {
    key: "findInside",
    value: function findInside(parent) {
      if (this.find) for (var i = 0; i < this.find.length; i++) {
        if (this.find[i].pos == null && parent.contains(this.find[i].node)) this.find[i].pos = this.top.currentPos;
      }
    }
  }, {
    key: "findAround",
    value: function findAround(parent, content, before) {
      if (parent != content && this.find) for (var i = 0; i < this.find.length; i++) {
        if (this.find[i].pos == null && parent.contains(this.find[i].node)) {
          var pos = content.compareDocumentPosition(this.find[i].node);
          if (pos & (before ? 2 : 4)) this.find[i].pos = this.top.currentPos;
        }
      }
    }
  }, {
    key: "findInText",
    value: function findInText(textNode) {
      if (this.find) for (var i = 0; i < this.find.length; i++) {
        if (this.find[i].node == textNode) this.find[i].pos = this.top.currentPos - (textNode.nodeValue.length - this.find[i].offset);
      }
    }
  }]);

  return DOMParseState;
}();

// Apply a CSS selector.


function matches(dom, selector) {
  return (dom.matches || dom.msMatchesSelector || dom.webkitMatchesSelector || dom.mozMatchesSelector).call(dom, selector);
}

// : (string) → [string]
// Tokenize a style attribute into property/value pairs.
function parseStyles(style) {
  var re = /\s*([\w-]+)\s*:\s*([^;]+)/g,
      m = void 0,
      result = [];
  while (m = re.exec(style)) {
    result.push(m[1], m[2].trim());
  }return result;
}

function schemaInfo(schema) {
  return schema.cached.parseDOMInfo || (schema.cached.parseDOMInfo = summarizeSchemaInfo(schema));
}

function summarizeSchemaInfo(schema) {
  var selectors = [],
      styles = [];
  for (var name in schema.nodes) {
    var type = schema.nodes[name],
        match = type.matchDOMTag;
    if (match) for (var selector in match) {
      selectors.push({ selector: selector, node: type, value: match[selector] });
    }
  }
  for (var _name in schema.marks) {
    var _type = schema.marks[_name],
        _match = _type.matchDOMTag,
        props = _type.matchDOMStyle;
    if (_match) for (var _selector in _match) {
      selectors.push({ selector: _selector, mark: _type, value: _match[_selector] });
    }if (props) for (var prop in props) {
      styles.push({ prop: prop, mark: _type, value: props[prop] });
    }
  }
  return { selectors: selectors, styles: styles };
}

function matchTag(selectors, dom) {
  for (var i = 0; i < selectors.length; i++) {
    var cur = selectors[i];
    if (matches(dom, cur.selector)) {
      var value = cur.value,
          content = void 0;
      if (value instanceof Function) {
        value = value(dom);
        if (value === false) continue;
      }
      if (Array.isArray(value)) {
        ;var _value = value;

        var _value2 = _slicedToArray(_value, 2);

        value = _value2[0];
        content = _value2[1];
      }
      return { node: cur.node, mark: cur.mark, attrs: value, content: content };
    }
  }
}

function matchStyle(styles, prop, value) {
  for (var i = 0; i < styles.length; i++) {
    var cur = styles[i];
    if (cur.prop == prop) {
      var attrs = cur.value;
      if (attrs instanceof Function) {
        attrs = attrs(value);
        if (attrs === false) continue;
      }
      return { mark: cur.mark, attrs: attrs };
    }
  }
}
},{"./fragment":35,"./mark":38}],37:[function(require,module,exports){
"use strict";

// !!
// This module defines ProseMirror's document model, the data
// structure used to define and inspect content documents. It
// includes:
//
// * The [node](#Node) type that represents document elements
//
// * The [schema](#Schema) types used to tag and constrain the
//   document structure
//
// This module does not depend on the browser API being available
// (i.e. you can load it into any JavaScript environment).

exports.Node = require("./node").Node;
var _require = require("./resolvedpos");

exports.ResolvedPos = _require.ResolvedPos;
exports.NodeRange = _require.NodeRange;

exports.Fragment = require("./fragment").Fragment;
var _require2 = require("./replace");

exports.Slice = _require2.Slice;
exports.ReplaceError = _require2.ReplaceError;

exports.Mark = require("./mark").Mark;
var _require3 = require("./schema");

exports.SchemaSpec = _require3.SchemaSpec;
exports.Schema = _require3.Schema;
exports.NodeType = _require3.NodeType;
exports.Block = _require3.Block;
exports.Inline = _require3.Inline;
exports.Text = _require3.Text;
exports.MarkType = _require3.MarkType;
exports.Attribute = _require3.Attribute;
exports.NodeKind = _require3.NodeKind;

var _require4 = require("./content");

exports.ContentMatch = _require4.ContentMatch;


exports.parseDOMInContext = require("./from_dom").parseDOMInContext;
},{"./content":33,"./fragment":35,"./from_dom":36,"./mark":38,"./node":39,"./replace":40,"./resolvedpos":41,"./schema":42}],38:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require("../util/comparedeep");

var compareDeep = _require.compareDeep;

// ;; A mark is a piece of information that can be attached to a node,
// such as it being emphasized, in code font, or a link. It has a type
// and optionally a set of attributes that provide further information
// (such as the target of the link). Marks are created through a
// `Schema`, which controls which types exist and which
// attributes they have.

var Mark = function () {
  function Mark(type, attrs) {
    _classCallCheck(this, Mark);

    // :: MarkType
    // The type of this mark.
    this.type = type;
    // :: Object
    // The attributes associated with this mark.
    this.attrs = attrs;
  }

  // :: () → Object
  // Convert this mark to a JSON-serializeable representation.


  _createClass(Mark, [{
    key: "toJSON",
    value: function toJSON() {
      var obj = { _: this.type.name };
      for (var attr in this.attrs) {
        obj[attr] = this.attrs[attr];
      }return obj;
    }

    // :: ([Mark]) → [Mark]
    // Given a set of marks, create a new set which contains this one as
    // well, in the right position. If this mark is already in the set,
    // the set itself is returned. If a mark of this type with different
    // attributes is already in the set, a set in which it is replaced
    // by this one is returned.

  }, {
    key: "addToSet",
    value: function addToSet(set) {
      for (var i = 0; i < set.length; i++) {
        var other = set[i];
        if (other.type == this.type) {
          if (this.eq(other)) return set;
          var copy = set.slice();
          copy[i] = this;
          return copy;
        }
        if (other.type.rank > this.type.rank) return set.slice(0, i).concat(this).concat(set.slice(i));
      }
      return set.concat(this);
    }

    // :: ([Mark]) → [Mark]
    // Remove this mark from the given set, returning a new set. If this
    // mark is not in the set, the set itself is returned.

  }, {
    key: "removeFromSet",
    value: function removeFromSet(set) {
      for (var i = 0; i < set.length; i++) {
        if (this.eq(set[i])) return set.slice(0, i).concat(set.slice(i + 1));
      }return set;
    }

    // :: ([Mark]) → bool
    // Test whether this mark is in the given set of marks.

  }, {
    key: "isInSet",
    value: function isInSet(set) {
      for (var i = 0; i < set.length; i++) {
        if (this.eq(set[i])) return true;
      }return false;
    }

    // :: (Mark) → bool
    // Test whether this mark has the same type and attributes as
    // another mark.

  }, {
    key: "eq",
    value: function eq(other) {
      if (this == other) return true;
      if (this.type != other.type) return false;
      if (!compareDeep(other.attrs, this.attrs)) return false;
      return true;
    }

    // :: ([Mark], [Mark]) → bool
    // Test whether two sets of marks are identical.

  }], [{
    key: "sameSet",
    value: function sameSet(a, b) {
      if (a == b) return true;
      if (a.length != b.length) return false;
      for (var i = 0; i < a.length; i++) {
        if (!a[i].eq(b[i])) return false;
      }return true;
    }

    // :: (?union<Mark, [Mark]>) → [Mark]
    // Create a properly sorted mark set from null, a single mark, or an
    // unsorted array of marks.

  }, {
    key: "setFrom",
    value: function setFrom(marks) {
      if (!marks || marks.length == 0) return Mark.none;
      if (marks instanceof Mark) return [marks];
      var copy = marks.slice();
      copy.sort(function (a, b) {
        return a.type.rank - b.type.rank;
      });
      return copy;
    }
  }]);

  return Mark;
}();

exports.Mark = Mark;

// :: [Mark] The empty set of marks.
Mark.none = [];
},{"../util/comparedeep":59}],39:[function(require,module,exports){
"use strict";

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require("./fragment");

var Fragment = _require.Fragment;

var _require2 = require("./mark");

var Mark = _require2.Mark;

var _require3 = require("./replace");

var Slice = _require3.Slice;
var _replace = _require3.replace;

var _require4 = require("./resolvedpos");

var ResolvedPos = _require4.ResolvedPos;

var _require5 = require("./to_dom");

var nodeToDOM = _require5.nodeToDOM;

var _require6 = require("../util/comparedeep");

var compareDeep = _require6.compareDeep;


var emptyAttrs = Object.create(null);

// ;; This class represents a node in the tree that makes up a
// ProseMirror document. So a document is an instance of `Node`, with
// children that are also instances of `Node`.
//
// Nodes are persistent data structures. Instead of changing them, you
// create new ones with the content you want. Old ones keep pointing
// at the old document shape. This is made cheaper by sharing
// structure between the old and new data as much as possible, which a
// tree shape like this (without back pointers) makes easy.
//
// **Never** directly mutate the properties of a `Node` object. See
// [this guide](guide/doc.html) for more information.

var Node = function () {
  function Node(type, attrs, content, marks) {
    _classCallCheck(this, Node);

    // :: NodeType
    // The type of node that this is.
    this.type = type;

    // :: Object
    // An object mapping attribute names to values. The kind of
    // attributes allowed and required are determined by the node
    // type.
    this.attrs = attrs;

    // :: Fragment
    // A container holding the node's children.
    this.content = content || Fragment.empty;

    // :: [Mark]
    // The marks (things like whether it is emphasized or part of a
    // link) associated with this node.
    this.marks = marks || Mark.none;
  }

  // :: ?string #path=Node.prototype.text
  // For text nodes, this contains the node's text content.

  // :: number
  // The size of this node. For text nodes, this is the amount of
  // characters. For leaf nodes, it is one. And for non-leaf nodes, it
  // is the size of the content plus two (the start and end token).


  _createClass(Node, [{
    key: "child",


    // :: (number) → Node
    // Get the child node at the given index. Raises an error when the
    // index is out of range.
    value: function child(index) {
      return this.content.child(index);
    }

    // :: (number) → ?Node
    // Get the child node at the given index, if it exists.

  }, {
    key: "maybeChild",
    value: function maybeChild(index) {
      return this.content.maybeChild(index);
    }

    // :: ((node: Node, offset: number, index: number))
    // Call `f` for every child node, passing the node, its offset
    // into this parent node, and its index.

  }, {
    key: "forEach",
    value: function forEach(f) {
      this.content.forEach(f);
    }

    // :: string
    // Concatenates all the text nodes found in this fragment and its
    // children.

  }, {
    key: "textBetween",


    // :: (number, number, ?string) → string
    // Get all text between positions `from` and `to`. When `separator`
    // is given, it will be inserted whenever a new block node is
    // started.
    value: function textBetween(from, to, separator) {
      return this.content.textBetween(from, to, separator);
    }

    // :: ?Node
    // Returns this node's first child, or `null` if there are no
    // children.

  }, {
    key: "eq",


    // :: (Node) → bool
    // Test whether two nodes represent the same content.
    value: function eq(other) {
      return this == other || this.sameMarkup(other) && this.content.eq(other.content);
    }

    // :: (Node) → bool
    // Compare the markup (type, attributes, and marks) of this node to
    // those of another. Returns `true` if both have the same markup.

  }, {
    key: "sameMarkup",
    value: function sameMarkup(other) {
      return this.hasMarkup(other.type, other.attrs, other.marks);
    }

    // :: (NodeType, ?Object, ?[Mark]) → bool
    // Check whether this node's markup correspond to the given type,
    // attributes, and marks.

  }, {
    key: "hasMarkup",
    value: function hasMarkup(type, attrs, marks) {
      return this.type == type && compareDeep(this.attrs, attrs || type.defaultAttrs || emptyAttrs) && Mark.sameSet(this.marks, marks || Mark.none);
    }

    // :: (?Fragment) → Node
    // Create a new node with the same markup as this node, containing
    // the given content (or empty, if no content is given).

  }, {
    key: "copy",
    value: function copy() {
      var content = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];

      if (content == this.content) return this;
      return new this.constructor(this.type, this.attrs, content, this.marks);
    }

    // :: ([Mark]) → Node
    // Create a copy of this node, with the given set of marks instead
    // of the node's own marks.

  }, {
    key: "mark",
    value: function mark(marks) {
      return marks == this.marks ? this : new this.constructor(this.type, this.attrs, this.content, marks);
    }

    // :: (number, ?number) → Node
    // Create a copy of this node with only the content between the
    // given offsets. If `to` is not given, it defaults to the end of
    // the node.

  }, {
    key: "cut",
    value: function cut(from, to) {
      if (from == 0 && to == this.content.size) return this;
      return this.copy(this.content.cut(from, to));
    }

    // :: (number, ?number) → Slice
    // Cut out the part of the document between the given positions, and
    // return it as a `Slice` object.

  }, {
    key: "slice",
    value: function slice(from) {
      var to = arguments.length <= 1 || arguments[1] === undefined ? this.content.size : arguments[1];

      if (from == to) return Slice.empty;

      var $from = this.resolve(from),
          $to = this.resolve(to);
      var depth = $from.sameDepth($to),
          start = $from.start(depth),
          node = $from.node(depth);
      var content = node.content.cut($from.pos - start, $to.pos - start);
      return new Slice(content, $from.depth - depth, $to.depth - depth, node);
    }

    // :: (number, number, Slice) → Node
    // Replace the part of the document between the given positions with
    // the given slice. The slice must 'fit', meaning its open sides
    // must be able to connect to the surrounding content, and its
    // content nodes must be valid children for the node they are placed
    // into. If any of this is violated, an error of type `ReplaceError`
    // is thrown.

  }, {
    key: "replace",
    value: function replace(from, to, slice) {
      return _replace(this.resolve(from), this.resolve(to), slice);
    }

    // :: (number) → ?Node
    // Find the node after the given position.

  }, {
    key: "nodeAt",
    value: function nodeAt(pos) {
      for (var node = this;;) {
        var _node$content$findInd = node.content.findIndex(pos);

        var index = _node$content$findInd.index;
        var offset = _node$content$findInd.offset;

        node = node.maybeChild(index);
        if (!node) return null;
        if (offset == pos || node.isText) return node;
        pos -= offset + 1;
      }
    }

    // :: (number) → {node: ?Node, index: number, offset: number}
    // Find the (direct) child node after the given offset, if any,
    // and return it along with its index and offset relative to this
    // node.

  }, {
    key: "childAfter",
    value: function childAfter(pos) {
      var _content$findIndex = this.content.findIndex(pos);

      var index = _content$findIndex.index;
      var offset = _content$findIndex.offset;

      return { node: this.content.maybeChild(index), index: index, offset: offset };
    }

    // :: (number) → {node: ?Node, index: number, offset: number}
    // Find the (direct) child node before the given offset, if any,
    // and return it along with its index and offset relative to this
    // node.

  }, {
    key: "childBefore",
    value: function childBefore(pos) {
      if (pos == 0) return { node: null, index: 0, offset: 0 };

      var _content$findIndex2 = this.content.findIndex(pos);

      var index = _content$findIndex2.index;
      var offset = _content$findIndex2.offset;

      if (offset < pos) return { node: this.content.child(index), index: index, offset: offset };
      var node = this.content.child(index - 1);
      return { node: node, index: index - 1, offset: offset - node.nodeSize };
    }

    // :: (?number, ?number, (node: Node, pos: number, parent: Node, index: number))
    // Iterate over all nodes between the given two positions, calling
    // the callback with the node, its position, its parent
    // node, and its index in that node.

  }, {
    key: "nodesBetween",
    value: function nodesBetween(from, to, f) {
      var pos = arguments.length <= 3 || arguments[3] === undefined ? 0 : arguments[3];

      this.content.nodesBetween(from, to, f, pos, this);
    }

    // :: ((node: Node, pos: number, parent: Node))
    // Call the given callback for every descendant node.

  }, {
    key: "descendants",
    value: function descendants(f) {
      this.nodesBetween(0, this.content.size, f);
    }

    // :: (number) → ResolvedPos
    // Resolve the given position in the document, returning an object
    // describing its path through the document.

  }, {
    key: "resolve",
    value: function resolve(pos) {
      return ResolvedPos.resolveCached(this, pos);
    }
  }, {
    key: "resolveNoCache",
    value: function resolveNoCache(pos) {
      return ResolvedPos.resolve(this, pos);
    }

    // :: (number) → [Mark]
    // Get the marks at the given position factoring in the surrounding marks'
    // inclusiveLeft and inclusiveRight properties. If the position is at the
    // start of a non-empty node, the marks of the node after it are returned.

  }, {
    key: "marksAt",
    value: function marksAt(pos) {
      var $pos = this.resolve(pos),
          parent = $pos.parent,
          index = $pos.index();

      // In an empty parent, return the empty array
      if (parent.content.size == 0) return Mark.none;
      // When inside a text node or at the start of the parent node, return the node's marks
      if (index == 0 || !$pos.atNodeBoundary) return parent.child(index).marks;

      var marks = parent.child(index - 1).marks;
      for (var i = 0; i < marks.length; i++) {
        if (!marks[i].type.inclusiveRight) marks = marks[i--].removeFromSet(marks);
      }return marks;
    }

    // :: (?number, ?number, MarkType) → bool
    // Test whether a mark of the given type occurs in this document
    // between the two given positions.

  }, {
    key: "rangeHasMark",
    value: function rangeHasMark(from, to, type) {
      var found = false;
      this.nodesBetween(from, to, function (node) {
        if (type.isInSet(node.marks)) found = true;
        return !found;
      });
      return found;
    }

    // :: bool
    // True when this is a block (non-inline node)

  }, {
    key: "toString",


    // :: () → string
    // Return a string representation of this node for debugging
    // purposes.
    value: function toString() {
      var name = this.type.name;
      if (this.content.size) name += "(" + this.content.toStringInner() + ")";
      return wrapMarks(this.marks, name);
    }

    // :: (number) → ContentMatch
    // Get the content match in this node at the given index.

  }, {
    key: "contentMatchAt",
    value: function contentMatchAt(index) {
      return this.type.contentExpr.getMatchAt(this.attrs, this.content, index);
    }

    // :: (number, number, ?Fragment, ?number, ?number) → bool
    // Test whether replacing the range `from` to `to` (by index) with
    // the given replacement fragment (which defaults to the empty
    // fragment) would leave the node's content valid. You can
    // optionally pass `start` and `end` indices into the replacement
    // fragment.

  }, {
    key: "canReplace",
    value: function canReplace(from, to, replacement, start, end) {
      return this.type.contentExpr.checkReplace(this.attrs, this.content, from, to, replacement, start, end);
    }

    // :: (number, number, NodeType, ?[Mark]) → bool
    // Test whether replacing the range `from` to `to` (by index) with a
    // node of the given type with the given attributes and marks would
    // be valid.

  }, {
    key: "canReplaceWith",
    value: function canReplaceWith(from, to, type, attrs, marks) {
      return this.type.contentExpr.checkReplaceWith(this.attrs, this.content, from, to, type, attrs, marks || Mark.none);
    }

    // :: (Node) → bool
    // Test whether the given node's content could be appended to this
    // node. If that node is empty, this will only return true if there
    // is at least one node type that can appear in both nodes (to avoid
    // merging completely incompatible nodes).

  }, {
    key: "canAppend",
    value: function canAppend(other) {
      if (other.content.size) return this.canReplace(this.childCount, this.childCount, other.content);else return this.type.compatibleContent(other.type);
    }
  }, {
    key: "defaultContentType",
    value: function defaultContentType(at) {
      var elt = this.contentMatchAt(at).nextElement;
      return elt && elt.defaultType();
    }

    // :: () → Object
    // Return a JSON-serializeable representation of this node.

  }, {
    key: "toJSON",
    value: function toJSON() {
      var obj = { type: this.type.name };
      for (var _ in this.attrs) {
        obj.attrs = this.attrs;
        break;
      }
      if (this.content.size) obj.content = this.content.toJSON();
      if (this.marks.length) obj.marks = this.marks.map(function (n) {
        return n.toJSON();
      });
      return obj;
    }

    // :: (Schema, Object) → Node
    // Deserialize a node from its JSON representation.

  }, {
    key: "toDOM",


    // :: (?Object) → DOMNode
    // Serialize this node to a DOM node. This can be useful when you
    // need to serialize a part of a document, as opposed to the whole
    // document, but you'll usually want to do
    // `doc.content.`[`toDOM()`](#Fragment.toDOM) instead.
    value: function toDOM() {
      var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
      return nodeToDOM(this, options);
    }
  }, {
    key: "nodeSize",
    get: function get() {
      return this.type.isLeaf ? 1 : 2 + this.content.size;
    }

    // :: number
    // The number of children that the node has.

  }, {
    key: "childCount",
    get: function get() {
      return this.content.childCount;
    }
  }, {
    key: "textContent",
    get: function get() {
      return this.textBetween(0, this.content.size, "");
    }
  }, {
    key: "firstChild",
    get: function get() {
      return this.content.firstChild;
    }

    // :: ?Node
    // Returns this node's last child, or `null` if there are no
    // children.

  }, {
    key: "lastChild",
    get: function get() {
      return this.content.lastChild;
    }
  }, {
    key: "isBlock",
    get: function get() {
      return this.type.isBlock;
    }

    // :: bool
    // True when this is a textblock node, a block node with inline
    // content.

  }, {
    key: "isTextblock",
    get: function get() {
      return this.type.isTextblock;
    }

    // :: bool
    // True when this is an inline node (a text node or a node that can
    // appear among text).

  }, {
    key: "isInline",
    get: function get() {
      return this.type.isInline;
    }

    // :: bool
    // True when this is a text node.

  }, {
    key: "isText",
    get: function get() {
      return this.type.isText;
    }
  }], [{
    key: "fromJSON",
    value: function fromJSON(schema, json) {
      var type = schema.nodeType(json.type);
      var content = json.text != null ? json.text : Fragment.fromJSON(schema, json.content);
      return type.create(json.attrs, content, json.marks && json.marks.map(schema.markFromJSON));
    }
  }]);

  return Node;
}();

exports.Node = Node;

var TextNode = function (_Node) {
  _inherits(TextNode, _Node);

  function TextNode(type, attrs, content, marks) {
    _classCallCheck(this, TextNode);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(TextNode).call(this, type, attrs, null, marks));

    if (!content) throw new RangeError("Empty text nodes are not allowed");

    _this.text = content;
    return _this;
  }

  _createClass(TextNode, [{
    key: "toString",
    value: function toString() {
      return wrapMarks(this.marks, JSON.stringify(this.text));
    }
  }, {
    key: "textBetween",
    value: function textBetween(from, to) {
      return this.text.slice(from, to);
    }
  }, {
    key: "mark",
    value: function mark(marks) {
      return new TextNode(this.type, this.attrs, this.text, marks);
    }
  }, {
    key: "withText",
    value: function withText(text) {
      if (text == this.text) return this;
      return new TextNode(this.type, this.attrs, text, this.marks);
    }
  }, {
    key: "cut",
    value: function cut() {
      var from = arguments.length <= 0 || arguments[0] === undefined ? 0 : arguments[0];
      var to = arguments.length <= 1 || arguments[1] === undefined ? this.text.length : arguments[1];

      if (from == 0 && to == this.text.length) return this;
      return this.withText(this.text.slice(from, to));
    }
  }, {
    key: "eq",
    value: function eq(other) {
      return this.sameMarkup(other) && this.text == other.text;
    }
  }, {
    key: "toJSON",
    value: function toJSON() {
      var base = _get(Object.getPrototypeOf(TextNode.prototype), "toJSON", this).call(this);
      base.text = this.text;
      return base;
    }
  }, {
    key: "textContent",
    get: function get() {
      return this.text;
    }
  }, {
    key: "nodeSize",
    get: function get() {
      return this.text.length;
    }
  }]);

  return TextNode;
}(Node);

exports.TextNode = TextNode;

function wrapMarks(marks, str) {
  for (var i = marks.length - 1; i >= 0; i--) {
    str = marks[i].type.name + "(" + str + ")";
  }return str;
}
},{"../util/comparedeep":59,"./fragment":35,"./mark":38,"./replace":40,"./resolvedpos":41,"./to_dom":43}],40:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require("../util/error");

var ProseMirrorError = _require.ProseMirrorError;

var _require2 = require("./fragment");

var Fragment = _require2.Fragment;

// ;; Error type raised by `Node.replace` when given an invalid
// replacement.

var ReplaceError = function (_ProseMirrorError) {
  _inherits(ReplaceError, _ProseMirrorError);

  function ReplaceError() {
    _classCallCheck(this, ReplaceError);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(ReplaceError).apply(this, arguments));
  }

  return ReplaceError;
}(ProseMirrorError);

exports.ReplaceError = ReplaceError;

// ;; A slice represents a piece cut out of a larger document. It
// stores not only a fragment, but also the depth up to which nodes on
// both side are 'open' / cut through.

var Slice = function () {
  // :: (Fragment, number, number, ?Node)

  function Slice(content, openLeft, openRight, possibleParent) {
    _classCallCheck(this, Slice);

    // :: Fragment The slice's content nodes.
    this.content = content;
    // :: number The open depth at the start.
    this.openLeft = openLeft;
    // :: number The open depth at the end.
    this.openRight = openRight;
    this.possibleParent = possibleParent;
  }

  // :: number
  // The size this slice would add when inserted into a document.


  _createClass(Slice, [{
    key: "insertAt",
    value: function insertAt(pos, fragment) {
      function insertInto(content, dist, insert, parent) {
        var _content$findIndex = content.findIndex(dist);

        var index = _content$findIndex.index;
        var offset = _content$findIndex.offset;var child = content.maybeChild(index);
        if (offset == dist || child.isText) {
          if (parent && !parent.canReplace(index, index, insert)) return null;
          return content.cut(0, dist).append(insert).append(content.cut(dist));
        }
        var inner = insertInto(child.content, dist - offset - 1, insert);
        return inner && content.replaceChild(index, child.copy(inner));
      }
      var content = insertInto(this.content, pos + this.openLeft, fragment, null);
      return content && new Slice(content, this.openLeft, this.openRight);
    }
  }, {
    key: "removeBetween",
    value: function removeBetween(from, to) {
      function removeRange(content, from, to) {
        var _content$findIndex2 = content.findIndex(from);

        var index = _content$findIndex2.index;
        var offset = _content$findIndex2.offset;var child = content.maybeChild(index);

        var _content$findIndex3 = content.findIndex(to);

        var indexTo = _content$findIndex3.index;
        var offsetTo = _content$findIndex3.offset;

        if (offset == from || child.isText) {
          if (offsetTo != to && !content.child(indexTo).isText) throw new RangeError("Removing non-flat range");
          return content.cut(0, from).append(content.cut(to));
        }
        if (index != indexTo) throw new RangeError("Removing non-flat range");
        return content.replaceChild(index, child.copy(removeRange(child.content, from - offset - 1, to - offset - 1)));
      }
      return new Slice(removeRange(this.content, from + this.openLeft, to + this.openLeft), this.openLeft, this.openRight);
    }
  }, {
    key: "toString",
    value: function toString() {
      return this.content + "(" + this.openLeft + "," + this.openRight + ")";
    }

    // :: () → ?Object
    // Convert a slice to a JSON-serializable representation.

  }, {
    key: "toJSON",
    value: function toJSON() {
      if (!this.content.size) return null;
      return { content: this.content.toJSON(),
        openLeft: this.openLeft,
        openRight: this.openRight };
    }

    // :: (Schema, ?Object) → Slice
    // Deserialize a slice from its JSON representation.

  }, {
    key: "size",
    get: function get() {
      return this.content.size - this.openLeft - this.openRight;
    }
  }], [{
    key: "fromJSON",
    value: function fromJSON(schema, json) {
      if (!json) return Slice.empty;
      return new Slice(Fragment.fromJSON(schema, json.content), json.openLeft, json.openRight);
    }
  }]);

  return Slice;
}();

exports.Slice = Slice;

// :: Slice
// The empty slice.
Slice.empty = new Slice(Fragment.empty, 0, 0);

function replace($from, $to, slice) {
  if (slice.openLeft > $from.depth) throw new ReplaceError("Inserted content deeper than insertion position");
  if ($from.depth - slice.openLeft != $to.depth - slice.openRight) throw new ReplaceError("Inconsistent open depths");
  return replaceOuter($from, $to, slice, 0);
}
exports.replace = replace;

function replaceOuter($from, $to, slice, depth) {
  var index = $from.index(depth),
      node = $from.node(depth);
  if (index == $to.index(depth) && depth < $from.depth - slice.openLeft) {
    var inner = replaceOuter($from, $to, slice, depth + 1);
    return node.copy(node.content.replaceChild(index, inner));
  } else if (slice.content.size) {
    var _prepareSliceForRepla = prepareSliceForReplace(slice, $from);

    var start = _prepareSliceForRepla.start;
    var end = _prepareSliceForRepla.end;

    return close(node, replaceThreeWay($from, start, end, $to, depth));
  } else {
    return close(node, replaceTwoWay($from, $to, depth));
  }
}

function checkJoin(main, sub) {
  if (!sub.type.compatibleContent(main.type)) throw new ReplaceError("Cannot join " + sub.type.name + " onto " + main.type.name);
}

function joinable($before, $after, depth) {
  var node = $before.node(depth);
  checkJoin(node, $after.node(depth));
  return node;
}

function addNode(child, target) {
  var last = target.length - 1;
  if (last >= 0 && child.isText && child.sameMarkup(target[last])) target[last] = child.withText(target[last].text + child.text);else target.push(child);
}

function addRange($start, $end, depth, target) {
  var node = ($end || $start).node(depth);
  var startIndex = 0,
      endIndex = $end ? $end.index(depth) : node.childCount;
  if ($start) {
    startIndex = $start.index(depth);
    if ($start.depth > depth) {
      startIndex++;
    } else if (!$start.atNodeBoundary) {
      addNode($start.nodeAfter, target);
      startIndex++;
    }
  }
  for (var i = startIndex; i < endIndex; i++) {
    addNode(node.child(i), target);
  }if ($end && $end.depth == depth && !$end.atNodeBoundary) addNode($end.nodeBefore, target);
}

function close(node, content) {
  if (!node.type.validContent(content, node.attrs)) throw new ReplaceError("Invalid content for node " + node.type.name);
  return node.copy(content);
}

function replaceThreeWay($from, $start, $end, $to, depth) {
  var openLeft = $from.depth > depth && joinable($from, $start, depth + 1);
  var openRight = $to.depth > depth && joinable($end, $to, depth + 1);

  var content = [];
  addRange(null, $from, depth, content);
  if (openLeft && openRight && $start.index(depth) == $end.index(depth)) {
    checkJoin(openLeft, openRight);
    addNode(close(openLeft, replaceThreeWay($from, $start, $end, $to, depth + 1)), content);
  } else {
    if (openLeft) addNode(close(openLeft, replaceTwoWay($from, $start, depth + 1)), content);
    addRange($start, $end, depth, content);
    if (openRight) addNode(close(openRight, replaceTwoWay($end, $to, depth + 1)), content);
  }
  addRange($to, null, depth, content);
  return new Fragment(content);
}

function replaceTwoWay($from, $to, depth) {
  var content = [];
  addRange(null, $from, depth, content);
  if ($from.depth > depth) {
    var type = joinable($from, $to, depth + 1);
    addNode(close(type, replaceTwoWay($from, $to, depth + 1)), content);
  }
  addRange($to, null, depth, content);
  return new Fragment(content);
}

function prepareSliceForReplace(slice, $along) {
  var extra = $along.depth - slice.openLeft,
      parent = $along.node(extra);
  var node = parent.copy(slice.content);
  for (var i = extra - 1; i >= 0; i--) {
    node = $along.node(i).copy(Fragment.from(node));
  }return { start: node.resolveNoCache(slice.openLeft + extra),
    end: node.resolveNoCache(node.content.size - slice.openRight - extra) };
}
},{"../util/error":61,"./fragment":35}],41:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// ;; The usual way to represent positions in a document is with a
// plain integer. Since those tell you very little about the context
// of that position, you'll often have to 'resolve' a position to get
// the context you need. Objects of this class represent such a
// resolved position, providing various pieces of context information
// and helper methods.
//
// Throughout this interface, methods that take an optional `depth`
// parameter will interpret undefined as `this.depth` and negative
// numbers as `this.depth + value`.

var ResolvedPos = function () {
  function ResolvedPos(pos, path, parentOffset) {
    _classCallCheck(this, ResolvedPos);

    // :: number The position that was resolved.
    this.pos = pos;
    this.path = path;
    // :: number
    // The number of levels the parent node is from the root. If this
    // position points directly into the root, it is 0. If it points
    // into a top-level paragraph, 1, and so on.
    this.depth = path.length / 3 - 1;
    // :: number The offset this position has into its parent node.
    this.parentOffset = parentOffset;
  }

  _createClass(ResolvedPos, [{
    key: "resolveDepth",
    value: function resolveDepth(val) {
      if (val == null) return this.depth;
      if (val < 0) return this.depth + val;
      return val;
    }

    // :: Node
    // The parent node that the position points into. Note that even if
    // a position points into a text node, that node is not considered
    // the parent—text nodes are 'flat' in this model.

  }, {
    key: "node",


    // :: (?number) → Node
    // The ancestor node at the given level. `p.node(p.depth)` is the
    // same as `p.parent`.
    value: function node(depth) {
      return this.path[this.resolveDepth(depth) * 3];
    }

    // :: (?number) → number
    // The index into the ancestor at the given level. If this points at
    // the 3rd node in the 2nd paragraph on the top level, for example,
    // `p.index(0)` is 2 and `p.index(1)` is 3.

  }, {
    key: "index",
    value: function index(depth) {
      return this.path[this.resolveDepth(depth) * 3 + 1];
    }

    // :: (?number) → number
    // The index pointing after this position into the ancestor at the
    // given level.

  }, {
    key: "indexAfter",
    value: function indexAfter(depth) {
      depth = this.resolveDepth(depth);
      return this.index(depth) + (depth == this.depth && this.atNodeBoundary ? 0 : 1);
    }

    // :: (?number) → number
    // The (absolute) position at the start of the node at the given
    // level.

  }, {
    key: "start",
    value: function start(depth) {
      depth = this.resolveDepth(depth);
      return depth == 0 ? 0 : this.path[depth * 3 - 1] + 1;
    }

    // :: (?number) → number
    // The (absolute) position at the end of the node at the given
    // level.

  }, {
    key: "end",
    value: function end(depth) {
      depth = this.resolveDepth(depth);
      return this.start(depth) + this.node(depth).content.size;
    }

    // :: (?number) → number
    // The (absolute) position directly before the node at the given
    // level, or, when `level` is `this.level + 1`, the original
    // position.

  }, {
    key: "before",
    value: function before(depth) {
      depth = this.resolveDepth(depth);
      if (!depth) throw new RangeError("There is no position before the top-level node");
      return depth == this.depth + 1 ? this.pos : this.path[depth * 3 - 1];
    }

    // :: (?number) → number
    // The (absolute) position directly after the node at the given
    // level, or, when `level` is `this.level + 1`, the original
    // position.

  }, {
    key: "after",
    value: function after(depth) {
      depth = this.resolveDepth(depth);
      if (!depth) throw new RangeError("There is no position after the top-level node");
      return depth == this.depth + 1 ? this.pos : this.path[depth * 3 - 1] + this.path[depth * 3].nodeSize;
    }

    // :: bool
    // True if this position points at a node boundary, false if it
    // points into a text node.

  }, {
    key: "sameDepth",


    // :: (ResolvedPos) → number
    // The depth up to which this position and the other share the same
    // parent nodes.
    value: function sameDepth(other) {
      var depth = 0,
          max = Math.min(this.depth, other.depth);
      while (depth < max && this.index(depth) == other.index(depth)) {
        ++depth;
      }return depth;
    }

    // :: (?ResolvedPos, ?(Node) → bool) → ?NodeRange
    // Returns a range based on the place where this position and the
    // given position diverge around block content. If both point into
    // the same textblock, for example, a range around that textblock
    // will be returned. If they point into different blocks, the range
    // around those blocks or their ancestors in their common ancestor
    // is returned. You can pass in an optional predicate that will be
    // called with a parent node to see if a range into that parent is
    // acceptable.

  }, {
    key: "blockRange",
    value: function blockRange() {
      var other = arguments.length <= 0 || arguments[0] === undefined ? this : arguments[0];
      var pred = arguments[1];

      if (other.pos < this.pos) return other.blockRange(this);
      for (var d = this.depth - (this.parent.isTextblock || this.pos == other.pos ? 1 : 0); d >= 0; d--) {
        if (other.pos <= this.end(d) && (!pred || pred(this.node(d)))) return new NodeRange(this, other, d);
      }
    }

    // :: (ResolvedPos) → bool
    // Query whether the given position shares the same parent node.

  }, {
    key: "sameParent",
    value: function sameParent(other) {
      return this.pos - this.parentOffset == other.pos - other.parentOffset;
    }
  }, {
    key: "toString",
    value: function toString() {
      var str = "";
      for (var i = 1; i <= this.depth; i++) {
        str += (str ? "/" : "") + this.node(i).type.name + "_" + this.index(i - 1);
      }return str + ":" + this.parentOffset;
    }
  }, {
    key: "plusOne",
    value: function plusOne() {
      var copy = this.path.slice(),
          skip = this.nodeAfter.nodeSize;
      copy[copy.length - 2] += 1;
      var pos = copy[copy.length - 1] = this.pos + skip;
      return new ResolvedPos(pos, copy, this.parentOffset + skip);
    }
  }, {
    key: "parent",
    get: function get() {
      return this.node(this.depth);
    }
  }, {
    key: "atNodeBoundary",
    get: function get() {
      return this.path[this.path.length - 1] == this.pos;
    }

    // :: ?Node
    // Get the node directly after the position, if any. If the position
    // points into a text node, only the part of that node after the
    // position is returned.

  }, {
    key: "nodeAfter",
    get: function get() {
      var parent = this.parent,
          index = this.index(this.depth);
      if (index == parent.childCount) return null;
      var dOff = this.pos - this.path[this.path.length - 1],
          child = parent.child(index);
      return dOff ? parent.child(index).cut(dOff) : child;
    }

    // :: ?Node
    // Get the node directly before the position, if any. If the
    // position points into a text node, only the part of that node
    // before the position is returned.

  }, {
    key: "nodeBefore",
    get: function get() {
      var index = this.index(this.depth);
      var dOff = this.pos - this.path[this.path.length - 1];
      if (dOff) return this.parent.child(index).cut(0, dOff);
      return index == 0 ? null : this.parent.child(index - 1);
    }
  }], [{
    key: "resolve",
    value: function resolve(doc, pos) {
      if (!(pos >= 0 && pos <= doc.content.size)) throw new RangeError("Position " + pos + " out of range");
      var path = [];
      var start = 0,
          parentOffset = pos;
      for (var node = doc;;) {
        var _node$content$findInd = node.content.findIndex(parentOffset);

        var index = _node$content$findInd.index;
        var offset = _node$content$findInd.offset;

        var rem = parentOffset - offset;
        path.push(node, index, start + offset);
        if (!rem) break;
        node = node.child(index);
        if (node.isText) break;
        parentOffset = rem - 1;
        start += offset + 1;
      }
      return new ResolvedPos(pos, path, parentOffset);
    }
  }, {
    key: "resolveCached",
    value: function resolveCached(doc, pos) {
      for (var i = 0; i < resolveCache.length; i++) {
        var cached = resolveCache[i];
        if (cached.pos == pos && cached.node(0) == doc) return cached;
      }
      var result = resolveCache[resolveCachePos] = ResolvedPos.resolve(doc, pos);
      resolveCachePos = (resolveCachePos + 1) % resolveCacheSize;
      return result;
    }
  }]);

  return ResolvedPos;
}();

exports.ResolvedPos = ResolvedPos;

var resolveCache = [],
    resolveCachePos = 0,
    resolveCacheSize = 6;

// ;; Represents a flat range of content.

var NodeRange = function () {
  function NodeRange($from, $to, depth) {
    _classCallCheck(this, NodeRange);

    // :: ResolvedPos A resolved position along the start of the
    // content. May have a `depth` greater than this object's `depth`
    // property, since these are the positions that were used to
    // compute the range, not re-resolved positions directly at its
    // boundaries.
    this.$from = $from;
    // :: ResolvedPos A position along the end of the content. See
    // caveat for [`from`](#NodeRange.from).
    this.$to = $to;
    // :: number The depth of the node that this range points into.
    this.depth = depth;
  }

  // :: number The position at the start of the range.


  _createClass(NodeRange, [{
    key: "start",
    get: function get() {
      return this.$from.before(this.depth + 1);
    }
    // :: number The position at the end of the range.

  }, {
    key: "end",
    get: function get() {
      return this.$to.after(this.depth + 1);
    }

    // :: Node The parent node that the range points into.

  }, {
    key: "parent",
    get: function get() {
      return this.$from.node(this.depth);
    }
    // :: number The start index of the range in the parent node.

  }, {
    key: "startIndex",
    get: function get() {
      return this.$from.index(this.depth);
    }
    // :: number The end index of the range in the parent node.

  }, {
    key: "endIndex",
    get: function get() {
      return this.$to.indexAfter(this.depth);
    }
  }]);

  return NodeRange;
}();

exports.NodeRange = NodeRange;
},{}],42:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require("./node");

var Node = _require.Node;
var TextNode = _require.TextNode;

var _require2 = require("./fragment");

var Fragment = _require2.Fragment;

var _require3 = require("./mark");

var Mark = _require3.Mark;

var _require4 = require("./content");

var ContentExpr = _require4.ContentExpr;

var _require5 = require("./from_dom");

var _parseDOM = _require5.parseDOM;

var _require6 = require("../util/obj");

var copyObj = _require6.copyObj;

var _require7 = require("../util/orderedmap");

var OrderedMap = _require7.OrderedMap;

// For node types where all attrs have a default value (or which don't
// have any attributes), build up a single reusable default attribute
// object, and use it for all nodes that don't specify specific
// attributes.

function defaultAttrs(attrs) {
  var defaults = Object.create(null);
  for (var attrName in attrs) {
    var attr = attrs[attrName];
    if (attr.default === undefined) return null;
    defaults[attrName] = attr.default;
  }
  return defaults;
}

function _computeAttrs(attrs, value) {
  var built = Object.create(null);
  for (var name in attrs) {
    var given = value && value[name];
    if (given == null) {
      var attr = attrs[name];
      if (attr.default !== undefined) given = attr.default;else if (attr.compute) given = attr.compute();else throw new RangeError("No value supplied for attribute " + name);
    }
    built[name] = given;
  }
  return built;
}

// ;; Node types are objects allocated once per `Schema`
// and used to tag `Node` instances with a type. They are
// instances of sub-types of this class, and contain information about
// the node type (its name, its allowed attributes, methods for
// serializing it to various formats, information to guide
// deserialization, and so on).

var NodeType = function () {
  function NodeType(name, schema) {
    _classCallCheck(this, NodeType);

    // :: string
    // The name the node type has in this schema.
    this.name = name;
    // Freeze the attributes, to avoid calling a potentially expensive
    // getter all the time.
    Object.defineProperty(this, "attrs", { value: copyObj(this.attrs) });
    this.defaultAttrs = defaultAttrs(this.attrs);
    this.contentExpr = null;
    // :: Schema
    // A link back to the `Schema` the node type belongs to.
    this.schema = schema;
  }

  // :: Object<Attribute> #path=NodeType.prototype.attrs
  // The attributes for this node type.

  // :: bool
  // True if this is a block type.


  _createClass(NodeType, [{
    key: "hasRequiredAttrs",
    value: function hasRequiredAttrs(ignore) {
      for (var n in this.attrs) {
        if (this.attrs[n].isRequired && (!ignore || !(n in ignore))) return true;
      }return false;
    }
  }, {
    key: "compatibleContent",
    value: function compatibleContent(other) {
      return this == other || this.contentExpr.compatible(other.contentExpr);
    }
  }, {
    key: "computeAttrs",
    value: function computeAttrs(attrs) {
      if (!attrs && this.defaultAttrs) return this.defaultAttrs;else return _computeAttrs(this.attrs, attrs);
    }

    // :: (?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → Node
    // Create a `Node` of this type. The given attributes are
    // checked and defaulted (you can pass `null` to use the type's
    // defaults entirely, if no required attributes exist). `content`
    // may be a `Fragment`, a node, an array of nodes, or
    // `null`. Similarly `marks` may be `null` to default to the empty
    // set of marks.

  }, {
    key: "create",
    value: function create(attrs, content, marks) {
      return new Node(this, this.computeAttrs(attrs), Fragment.from(content), Mark.setFrom(marks));
    }

    // :: (?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → Node
    // Like [`create`](NodeType.create), but check the given content
    // against the node type's content restrictions, and throw an error
    // if it doesn't match.

  }, {
    key: "createChecked",
    value: function createChecked(attrs, content, marks) {
      attrs = this.computeAttrs(attrs);
      content = Fragment.from(content);
      if (!this.validContent(content, attrs)) throw new RangeError("Invalid content for node " + this.name);
      return new Node(this, attrs, content, Mark.setFrom(marks));
    }

    // :: (?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → ?Node
    // Like [`create`](NodeType.create), but see if it is necessary to
    // add nodes to the start or end of the given fragment to make it
    // fit the node. If no fitting wrapping can be found, return null.
    // Note that, due to the fact that required nodes can always be
    // created, this will always succeed if you pass null or
    // `Fragment.empty` as content.

  }, {
    key: "createAndFill",
    value: function createAndFill(attrs, content, marks) {
      attrs = this.computeAttrs(attrs);
      content = Fragment.from(content);
      if (content.size) {
        var before = this.contentExpr.start(attrs).fillBefore(content);
        if (!before) return null;
        content = before.append(content);
      }
      var after = this.contentExpr.getMatchAt(attrs, content).fillBefore(Fragment.empty, true);
      if (!after) return null;
      return new Node(this, attrs, content.append(after), Mark.setFrom(marks));
    }

    // :: (Fragment, ?Object) → bool
    // Returns true if the given fragment is valid content for this node
    // type with the given attributes.

  }, {
    key: "validContent",
    value: function validContent(content, attrs) {
      return this.contentExpr.matches(attrs, content);
    }
  }, {
    key: "toDOM",


    // :: (Node) → DOMOutputSpec
    // Defines the way a node of this type should be serialized to
    // DOM/HTML. Should return an [array structure](#DOMOutputSpec) that
    // describes the resulting DOM structure, with an optional number
    // zero (“hole”) in it to indicate where the node's content should
    // be inserted.
    value: function toDOM(_) {
      throw new Error("Failed to override NodeType.toDOM");
    }

    // :: Object<union<ParseSpec, (DOMNode) → union<bool, ParseSpec>>>
    // Defines the way nodes of this type are parsed. Should, if
    // present, contain an object mapping CSS selectors (such as `"p"`
    // for `<p>` tags, or `"div[data-type=foo]"` for `<div>` tags with a
    // specific attribute) to [parse specs](#ParseSpec) or functions
    // that, when given a DOM node, return either `false` or a parse
    // spec.

  }, {
    key: "isBlock",
    get: function get() {
      return false;
    }

    // :: bool
    // True if this is a textblock type, a block that contains inline
    // content.

  }, {
    key: "isTextblock",
    get: function get() {
      return false;
    }

    // :: bool
    // True if this is an inline type.

  }, {
    key: "isInline",
    get: function get() {
      return false;
    }

    // :: bool
    // True if this is the text node type.

  }, {
    key: "isText",
    get: function get() {
      return false;
    }

    // :: bool
    // True for node types that allow no content.

  }, {
    key: "isLeaf",
    get: function get() {
      return this.contentExpr.isLeaf;
    }

    // :: bool
    // Controls whether nodes of this type can be selected (as a [node
    // selection](#NodeSelection)).

  }, {
    key: "selectable",
    get: function get() {
      return true;
    }

    // :: bool
    // Determines whether nodes of this type can be dragged. Enabling it
    // causes ProseMirror to set a `draggable` attribute on its DOM
    // representation, and to put its HTML serialization into the drag
    // event's [data
    // transfer](https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer)
    // when dragged.

  }, {
    key: "draggable",
    get: function get() {
      return false;
    }
  }, {
    key: "matchDOMTag",
    get: function get() {}
  }], [{
    key: "compile",
    value: function compile(nodes, schema) {
      var result = Object.create(null);
      nodes.forEach(function (name, spec) {
        return result[name] = new spec.type(name, schema);
      });

      if (!result.doc) throw new RangeError("Every schema needs a 'doc' type");
      if (!result.text) throw new RangeError("Every schema needs a 'text' type");

      return result;
    }
  }]);

  return NodeType;
}();

exports.NodeType = NodeType;

// ;; Base type for block nodetypes.

var Block = function (_NodeType) {
  _inherits(Block, _NodeType);

  function Block() {
    _classCallCheck(this, Block);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Block).apply(this, arguments));
  }

  _createClass(Block, [{
    key: "isBlock",
    get: function get() {
      return true;
    }
  }, {
    key: "isTextblock",
    get: function get() {
      return this.contentExpr.inlineContent;
    }
  }]);

  return Block;
}(NodeType);

exports.Block = Block;

// ;; Base type for inline node types.

var Inline = function (_NodeType2) {
  _inherits(Inline, _NodeType2);

  function Inline() {
    _classCallCheck(this, Inline);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Inline).apply(this, arguments));
  }

  _createClass(Inline, [{
    key: "isInline",
    get: function get() {
      return true;
    }
  }]);

  return Inline;
}(NodeType);

exports.Inline = Inline;

// ;; The text node type.

var Text = function (_Inline) {
  _inherits(Text, _Inline);

  function Text() {
    _classCallCheck(this, Text);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Text).apply(this, arguments));
  }

  _createClass(Text, [{
    key: "create",
    value: function create(attrs, content, marks) {
      return new TextNode(this, this.computeAttrs(attrs), content, marks);
    }
  }, {
    key: "toDOM",
    value: function toDOM(node) {
      return node.text;
    }
  }, {
    key: "selectable",
    get: function get() {
      return false;
    }
  }, {
    key: "isText",
    get: function get() {
      return true;
    }
  }]);

  return Text;
}(Inline);

exports.Text = Text;

// Attribute descriptors

// ;; Attributes are named values associated with nodes and marks.
// Each node type or mark type has a fixed set of attributes, which
// instances of this class are used to control. Attribute values must
// be JSON-serializable.

var Attribute = function () {
  // :: (Object)
  // Create an attribute. `options` is an object containing the
  // settings for the attributes. The following settings are
  // supported:
  //
  // **`default`**`: ?any`
  //   : The default value for this attribute, to choose when no
  //     explicit value is provided.
  //
  // **`compute`**`: ?() → any`
  //   : A function that computes a default value for the attribute.
  //
  // Attributes that have no default or compute property must be
  // provided whenever a node or mark of a type that has them is
  // created.

  function Attribute() {
    var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Attribute);

    this.default = options.default;
    this.compute = options.compute;
  }

  _createClass(Attribute, [{
    key: "isRequired",
    get: function get() {
      return this.default === undefined && !this.compute;
    }
  }]);

  return Attribute;
}();

exports.Attribute = Attribute;

// Marks

// ;; Like nodes, marks (which are associated with nodes to signify
// things like emphasis or being part of a link) are tagged with type
// objects, which are instantiated once per `Schema`.

var MarkType = function () {
  function MarkType(name, rank, schema) {
    _classCallCheck(this, MarkType);

    // :: string
    // The name of the mark type.
    this.name = name;
    Object.defineProperty(this, "attrs", { value: copyObj(this.attrs) });
    this.rank = rank;
    // :: Schema
    // The schema that this mark type instance is part of.
    this.schema = schema;
    var defaults = defaultAttrs(this.attrs);
    this.instance = defaults && new Mark(this, defaults);
  }

  // :: bool
  // Whether this mark should be active when the cursor is positioned
  // at the end of the mark.


  _createClass(MarkType, [{
    key: "create",


    // :: (?Object) → Mark
    // Create a mark of this type. `attrs` may be `null` or an object
    // containing only some of the mark's attributes. The others, if
    // they have defaults, will be added.
    value: function create(attrs) {
      if (!attrs && this.instance) return this.instance;
      return new Mark(this, _computeAttrs(this.attrs, attrs));
    }
  }, {
    key: "removeFromSet",


    // :: ([Mark]) → [Mark]
    // When there is a mark of this type in the given set, a new set
    // without it is returned. Otherwise, the input set is returned.
    value: function removeFromSet(set) {
      for (var i = 0; i < set.length; i++) {
        if (set[i].type == this) return set.slice(0, i).concat(set.slice(i + 1));
      }return set;
    }

    // :: ([Mark]) → ?Mark
    // Tests whether there is a mark of this type in the given set.

  }, {
    key: "isInSet",
    value: function isInSet(set) {
      for (var i = 0; i < set.length; i++) {
        if (set[i].type == this) return set[i];
      }
    }

    // :: (mark: Mark) → DOMOutputSpec
    // Defines the way marks of this type should be serialized to DOM/HTML.

  }, {
    key: "toDOM",
    value: function toDOM(_) {
      throw new Error("Failed to override MarkType.toDOM");
    }

    // :: Object<union<ParseSpec, (DOMNode) → union<bool, ParseSpec>>>
    // Defines the way marks of this type are parsed. Works just like
    // `NodeType.matchTag`, but produces marks rather than nodes.

  }, {
    key: "inclusiveRight",
    get: function get() {
      return true;
    }
  }, {
    key: "matchDOMTag",
    get: function get() {}

    // :: Object<union<?Object, (string) → union<bool, ?Object>>>
    // Defines the way DOM styles are mapped to marks of this type. Should
    // contain an object mapping CSS property names, as found in inline
    // styles, to either attributes for this mark (null for default
    // attributes), or a function mapping the style's value to either a
    // set of attributes or `false` to indicate that the style does not
    // match.

  }, {
    key: "matchDOMStyle",
    get: function get() {}
  }], [{
    key: "compile",
    value: function compile(marks, schema) {
      var result = Object.create(null),
          rank = 0;
      marks.forEach(function (name, markType) {
        return result[name] = new markType(name, rank++, schema);
      });
      return result;
    }
  }]);

  return MarkType;
}();

exports.MarkType = MarkType;

// ;; #path=SchemaSpec #kind=interface
// An object describing a schema, as passed to the `Schema`
// constructor.

// :: union<Object<NodeSpec>, OrderedMap<NodeSpec>> #path=SchemaSpec.nodes
// The node types in this schema. Maps names to `NodeSpec` objects
// describing the node to be associated with that name. Their order is significant

// :: ?union<Object<constructor<MarkType>>, OrderedMap<constructor<MarkType>>> #path=SchemaSpec.marks
// The mark types that exist in this schema.

// ;; #path=NodeSpec #kind=interface

// :: constructor<NodeType> #path=NodeSpec.type
// The `NodeType` class to be used for this node.

// :: ?string #path=NodeSpec.content
// The content expression for this node, as described in the [schema
// guide](guide/schema.html). When not given, the node does not allow
// any content.

// :: ?string #path=NodeSpec.group
// The group or space-separated groups to which this node belongs, as
// referred to in the content expressions for the schema.

// ;; Each document is based on a single schema, which provides the
// node and mark types that it is made up of (which, in turn,
// determine the structure it is allowed to have).

var Schema = function () {
  // :: (SchemaSpec, ?any)
  // Construct a schema from a specification.

  function Schema(spec, data) {
    _classCallCheck(this, Schema);

    // :: OrderedMap<NodeSpec> The node specs that the schema is based on.
    this.nodeSpec = OrderedMap.from(spec.nodes);
    // :: OrderedMap<constructor<MarkType>> The mark spec that the schema is based on.
    this.markSpec = OrderedMap.from(spec.marks);

    // :: any A generic field that you can use (by passing a value to
    // the constructor) to store arbitrary data or references in your
    // schema object, for use by node- or mark- methods.
    this.data = data;

    // :: Object<NodeType>
    // An object mapping the schema's node names to node type objects.
    this.nodes = NodeType.compile(this.nodeSpec, this);
    // :: Object<MarkType>
    // A map from mark names to mark type objects.
    this.marks = MarkType.compile(this.markSpec, this);
    for (var prop in this.nodes) {
      if (prop in this.marks) throw new RangeError(prop + " can not be both a node and a mark");
      var type = this.nodes[prop];
      type.contentExpr = ContentExpr.parse(type, this.nodeSpec.get(prop).content || "", this.nodeSpec);
    }

    // :: Object
    // An object for storing whatever values modules may want to
    // compute and cache per schema. (If you want to store something
    // in it, try to use property names unlikely to clash.)
    this.cached = Object.create(null);
    this.cached.wrappings = Object.create(null);

    this.node = this.node.bind(this);
    this.text = this.text.bind(this);
    this.nodeFromJSON = this.nodeFromJSON.bind(this);
    this.markFromJSON = this.markFromJSON.bind(this);
  }

  // :: (union<string, NodeType>, ?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → Node
  // Create a node in this schema. The `type` may be a string or a
  // `NodeType` instance. Attributes will be extended
  // with defaults, `content` may be a `Fragment`,
  // `null`, a `Node`, or an array of nodes.
  //
  // When creating a text node, `content` should be a string and is
  // interpreted as the node's text.
  //
  // This method is bound to the Schema, meaning you don't have to
  // call it as a method, but can pass it to higher-order functions
  // and such.


  _createClass(Schema, [{
    key: "node",
    value: function node(type, attrs, content, marks) {
      if (typeof type == "string") type = this.nodeType(type);else if (!(type instanceof NodeType)) throw new RangeError("Invalid node type: " + type);else if (type.schema != this) throw new RangeError("Node type from different schema used (" + type.name + ")");

      return type.createChecked(attrs, content, marks);
    }

    // :: (string, ?[Mark]) → Node
    // Create a text node in the schema. This method is bound to the
    // Schema. Empty text nodes are not allowed.

  }, {
    key: "text",
    value: function text(_text, marks) {
      return this.nodes.text.create(null, _text, Mark.setFrom(marks));
    }

    // :: (string, ?Object) → Mark
    // Create a mark with the named type

  }, {
    key: "mark",
    value: function mark(name, attrs) {
      var spec = this.marks[name];
      if (!spec) throw new RangeError("No mark named " + name);
      return spec.create(attrs);
    }

    // :: (Object) → Node
    // Deserialize a node from its JSON representation. This method is
    // bound.

  }, {
    key: "nodeFromJSON",
    value: function nodeFromJSON(json) {
      return Node.fromJSON(this, json);
    }

    // :: (Object) → Mark
    // Deserialize a mark from its JSON representation. This method is
    // bound.

  }, {
    key: "markFromJSON",
    value: function markFromJSON(json) {
      var type = this.marks[json._];
      var attrs = null;
      for (var prop in json) {
        if (prop != "_") {
          if (!attrs) attrs = Object.create(null);
          attrs[prop] = json[prop];
        }
      }return attrs ? type.create(attrs) : type.instance;
    }

    // :: (string) → NodeType
    // Get the `NodeType` associated with the given name in
    // this schema, or raise an error if it does not exist.

  }, {
    key: "nodeType",
    value: function nodeType(name) {
      var found = this.nodes[name];
      if (!found) throw new RangeError("Unknown node type: " + name);
      return found;
    }

    // :: (DOMNode, ?Object) → Node
    // Parse a document from the content of a DOM node. To provide an
    // explicit parent document (for example, when not in a browser
    // window environment, where we simply use the global document),
    // pass it as the `document` property of `options`.

  }, {
    key: "parseDOM",
    value: function parseDOM(dom) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      return _parseDOM(this, dom, options);
    }
  }]);

  return Schema;
}();

exports.Schema = Schema;
},{"../util/obj":63,"../util/orderedmap":64,"./content":33,"./fragment":35,"./from_dom":36,"./mark":38,"./node":39}],43:[function(require,module,exports){
"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// ;; #path=DOMOutputSpec #kind=interface
// A description of a DOM structure. Can be either a string, which is
// interpreted as a text node, a DOM node, which is interpreted as
// itself, or an array.
//
// An array describes a DOM element. The first element in the array
// should be a string, and is the name of the DOM element. If the
// second element is a non-Array, non-DOM node object, it is
// interpreted as an object providing the DOM element's attributes.
// Any elements after that (including the 2nd if it's not an attribute
// object) are interpreted as children of the DOM elements, and must
// either be valid `DOMOutputSpec` values, or the number zero.
//
// The number zero (pronounced “hole”) is used to indicate the place
// where a ProseMirror node's content should be inserted.

// Object used to to expose relevant values and methods
// to DOM serializer functions.

var DOMSerializer = function () {
  function DOMSerializer(options) {
    _classCallCheck(this, DOMSerializer);

    // : Object The options passed to the serializer.
    this.options = options || {};
    // : DOMDocument The DOM document in which we are working.
    this.doc = this.options.document || window.document;
  }

  _createClass(DOMSerializer, [{
    key: "renderNode",
    value: function renderNode(node, pos, offset) {
      var dom = this.renderStructure(node.type.toDOM(node), node.content, pos + 1);
      if (this.options.onRender) dom = this.options.onRender(node, dom, pos, offset) || dom;
      return dom;
    }
  }, {
    key: "renderStructure",
    value: function renderStructure(structure, content, startPos) {
      if (typeof structure == "string") return this.doc.createTextNode(structure);
      if (structure.nodeType != null) return structure;
      var dom = this.doc.createElement(structure[0]),
          attrs = structure[1],
          start = 1;
      if (attrs && (typeof attrs === "undefined" ? "undefined" : _typeof(attrs)) == "object" && attrs.nodeType == null && !Array.isArray(attrs)) {
        start = 2;
        for (var name in attrs) {
          if (name == "style") dom.style.cssText = attrs[name];else if (attrs[name]) dom.setAttribute(name, attrs[name]);
        }
      }
      for (var i = start; i < structure.length; i++) {
        var child = structure[i];
        if (child === 0) {
          if (!content) throw new RangeError("Content hole not allowed in a Mark spec (must produce a single node)");
          if (i < structure.length - 1 || i > start) throw new RangeError("Content hole must be the only child of its parent node");
          if (this.options.onContainer) this.options.onContainer(dom);
          this.renderFragment(content, dom, startPos);
        } else {
          dom.appendChild(this.renderStructure(child, content, startPos));
        }
      }
      return dom;
    }
  }, {
    key: "renderFragment",
    value: function renderFragment(fragment, where, startPos) {
      if (!where) where = this.doc.createDocumentFragment();
      if (fragment.size == 0) return where;

      if (!fragment.firstChild.isInline) this.renderBlocksInto(fragment, where, startPos);else if (this.options.renderInlineFlat) this.renderInlineFlatInto(fragment, where, startPos);else this.renderInlineInto(fragment, where, startPos);
      return where;
    }
  }, {
    key: "renderBlocksInto",
    value: function renderBlocksInto(fragment, where, startPos) {
      var _this = this;

      fragment.forEach(function (node, offset) {
        return where.appendChild(_this.renderNode(node, startPos + offset, offset));
      });
    }
  }, {
    key: "renderInlineInto",
    value: function renderInlineInto(fragment, where, startPos) {
      var _this2 = this;

      var top = where;
      var active = [];
      fragment.forEach(function (node, offset) {
        var keep = 0;
        for (; keep < Math.min(active.length, node.marks.length); ++keep) {
          if (!node.marks[keep].eq(active[keep])) break;
        }while (keep < active.length) {
          active.pop();
          top = top.parentNode;
        }
        while (active.length < node.marks.length) {
          var add = node.marks[active.length];
          active.push(add);
          top = top.appendChild(_this2.renderMark(add));
        }
        top.appendChild(_this2.renderNode(node, startPos + offset, offset));
      });
    }
  }, {
    key: "renderInlineFlatInto",
    value: function renderInlineFlatInto(fragment, where, startPos) {
      var _this3 = this;

      fragment.forEach(function (node, offset) {
        var pos = startPos + offset,
            dom = _this3.renderNode(node, pos, offset);
        dom = _this3.wrapInlineFlat(dom, node.marks);
        dom = _this3.options.renderInlineFlat(node, dom, pos, offset) || dom;
        where.appendChild(dom);
      });
    }
  }, {
    key: "renderMark",
    value: function renderMark(mark) {
      return this.renderStructure(mark.type.toDOM(mark));
    }
  }, {
    key: "wrapInlineFlat",
    value: function wrapInlineFlat(dom, marks) {
      for (var i = marks.length - 1; i >= 0; i--) {
        var wrap = this.renderMark(marks[i]);
        wrap.appendChild(dom);
        dom = wrap;
      }
      return dom;
    }
  }]);

  return DOMSerializer;
}();

function fragmentToDOM(fragment, options) {
  return new DOMSerializer(options).renderFragment(fragment, null, options.pos || 0);
}
exports.fragmentToDOM = fragmentToDOM;

function nodeToDOM(node, options) {
  var serializer = new DOMSerializer(options),
      pos = options.pos || 0;
  var dom = serializer.renderNode(node, pos, options.offset || 0);
  if (node.isInline) {
    dom = serializer.wrapInlineFlat(dom, node.marks);
    if (serializer.options.renderInlineFlat) dom = options.renderInlineFlat(node, dom, pos, options.offset || 0) || dom;
  }
  return dom;
}
exports.nodeToDOM = nodeToDOM;
},{}],44:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require("../model");

var Schema = _require.Schema;
var Block = _require.Block;
var Inline = _require.Inline;
var Text = _require.Text;
var Attribute = _require.Attribute;
var MarkType = _require.MarkType;

exports.Text = Text;

// !! This module defines a number of basic node and mark types, and a
// schema that combines them.

// ;; A default top-level document node type.

var Doc = function (_Block) {
  _inherits(Doc, _Block);

  function Doc() {
    _classCallCheck(this, Doc);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Doc).apply(this, arguments));
  }

  return Doc;
}(Block);

exports.Doc = Doc;

// ;; A blockquote node type.

var BlockQuote = function (_Block2) {
  _inherits(BlockQuote, _Block2);

  function BlockQuote() {
    _classCallCheck(this, BlockQuote);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(BlockQuote).apply(this, arguments));
  }

  _createClass(BlockQuote, [{
    key: "toDOM",
    value: function toDOM() {
      return ["blockquote", 0];
    }
  }, {
    key: "matchDOMTag",
    get: function get() {
      return { "blockquote": null };
    }
  }]);

  return BlockQuote;
}(Block);

exports.BlockQuote = BlockQuote;

// ;; An ordered list node type. Has a single attribute, `order`,
// which determines the number at which the list starts counting, and
// defaults to 1.

var OrderedList = function (_Block3) {
  _inherits(OrderedList, _Block3);

  function OrderedList() {
    _classCallCheck(this, OrderedList);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(OrderedList).apply(this, arguments));
  }

  _createClass(OrderedList, [{
    key: "toDOM",
    value: function toDOM(node) {
      return ["ol", { start: node.attrs.order == 1 ? null : node.attrs.order }, 0];
    }
  }, {
    key: "attrs",
    get: function get() {
      return { order: new Attribute({ default: 1 }) };
    }
  }, {
    key: "matchDOMTag",
    get: function get() {
      return { "ol": function ol(dom) {
          return {
            order: dom.hasAttribute("start") ? +dom.getAttribute("start") : 1
          };
        } };
    }
  }]);

  return OrderedList;
}(Block);

exports.OrderedList = OrderedList;

// ;; A bullet list node type.

var BulletList = function (_Block4) {
  _inherits(BulletList, _Block4);

  function BulletList() {
    _classCallCheck(this, BulletList);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(BulletList).apply(this, arguments));
  }

  _createClass(BulletList, [{
    key: "toDOM",
    value: function toDOM() {
      return ["ul", 0];
    }
  }, {
    key: "matchDOMTag",
    get: function get() {
      return { "ul": null };
    }
  }]);

  return BulletList;
}(Block);

exports.BulletList = BulletList;

// ;; A list item node type.

var ListItem = function (_Block5) {
  _inherits(ListItem, _Block5);

  function ListItem() {
    _classCallCheck(this, ListItem);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(ListItem).apply(this, arguments));
  }

  _createClass(ListItem, [{
    key: "toDOM",
    value: function toDOM() {
      return ["li", 0];
    }
  }, {
    key: "matchDOMTag",
    get: function get() {
      return { "li": null };
    }
  }]);

  return ListItem;
}(Block);

exports.ListItem = ListItem;

// ;; A node type for horizontal rules.

var HorizontalRule = function (_Block6) {
  _inherits(HorizontalRule, _Block6);

  function HorizontalRule() {
    _classCallCheck(this, HorizontalRule);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(HorizontalRule).apply(this, arguments));
  }

  _createClass(HorizontalRule, [{
    key: "toDOM",
    value: function toDOM() {
      return ["div", ["hr"]];
    }
  }, {
    key: "matchDOMTag",
    get: function get() {
      return { "hr": null };
    }
  }]);

  return HorizontalRule;
}(Block);

exports.HorizontalRule = HorizontalRule;

// ;; A heading node type. Has a single attribute `level`, which
// indicates the heading level, and defaults to 1.

var Heading = function (_Block7) {
  _inherits(Heading, _Block7);

  function Heading() {
    _classCallCheck(this, Heading);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Heading).apply(this, arguments));
  }

  _createClass(Heading, [{
    key: "toDOM",
    value: function toDOM(node) {
      return ["h" + node.attrs.level, 0];
    }
  }, {
    key: "attrs",
    get: function get() {
      return { level: new Attribute({ default: 1 }) };
    }
    // :: number
    // Controls the maximum heading level. Has the value 6 in the
    // `Heading` class, but you can override it in a subclass.

  }, {
    key: "maxLevel",
    get: function get() {
      return 6;
    }
  }, {
    key: "matchDOMTag",
    get: function get() {
      return {
        "h1": { level: 1 },
        "h2": { level: 2 },
        "h3": { level: 3 },
        "h4": { level: 4 },
        "h5": { level: 5 },
        "h6": { level: 6 }
      };
    }
  }]);

  return Heading;
}(Block);

exports.Heading = Heading;

// ;; A code block / listing node type.

var CodeBlock = function (_Block8) {
  _inherits(CodeBlock, _Block8);

  function CodeBlock() {
    _classCallCheck(this, CodeBlock);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(CodeBlock).apply(this, arguments));
  }

  _createClass(CodeBlock, [{
    key: "toDOM",
    value: function toDOM() {
      return ["pre", ["code", 0]];
    }
  }, {
    key: "isCode",
    get: function get() {
      return true;
    }
  }, {
    key: "matchDOMTag",
    get: function get() {
      return { "pre": [null, { preserveWhitespace: true }] };
    }
  }]);

  return CodeBlock;
}(Block);

exports.CodeBlock = CodeBlock;

// ;; A paragraph node type.

var Paragraph = function (_Block9) {
  _inherits(Paragraph, _Block9);

  function Paragraph() {
    _classCallCheck(this, Paragraph);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Paragraph).apply(this, arguments));
  }

  _createClass(Paragraph, [{
    key: "toDOM",
    value: function toDOM() {
      return ["p", 0];
    }
  }, {
    key: "matchDOMTag",
    get: function get() {
      return { "p": null };
    }
  }]);

  return Paragraph;
}(Block);

exports.Paragraph = Paragraph;

// ;; An inline image node type. Has these attributes:
//
// - **`src`** (required): The URL of the image.
// - **`alt`**: The alt text.
// - **`title`**: The title of the image.

var Image = function (_Inline) {
  _inherits(Image, _Inline);

  function Image() {
    _classCallCheck(this, Image);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Image).apply(this, arguments));
  }

  _createClass(Image, [{
    key: "toDOM",
    value: function toDOM(node) {
      return ["img", node.attrs];
    }
  }, {
    key: "attrs",
    get: function get() {
      return {
        src: new Attribute(),
        alt: new Attribute({ default: "" }),
        title: new Attribute({ default: "" })
      };
    }
  }, {
    key: "draggable",
    get: function get() {
      return true;
    }
  }, {
    key: "matchDOMTag",
    get: function get() {
      return { "img[src]": function imgSrc(dom) {
          return {
            src: dom.getAttribute("src"),
            title: dom.getAttribute("title"),
            alt: dom.getAttribute("alt")
          };
        } };
    }
  }]);

  return Image;
}(Inline);

exports.Image = Image;

// ;; A hard break node type.

var HardBreak = function (_Inline2) {
  _inherits(HardBreak, _Inline2);

  function HardBreak() {
    _classCallCheck(this, HardBreak);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(HardBreak).apply(this, arguments));
  }

  _createClass(HardBreak, [{
    key: "toDOM",
    value: function toDOM() {
      return ["br"];
    }
  }, {
    key: "selectable",
    get: function get() {
      return false;
    }
  }, {
    key: "isBR",
    get: function get() {
      return true;
    }
  }, {
    key: "matchDOMTag",
    get: function get() {
      return { "br": null };
    }
  }]);

  return HardBreak;
}(Inline);

exports.HardBreak = HardBreak;

// ;; An emphasis mark type.

var EmMark = function (_MarkType) {
  _inherits(EmMark, _MarkType);

  function EmMark() {
    _classCallCheck(this, EmMark);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(EmMark).apply(this, arguments));
  }

  _createClass(EmMark, [{
    key: "toDOM",
    value: function toDOM() {
      return ["em"];
    }
  }, {
    key: "matchDOMTag",
    get: function get() {
      return { "i": null, "em": null };
    }
  }, {
    key: "matchDOMStyle",
    get: function get() {
      return { "font-style": function fontStyle(value) {
          return value == "italic" && null;
        } };
    }
  }]);

  return EmMark;
}(MarkType);

exports.EmMark = EmMark;

// ;; A strong mark type.

var StrongMark = function (_MarkType2) {
  _inherits(StrongMark, _MarkType2);

  function StrongMark() {
    _classCallCheck(this, StrongMark);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(StrongMark).apply(this, arguments));
  }

  _createClass(StrongMark, [{
    key: "toDOM",
    value: function toDOM() {
      return ["strong"];
    }
  }, {
    key: "matchDOMTag",
    get: function get() {
      return { "b": null, "strong": null };
    }
  }, {
    key: "matchDOMStyle",
    get: function get() {
      return { "font-weight": function fontWeight(value) {
          return (/^(bold(er)?|[5-9]\d{2,})$/.test(value) && null
          );
        } };
    }
  }]);

  return StrongMark;
}(MarkType);

exports.StrongMark = StrongMark;

// ;; A link mark type. Has these attributes:
//
// - **`href`** (required): The link target.
// - **`title`**: The link's title.

var LinkMark = function (_MarkType3) {
  _inherits(LinkMark, _MarkType3);

  function LinkMark() {
    _classCallCheck(this, LinkMark);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(LinkMark).apply(this, arguments));
  }

  _createClass(LinkMark, [{
    key: "toDOM",
    value: function toDOM(node) {
      return ["a", node.attrs];
    }
  }, {
    key: "attrs",
    get: function get() {
      return {
        href: new Attribute(),
        title: new Attribute({ default: "" })
      };
    }
  }, {
    key: "matchDOMTag",
    get: function get() {
      return { "a[href]": function aHref(dom) {
          return {
            href: dom.getAttribute("href"), title: dom.getAttribute("title")
          };
        } };
    }
  }]);

  return LinkMark;
}(MarkType);

exports.LinkMark = LinkMark;

// ;; A code font mark type.

var CodeMark = function (_MarkType4) {
  _inherits(CodeMark, _MarkType4);

  function CodeMark() {
    _classCallCheck(this, CodeMark);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(CodeMark).apply(this, arguments));
  }

  _createClass(CodeMark, [{
    key: "toDOM",
    value: function toDOM() {
      return ["code"];
    }
  }, {
    key: "isCode",
    get: function get() {
      return true;
    }
  }, {
    key: "matchDOMTag",
    get: function get() {
      return { "code": null };
    }
  }]);

  return CodeMark;
}(MarkType);

exports.CodeMark = CodeMark;

// :: Schema
// A basic document schema.
var schema = new Schema({
  nodes: {
    doc: { type: Doc, content: "block+" },

    paragraph: { type: Paragraph, content: "inline<_>*", group: "block" },
    blockquote: { type: BlockQuote, content: "block+", group: "block" },
    ordered_list: { type: OrderedList, content: "list_item+", group: "block" },
    bullet_list: { type: BulletList, content: "list_item+", group: "block" },
    horizontal_rule: { type: HorizontalRule, group: "block" },
    heading: { type: Heading, content: "inline<_>*", group: "block" },
    code_block: { type: CodeBlock, content: "text*", group: "block" },

    list_item: { type: ListItem, content: "paragraph block*" },

    text: { type: Text, group: "inline" },
    image: { type: Image, group: "inline" },
    hard_break: { type: HardBreak, group: "inline" }
  },

  marks: {
    em: EmMark,
    strong: StrongMark,
    link: LinkMark,
    code: CodeMark
  }
});
exports.schema = schema;
},{"../model":37}],45:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require("../model");

var Block = _require.Block;
var Attribute = _require.Attribute;
var Fragment = _require.Fragment;
var Slice = _require.Slice;

var _require2 = require("../transform");

var Step = _require2.Step;
var StepResult = _require2.StepResult;
var PosMap = _require2.PosMap;
var ReplaceStep = _require2.ReplaceStep;

var _require3 = require("../util/obj");

var copyObj = _require3.copyObj;

var _require4 = require("../edit");

var Selection = _require4.Selection;

// ;; A table node type. Has one attribute, **`columns`**, which holds
// a number indicating the amount of columns in the table.

var Table = function (_Block) {
  _inherits(Table, _Block);

  function Table() {
    _classCallCheck(this, Table);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Table).apply(this, arguments));
  }

  _createClass(Table, [{
    key: "toDOM",
    value: function toDOM() {
      return ["table", ["tbody", 0]];
    }
  }, {
    key: "attrs",
    get: function get() {
      return { columns: new Attribute({ default: 1 }) };
    }
  }, {
    key: "matchDOMTag",
    get: function get() {
      return { "table": function table(dom) {
          var row = dom.querySelector("tr");
          if (!row || !row.children.length) return false;
          // FIXME using the child count as column width is problematic
          // when parsing document fragments
          return { columns: row.children.length };
        } };
    }
  }]);

  return Table;
}(Block);

exports.Table = Table;

// ;; A table row node type. Has one attribute, **`columns`**, which
// holds a number indicating the amount of columns in the table.

var TableRow = function (_Block2) {
  _inherits(TableRow, _Block2);

  function TableRow() {
    _classCallCheck(this, TableRow);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(TableRow).apply(this, arguments));
  }

  _createClass(TableRow, [{
    key: "toDOM",
    value: function toDOM() {
      return ["tr", 0];
    }
  }, {
    key: "attrs",
    get: function get() {
      return { columns: new Attribute({ default: 1 }) };
    }
  }, {
    key: "matchDOMTag",
    get: function get() {
      return { "tr": function tr(dom) {
          return dom.children.length ? { columns: dom.children.length } : false;
        } };
    }
  }]);

  return TableRow;
}(Block);

exports.TableRow = TableRow;

// ;; A table cell node type.

var TableCell = function (_Block3) {
  _inherits(TableCell, _Block3);

  function TableCell() {
    _classCallCheck(this, TableCell);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(TableCell).apply(this, arguments));
  }

  _createClass(TableCell, [{
    key: "toDOM",
    value: function toDOM() {
      return ["td", 0];
    }
  }, {
    key: "matchDOMTag",
    get: function get() {
      return { "td": null };
    }
  }]);

  return TableCell;
}(Block);

exports.TableCell = TableCell;

// :: (OrderedMap, string, ?string) → OrderedMap
// Convenience function for adding table-related node types to a map
// describing the nodes in a schema. Adds `Table` as `"table"`,
// `TableRow` as `"table_row"`, and `TableCell` as `"table_cell"`.
// `cellContent` should be a content expression describing what may
// occur inside cells.
function addTableNodes(nodes, cellContent, tableGroup) {
  return nodes.append({
    table: { type: Table, content: "table_row[columns=.columns]+", group: tableGroup },
    table_row: { type: TableRow, content: "table_cell{.columns}" },
    table_cell: { type: TableCell, content: cellContent }
  });
}
exports.addTableNodes = addTableNodes;

// :: (NodeType, number, number, ?Object) → Node
// Create a table node with the given number of rows and columns.
function createTable(nodeType, rows, columns, attrs) {
  attrs = attrs ? copyObj(attrs) : Object.create(null);
  attrs.columns = columns;
  var rowType = nodeType.contentExpr.elements[0].nodeTypes[0];
  var cellType = rowType.contentExpr.elements[0].nodeTypes[0];
  var cell = cellType.createAndFill(),
      cells = [];
  for (var i = 0; i < columns; i++) {
    cells.push(cell);
  }var row = rowType.create({ columns: columns }, Fragment.from(cells)),
      rowNodes = [];
  for (var _i = 0; _i < rows; _i++) {
    rowNodes.push(row);
  }return nodeType.create(attrs, Fragment.from(rowNodes));
}
exports.createTable = createTable;

// Steps to add and remove a column

function adjustColumns(attrs, diff) {
  var copy = copyObj(attrs);
  copy.columns = attrs.columns + diff;
  return copy;
}

// ;; A `Step` subclass for adding a column to a table in a single
// atomic step.

var AddColumnStep = function (_Step) {
  _inherits(AddColumnStep, _Step);

  function AddColumnStep(positions, cells) {
    _classCallCheck(this, AddColumnStep);

    var _this4 = _possibleConstructorReturn(this, Object.getPrototypeOf(AddColumnStep).call(this));

    _this4.positions = positions;
    _this4.cells = cells;
    return _this4;
  }

  // :: (Node, number, number, NodeType, ?Object) → AddColumnStep
  // Create a step that inserts a column into the table after
  // `tablePos`, at the index given by `columnIndex`, using cells with
  // the given type and attributes.


  _createClass(AddColumnStep, [{
    key: "apply",
    value: function apply(doc) {
      var index = null,
          table = null,
          tablePos = null;
      for (var i = 0; i < this.positions.length; i++) {
        var $pos = doc.resolve(this.positions[i]);
        if ($pos.depth < 2 || $pos.index(-1) != i) return StepResult.fail("Invalid cell insert position");
        if (table == null) {
          table = $pos.node(-1);
          if (table.childCount != this.positions.length) return StepResult.fail("Mismatch in number of rows");
          tablePos = $pos.before(-1);
          index = $pos.index();
        } else if ($pos.before(-1) != tablePos || $pos.index() != index) {
          return StepResult.fail("Column insert positions not consistent");
        }
      }

      var updatedRows = [];
      for (var _i2 = 0; _i2 < table.childCount; _i2++) {
        var row = table.child(_i2),
            rowCells = index ? [] : [this.cells[_i2]];
        for (var j = 0; j < row.childCount; j++) {
          rowCells.push(row.child(j));
          if (j + 1 == index) rowCells.push(this.cells[_i2]);
        }
        updatedRows.push(row.type.create(adjustColumns(row.attrs, 1), Fragment.from(rowCells)));
      }
      var updatedTable = table.type.create(adjustColumns(table.attrs, 1), Fragment.from(updatedRows));
      return StepResult.fromReplace(doc, tablePos, tablePos + table.nodeSize, new Slice(Fragment.from(updatedTable), 0, 0));
    }
  }, {
    key: "posMap",
    value: function posMap() {
      var ranges = [];
      for (var i = 0; i < this.positions.length; i++) {
        ranges.push(this.positions[i], 0, this.cells[i].nodeSize);
      }return new PosMap(ranges);
    }
  }, {
    key: "invert",
    value: function invert(doc) {
      var $first = doc.resolve(this.positions[0]);
      var table = $first.node(-1);
      var from = [],
          to = [],
          dPos = 0;
      for (var i = 0; i < table.childCount; i++) {
        var pos = this.positions[i] + dPos,
            size = this.cells[i].nodeSize;
        from.push(pos);
        to.push(pos + size);
        dPos += size;
      }
      return new RemoveColumnStep(from, to);
    }
  }, {
    key: "map",
    value: function map(mapping) {
      return new AddColumnStep(this.positions.map(function (p) {
        return mapping.map(p);
      }), this.cells);
    }
  }, {
    key: "toJSON",
    value: function toJSON() {
      return { stepType: this.jsonID,
        positions: this.positions,
        cells: this.cells.map(function (c) {
          return c.toJSON();
        }) };
    }
  }], [{
    key: "create",
    value: function create(doc, tablePos, columnIndex, cellType, cellAttrs) {
      var cell = cellType.createAndFill(cellAttrs);
      var positions = [],
          cells = [];
      var table = doc.nodeAt(tablePos);
      table.forEach(function (row, rowOff) {
        var cellPos = tablePos + 2 + rowOff;
        for (var i = 0; i < columnIndex; i++) {
          cellPos += row.child(i).nodeSize;
        }positions.push(cellPos);
        cells.push(cell);
      });
      return new AddColumnStep(positions, cells);
    }
  }, {
    key: "fromJSON",
    value: function fromJSON(schema, json) {
      return new AddColumnStep(json.positions, json.cells.map(schema.nodeFromJSON));
    }
  }]);

  return AddColumnStep;
}(Step);

exports.AddColumnStep = AddColumnStep;

Step.jsonID("addTableColumn", AddColumnStep);

// ;; A subclass of `Step` that removes a column from a table.

var RemoveColumnStep = function (_Step2) {
  _inherits(RemoveColumnStep, _Step2);

  function RemoveColumnStep(from, to) {
    _classCallCheck(this, RemoveColumnStep);

    var _this5 = _possibleConstructorReturn(this, Object.getPrototypeOf(RemoveColumnStep).call(this));

    _this5.from = from;
    _this5.to = to;
    return _this5;
  }

  // :: (Node, number, number) → RemoveColumnStep
  // Create a step that deletes the column at `columnIndex` in the
  // table after `tablePos`.


  _createClass(RemoveColumnStep, [{
    key: "apply",
    value: function apply(doc) {
      var index = null,
          table = null,
          tablePos = null;
      for (var i = 0; i < this.from.length; i++) {
        var $from = doc.resolve(this.from[i]),
            after = $from.nodeAfter;
        if ($from.depth < 2 || $from.index(-1) != i || !after || this.from[i] + after.nodeSize != this.to[i]) return StepResult.fail("Invalid cell delete positions");
        if (table == null) {
          table = $from.node(-1);
          if (table.childCount != this.from.length) return StepResult.fail("Mismatch in number of rows");
          tablePos = $from.before(-1);
          index = $from.index();
        } else if ($from.before(-1) != tablePos || $from.index() != index) {
          return StepResult.fail("Column delete positions not consistent");
        }
      }

      var updatedRows = [];
      for (var _i3 = 0; _i3 < table.childCount; _i3++) {
        var row = table.child(_i3),
            rowCells = [];
        for (var j = 0; j < row.childCount; j++) {
          if (j != index) rowCells.push(row.child(j));
        }updatedRows.push(row.type.create(adjustColumns(row.attrs, -1), Fragment.from(rowCells)));
      }
      var updatedTable = table.type.create(adjustColumns(table.attrs, -1), Fragment.from(updatedRows));
      return StepResult.fromReplace(doc, tablePos, tablePos + table.nodeSize, new Slice(Fragment.from(updatedTable), 0, 0));
    }
  }, {
    key: "posMap",
    value: function posMap() {
      var ranges = [];
      for (var i = 0; i < this.from.length; i++) {
        ranges.push(this.from[i], this.to[i] - this.from[i], 0);
      }return new PosMap(ranges);
    }
  }, {
    key: "invert",
    value: function invert(doc) {
      var $first = doc.resolve(this.from[0]);
      var table = $first.node(-1),
          index = $first.index();
      var positions = [],
          cells = [],
          dPos = 0;
      for (var i = 0; i < table.childCount; i++) {
        positions.push(this.from[i] - dPos);
        var cell = table.child(i).child(index);
        dPos += cell.nodeSize;
        cells.push(cell);
      }
      return new AddColumnStep(positions, cells);
    }
  }, {
    key: "map",
    value: function map(mapping) {
      var from = [],
          to = [];
      for (var i = 0; i < this.from.length; i++) {
        var start = mapping.map(this.from[i], 1),
            end = mapping.map(this.to[i], -1);
        if (end <= start) return null;
        from.push(start);
        to.push(end);
      }
      return new RemoveColumnStep(from, to);
    }
  }], [{
    key: "create",
    value: function create(doc, tablePos, columnIndex) {
      var from = [],
          to = [];
      var table = doc.nodeAt(tablePos);
      table.forEach(function (row, rowOff) {
        var cellPos = tablePos + 2 + rowOff;
        for (var i = 0; i < columnIndex; i++) {
          cellPos += row.child(i).nodeSize;
        }from.push(cellPos);
        to.push(cellPos + row.child(columnIndex).nodeSize);
      });
      return new RemoveColumnStep(from, to);
    }
  }, {
    key: "fromJSON",
    value: function fromJSON(_schema, json) {
      return new RemoveColumnStep(json.from, json.to);
    }
  }]);

  return RemoveColumnStep;
}(Step);

exports.RemoveColumnStep = RemoveColumnStep;

Step.jsonID("removeTableColumn", RemoveColumnStep);

// Table-related command functions

function findRow($pos, pred) {
  for (var d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type instanceof TableRow && (!pred || pred(d))) return d;
  }return -1;
}

// :: (ProseMirror, ?bool) → bool
// Command function that adds a column before the column with the
// selection.
function addColumnBefore(pm, apply) {
  var $from = pm.selection.$from,
      cellFrom = void 0;
  var rowDepth = findRow($from, function (d) {
    return cellFrom = d == $from.depth ? $from.nodeBefore : $from.node(d + 1);
  });
  if (rowDepth == -1) return false;
  if (apply !== false) pm.tr.step(AddColumnStep.create(pm.doc, $from.before(rowDepth - 1), $from.index(rowDepth), cellFrom.type, cellFrom.attrs)).apply();
  return true;
}
exports.addColumnBefore = addColumnBefore;

// :: (ProseMirror, ?bool) → bool
// Command function that adds a column after the column with the
// selection.
function addColumnAfter(pm, apply) {
  var $from = pm.selection.$from,
      cellFrom = void 0;
  var rowDepth = findRow($from, function (d) {
    return cellFrom = d == $from.depth ? $from.nodeAfter : $from.node(d + 1);
  });
  if (rowDepth == -1) return false;
  if (apply !== false) pm.tr.step(AddColumnStep.create(pm.doc, $from.before(rowDepth - 1), $from.indexAfter(rowDepth) + (rowDepth == $from.depth ? 1 : 0), cellFrom.type, cellFrom.attrs)).apply();
  return true;
}
exports.addColumnAfter = addColumnAfter;

// :: (ProseMirror, ?bool) → bool
// Command function that removes the column with the selection.
function removeColumn(pm, apply) {
  var $from = pm.selection.$from;
  var rowDepth = findRow($from, function (d) {
    return $from.node(d).childCount > 1;
  });
  if (rowDepth == -1) return false;
  if (apply !== false) pm.tr.step(RemoveColumnStep.create(pm.doc, $from.before(rowDepth - 1), $from.index(rowDepth))).apply();
  return true;
}
exports.removeColumn = removeColumn;

function addRow(pm, apply, side) {
  var $from = pm.selection.$from;
  var rowDepth = findRow($from);
  if (rowDepth == -1) return false;
  if (apply !== false) {
    (function () {
      var exampleRow = $from.node(rowDepth);
      var cells = [],
          pos = side < 0 ? $from.before(rowDepth) : $from.after(rowDepth);
      exampleRow.forEach(function (cell) {
        return cells.push(cell.type.createAndFill(cell.attrs));
      });
      var row = exampleRow.copy(Fragment.from(cells));
      pm.tr.step(new ReplaceStep(pos, pos, new Slice(Fragment.from(row), 0, 0))).apply();
    })();
  }
  return true;
}

// :: (ProseMirror, ?bool) → bool
// Command function that adds a row after the row with the
// selection.
function addRowBefore(pm, apply) {
  return addRow(pm, apply, -1);
}
exports.addRowBefore = addRowBefore;

// :: (ProseMirror, ?bool) → bool
// Command function that adds a row before the row with the
// selection.
function addRowAfter(pm, apply) {
  return addRow(pm, apply, 1);
}
exports.addRowAfter = addRowAfter;

// :: (ProseMirror, ?bool) → bool
// Command function that removes the row with the selection.
function removeRow(pm, apply) {
  var $from = pm.selection.$from;
  var rowDepth = findRow($from, function (d) {
    return $from.node(d - 1).childCount > 1;
  });
  if (rowDepth == -1) return false;
  if (apply !== false) pm.tr.step(new ReplaceStep($from.before(rowDepth), $from.after(rowDepth), Slice.empty)).apply();
  return true;
}
exports.removeRow = removeRow;

function moveCell(pm, dir, apply) {
  var $from = pm.selection.$from;

  var rowDepth = findRow($from);
  if (rowDepth == -1) return false;
  var row = $from.node(rowDepth),
      newIndex = $from.index(rowDepth) + dir;
  if (newIndex >= 0 && newIndex < row.childCount) {
    var $cellStart = pm.doc.resolve(row.content.offsetAt(newIndex) + $from.start(rowDepth));
    var sel = Selection.findFrom($cellStart, 1);
    if (!sel || sel.from >= $cellStart.end()) return false;
    if (apply !== false) pm.setSelection(sel);
    return true;
  } else {
    var rowIndex = $from.index(rowDepth - 1) + dir,
        table = $from.node(rowDepth - 1);
    if (rowIndex < 0 || rowIndex >= table.childCount) return false;
    var cellStart = dir > 0 ? $from.after(rowDepth) + 2 : $from.before(rowDepth) - 2 - table.child(rowIndex).lastChild.content.size;
    var _$cellStart = pm.doc.resolve(cellStart),
        _sel = Selection.findFrom(_$cellStart, 1);
    if (!_sel || _sel.from >= _$cellStart.end()) return false;
    if (apply !== false) pm.setSelection(_sel);
    return true;
  }
}

// :: (ProseMirror, ?bool) → bool
// Move to the next cell in the current table, if there is one.
function selectNextCell(pm, apply) {
  return moveCell(pm, 1, apply);
}
exports.selectNextCell = selectNextCell;

// :: (ProseMirror, ?bool) → bool
// Move to the previous cell in the current table, if there is one.
function selectPreviousCell(pm, apply) {
  return moveCell(pm, -1, apply);
}
exports.selectPreviousCell = selectPreviousCell;
},{"../edit":10,"../model":37,"../transform":46,"../util/obj":63}],46:[function(require,module,exports){
"use strict";

;
var _require = require("./transform");

exports.Transform = _require.Transform;
exports.TransformError = _require.TransformError;

var _require2 = require("./step");

exports.Step = _require2.Step;
exports.StepResult = _require2.StepResult;

var _require3 = require("./structure");

exports.joinPoint = _require3.joinPoint;
exports.joinable = _require3.joinable;
exports.canSplit = _require3.canSplit;
exports.insertPoint = _require3.insertPoint;
exports.liftTarget = _require3.liftTarget;
exports.findWrapping = _require3.findWrapping;

var _require4 = require("./map");

exports.PosMap = _require4.PosMap;
exports.MapResult = _require4.MapResult;
exports.Remapping = _require4.Remapping;
exports.mapThrough = _require4.mapThrough;
exports.mapThroughResult = _require4.mapThroughResult;

var _require5 = require("./mark_step");

exports.AddMarkStep = _require5.AddMarkStep;
exports.RemoveMarkStep = _require5.RemoveMarkStep;

var _require6 = require("./replace_step");

exports.ReplaceStep = _require6.ReplaceStep;
exports.ReplaceAroundStep = _require6.ReplaceAroundStep;

require("./mark");
require("./replace");

// !! This module defines a way to transform documents. Transforming
// happens in `Step`s, which are atomic, well-defined modifications to
// a document. [Applying](`Step.apply`) a step produces a new
// document.
//
// Each step provides a [position map](#PosMap) that maps positions in
// the old document to position in the new document. Steps can be
// [inverted](#Step.invert) to create a step that undoes their effect,
// and chained together in a convenience object called a `Transform`.
//
// This module does not depend on the browser API being available
// (i.e. you can load it into any JavaScript environment).
//
// You can read more about transformations in [this
// guide](guide/transform.md).
},{"./map":47,"./mark":48,"./mark_step":49,"./replace":50,"./replace_step":51,"./step":52,"./structure":53,"./transform":54}],47:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// ;; #path=Mappable #kind=interface
// There are various things that positions can be mapped through.
// We'll denote those as 'mappable'. This is not an actual class in
// the codebase, only an agreed-on interface.

// :: (pos: number, bias: ?number) → number #path=Mappable.map
// Map a position through this object. When given, `bias` (should be
// -1 or 1) determines in which direction to move when a chunk of
// content is inserted at or around the mapped position.

// :: (pos: number, bias: ?number) → MapResult #path=Mappable.mapResult
// Map a position, and return an object containing additional
// information about the mapping. The result's `deleted` field tells
// you whether the position was deleted (completely enclosed in a
// replaced range) during the mapping.

// Recovery values encode a range index and an offset. They are
// represented as numbers, because tons of them will be created when
// mapping, for example, a large number of marked ranges. The number's
// lower 16 bits provide the index, the remaining bits the offset.
//
// Note: We intentionally don't use bit shift operators to en- and
// decode these, since those clip to 32 bits, which we might in rare
// cases want to overflow. A 64-bit float can represent 48-bit
// integers precisely.

var lower16 = 0xffff;
var factor16 = Math.pow(2, 16);

function makeRecover(index, offset) {
  return index + offset * factor16;
}
function recoverIndex(value) {
  return value & lower16;
}
function recoverOffset(value) {
  return (value - (value & lower16)) / factor16;
}

// ;; An object representing a mapped position with some extra
// information.

var MapResult = function MapResult(pos) {
  var deleted = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];
  var recover = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];

  _classCallCheck(this, MapResult);

  // :: number The mapped version of the position.
  this.pos = pos;
  // :: bool Tells you whether the position was deleted, that is,
  // whether the step removed its surroundings from the document.
  this.deleted = deleted;
  this.recover = recover;
};

exports.MapResult = MapResult;

// ;; A position map, holding information about the way positions in
// the pre-step version of a document correspond to positions in the
// post-step version. This class implements `Mappable`.

var PosMap = function () {
  // :: ([number])
  // Create a position map. The modifications to the document are
  // represented as an array of numbers, in which each group of three
  // represents a modified chunk as `[start, oldSize, newSize]`.

  function PosMap(ranges) {
    var inverted = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];

    _classCallCheck(this, PosMap);

    this.ranges = ranges;
    this.inverted = inverted;
  }

  _createClass(PosMap, [{
    key: "recover",
    value: function recover(value) {
      var diff = 0,
          index = recoverIndex(value);
      if (!this.inverted) for (var i = 0; i < index; i++) {
        diff += this.ranges[i * 3 + 2] - this.ranges[i * 3 + 1];
      }return this.ranges[index * 3] + diff + recoverOffset(value);
    }

    // :: (number, ?number) → MapResult
    // Map the given position through this map. The `bias` parameter can
    // be used to control what happens when the transform inserted
    // content at (or around) this position—if `bias` is negative, the a
    // position before the inserted content will be returned, if it is
    // positive, a position after the insertion is returned.

  }, {
    key: "mapResult",
    value: function mapResult(pos, bias) {
      return this._map(pos, bias, false);
    }

    // :: (number, ?number) → number
    // Map the given position through this map, returning only the
    // mapped position.

  }, {
    key: "map",
    value: function map(pos, bias) {
      return this._map(pos, bias, true);
    }
  }, {
    key: "_map",
    value: function _map(pos, bias, simple) {
      var diff = 0,
          oldIndex = this.inverted ? 2 : 1,
          newIndex = this.inverted ? 1 : 2;
      for (var i = 0; i < this.ranges.length; i += 3) {
        var start = this.ranges[i] - (this.inverted ? diff : 0);
        if (start > pos) break;
        var oldSize = this.ranges[i + oldIndex],
            newSize = this.ranges[i + newIndex],
            end = start + oldSize;
        if (pos <= end) {
          var side = !oldSize ? bias : pos == start ? -1 : pos == end ? 1 : bias;
          var result = start + diff + (side < 0 ? 0 : newSize);
          if (simple) return result;
          var recover = makeRecover(i / 3, pos - start);
          return new MapResult(result, pos != start && pos != end, recover);
        }
        diff += newSize - oldSize;
      }
      return simple ? pos + diff : new MapResult(pos + diff);
    }
  }, {
    key: "touches",
    value: function touches(pos, recover) {
      var diff = 0,
          index = recoverIndex(recover);
      var oldIndex = this.inverted ? 2 : 1,
          newIndex = this.inverted ? 1 : 2;
      for (var i = 0; i < this.ranges.length; i += 3) {
        var start = this.ranges[i] - (this.inverted ? diff : 0);
        if (start > pos) break;
        var oldSize = this.ranges[i + oldIndex],
            end = start + oldSize;
        if (pos <= end && i == index * 3) return true;
        diff += this.ranges[i + newIndex] - oldSize;
      }
      return false;
    }

    // :: ((oldStart: number, oldEnd: number, newStart: number, newEnd: number))
    // Calls the given function on each of the changed ranges denoted by
    // this map.

  }, {
    key: "forEach",
    value: function forEach(f) {
      var oldIndex = this.inverted ? 2 : 1,
          newIndex = this.inverted ? 1 : 2;
      for (var i = 0, diff = 0; i < this.ranges.length; i += 3) {
        var start = this.ranges[i],
            oldStart = start - (this.inverted ? diff : 0),
            newStart = start + (this.inverted ? 0 : diff);
        var oldSize = this.ranges[i + oldIndex],
            newSize = this.ranges[i + newIndex];
        f(oldStart, oldStart + oldSize, newStart, newStart + newSize);
        diff += newSize - oldSize;
      }
    }

    // :: () → PosMap
    // Create an inverted version of this map. The result can be used to
    // map positions in the post-step document to the pre-step document.

  }, {
    key: "invert",
    value: function invert() {
      return new PosMap(this.ranges, !this.inverted);
    }
  }, {
    key: "toString",
    value: function toString() {
      return (this.inverted ? "-" : "") + JSON.stringify(this.ranges);
    }
  }]);

  return PosMap;
}();

exports.PosMap = PosMap;

PosMap.empty = new PosMap([]);

// ;; A remapping represents a pipeline of zero or more mappings. It
// is a specialized data structured used to manage mapping through a
// series of steps, typically including inverted and non-inverted
// versions of the same step. (This comes up when ‘rebasing’ steps for
// collaboration or history management.) This class implements
// `Mappable`.

var Remapping = function () {
  // :: (?[PosMap], ?[PosMap])

  function Remapping() {
    var head = arguments.length <= 0 || arguments[0] === undefined ? [] : arguments[0];
    var tail = arguments.length <= 1 || arguments[1] === undefined ? [] : arguments[1];

    _classCallCheck(this, Remapping);

    // :: [PosMap]
    // The maps in the head of the mapping are applied to input
    // positions first, back-to-front. So the map at the end of this
    // array (if any) is the very first one applied.
    this.head = head;
    // :: [PosMap]
    // The maps in the tail are applied last, front-to-back.
    this.tail = tail;
    this.mirror = Object.create(null);
  }

  // :: (PosMap, ?number) → number
  // Add a map to the mapping's front. If this map is the mirror image
  // (produced by an inverted step) of another map in this mapping,
  // that map's id (as returned by this method or
  // [`addToBack`](#Remapping.addToBack)) should be passed as a second
  // parameter to register the correspondence.


  _createClass(Remapping, [{
    key: "addToFront",
    value: function addToFront(map, corr) {
      this.head.push(map);
      var id = -this.head.length;
      if (corr != null) this.mirror[id] = corr;
      return id;
    }

    // :: (PosMap, ?number) → number
    // Add a map to the mapping's back. If the map is the mirror image
    // of another mapping in this object, the id of that map should be
    // passed to register the correspondence.

  }, {
    key: "addToBack",
    value: function addToBack(map, corr) {
      this.tail.push(map);
      var id = this.tail.length - 1;
      if (corr != null) this.mirror[corr] = id;
      return id;
    }
  }, {
    key: "get",
    value: function get(id) {
      return id < 0 ? this.head[-id - 1] : this.tail[id];
    }

    // :: (number, ?number) → MapResult
    // Map a position through this remapping, returning a mapping
    // result.

  }, {
    key: "mapResult",
    value: function mapResult(pos, bias) {
      return this._map(pos, bias, false);
    }

    // :: (number, ?number) → number
    // Map a position through this remapping.

  }, {
    key: "map",
    value: function map(pos, bias) {
      return this._map(pos, bias, true);
    }
  }, {
    key: "_map",
    value: function _map(pos, bias, simple) {
      var deleted = false,
          recoverables = null;

      for (var i = -this.head.length; i < this.tail.length; i++) {
        var map = this.get(i),
            rec = void 0;

        if ((rec = recoverables && recoverables[i]) != null && map.touches(pos, rec)) {
          pos = map.recover(rec);
          continue;
        }

        var result = map.mapResult(pos, bias);
        if (result.recover != null) {
          var corr = this.mirror[i];
          if (corr != null) {
            if (result.deleted) {
              i = corr;
              pos = this.get(corr).recover(result.recover);
              continue;
            } else {
              ;(recoverables || (recoverables = Object.create(null)))[corr] = result.recover;
            }
          }
        }

        if (result.deleted) deleted = true;
        pos = result.pos;
      }

      return simple ? pos : new MapResult(pos, deleted);
    }
  }, {
    key: "toString",
    value: function toString() {
      var maps = [];
      for (var i = -this.head.length; i < this.tail.length; i++) {
        maps.push(i + ":" + this.get(i) + (this.mirror[i] != null ? "->" + this.mirror[i] : ""));
      }return maps.join("\n");
    }
  }]);

  return Remapping;
}();

exports.Remapping = Remapping;

// :: ([Mappable], number, ?number, ?number) → number
// Map the given position through an array of mappables. When `start`
// is given, the mapping is started at that array position.
function mapThrough(mappables, pos, bias, start) {
  for (var i = start || 0; i < mappables.length; i++) {
    pos = mappables[i].map(pos, bias);
  }return pos;
}
exports.mapThrough = mapThrough;

// :: ([Mappable], number, ?number, ?number) → MapResult
// Map the given position through an array of mappables, returning a
// `MapResult` object.
function mapThroughResult(mappables, pos, bias, start) {
  var deleted = false;
  for (var i = start || 0; i < mappables.length; i++) {
    var result = mappables[i].mapResult(pos, bias);
    pos = result.pos;
    if (result.deleted) deleted = true;
  }
  return new MapResult(pos, deleted);
}
exports.mapThroughResult = mapThroughResult;
},{}],48:[function(require,module,exports){
"use strict";

var _require = require("../model");

var MarkType = _require.MarkType;
var Slice = _require.Slice;

var _require2 = require("./transform");

var Transform = _require2.Transform;

var _require3 = require("./mark_step");

var AddMarkStep = _require3.AddMarkStep;
var RemoveMarkStep = _require3.RemoveMarkStep;

var _require4 = require("./replace_step");

var ReplaceStep = _require4.ReplaceStep;

// :: (number, number, Mark) → Transform
// Add the given mark to the inline content between `from` and `to`.

Transform.prototype.addMark = function (from, to, mark) {
  var _this = this;

  var removed = [],
      added = [],
      removing = null,
      adding = null;
  this.doc.nodesBetween(from, to, function (node, pos, parent, index) {
    if (!node.isInline) return;
    var marks = node.marks;
    if (mark.isInSet(marks) || !parent.contentMatchAt(index + 1).allowsMark(mark.type)) {
      adding = removing = null;
    } else {
      var start = Math.max(pos, from),
          end = Math.min(pos + node.nodeSize, to);
      var rm = mark.type.isInSet(marks);

      if (!rm) removing = null;else if (removing && removing.mark.eq(rm)) removing.to = end;else removed.push(removing = new RemoveMarkStep(start, end, rm));

      if (adding) adding.to = end;else added.push(adding = new AddMarkStep(start, end, mark));
    }
  });

  removed.forEach(function (s) {
    return _this.step(s);
  });
  added.forEach(function (s) {
    return _this.step(s);
  });
  return this;
};

// :: (number, number, ?union<Mark, MarkType>) → Transform
// Remove the given mark, or all marks of the given type, from inline
// nodes between `from` and `to`.
Transform.prototype.removeMark = function (from, to) {
  var _this2 = this;

  var mark = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];

  var matched = [],
      step = 0;
  this.doc.nodesBetween(from, to, function (node, pos) {
    if (!node.isInline) return;
    step++;
    var toRemove = null;
    if (mark instanceof MarkType) {
      var found = mark.isInSet(node.marks);
      if (found) toRemove = [found];
    } else if (mark) {
      if (mark.isInSet(node.marks)) toRemove = [mark];
    } else {
      toRemove = node.marks;
    }
    if (toRemove && toRemove.length) {
      var end = Math.min(pos + node.nodeSize, to);
      for (var i = 0; i < toRemove.length; i++) {
        var style = toRemove[i],
            _found = void 0;
        for (var j = 0; j < matched.length; j++) {
          var m = matched[j];
          if (m.step == step - 1 && style.eq(matched[j].style)) _found = m;
        }
        if (_found) {
          _found.to = end;
          _found.step = step;
        } else {
          matched.push({ style: style, from: Math.max(pos, from), to: end, step: step });
        }
      }
    }
  });
  matched.forEach(function (m) {
    return _this2.step(new RemoveMarkStep(m.from, m.to, m.style));
  });
  return this;
};

// :: (number, number) → Transform
// Remove all marks and non-text inline nodes from the given range.
Transform.prototype.clearMarkup = function (from, to) {
  var _this3 = this;

  var delSteps = []; // Must be accumulated and applied in inverse order
  this.doc.nodesBetween(from, to, function (node, pos) {
    if (!node.isInline) return;
    if (!node.type.isText) {
      delSteps.push(new ReplaceStep(pos, pos + node.nodeSize, Slice.empty));
      return;
    }
    for (var i = 0; i < node.marks.length; i++) {
      _this3.step(new RemoveMarkStep(Math.max(pos, from), Math.min(pos + node.nodeSize, to), node.marks[i]));
    }
  });
  for (var i = delSteps.length - 1; i >= 0; i--) {
    this.step(delSteps[i]);
  }return this;
};

Transform.prototype.clearMarkupFor = function (pos, newType, newAttrs) {
  var node = this.doc.nodeAt(pos),
      match = newType.contentExpr.start(newAttrs);
  var delSteps = [];
  for (var i = 0, cur = pos + 1; i < node.childCount; i++) {
    var child = node.child(i),
        end = cur + child.nodeSize;
    var allowed = match.matchType(child.type, child.attrs);
    if (!allowed) {
      delSteps.push(new ReplaceStep(cur, end, Slice.empty));
    } else {
      match = allowed;
      for (var j = 0; j < child.marks.length; j++) {
        if (!match.allowsMark(child.marks[j])) this.step(new RemoveMarkStep(cur, end, child.marks[j]));
      }
    }
    cur = end;
  }
  for (var _i = delSteps.length - 1; _i >= 0; _i--) {
    this.step(delSteps[_i]);
  }return this;
};
},{"../model":37,"./mark_step":49,"./replace_step":51,"./transform":54}],49:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require("../model");

var Fragment = _require.Fragment;
var Slice = _require.Slice;

var _require2 = require("./step");

var Step = _require2.Step;
var StepResult = _require2.StepResult;


function mapFragment(fragment, f, parent) {
  var mapped = [];
  for (var i = 0; i < fragment.childCount; i++) {
    var child = fragment.child(i);
    if (child.content.size) child = child.copy(mapFragment(child.content, f, child));
    if (child.isInline) child = f(child, parent, i);
    mapped.push(child);
  }
  return Fragment.fromArray(mapped);
}

// ;; Add a mark to all inline content between two positions.

var AddMarkStep = function (_Step) {
  _inherits(AddMarkStep, _Step);

  // :: (number, number, Mark)

  function AddMarkStep(from, to, mark) {
    _classCallCheck(this, AddMarkStep);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(AddMarkStep).call(this));

    _this.from = from;
    _this.to = to;
    _this.mark = mark;
    return _this;
  }

  _createClass(AddMarkStep, [{
    key: "apply",
    value: function apply(doc) {
      var _this2 = this;

      var oldSlice = doc.slice(this.from, this.to);
      var slice = new Slice(mapFragment(oldSlice.content, function (node, parent, index) {
        if (!parent.contentMatchAt(index + 1).allowsMark(_this2.mark.type)) return node;
        return node.mark(_this2.mark.addToSet(node.marks));
      }, oldSlice.possibleParent), oldSlice.openLeft, oldSlice.openRight);
      return StepResult.fromReplace(doc, this.from, this.to, slice);
    }
  }, {
    key: "invert",
    value: function invert() {
      return new RemoveMarkStep(this.from, this.to, this.mark);
    }
  }, {
    key: "map",
    value: function map(mapping) {
      var from = mapping.mapResult(this.from, 1),
          to = mapping.mapResult(this.to, -1);
      if (from.deleted && to.deleted || from.pos >= to.pos) return null;
      return new AddMarkStep(from.pos, to.pos, this.mark);
    }
  }], [{
    key: "fromJSON",
    value: function fromJSON(schema, json) {
      return new AddMarkStep(json.from, json.to, schema.markFromJSON(json.mark));
    }
  }]);

  return AddMarkStep;
}(Step);

exports.AddMarkStep = AddMarkStep;

Step.jsonID("addMark", AddMarkStep);

// ;; Remove a mark from all inline content between two positions.

var RemoveMarkStep = function (_Step2) {
  _inherits(RemoveMarkStep, _Step2);

  // :: (number, number, Mark)

  function RemoveMarkStep(from, to, mark) {
    _classCallCheck(this, RemoveMarkStep);

    var _this3 = _possibleConstructorReturn(this, Object.getPrototypeOf(RemoveMarkStep).call(this));

    _this3.from = from;
    _this3.to = to;
    _this3.mark = mark;
    return _this3;
  }

  _createClass(RemoveMarkStep, [{
    key: "apply",
    value: function apply(doc) {
      var _this4 = this;

      var oldSlice = doc.slice(this.from, this.to);
      var slice = new Slice(mapFragment(oldSlice.content, function (node) {
        return node.mark(_this4.mark.removeFromSet(node.marks));
      }), oldSlice.openLeft, oldSlice.openRight);
      return StepResult.fromReplace(doc, this.from, this.to, slice);
    }
  }, {
    key: "invert",
    value: function invert() {
      return new AddMarkStep(this.from, this.to, this.mark);
    }
  }, {
    key: "map",
    value: function map(mapping) {
      var from = mapping.mapResult(this.from, 1),
          to = mapping.mapResult(this.to, -1);
      if (from.deleted && to.deleted || from.pos >= to.pos) return null;
      return new RemoveMarkStep(from.pos, to.pos, this.mark);
    }
  }], [{
    key: "fromJSON",
    value: function fromJSON(schema, json) {
      return new RemoveMarkStep(json.from, json.to, schema.markFromJSON(json.mark));
    }
  }]);

  return RemoveMarkStep;
}(Step);

exports.RemoveMarkStep = RemoveMarkStep;

Step.jsonID("removeMark", RemoveMarkStep);
},{"../model":37,"./step":52}],50:[function(require,module,exports){
"use strict";

var _require = require("../model");

var Fragment = _require.Fragment;
var Slice = _require.Slice;

var _require2 = require("./replace_step");

var ReplaceStep = _require2.ReplaceStep;
var ReplaceAroundStep = _require2.ReplaceAroundStep;

var _require3 = require("./transform");

var Transform = _require3.Transform;

// :: (number, number) → Transform
// Delete the content between the given positions.

Transform.prototype.delete = function (from, to) {
  return this.replace(from, to, Slice.empty);
};

// :: (number, ?number, ?Slice) → Transform
// Replace the part of the document between `from` and `to` with the
// part of the `source` between `start` and `end`.
Transform.prototype.replace = function (from) {
  var to = arguments.length <= 1 || arguments[1] === undefined ? from : arguments[1];
  var slice = arguments.length <= 2 || arguments[2] === undefined ? Slice.empty : arguments[2];

  if (from == to && !slice.size) return this;

  var $from = this.doc.resolve(from),
      $to = this.doc.resolve(to);
  var placed = placeSlice($from, slice);

  var fittedLeft = fitLeft($from, placed);
  var fitted = fitRight($from, $to, fittedLeft);
  if (!fitted) return this;
  if (fittedLeft.size != fitted.size && canMoveText($from, $to, fittedLeft)) {
    var d = $to.depth,
        after = $to.after(d);
    while (d > 1 && after == $to.end(--d)) {
      ++after;
    }var fittedAfter = fitRight($from, this.doc.resolve(after), fittedLeft);
    if (fittedAfter) return this.step(new ReplaceAroundStep(from, after, to, $to.end(), fittedAfter, fittedLeft.size));
  }
  return this.step(new ReplaceStep(from, to, fitted));
};

// :: (number, number, union<Fragment, Node, [Node]>) → Transform
// Replace the given range with the given content, which may be a
// fragment, node, or array of nodes.
Transform.prototype.replaceWith = function (from, to, content) {
  return this.replace(from, to, new Slice(Fragment.from(content), 0, 0));
};

// :: (number, union<Fragment, Node, [Node]>) → Transform
// Insert the given content at the given position.
Transform.prototype.insert = function (pos, content) {
  return this.replaceWith(pos, pos, content);
};

// :: (number, string) → Transform
// Insert the given text at `pos`, inheriting the marks of the
// existing content at that position.
Transform.prototype.insertText = function (pos, text) {
  return this.insert(pos, this.doc.type.schema.text(text, this.doc.marksAt(pos)));
};

// :: (number, Node) → Transform
// Insert the given node at `pos`, inheriting the marks of the
// existing content at that position.
Transform.prototype.insertInline = function (pos, node) {
  return this.insert(pos, node.mark(this.doc.marksAt(pos)));
};

function fitLeftInner($from, depth, placed, placedBelow) {
  var content = Fragment.empty,
      openRight = 0,
      placedHere = placed[depth];
  if ($from.depth > depth) {
    var inner = fitLeftInner($from, depth + 1, placed, placedBelow || placedHere);
    openRight = inner.openRight + 1;
    content = Fragment.from($from.node(depth + 1).copy(inner.content));
  }

  if (placedHere) {
    content = content.append(placedHere.content);
    openRight = placedHere.openRight;
  }
  if (placedBelow) {
    content = content.append($from.node(depth).contentMatchAt($from.indexAfter(depth)).fillBefore(Fragment.empty, true));
    openRight = 0;
  }

  return { content: content, openRight: openRight };
}

function fitLeft($from, placed) {
  var _fitLeftInner = fitLeftInner($from, 0, placed, false);

  var content = _fitLeftInner.content;
  var openRight = _fitLeftInner.openRight;

  return new Slice(content, $from.depth, openRight || 0);
}

function fitRightJoin(content, parent, $from, $to, depth, openLeft, openRight) {
  var match = void 0,
      count = content.childCount,
      matchCount = count - (openRight > 0 ? 1 : 0);
  if (openLeft < 0) match = parent.contentMatchAt(matchCount);else if (count == 1 && openRight > 0) match = $from.node(depth).contentMatchAt(openLeft ? $from.index(depth) : $from.indexAfter(depth));else match = $from.node(depth).contentMatchAt($from.indexAfter(depth)).matchFragment(content, count > 0 && openLeft ? 1 : 0, matchCount);

  var toNode = $to.node(depth);
  if (openRight > 0 && depth < $to.depth) {
    // FIXME find a less allocaty approach
    var after = toNode.content.cutByIndex($to.indexAfter(depth)).addToStart(content.lastChild);
    var _joinable = match.fillBefore(after, true);
    // Can't insert content if there's a single node stretched across this gap
    if (_joinable && _joinable.size && openLeft > 0 && count == 1) _joinable = null;

    if (_joinable) {
      var inner = fitRightJoin(content.lastChild.content, content.lastChild, $from, $to, depth + 1, count == 1 ? openLeft - 1 : -1, openRight - 1);
      if (inner) {
        var last = content.lastChild.copy(inner);
        if (_joinable.size) return content.cutByIndex(0, count - 1).append(_joinable).addToEnd(last);else return content.replaceChild(count - 1, last);
      }
    }
  }
  if (openRight > 0) match = match.matchNode(count == 1 && openLeft > 0 ? $from.node(depth + 1) : content.lastChild);

  // If we're here, the next level can't be joined, so we see what
  // happens if we leave it open.
  var toIndex = $to.index(depth);
  if (toIndex == toNode.childCount && !toNode.type.compatibleContent(parent.type)) return null;
  var joinable = match.fillBefore(toNode.content, true, toIndex);
  if (!joinable) return null;

  if (openRight > 0) {
    var closed = fitRightClosed(content.lastChild, openRight - 1, $from, depth + 1, count == 1 ? openLeft - 1 : -1);
    content = content.replaceChild(count - 1, closed);
  }
  content = content.append(joinable);
  if ($to.depth > depth) content = content.addToEnd(fitRightSeparate($to, depth + 1));
  return content;
}

function fitRightClosed(node, openRight, $from, depth, openLeft) {
  var match = void 0,
      content = node.content,
      count = content.childCount;
  if (openLeft >= 0) match = $from.node(depth).contentMatchAt($from.indexAfter(depth)).matchFragment(content, openLeft > 0 ? 1 : 0, count);else match = node.contentMatchAt(count);

  if (openRight > 0) {
    var closed = fitRightClosed(content.lastChild, openRight - 1, $from, depth + 1, count == 1 ? openLeft - 1 : -1);
    content = content.replaceChild(count - 1, closed);
  }

  return node.copy(content.append(match.fillBefore(Fragment.empty, true)));
}

function fitRightSeparate($to, depth) {
  var node = $to.node(depth);
  var fill = node.contentMatchAt(0).fillBefore(node.content, true, $to.index(depth));
  if ($to.depth > depth) fill = fill.addToEnd(fitRightSeparate($to, depth + 1));
  return node.copy(fill);
}

function normalizeSlice(content, openLeft, openRight) {
  while (openLeft > 0 && openRight > 0 && content.childCount == 1) {
    content = content.firstChild.content;
    openLeft--;
    openRight--;
  }
  return new Slice(content, openLeft, openRight);
}

// : (ResolvedPos, ResolvedPos, number, Slice) → Slice
function fitRight($from, $to, slice) {
  var fitted = fitRightJoin(slice.content, $from.node(0), $from, $to, 0, slice.openLeft, slice.openRight);
  // FIXME we might want to be clever about selectively dropping nodes here?
  if (!fitted) return null;
  return normalizeSlice(fitted, slice.openLeft, $to.depth);
}

function canMoveText($from, $to, slice) {
  if (!$to.parent.isTextblock) return false;

  var match = void 0;
  if (!slice.openRight) {
    var parent = $from.node($from.depth - (slice.openLeft - slice.openRight));
    if (!parent.isTextblock) return false;
    match = parent.contentMatchAt(parent.childCount);
    if (slice.size) match = match.matchFragment(slice.content, slice.openLeft ? 1 : 0);
  } else {
    var _parent = nodeRight(slice.content, slice.openRight);
    if (!_parent.isTextblock) return false;
    match = _parent.contentMatchAt(_parent.childCount);
  }
  match = match.matchFragment($to.parent.content, $to.index());
  return match && match.validEnd();
}

// Algorithm for 'placing' the elements of a slice into a gap:
//
// We consider the content of each node that is open to the left to be
// independently placeable. I.e. in <p("foo"), p("bar")>, when the
// paragraph on the left is open, "foo" can be placed (somewhere on
// the left side of the replacement gap) independently from p("bar").
//
// So placeSlice splits up a slice into a number of sub-slices,
// along with information on where they can be placed on the given
// left-side edge. It works by walking the open side of the slice,
// from the inside out, and trying to find a landing spot for each
// element, by simultaneously scanning over the gap side. When no
// place is found for an open node's content, it is left in that node.
//
// If the outer content can't be placed, a set of wrapper nodes is
// made up for it (by rooting it in the document node type using
// findWrapping), and the algorithm continues to iterate over those.
// This is guaranteed to find a fit, since both stacks now start with
// the same node type (doc).

function nodeLeft(content, depth) {
  for (var i = 1; i < depth; i++) {
    content = content.firstChild.content;
  }return content.firstChild;
}

function nodeRight(content, depth) {
  for (var i = 1; i < depth; i++) {
    content = content.lastChild.content;
  }return content.lastChild;
}

function placeSlice($from, slice) {
  var dFrom = $from.depth,
      unplaced = null;
  var placed = [],
      parents = null;

  for (var dSlice = slice.openLeft;; --dSlice) {
    var curType = void 0,
        curAttrs = void 0,
        curFragment = void 0;
    if (dSlice >= 0) {
      if (dSlice > 0) {
        // Inside slice
        ;
        var _nodeLeft = nodeLeft(slice.content, dSlice);

        curType = _nodeLeft.type;
        curAttrs = _nodeLeft.attrs;
        curFragment = _nodeLeft.content;
      } else if (dSlice == 0) {
        // Top of slice
        curFragment = slice.content;
      }
      if (dSlice < slice.openLeft) curFragment = curFragment.cut(curFragment.firstChild.nodeSize);
    } else {
      // Outside slice
      curFragment = Fragment.empty;
      var parent = parents[parents.length + dSlice - 1];
      curType = parent.type;
      curAttrs = parent.attrs;
    }
    if (unplaced) curFragment = curFragment.addToStart(unplaced);

    if (curFragment.size == 0 && dSlice <= 0) break;

    // FIXME cut/remove marks when it helps find a placement
    var found = findPlacement(curFragment, $from, dFrom);
    if (found) {
      if (found.fragment.size > 0) placed[found.depth] = {
        content: found.fill.append(found.fragment),
        openRight: dSlice > 0 ? 0 : slice.openRight - dSlice,
        depth: found.depth
      };
      if (dSlice <= 0) break;
      unplaced = null;
      dFrom = Math.max(0, found.depth - 1);
    } else {
      if (dSlice == 0) {
        var top = $from.node(0);
        parents = top.contentMatchAt($from.index(0)).findWrapping(curFragment.firstChild.type, curFragment.firstChild.attrs);
        if (!parents) break;
        var last = parents[parents.length - 1];
        if (last ? !last.type.contentExpr.matches(last.attrs, curFragment) : !top.canReplace($from.indexAfter(0), $from.depth ? $from.index(0) : $from.indexAfter(0), curFragment)) break;
        parents = [{ type: top.type, attrs: top.attrs }].concat(parents);
        curType = parents[parents.length - 1].type;
        curAttrs = parents[parents.length - 1].type;
      }
      curFragment = curType.contentExpr.start(curAttrs).fillBefore(curFragment, true).append(curFragment);
      unplaced = curType.create(curAttrs, curFragment);
    }
  }

  return placed;
}

function findPlacement(fragment, $from, start) {
  var hasMarks = false;
  for (var i = 0; i < fragment.childCount; i++) {
    if (fragment.child(i).marks.length) hasMarks = true;
  }for (var d = start; d >= 0; d--) {
    var startMatch = $from.node(d).contentMatchAt($from.indexAfter(d));
    var match = startMatch.fillBefore(fragment);
    if (match) return { depth: d, fill: match, fragment: fragment };
    if (hasMarks) {
      var stripped = matchStrippingMarks(startMatch, fragment);
      if (stripped) return { depth: d, fill: Fragment.empty, fragment: stripped };
    }
  }
}

function matchStrippingMarks(match, fragment) {
  var newNodes = [];
  for (var i = 0; i < fragment.childCount; i++) {
    var node = fragment.child(i),
        stripped = node.mark(node.marks.filter(function (m) {
      return match.allowsMark(m.type);
    }));
    match = match.matchNode(stripped);
    if (!match) return null;
    newNodes.push(stripped);
  }
  return Fragment.from(newNodes);
}
},{"../model":37,"./replace_step":51,"./transform":54}],51:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require("../model");

var Slice = _require.Slice;

var _require2 = require("./step");

var Step = _require2.Step;
var StepResult = _require2.StepResult;

var _require3 = require("./map");

var PosMap = _require3.PosMap;

// ;; Replace a part of the document with a slice of new content.

var ReplaceStep = function (_Step) {
  _inherits(ReplaceStep, _Step);

  // :: (number, number, Slice, bool)
  // The given `slice` should fit the 'gap' between `from` and
  // `to`—the depths must line up, and the surrounding nodes must be
  // able to be joined with the open sides of the slice. When
  // `structure` is true, the step will fail if the content between
  // from and to is not just a sequence of closing and then opening
  // tokens (this is to guard against rebased replace steps
  // overwriting something they weren't supposed to).

  function ReplaceStep(from, to, slice, structure) {
    _classCallCheck(this, ReplaceStep);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(ReplaceStep).call(this));

    _this.from = from;
    _this.to = to;
    _this.slice = slice;
    _this.structure = !!structure;
    return _this;
  }

  _createClass(ReplaceStep, [{
    key: "apply",
    value: function apply(doc) {
      if (this.structure && contentBetween(doc, this.from, this.to)) return StepResult.fail("Structure replace would overwrite content");
      return StepResult.fromReplace(doc, this.from, this.to, this.slice);
    }
  }, {
    key: "posMap",
    value: function posMap() {
      return new PosMap([this.from, this.to - this.from, this.slice.size]);
    }
  }, {
    key: "invert",
    value: function invert(doc) {
      return new ReplaceStep(this.from, this.from + this.slice.size, doc.slice(this.from, this.to));
    }
  }, {
    key: "map",
    value: function map(mapping) {
      var from = mapping.mapResult(this.from, 1),
          to = mapping.mapResult(this.to, -1);
      if (from.deleted && to.deleted) return null;
      return new ReplaceStep(from.pos, Math.max(from.pos, to.pos), this.slice);
    }
  }], [{
    key: "fromJSON",
    value: function fromJSON(schema, json) {
      return new ReplaceStep(json.from, json.to, Slice.fromJSON(schema, json.slice));
    }
  }]);

  return ReplaceStep;
}(Step);

exports.ReplaceStep = ReplaceStep;

Step.jsonID("replace", ReplaceStep);

// ;; Replace a part of the document with a slice of content, but
// preserve a range of the replaced content by moving it into the
// slice.

var ReplaceAroundStep = function (_Step2) {
  _inherits(ReplaceAroundStep, _Step2);

  // :: (number, number, number, number, Slice, number, bool)
  // Create a replace-wrap step with the given range and gap. `insert`
  // should be the point in the slice into which the gap should be
  // moved. `structure` has the same meaning as it has in the
  // `ReplaceStep` class.

  function ReplaceAroundStep(from, to, gapFrom, gapTo, slice, insert, structure) {
    _classCallCheck(this, ReplaceAroundStep);

    var _this2 = _possibleConstructorReturn(this, Object.getPrototypeOf(ReplaceAroundStep).call(this));

    _this2.from = from;
    _this2.to = to;
    _this2.gapFrom = gapFrom;
    _this2.gapTo = gapTo;
    _this2.slice = slice;
    _this2.insert = insert;
    _this2.structure = !!structure;
    return _this2;
  }

  _createClass(ReplaceAroundStep, [{
    key: "apply",
    value: function apply(doc) {
      if (this.structure && (contentBetween(doc, this.from, this.gapFrom) || contentBetween(doc, this.gapTo, this.to))) return StepResult.fail("Structure gap-replace would overwrite content");

      var gap = doc.slice(this.gapFrom, this.gapTo);
      if (gap.openLeft || gap.openRight) return StepResult.fail("Gap is not a flat range");
      var inserted = this.slice.insertAt(this.insert, gap.content);
      if (!inserted) return StepResult.fail("Content does not fit in gap");
      return StepResult.fromReplace(doc, this.from, this.to, inserted);
    }
  }, {
    key: "posMap",
    value: function posMap() {
      return new PosMap([this.from, this.gapFrom - this.from, this.insert, this.gapTo, this.to - this.gapTo, this.slice.size - this.insert]);
    }
  }, {
    key: "invert",
    value: function invert(doc) {
      var gap = this.gapTo - this.gapFrom;
      return new ReplaceAroundStep(this.from, this.from + this.slice.size + gap, this.from + this.insert, this.from + this.insert + gap, doc.slice(this.from, this.to).removeBetween(this.gapFrom - this.from, this.gapTo - this.from), this.gapFrom - this.from, this.structure);
    }
  }, {
    key: "map",
    value: function map(mapping) {
      var from = mapping.mapResult(this.from, 1),
          to = mapping.mapResult(this.to, -1);
      var gapFrom = mapping.map(this.gapFrom, -1),
          gapTo = mapping.map(this.gapTo, 1);
      if (from.deleted && to.deleted || gapFrom < from.pos || gapTo > to.pos) return null;
      return new ReplaceAroundStep(from.pos, to.pos, gapFrom, gapTo, this.slice, this.insert, this.structure);
    }
  }], [{
    key: "fromJSON",
    value: function fromJSON(schema, json) {
      return new ReplaceAroundStep(json.from, json.to, json.gapFrom, json.gapTo, Slice.fromJSON(schema, json.slice), json.insert, json.structure);
    }
  }]);

  return ReplaceAroundStep;
}(Step);

exports.ReplaceAroundStep = ReplaceAroundStep;

Step.jsonID("replaceAround", ReplaceAroundStep);

function contentBetween(doc, from, to) {
  var $from = doc.resolve(from),
      dist = to - from,
      depth = $from.depth;
  while (dist > 0 && depth > 0 && $from.indexAfter(depth) == $from.node(depth).childCount) {
    depth--;
    dist--;
  }
  if (dist > 0) {
    var next = $from.node(depth).maybeChild($from.indexAfter(depth));
    while (dist > 0) {
      if (!next || next.type.isLeaf) return true;
      next = next.firstChild;
      dist--;
    }
  }
  return false;
}
},{"../model":37,"./map":47,"./step":52}],52:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require("../model");

var ReplaceError = _require.ReplaceError;

var _require2 = require("./map");

var PosMap = _require2.PosMap;


function mustOverride() {
  throw new Error("Override me");
}

var stepsByID = Object.create(null);

// ;; A step object wraps an atomic operation. It generally applies
// only to the document it was created for, since the positions
// associated with it will only make sense for that document.
//
// New steps are defined by creating classes that extend `Step`,
// overriding the `apply`, `invert`, `map`, `posMap` and `fromJSON`
// methods, and registering your class with a unique
// JSON-serialization identifier using `Step.jsonID`.

var Step = function () {
  function Step() {
    _classCallCheck(this, Step);
  }

  _createClass(Step, [{
    key: "apply",

    // :: (doc: Node) → StepResult
    // Applies this step to the given document, returning a result
    // object that either indicates failure, if the step can not be
    // applied to this document, or indicates success by containing a
    // transformed document.
    value: function apply(_doc) {
      return mustOverride();
    }

    // :: () → PosMap
    // Get the position map that represents the changes made by this
    // step.

  }, {
    key: "posMap",
    value: function posMap() {
      return PosMap.empty;
    }

    // :: (doc: Node) → Step
    // Create an inverted version of this step. Needs the document as it
    // was before the step as input.

  }, {
    key: "invert",
    value: function invert(_doc) {
      return mustOverride();
    }

    // :: (mapping: Mappable) → ?Step
    // Map this step through a mappable thing, returning either a
    // version of that step with its positions adjusted, or `null` if
    // the step was entirely deleted by the mapping.

  }, {
    key: "map",
    value: function map(_mapping) {
      return mustOverride();
    }

    // :: () → Object
    // Create a JSON-serializeable representation of this step. By
    // default, it'll create an object with the step's [JSON
    // id](#Step.jsonID), and each of the steps's own properties,
    // automatically calling `toJSON` on the property values that have
    // such a method.

  }, {
    key: "toJSON",
    value: function toJSON() {
      var obj = { stepType: this.jsonID };
      for (var prop in this) {
        if (this.hasOwnProperty(prop)) {
          var val = this[prop];
          obj[prop] = val && val.toJSON ? val.toJSON() : val;
        }
      }return obj;
    }

    // :: (Schema, Object) → Step
    // Deserialize a step from its JSON representation. Will call
    // through to the step class' own implementation of this method.

  }], [{
    key: "fromJSON",
    value: function fromJSON(schema, json) {
      return stepsByID[json.stepType].fromJSON(schema, json);
    }

    // :: (string, constructor<Step>)
    // To be able to serialize steps to JSON, each step needs a string
    // ID to attach to its JSON representation. Use this method to
    // register an ID for your step classes. Try to pick something
    // that's unlikely to clash with steps from other modules.

  }, {
    key: "jsonID",
    value: function jsonID(id, stepClass) {
      if (id in stepsByID) throw new RangeError("Duplicate use of step JSON ID " + id);
      stepsByID[id] = stepClass;
      stepClass.prototype.jsonID = id;
      return stepClass;
    }
  }]);

  return Step;
}();

exports.Step = Step;

// ;; The result of [applying](#Step.apply) a step. Contains either a
// new document or a failure value.

var StepResult = function () {
  // : (?Node, ?string)

  function StepResult(doc, failed) {
    _classCallCheck(this, StepResult);

    // :: ?Node The transformed document.
    this.doc = doc;
    // :: ?string Text providing information about a failed step.
    this.failed = failed;
  }

  // :: (Node) → StepResult
  // Create a successful step result.


  _createClass(StepResult, null, [{
    key: "ok",
    value: function ok(doc) {
      return new StepResult(doc, null);
    }

    // :: (string) → StepResult
    // Create a failed step result.

  }, {
    key: "fail",
    value: function fail(message) {
      return new StepResult(null, message);
    }

    // :: (Node, number, number, Slice) → StepResult
    // Call `Node.replace` with the given arguments. Create a successful
    // result if it succeeds, and a failed one if it throws a
    // `ReplaceError`.

  }, {
    key: "fromReplace",
    value: function fromReplace(doc, from, to, slice) {
      try {
        return StepResult.ok(doc.replace(from, to, slice));
      } catch (e) {
        if (e instanceof ReplaceError) return StepResult.fail(e.message);
        throw e;
      }
    }
  }]);

  return StepResult;
}();

exports.StepResult = StepResult;
},{"../model":37,"./map":47}],53:[function(require,module,exports){
"use strict";

var _require = require("../model");

var Slice = _require.Slice;
var Fragment = _require.Fragment;

var _require2 = require("./transform");

var Transform = _require2.Transform;

var _require3 = require("./replace_step");

var ReplaceStep = _require3.ReplaceStep;
var ReplaceAroundStep = _require3.ReplaceAroundStep;


function canCut(node, start, end) {
  return (start == 0 || node.canReplace(start, node.childCount)) && (end == node.childCount || node.canReplace(0, end));
}

// :: (NodeRange) → ?number
// Try to find a target depth to which the content in the given range
// can be lifted.
function liftTarget(range) {
  var parent = range.parent;
  var content = parent.content.cutByIndex(range.startIndex, range.endIndex);
  for (var depth = range.depth;; --depth) {
    var node = range.$from.node(depth),
        index = range.$from.index(depth),
        endIndex = range.$to.indexAfter(depth);
    if (depth < range.depth && node.canReplace(index, endIndex, content)) return depth;
    if (depth == 0 || !canCut(node, index, endIndex)) break;
  }
}
exports.liftTarget = liftTarget;

// :: (NodeRange, number) → Transform
// Split the content in the given range off from its parent, if there
// is subling content before or after it, and move it up the tree to
// the depth specified by `target`. You'll probably want to use
// `liftTarget` to compute `target`, in order to be sure the lift is
// valid.
Transform.prototype.lift = function (range, target) {
  var $from = range.$from;
  var $to = range.$to;
  var depth = range.depth;


  var gapStart = $from.before(depth + 1),
      gapEnd = $to.after(depth + 1);
  var start = gapStart,
      end = gapEnd;

  var before = Fragment.empty,
      openLeft = 0;
  for (var d = depth, splitting = false; d > target; d--) {
    if (splitting || $from.index(d) > 0) {
      splitting = true;
      before = Fragment.from($from.node(d).copy(before));
      openLeft++;
    } else {
      start--;
    }
  }var after = Fragment.empty,
      openRight = 0;
  for (var _d = depth, _splitting = false; _d > target; _d--) {
    if (_splitting || $to.after(_d + 1) < $to.end(_d)) {
      _splitting = true;
      after = Fragment.from($to.node(_d).copy(after));
      openRight++;
    } else {
      end++;
    }
  }return this.step(new ReplaceAroundStep(start, end, gapStart, gapEnd, new Slice(before.append(after), openLeft, openRight), before.size - openLeft, true));
};

// :: (NodeRange, NodeType, ?Object) → ?[{type: NodeType, attrs: ?Object}]
// Try to find a valid way to wrap the content in the given range in a
// node of the given type. May introduce extra nodes around and inside
// the wrapper node, if necessary.
function findWrapping(range, nodeType, attrs) {
  var innerRange = arguments.length <= 3 || arguments[3] === undefined ? range : arguments[3];

  var wrap = { type: nodeType, attrs: attrs };
  var around = findWrappingOutside(range, wrap);
  var inner = around && findWrappingInside(innerRange, wrap);
  if (!inner) return null;
  return around.concat(wrap).concat(inner);
}
exports.findWrapping = findWrapping;

function findWrappingOutside(range, wrap) {
  var parent = range.parent;
  var startIndex = range.startIndex;
  var endIndex = range.endIndex;

  var around = parent.contentMatchAt(startIndex).findWrapping(wrap.type, wrap.attrs);
  if (!around) return null;
  var outer = around.length ? around[0] : wrap;
  if (!parent.canReplaceWith(startIndex, endIndex, outer.type, outer.attrs)) return null;
  return around;
}

function findWrappingInside(range, wrap) {
  var parent = range.parent;
  var startIndex = range.startIndex;
  var endIndex = range.endIndex;

  var inner = parent.child(startIndex);
  var inside = wrap.type.contentExpr.start(wrap.attrs).findWrapping(inner.type, inner.attrs);
  if (!inside) return null;
  var last = inside.length ? inside[inside.length - 1] : wrap;
  var innerMatch = last.type.contentExpr.start(last.attrs);
  for (var i = startIndex; i < endIndex; i++) {
    innerMatch = innerMatch && innerMatch.matchNode(parent.child(i));
  }if (!innerMatch || !innerMatch.validEnd()) return null;
  return inside;
}

// :: (NodeRange, [{type: NodeType, attrs: ?Object}]) → Transform
// Wrap the given [range](#NodeRange) in the given set of wrappers.
// The wrappers are assumed to be valid in this position, and should
// probably be computed with `findWrapping`.
Transform.prototype.wrap = function (range, wrappers) {
  var content = Fragment.empty;
  for (var i = wrappers.length - 1; i >= 0; i--) {
    content = Fragment.from(wrappers[i].type.create(wrappers[i].attrs, content));
  }var start = range.start,
      end = range.end;
  return this.step(new ReplaceAroundStep(start, end, start, end, new Slice(content, 0, 0), wrappers.length, true));
};

// :: (number, ?number, NodeType, ?Object) → Transform
// Set the type of all textblocks (partly) between `from` and `to` to
// the given node type with the given attributes.
Transform.prototype.setBlockType = function (from) {
  var to = arguments.length <= 1 || arguments[1] === undefined ? from : arguments[1];

  var _this = this;

  var type = arguments[2];
  var attrs = arguments[3];

  if (!type.isTextblock) throw new RangeError("Type given to setBlockType should be a textblock");
  var mapFrom = this.steps.length;
  this.doc.nodesBetween(from, to, function (node, pos) {
    if (node.isTextblock && !node.hasMarkup(type, attrs)) {
      // Ensure all markup that isn't allowed in the new node type is cleared
      _this.clearMarkupFor(_this.map(pos, 1, mapFrom), type, attrs);
      var startM = _this.map(pos, 1, mapFrom),
          endM = _this.map(pos + node.nodeSize, 1, mapFrom);
      _this.step(new ReplaceAroundStep(startM, endM, startM + 1, endM - 1, new Slice(Fragment.from(type.create(attrs)), 0, 0), 1, true));
      return false;
    }
  });
  return this;
};

// :: (number, ?NodeType, ?Object) → Transform
// Change the type and attributes of the node after `pos`.
Transform.prototype.setNodeType = function (pos, type, attrs) {
  var node = this.doc.nodeAt(pos);
  if (!node) throw new RangeError("No node at given position");
  if (!type) type = node.type;
  if (node.type.isLeaf) return this.replaceWith(pos, pos + node.nodeSize, type.create(attrs, null, node.marks));

  if (!type.validContent(node.content, attrs)) throw new RangeError("Invalid content for node type " + type.name);

  return this.step(new ReplaceAroundStep(pos, pos + node.nodeSize, pos + 1, pos + node.nodeSize - 1, new Slice(Fragment.from(type.create(attrs)), 0, 0), 1, true));
};

// :: (Node, number, ?NodeType, ?Object) → bool
// Check whether splitting at the given position is allowed.
function canSplit(doc, pos) {
  var depth = arguments.length <= 2 || arguments[2] === undefined ? 1 : arguments[2];
  var typeAfter = arguments[3];
  var attrsAfter = arguments[4];

  var $pos = doc.resolve(pos),
      base = $pos.depth - depth;
  if (base < 0 || !$pos.parent.canReplace($pos.index(), $pos.parent.childCount) || !$pos.parent.canReplace(0, $pos.indexAfter())) return false;
  for (var d = $pos.depth - 1; d > base; d--) {
    var node = $pos.node(d),
        _index = $pos.index(d);
    if (!node.canReplace(0, _index) || !node.canReplaceWith(_index, node.childCount, typeAfter || $pos.node(d + 1).type, typeAfter ? attrsAfter : $pos.node(d + 1).attrs)) return false;
    typeAfter = null;
  }
  var index = $pos.indexAfter(base);
  return $pos.node(base).canReplaceWith(index, index, typeAfter || $pos.node(base + 1).type, typeAfter ? attrsAfter : $pos.node(base + 1).attrs);
}
exports.canSplit = canSplit;

// :: (number, ?number, ?NodeType, ?Object) → Transform
// Split the node at the given position, and optionally, if `depth` is
// greater than one, any number of nodes above that. By default, the part
// split off will inherit the node type of the original node. This can
// be changed by passing `typeAfter` and `attrsAfter`.
Transform.prototype.split = function (pos) {
  var depth = arguments.length <= 1 || arguments[1] === undefined ? 1 : arguments[1];
  var typeAfter = arguments[2];
  var attrsAfter = arguments[3];

  var $pos = this.doc.resolve(pos),
      before = Fragment.empty,
      after = Fragment.empty;
  for (var d = $pos.depth, e = $pos.depth - depth; d > e; d--) {
    before = Fragment.from($pos.node(d).copy(before));
    after = Fragment.from(typeAfter ? typeAfter.create(attrsAfter, after) : $pos.node(d).copy(after));
    typeAfter = null;
  }
  return this.step(new ReplaceStep(pos, pos, new Slice(before.append(after), depth, depth, true)));
};

// :: (Node, number) → bool
// Test whether the blocks before and after a given position can be
// joined.
function joinable(doc, pos) {
  var $pos = doc.resolve(pos),
      index = $pos.index();
  return canJoin($pos.nodeBefore, $pos.nodeAfter) && $pos.parent.canReplace(index, index + 1);
}
exports.joinable = joinable;

function canJoin(a, b) {
  return a && b && !a.isLeaf && a.canAppend(b);
}

// :: (Node, number, ?number) → ?number
// Find an ancestor of the given position that can be joined to the
// block before (or after if `dir` is positive). Returns the joinable
// point, if any.
function joinPoint(doc, pos) {
  var dir = arguments.length <= 2 || arguments[2] === undefined ? -1 : arguments[2];

  var $pos = doc.resolve(pos);
  for (var d = $pos.depth;; d--) {
    var before = void 0,
        after = void 0;
    if (d == $pos.depth) {
      before = $pos.nodeBefore;
      after = $pos.nodeAfter;
    } else if (dir > 0) {
      before = $pos.node(d + 1);
      after = $pos.node(d).maybeChild($pos.index(d) + 1);
    } else {
      before = $pos.node(d).maybeChild($pos.index(d) - 1);
      after = $pos.node(d + 1);
    }
    if (before && !before.isTextblock && canJoin(before, after)) return pos;
    if (d == 0) break;
    pos = dir < 0 ? $pos.before(d) : $pos.after(d);
  }
}
exports.joinPoint = joinPoint;

// :: (number, ?number, ?bool) → Transform
// Join the blocks around the given position. When `silent` is true,
// the method will return without raising an error if the position
// isn't a valid place to join.
Transform.prototype.join = function (pos) {
  var depth = arguments.length <= 1 || arguments[1] === undefined ? 1 : arguments[1];
  var silent = arguments.length <= 2 || arguments[2] === undefined ? false : arguments[2];

  if (silent && (pos < depth || pos + depth > this.doc.content.size)) return this;
  var step = new ReplaceStep(pos - depth, pos + depth, Slice.empty, true);
  if (silent) this.maybeStep(step);else this.step(step);
  return this;
};

// :: (Node, number, NodeType, ?Object) → ?number
// Try to find a point where a node of the given type can be inserted
// near `pos`, by searching up the node hierarchy when `pos` itself
// isn't a valid place but is at the start or end of a node. Return
// null if no position was found.
function insertPoint(doc, pos, nodeType, attrs) {
  var $pos = doc.resolve(pos);
  if ($pos.parent.canReplaceWith($pos.index(), $pos.index(), nodeType, attrs)) return pos;

  if ($pos.parentOffset == 0) for (var d = $pos.depth - 1; d >= 0; d--) {
    var index = $pos.index(d);
    if ($pos.node(d).canReplaceWith(index, index, nodeType, attrs)) return $pos.before(d + 1);
    if (index > 0) return null;
  }
  if ($pos.parentOffset == $pos.parent.content.size) for (var _d2 = $pos.depth - 1; _d2 >= 0; _d2--) {
    var _index2 = $pos.indexAfter(_d2);
    if ($pos.node(_d2).canReplaceWith(_index2, _index2, nodeType, attrs)) return $pos.after(_d2 + 1);
    if (_index2 < $pos.node(_d2).childCount) return null;
  }
}
exports.insertPoint = insertPoint;
},{"../model":37,"./replace_step":51,"./transform":54}],54:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require("../util/error");

var ProseMirrorError = _require.ProseMirrorError;

var _require2 = require("./map");

var mapThrough = _require2.mapThrough;
var mapThroughResult = _require2.mapThroughResult;

var TransformError = function (_ProseMirrorError) {
  _inherits(TransformError, _ProseMirrorError);

  function TransformError() {
    _classCallCheck(this, TransformError);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(TransformError).apply(this, arguments));
  }

  return TransformError;
}(ProseMirrorError);

exports.TransformError = TransformError;

// ;; A change to a document often consists of a series of
// [steps](#Step). This class provides a convenience abstraction to
// build up and track such an array of steps. A `Transform` object
// implements `Mappable`.
//
// The high-level transforming methods return the `Transform` object
// itself, so that they can be chained.

var Transform = function () {
  // :: (Node)
  // Create a transformation that starts with the given document.

  function Transform(doc) {
    _classCallCheck(this, Transform);

    // :: Node
    // The current document (the result of applying the steps in the
    // transform).
    this.doc = doc;
    // :: [Step]
    // The steps in this transform.
    this.steps = [];
    // :: [Node]
    // The documents before each of the steps.
    this.docs = [];
    // :: [PosMap]
    // The position maps for each of the steps in this transform.
    this.maps = [];
  }

  // :: Node The document at the start of the transformation.


  _createClass(Transform, [{
    key: "step",


    // :: (Step) → Transform
    // Apply a new step in this transformation, saving the result.
    // Throws an error when the step fails.
    value: function step(_step) {
      var result = this.maybeStep(_step);
      if (result.failed) throw new TransformError(result.failed);
      return this;
    }

    // :: (Step) → StepResult
    // Try to apply a step in this transformation, ignoring it if it
    // fails. Returns the step result.

  }, {
    key: "maybeStep",
    value: function maybeStep(step) {
      var result = step.apply(this.doc);
      if (!result.failed) {
        this.docs.push(this.doc);
        this.steps.push(step);
        this.maps.push(step.posMap());
        this.doc = result.doc;
      }
      return result;
    }

    // :: (number, ?number) → MapResult
    // Map a position through the whole transformation (all the position
    // maps in [`maps`](#Transform.maps)), and return the result.

  }, {
    key: "mapResult",
    value: function mapResult(pos, bias, start) {
      return mapThroughResult(this.maps, pos, bias, start);
    }

    // :: (number, ?number) → number
    // Map a position through the whole transformation, and return the
    // mapped position.

  }, {
    key: "map",
    value: function map(pos, bias, start) {
      return mapThrough(this.maps, pos, bias, start);
    }
  }, {
    key: "before",
    get: function get() {
      return this.docs.length ? this.docs[0] : this.doc;
    }
  }]);

  return Transform;
}();

exports.Transform = Transform;
},{"../util/error":61,"./map":47}],55:[function(require,module,exports){
"use strict";

var _require = require("../util/obj");

var copyObj = _require.copyObj;


copyObj(require("./prompt"), exports);
exports.Tooltip = require("./tooltip").Tooltip;

// !! This module implements some GUI primitives.
//
// The prompting implementation gets the job done, roughly, but it's
// rather primitive and you'll probably want to replace it in your own
// system (or submit patches to improve this implementation).
},{"../util/obj":63,"./prompt":56,"./tooltip":57}],56:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require("../util/dom");

var elt = _require.elt;
var insertCSS = _require.insertCSS;

// ;; This class represents a dialog that prompts for a set of
// fields.

var FieldPrompt = function () {
  // :: (ProseMirror, string, [Field])
  // Construct a prompt. Note that this does not
  // [open](#FieldPrompt.open) it yet.

  function FieldPrompt(pm, title, fields) {
    var _this = this;

    _classCallCheck(this, FieldPrompt);

    this.pm = pm;
    this.title = title;
    this.fields = fields;
    this.doClose = null;
    this.domFields = [];
    for (var name in fields) {
      this.domFields.push(fields[name].render(pm));
    }var promptTitle = elt("h5", {}, pm.translate(title));
    var submitButton = elt("button", { type: "submit", class: "ProseMirror-prompt-submit" }, "Ok");
    var cancelButton = elt("button", { type: "button", class: "ProseMirror-prompt-cancel" }, "Cancel");
    cancelButton.addEventListener("click", function () {
      return _this.close();
    });
    // :: DOMNode
    // An HTML form wrapping the fields.
    this.form = elt("form", null, promptTitle, this.domFields.map(function (f) {
      return elt("div", null, f);
    }), elt("div", { class: "ProseMirror-prompt-buttons" }, submitButton, " ", cancelButton));
  }

  // :: ()
  // Close the prompt.


  _createClass(FieldPrompt, [{
    key: "close",
    value: function close() {
      if (this.doClose) {
        this.doClose();
        this.doClose = null;
      }
    }

    // :: ()
    // Open the prompt's dialog.

  }, {
    key: "open",
    value: function open(callback) {
      var _this2 = this;

      this.close();
      var prompt = this.prompt();
      var hadFocus = this.pm.hasFocus();
      this.doClose = function () {
        prompt.close();
        if (hadFocus) setTimeout(function () {
          return _this2.pm.focus();
        }, 50);
      };

      var submit = function submit() {
        var params = _this2.values();
        if (params) {
          _this2.close();
          callback(params);
        }
      };

      this.form.addEventListener("submit", function (e) {
        e.preventDefault();
        submit();
      });

      this.form.addEventListener("keydown", function (e) {
        if (e.keyCode == 27) {
          e.preventDefault();
          prompt.close();
        } else if (e.keyCode == 13 && !(e.ctrlKey || e.metaKey || e.shiftKey)) {
          e.preventDefault();
          submit();
        }
      });

      var input = this.form.elements[0];
      if (input) input.focus();
    }

    // :: () → ?[any]
    // Read the values from the form's field. Validate them, and when
    // one isn't valid (either has a validate function that produced an
    // error message, or has no validate function, no value, and no
    // default value), show the problem to the user and return `null`.

  }, {
    key: "values",
    value: function values() {
      var result = Object.create(null),
          i = 0;
      for (var name in this.fields) {
        var field = this.fields[name],
            dom = this.domFields[i++];
        var value = field.read(dom),
            bad = field.validate(value);
        if (bad) {
          this.reportInvalid(dom, this.pm.translate(bad));
          return null;
        }
        result[name] = field.clean(value);
      }
      return result;
    }

    // :: () → {close: ()}
    // Open a prompt with the parameter form in it. The default
    // implementation calls `openPrompt`.

  }, {
    key: "prompt",
    value: function prompt() {
      var _this3 = this;

      return openPrompt(this.pm, this.form, { onClose: function onClose() {
          return _this3.close();
        } });
    }

    // :: (DOMNode, string)
    // Report a field as invalid, showing the given message to the user.

  }, {
    key: "reportInvalid",
    value: function reportInvalid(dom, message) {
      // FIXME this is awful and needs a lot more work
      var parent = dom.parentNode;
      var style = "left: " + (dom.offsetLeft + dom.offsetWidth + 2) + "px; top: " + (dom.offsetTop - 5) + "px";
      var msg = parent.appendChild(elt("div", { class: "ProseMirror-invalid", style: style }, message));
      setTimeout(function () {
        return parent.removeChild(msg);
      }, 1500);
    }
  }]);

  return FieldPrompt;
}();

exports.FieldPrompt = FieldPrompt;

// ;; The type of field that `FieldPrompt` expects to be passed to it.

var Field = function () {
  // :: (Object)
  // Create a field with the given options. Options support by all
  // field types are:
  //
  // **`value`**`: ?any`
  //   : The starting value for the field.
  //
  // **`label`**`: string`
  //   : The label for the field.
  //
  // **`required`**`: ?bool`
  //   : Whether the field is required.
  //
  // **`validate`**`: ?(any) → ?string`
  //   : A function to validate the given value. Should return an
  //     error message if it is not valid.

  function Field(options) {
    _classCallCheck(this, Field);

    this.options = options;
  }

  // :: (pm: ProseMirror) → DOMNode #path=Field.prototype.render
  // Render the field to the DOM. Should be implemented by all subclasses.

  // :: (DOMNode) → any
  // Read the field's value from its DOM node.


  _createClass(Field, [{
    key: "read",
    value: function read(dom) {
      return dom.value;
    }

    // :: (any) → ?string
    // A field-type-specific validation function.

  }, {
    key: "validateType",
    value: function validateType(_value) {}
  }, {
    key: "validate",
    value: function validate(value) {
      if (!value && this.options.required) return "Required field";
      return this.validateType(value) || this.options.validate && this.options.validate(value);
    }
  }, {
    key: "clean",
    value: function clean(value) {
      return this.options.clean ? this.options.clean(value) : value;
    }
  }]);

  return Field;
}();

exports.Field = Field;

// ;; A field class for single-line text fields.

var TextField = function (_Field) {
  _inherits(TextField, _Field);

  function TextField() {
    _classCallCheck(this, TextField);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(TextField).apply(this, arguments));
  }

  _createClass(TextField, [{
    key: "render",
    value: function render(pm) {
      return elt("input", { type: "text",
        placeholder: pm.translate(this.options.label),
        value: this.options.value || "",
        autocomplete: "off" });
    }
  }]);

  return TextField;
}(Field);

exports.TextField = TextField;

// ;; A field class for dropdown fields based on a plain `<select>`
// tag. Expects an option `options`, which should be an array of
// `{value: string, label: string}` objects, or a function taking a
// `ProseMirror` instance and returning such an array.

var SelectField = function (_Field2) {
  _inherits(SelectField, _Field2);

  function SelectField() {
    _classCallCheck(this, SelectField);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(SelectField).apply(this, arguments));
  }

  _createClass(SelectField, [{
    key: "render",
    value: function render(pm) {
      var opts = this.options;
      var options = opts.options.call ? opts.options(pm) : opts.options;
      return elt("select", null, options.map(function (o) {
        return elt("option", { value: o.value, selected: o.value == opts.value ? "true" : null }, pm.translate(o.label));
      }));
    }
  }]);

  return SelectField;
}(Field);

exports.SelectField = SelectField;

// :: (ProseMirror, DOMNode, ?Object) → {close: ()}
// Open a dialog box for the given editor, putting `content` inside of
// it. The `close` method on the return value can be used to
// explicitly close the dialog again. The following options are
// supported:
//
// **`pos`**`: {left: number, top: number}`
//   : Provide an explicit position for the element. By default, it'll
//     be placed in the center of the editor.
//
// **`onClose`**`: fn()`
//   : A function to be called when the dialog is closed.
function openPrompt(pm, content, options) {
  var button = elt("button", { class: "ProseMirror-prompt-close" });
  var wrapper = elt("div", { class: "ProseMirror-prompt" }, content, button);
  var outerBox = pm.wrapper.getBoundingClientRect();

  pm.wrapper.appendChild(wrapper);
  if (options && options.pos) {
    wrapper.style.left = options.pos.left - outerBox.left + "px";
    wrapper.style.top = options.pos.top - outerBox.top + "px";
  } else {
    var blockBox = wrapper.getBoundingClientRect();
    var cX = Math.max(0, outerBox.left) + Math.min(window.innerWidth, outerBox.right) - blockBox.width;
    var cY = Math.max(0, outerBox.top) + Math.min(window.innerHeight, outerBox.bottom) - blockBox.height;
    wrapper.style.left = cX / 2 - outerBox.left + "px";
    wrapper.style.top = cY / 2 - outerBox.top + "px";
  }

  var close = function close() {
    pm.on.interaction.remove(close);
    if (wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper);
      if (options && options.onClose) options.onClose();
    }
  };
  button.addEventListener("click", close);
  pm.on.interaction.add(close);
  return { close: close };
}
exports.openPrompt = openPrompt;

insertCSS("\n.ProseMirror-prompt {\n  background: white;\n  padding: 2px 6px 2px 15px;\n  border: 1px solid silver;\n  position: absolute;\n  border-radius: 3px;\n  z-index: 11;\n}\n\n.ProseMirror-prompt h5 {\n  margin: 0;\n  font-weight: normal;\n  font-size: 100%;\n  color: #444;\n}\n\n.ProseMirror-prompt input[type=\"text\"],\n.ProseMirror-prompt textarea {\n  background: #eee;\n  border: none;\n  outline: none;\n}\n\n.ProseMirror-prompt input[type=\"text\"] {\n  padding: 0 4px;\n}\n\n.ProseMirror-prompt-close {\n  position: absolute;\n  left: 2px; top: 1px;\n  color: #666;\n  border: none; background: transparent; padding: 0;\n}\n\n.ProseMirror-prompt-close:after {\n  content: \"✕\";\n  font-size: 12px;\n}\n\n.ProseMirror-invalid {\n  background: #ffc;\n  border: 1px solid #cc7;\n  border-radius: 4px;\n  padding: 5px 10px;\n  position: absolute;\n  min-width: 10em;\n}\n\n.ProseMirror-prompt-buttons {\n  margin-top: 5px;\n  display: none;\n}\n\n");
},{"../util/dom":60}],57:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require("../util/dom");

var elt = _require.elt;
var insertCSS = _require.insertCSS;


var prefix = "ProseMirror-tooltip";

// ;; Used to show tooltips. An instance of this class is a persistent
// DOM node (to allow position and opacity animation) that can be
// shown and hidden. It is positioned relative to a position (passed
// when showing the tooltip), and points at that position with a
// little arrow-like triangle attached to the node.

var Tooltip = function () {
  // :: (DOMNode, union<string, Object>)
  // Create a new tooltip that lives in the wrapper node, which should
  // be its offset anchor, i.e. it should have a `relative` or
  // `absolute` CSS position. You'll often want to pass an editor's
  // [`wrapper` node](#ProseMirror.wrapper). `options` may be an object
  // containg a `direction` string and a `getBoundingRect` function which
  // should return a rectangle determining the space in which the tooltip
  // may appear. Alternatively, `options` may be a string specifying the
  // direction. The direction can be `"above"`, `"below"`, `"right"`,
  // `"left"`, or `"center"`. In the latter case, the tooltip has no arrow
  // and is positioned centered in its wrapper node.

  function Tooltip(wrapper, options) {
    var _this = this;

    _classCallCheck(this, Tooltip);

    this.wrapper = wrapper;
    this.options = typeof options == "string" ? { direction: options } : options;
    this.dir = this.options.direction || "above";
    this.pointer = wrapper.appendChild(elt("div", { class: prefix + "-pointer-" + this.dir + " " + prefix + "-pointer" }));
    this.pointerWidth = this.pointerHeight = null;
    this.dom = wrapper.appendChild(elt("div", { class: prefix }));
    this.dom.addEventListener("transitionend", function () {
      if (_this.dom.style.opacity == "0") _this.dom.style.display = _this.pointer.style.display = "";
    });

    this.isOpen = false;
    this.lastLeft = this.lastTop = null;
  }

  // :: ()
  // Remove the tooltip from the DOM.


  _createClass(Tooltip, [{
    key: "detach",
    value: function detach() {
      this.dom.parentNode.removeChild(this.dom);
      this.pointer.parentNode.removeChild(this.pointer);
    }
  }, {
    key: "getSize",
    value: function getSize(node) {
      var wrap = this.wrapper.appendChild(elt("div", {
        class: prefix,
        style: "display: block; position: absolute"
      }, node));
      var size = { width: wrap.offsetWidth + 1, height: wrap.offsetHeight };
      wrap.parentNode.removeChild(wrap);
      return size;
    }

    // :: (DOMNode, ?{left: number, top: number})
    // Make the tooltip visible, show the given node in it, and position
    // it relative to the given position. If `pos` is not given, the
    // tooltip stays in its previous place. Unless the tooltip's
    // direction is `"center"`, `pos` should definitely be given the
    // first time it is shown.

  }, {
    key: "open",
    value: function open(node, pos) {
      var left = this.lastLeft = pos ? pos.left : this.lastLeft;
      var top = this.lastTop = pos ? pos.top : this.lastTop;

      var size = this.getSize(node);

      var around = this.wrapper.getBoundingClientRect();

      // Use the window as the bounding rectangle if no getBoundingRect
      // function is defined
      var boundingRect = (this.options.getBoundingRect || windowRect)();

      for (var child = this.dom.firstChild, next; child; child = next) {
        next = child.nextSibling;
        if (child != this.pointer) this.dom.removeChild(child);
      }
      this.dom.appendChild(node);

      this.dom.style.display = this.pointer.style.display = "block";

      if (this.pointerWidth == null) {
        this.pointerWidth = this.pointer.offsetWidth - 1;
        this.pointerHeight = this.pointer.offsetHeight - 1;
      }

      this.dom.style.width = size.width + "px";
      this.dom.style.height = size.height + "px";

      var margin = 5;
      if (this.dir == "above" || this.dir == "below") {
        var tipLeft = Math.max(boundingRect.left, Math.min(left - size.width / 2, boundingRect.right - size.width));
        this.dom.style.left = tipLeft - around.left + "px";
        this.pointer.style.left = left - around.left - this.pointerWidth / 2 + "px";
        if (this.dir == "above") {
          var tipTop = top - around.top - margin - this.pointerHeight - size.height;
          this.dom.style.top = tipTop + "px";
          this.pointer.style.top = tipTop + size.height + "px";
        } else {
          // below
          var _tipTop = top - around.top + margin;
          this.pointer.style.top = _tipTop + "px";
          this.dom.style.top = _tipTop + this.pointerHeight + "px";
        }
      } else if (this.dir == "left" || this.dir == "right") {
        this.dom.style.top = top - around.top - size.height / 2 + "px";
        this.pointer.style.top = top - this.pointerHeight / 2 - around.top + "px";
        if (this.dir == "left") {
          var pointerLeft = left - around.left - margin - this.pointerWidth;
          this.dom.style.left = pointerLeft - size.width + "px";
          this.pointer.style.left = pointerLeft + "px";
        } else {
          // right
          var _pointerLeft = left - around.left + margin;
          this.dom.style.left = _pointerLeft + this.pointerWidth + "px";
          this.pointer.style.left = _pointerLeft + "px";
        }
      } else if (this.dir == "center") {
        var _top = Math.max(around.top, boundingRect.top),
            bottom = Math.min(around.bottom, boundingRect.bottom);
        var fromTop = (bottom - _top - size.height) / 2;
        this.dom.style.left = (around.width - size.width) / 2 + "px";
        this.dom.style.top = _top - around.top + fromTop + "px";
      }

      getComputedStyle(this.dom).opacity;
      getComputedStyle(this.pointer).opacity;
      this.dom.style.opacity = this.pointer.style.opacity = 1;
      this.isOpen = true;
    }

    // :: ()
    // Close (hide) the tooltip.

  }, {
    key: "close",
    value: function close() {
      if (this.isOpen) {
        this.isOpen = false;
        this.dom.style.opacity = this.pointer.style.opacity = 0;
      }
    }
  }]);

  return Tooltip;
}();

exports.Tooltip = Tooltip;

function windowRect() {
  return {
    left: 0, right: window.innerWidth,
    top: 0, bottom: window.innerHeight
  };
}

insertCSS("\n\n." + prefix + " {\n  position: absolute;\n  display: none;\n  box-sizing: border-box;\n  -moz-box-sizing: border- box;\n  overflow: hidden;\n\n  -webkit-transition: width 0.4s ease-out, height 0.4s ease-out, left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;\n  -moz-transition: width 0.4s ease-out, height 0.4s ease-out, left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;\n  transition: width 0.4s ease-out, height 0.4s ease-out, left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;\n  opacity: 0;\n\n  border-radius: 5px;\n  padding: 3px 7px;\n  margin: 0;\n  background: white;\n  border: 1px solid #777;\n  color: #555;\n\n  z-index: 11;\n}\n\n." + prefix + "-pointer {\n  position: absolute;\n  display: none;\n  width: 0; height: 0;\n\n  -webkit-transition: left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;\n  -moz-transition: left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;\n  transition: left 0.4s ease-out, top 0.4s ease-out, opacity 0.2s;\n  opacity: 0;\n\n  z-index: 12;\n}\n\n." + prefix + "-pointer:after {\n  content: \"\";\n  position: absolute;\n  display: block;\n}\n\n." + prefix + "-pointer-above {\n  border-left: 6px solid transparent;\n  border-right: 6px solid transparent;\n  border-top: 6px solid #777;\n}\n\n." + prefix + "-pointer-above:after {\n  border-left: 6px solid transparent;\n  border-right: 6px solid transparent;\n  border-top: 6px solid white;\n  left: -6px; top: -7px;\n}\n\n." + prefix + "-pointer-below {\n  border-left: 6px solid transparent;\n  border-right: 6px solid transparent;\n  border-bottom: 6px solid #777;\n}\n\n." + prefix + "-pointer-below:after {\n  border-left: 6px solid transparent;\n  border-right: 6px solid transparent;\n  border-bottom: 6px solid white;\n  left: -6px; top: 1px;\n}\n\n." + prefix + "-pointer-right {\n  border-top: 6px solid transparent;\n  border-bottom: 6px solid transparent;\n  border-right: 6px solid #777;\n}\n\n." + prefix + "-pointer-right:after {\n  border-top: 6px solid transparent;\n  border-bottom: 6px solid transparent;\n  border-right: 6px solid white;\n  left: 1px; top: -6px;\n}\n\n." + prefix + "-pointer-left {\n  border-top: 6px solid transparent;\n  border-bottom: 6px solid transparent;\n  border-left: 6px solid #777;\n}\n\n." + prefix + "-pointer-left:after {\n  border-top: 6px solid transparent;\n  border-bottom: 6px solid transparent;\n  border-left: 6px solid white;\n  left: -7px; top: -6px;\n}\n\n." + prefix + " input[type=\"text\"],\n." + prefix + " textarea {\n  background: #eee;\n  border: none;\n  outline: none;\n}\n\n." + prefix + " input[type=\"text\"] {\n  padding: 0 4px;\n}\n\n");
},{"../util/dom":60}],58:[function(require,module,exports){
"use strict";

var ie_upto10 = /MSIE \d/.test(navigator.userAgent);
var ie_11up = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(navigator.userAgent);

module.exports = {
  mac: /Mac/.test(navigator.platform),
  ie: ie_upto10 || !!ie_11up,
  ie_version: ie_upto10 ? document.documentMode || 6 : ie_11up && +ie_11up[1],
  gecko: /gecko\/\d/i.test(navigator.userAgent),
  ios: /AppleWebKit/.test(navigator.userAgent) && /Mobile\/\w+/.test(navigator.userAgent)
};
},{}],59:[function(require,module,exports){
"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

function compareDeep(a, b) {
  if (a === b) return true;
  if (!(a && (typeof a === "undefined" ? "undefined" : _typeof(a)) == "object") || !(b && (typeof b === "undefined" ? "undefined" : _typeof(b)) == "object")) return false;
  var array = Array.isArray(a);
  if (Array.isArray(b) != array) return false;
  if (array) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (!compareDeep(a[i], b[i])) return false;
    }
  } else {
    for (var p in a) {
      if (!(p in b) || !compareDeep(a[p], b[p])) return false;
    }for (var _p in b) {
      if (!(_p in a)) return false;
    }
  }
  return true;
}
exports.compareDeep = compareDeep;
},{}],60:[function(require,module,exports){
"use strict";

function elt(tag, attrs) {
  var result = document.createElement(tag);
  if (attrs) for (var name in attrs) {
    if (name == "style") result.style.cssText = attrs[name];else if (attrs[name] != null) result.setAttribute(name, attrs[name]);
  }

  for (var _len = arguments.length, args = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
    args[_key - 2] = arguments[_key];
  }

  for (var i = 0; i < args.length; i++) {
    add(args[i], result);
  }return result;
}
exports.elt = elt;

function add(value, target) {
  if (typeof value == "string") value = document.createTextNode(value);

  if (Array.isArray(value)) {
    for (var i = 0; i < value.length; i++) {
      add(value[i], target);
    }
  } else {
    target.appendChild(value);
  }
}

var reqFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
var cancelFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame || window.webkitCancelAnimationFrame || window.msCancelAnimationFrame;

function requestAnimationFrame(f) {
  if (reqFrame) return reqFrame.call(window, f);else return setTimeout(f, 10);
}
exports.requestAnimationFrame = requestAnimationFrame;

function cancelAnimationFrame(handle) {
  if (reqFrame) return cancelFrame.call(window, handle);else clearTimeout(handle);
}
exports.cancelAnimationFrame = cancelAnimationFrame;

// : (DOMNode, DOMNode) → bool
// Check whether a DOM node is an ancestor of another DOM node.
function contains(parent, child) {
  // Android browser and IE will return false if child is a text node.
  if (child.nodeType != 1) child = child.parentNode;
  return child && parent.contains(child);
}
exports.contains = contains;

var accumulatedCSS = "",
    cssNode = null;

function insertCSS(css) {
  if (cssNode) cssNode.textContent += css;else accumulatedCSS += css;
}
exports.insertCSS = insertCSS;

// This is called when a ProseMirror instance is created, to ensure
// the CSS is in the DOM.
function ensureCSSAdded() {
  if (!cssNode) {
    cssNode = document.createElement("style");
    cssNode.textContent = "/* ProseMirror CSS */\n" + accumulatedCSS;
    document.head.insertBefore(cssNode, document.head.firstChild);
  }
}
exports.ensureCSSAdded = ensureCSSAdded;
},{}],61:[function(require,module,exports){
"use strict";

// ;; Superclass for ProseMirror-related errors. Does some magic to
// make it safely subclassable even on ES5 runtimes.
function ProseMirrorError(message) {
  Error.call(this, message);
  if (this.message != message) {
    this.message = message;
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.name);else this.stack = new Error(message).stack;
  }
}
exports.ProseMirrorError = ProseMirrorError;

ProseMirrorError.prototype = Object.create(Error.prototype);

ProseMirrorError.prototype.constructor = ProseMirrorError;

Object.defineProperty(ProseMirrorError.prototype, "name", {
  get: function get() {
    return this.constructor.name || functionName(this.constructor) || "ProseMirrorError";
  }
});

function functionName(f) {
  var match = /^function (\w+)/.exec(f.toString());
  return match && match[1];
}
},{}],62:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Map = window.Map || function () {
  function _class() {
    _classCallCheck(this, _class);

    this.content = [];
  }

  _createClass(_class, [{
    key: "set",
    value: function set(key, value) {
      var found = this.find(key);
      if (found > -1) this.content[found + 1] = value;else this.content.push(key, value);
    }
  }, {
    key: "get",
    value: function get(key) {
      var found = this.find(key);
      return found == -1 ? undefined : this.content[found + 1];
    }
  }, {
    key: "has",
    value: function has(key) {
      return this.find(key) > -1;
    }
  }, {
    key: "find",
    value: function find(key) {
      for (var i = 0; i < this.content.length; i += 2) {
        if (this.content[i] === key) return i;
      }
    }
  }, {
    key: "clear",
    value: function clear() {
      this.content.length = 0;
    }
  }, {
    key: "size",
    get: function get() {
      return this.content.length / 2;
    }
  }]);

  return _class;
}();
exports.Map = Map;
},{}],63:[function(require,module,exports){
"use strict";

function copyObj(obj, base) {
  var copy = base || Object.create(null);
  for (var prop in obj) {
    copy[prop] = obj[prop];
  }return copy;
}
exports.copyObj = copyObj;
},{}],64:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// ;; Persistent data structure representing an ordered mapping from
// strings to values, with some convenient update methods.

var OrderedMap = function () {
  function OrderedMap(content) {
    _classCallCheck(this, OrderedMap);

    this.content = content;
  }

  _createClass(OrderedMap, [{
    key: "find",
    value: function find(key) {
      for (var i = 0; i < this.content.length; i += 2) {
        if (this.content[i] == key) return i;
      }return -1;
    }

    // :: (string) → ?any
    // Retrieve the value stored under `key`, or return undefined when
    // no such key exists.

  }, {
    key: "get",
    value: function get(key) {
      var found = this.find(key);
      return found == -1 ? undefined : this.content[found + 1];
    }

    // :: (string, any, ?string) → OrderedMap
    // Create a new map by replacing the value of `key` with a new
    // value, or adding a binding to the end of the map. If `newKey` is
    // given, the key of the binding will be replaced with that key.

  }, {
    key: "update",
    value: function update(key, value, newKey) {
      var self = newKey && newKey != key ? this.remove(newKey) : this;
      var found = self.find(key),
          content = self.content.slice();
      if (found == -1) {
        content.push(newKey || key, value);
      } else {
        content[found + 1] = value;
        if (newKey) content[found] = newKey;
      }
      return new OrderedMap(content);
    }

    // :: (string) → OrderedMap
    // Return a map with the given key removed, if it existed.

  }, {
    key: "remove",
    value: function remove(key) {
      var found = this.find(key);
      if (found == -1) return this;
      var content = this.content.slice();
      content.splice(found, 2);
      return new OrderedMap(content);
    }

    // :: (string, any) → OrderedMap
    // Add a new key to the start of the map.

  }, {
    key: "addToStart",
    value: function addToStart(key, value) {
      return new OrderedMap([key, value].concat(this.remove(key).content));
    }

    // :: (string, any) → OrderedMap
    // Add a new key to the end of the map.

  }, {
    key: "addToEnd",
    value: function addToEnd(key, value) {
      var content = this.remove(key).content.slice();
      content.push(key, value);
      return new OrderedMap(content);
    }

    // :: (string, string, any) → OrderedMap
    // Add a key after the given key. If `place` is not found, the new
    // key is added to the end.

  }, {
    key: "addBefore",
    value: function addBefore(place, key, value) {
      var without = this.remove(key),
          content = without.content.slice();
      var found = without.find(place);
      content.splice(found == -1 ? content.length : found, 0, key, value);
      return new OrderedMap(content);
    }

    // :: ((key: string, value: any))
    // Call the given function for each key/value pair in the map, in
    // order.

  }, {
    key: "forEach",
    value: function forEach(f) {
      for (var i = 0; i < this.content.length; i += 2) {
        f(this.content[i], this.content[i + 1]);
      }
    }

    // :: (union<Object, OrderedMap>) → OrderedMap
    // Create a new map by prepending the keys in this map that don't
    // appear in `map` before the keys in `map`.

  }, {
    key: "prepend",
    value: function prepend(map) {
      map = OrderedMap.from(map);
      if (!map.size) return this;
      return new OrderedMap(map.content.concat(this.subtract(map).content));
    }

    // :: (union<Object, OrderedMap>) → OrderedMap
    // Create a new map by appending the keys in this map that don't
    // appear in `map` after the keys in `map`.

  }, {
    key: "append",
    value: function append(map) {
      map = OrderedMap.from(map);
      if (!map.size) return this;
      return new OrderedMap(this.subtract(map).content.concat(map.content));
    }

    // :: (union<Object, OrderedMap>) → OrderedMap
    // Create a map containing all the keys in this map that don't
    // appear in `map`.

  }, {
    key: "subtract",
    value: function subtract(map) {
      var result = this;
      OrderedMap.from(map).forEach(function (key) {
        return result = result.remove(key);
      });
      return result;
    }

    // :: number
    // The amount of keys in this map.

  }, {
    key: "size",
    get: function get() {
      return this.content.length >> 1;
    }

    // :: (?union<Object, OrderedMap>) → OrderedMap
    // Return a map with the given content. If null, create an empty
    // map. If given an ordered map, return that map itself. If given an
    // object, create a map from the object's properties.

  }], [{
    key: "from",
    value: function from(value) {
      if (value instanceof OrderedMap) return value;
      var content = [];
      if (value) for (var prop in value) {
        content.push(prop, value[prop]);
      }return new OrderedMap(content);
    }
  }]);

  return OrderedMap;
}();

exports.OrderedMap = OrderedMap;
},{}],65:[function(require,module,exports){
function Handler(f, once, priority) {
  this.f = f
  this.once = once
  this.priority = priority
}

function Subscription() {
  this.handlers = []
}
exports.Subscription = Subscription

function insert(s, handler) {
  var pos = 0
  for (; pos < s.handlers.length; pos++)
    if (s.handlers[pos].priority < handler.priority) break
  s.handlers = s.handlers.slice(0, pos).concat(handler).concat(s.handlers.slice(pos))
}

Subscription.prototype.handlersForDispatch = function() {
  var handlers = this.handlers, updated = null
  for (var i = handlers.length - 1; i >= 0; i--) if (handlers[i].once) {
    if (!updated) updated = handlers.slice()
    updated.splice(i, 1)
  }
  if (updated) this.handlers = updated
  return handlers
}

Subscription.prototype.add = function(f, priority) {
  insert(this, new Handler(f, false, priority || 0))
}

Subscription.prototype.addOnce = function(f, priority) {
  insert(this, new Handler(f, true, priority || 0))
}

Subscription.prototype.remove = function(f) {
  for (var i = 0; i < this.handlers.length; i++) if (this.handlers[i].f == f) {
    this.handlers = this.handlers.slice(0, i).concat(this.handlers.slice(i + 1))
    return
  }
}

Subscription.prototype.hasHandler = function() {
  return this.handlers.length > 0
}

Subscription.prototype.dispatch = function() {
  var handlers = this.handlersForDispatch()
  for (var i = 0; i < handlers.length; i++)
    handlers[i].f.apply(null, arguments)
}

function PipelineSubscription() {
  Subscription.call(this)
}
exports.PipelineSubscription = PipelineSubscription

PipelineSubscription.prototype = new Subscription

PipelineSubscription.prototype.dispatch = function(value) {
  var handlers = this.handlersForDispatch()
  for (var i = 0; i < handlers.length; i++)
    value = handlers[i].f(value)
  return value
}

function StoppableSubscription() {
  Subscription.call(this)
}
exports.StoppableSubscription = StoppableSubscription

StoppableSubscription.prototype = new Subscription

StoppableSubscription.prototype.dispatch = function() {
  var handlers = this.handlersForDispatch()
  for (var i = 0; i < handlers.length; i++) {
    var result = handlers[i].f.apply(null, arguments)
    if (result) return result
  }
}

function DOMSubscription() {
  Subscription.call(this)
}
exports.DOMSubscription = DOMSubscription

DOMSubscription.prototype = new Subscription

DOMSubscription.prototype.dispatch = function(event) {
  var handlers = this.handlersForDispatch()
  for (var i = 0; i < handlers.length; i++)
    if (handlers[i].f(event) || event.defaultPrevented) return true
  return false
}

},{}],66:[function(require,module,exports){
"use strict";

var _require = require("prosemirror/dist/edit");

var ProseMirror = _require.ProseMirror;

var _require2 = require("prosemirror/dist/schema-basic");

var schema = _require2.schema;

var _require3 = require("prosemirror/dist/example-setup");

var exampleSetup = _require3.exampleSetup;
var buildMenuItems = _require3.buildMenuItems;

var _require4 = require("prosemirror/dist/menu");

var tooltipMenu = _require4.tooltipMenu;
var menuBar = _require4.menuBar;


var place = document.querySelector("#page-about");
var content = document.querySelector("#content");

var pm = window.pm = new ProseMirror({
  place: place,
  doc: schema.parseDOM(content),
  plugins: [exampleSetup.config({ menuBar: false, tooltipMenu: false })]
});
content.style.display = "none";

var menu = buildMenuItems(schema);

setMenuStyle(place.getAttribute("menustyle") || "bar");

function setMenuStyle(type) {
  if (type == "bar") {
    tooltipMenu.detach(pm);
    menuBar.config({ float: true, content: menu.fullMenu }).attach(pm);
  } else {
    menuBar.detach(pm);
    tooltipMenu.config({ selectedBlockMenu: true,
      inlineContent: menu.inlineMenu,
      blockContent: menu.blockMenu }).attach(pm);
  }
}

var menuStyle = document.querySelector("#menustyle");
if (menuStyle) menuStyle.addEventListener("change", function () {
  return setMenuStyle(menuStyle.value);
});

},{"prosemirror/dist/edit":10,"prosemirror/dist/example-setup":20,"prosemirror/dist/menu":29,"prosemirror/dist/schema-basic":44}]},{},[66]);
