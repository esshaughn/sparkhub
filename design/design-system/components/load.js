// Loads the Spark Hub components for cards + UI kits.
// Uses the compiled _ds_bundle.js namespace when present; otherwise compiles the .jsx sources in the browser (needs Babel standalone).
(function () {
  var FILES = ['icons/Icon', 'brand/Sparkles', 'brand/Wordmark', 'actions/Button', 'actions/IconButton', 'actions/Fab', 'chips/Chip', 'chips/FilterPill', 'chips/Tag',
    'people/Face', 'cards/Card', 'cards/ListRow', 'cards/NextUpCard', 'cards/EventCard', 'cards/IdeaCard', 'cards/GradientCard', 'surfaces/BottomSheet', 'surfaces/Popup',
    'surfaces/Toast', 'surfaces/Menu', 'textures/NotePaper', 'textures/GraphPaper', 'rsvp/RsvpTiles', 'navigation/TabBar', 'navigation/ScreenHeader', 'forms/Field'];
  function findNS() { var k = Object.keys(window).find(function (k) { try { return window[k] && window[k].Button && window[k].Tag && window[k].Icon; } catch (e) { return false; } }); return k ? window[k] : null; }
  window.loadSparkHub = function (root) {
    var ns = findNS(); if (ns) return Promise.resolve(ns);
    root = root || './';
    return new Promise(function (res) { var s = document.createElement('script'); s.src = root + '_ds' + '_bundle.js'; s.onload = s.onerror = function () { res(); }; document.head.appendChild(s); }).then(function () {
    var ns2 = findNS(); if (ns2) return ns2;
    return Promise.all(FILES.map(function (f) { return fetch(root + 'components/' + f + '.jsx').then(function (r) { return r.text(); }); })).then(function (srcs) {
      var names = [];
      var body = srcs.map(function (s, i) {
        var mine = [];
        var src = s.replace(/^import .*$/gm, '').replace(/^export (function|const) (\w+)/gm, function (m, kw, n) { mine.push(n); names.push(n); return kw + ' ' + n; });
        return 'var __m' + i + ' = (function(){\n' + src + '\nreturn {' + mine.join(',') + '};})();\n' + mine.map(function (n) { return 'var ' + n + ' = __m' + i + '.' + n + ';'; }).join('\n');
      }).join('\n');
      var code = Babel.transform(body + '\nreturn {' + names.join(',') + '};', { presets: ['react'], parserOpts: { allowReturnOutsideFunction: true } }).code;
      var out = new Function('React', code)(window.React);
      window.SparkHubDS = out; return out;
    });
    });
  };
})();
