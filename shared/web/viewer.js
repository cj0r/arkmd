(function () {
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }

  var imagePolicy = "ask", allowedRemote = {};
  var md = window.markdownit({
    html: false, linkify: true, typographer: true, breaks: false,
    highlight: function (code, lang) {
      try {
        if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
        if (!lang && code.length < 20000) return hljs.highlightAuto(code).value;
      } catch (e) {}
      return esc(code);
    }
  }).use(window.markdownitTaskLists, { enabled: true, label: false })
    .use(window.markdownitFootnote);
  // A picture from the web must not get a src while the page is parsed (the browser would fetch it at once), so
  // unless remote pictures are allowed it is emitted as data-remote and guardRemoteImages decides what to do.
  var defaultImage = md.renderer.rules.image;
  md.renderer.rules.image = function (tokens, idx, options, env, self) {
    var token = tokens[idx];
    var src = token.attrGet("src") || "";
    if (imagePolicy !== "always" && /^https?:/i.test(src) && !allowedRemote[src]) {
      token.attrSet("data-remote", src);
      token.attrs = token.attrs.filter(function (a) { return a[0] !== "src"; });
    }
    return defaultImage ? defaultImage(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
  };
  // Remember which source line each task item came from, so ticking a box can be written back to the file.
  md.core.ruler.push("task_lines", function (state) {
    state.tokens.forEach(function (t) {
      if (t.type === "list_item_open" && t.map && (t.attrGet("class") || "").indexOf("task-list-item") >= 0) t.attrSet("data-line", String(t.map[0] + (state.env.lineOffset || 0)));
    });
  });

  // Show the fence language as a small label.
  var defaultFence = md.renderer.rules.fence;
  md.renderer.rules.fence = function (tokens, idx, opts, env, self) {
    var lang = (tokens[idx].info || "").trim().split(/\s+/)[0];
    var html = defaultFence(tokens, idx, opts, env, self);
    return lang ? html.replace(/^<pre/, '<pre data-lang="' + esc(lang) + '"') : html;
  };

  // ==highlight==, [[wikilinks]] and #tags in plain text.
  md.core.ruler.push("obsidian_inline", function (state) {
    state.tokens.forEach(function (block) {
      if (block.type !== "inline" || !block.children) return;
      var out = [];
      block.children.forEach(function (t) {
        if (t.type !== "text" || !/(==|\[\[|#)/.test(t.content)) { out.push(t); return; }
        var re = /==([^=\n]+)==|\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]|(^|\s)#([A-Za-z0-9_\-\/]*[A-Za-z_\-\/][A-Za-z0-9_\-\/]*)/g;
        var s = t.content, last = 0, m;
        function text(str) { if (!str) return; var x = new state.Token("text", "", 0); x.content = str; out.push(x); }
        function raw(html) { var x = new state.Token("html_inline", "", 0); x.content = html; out.push(x); }
        while ((m = re.exec(s))) {
          text(s.slice(last, m.index));
          if (m[1] !== undefined) raw("<mark>" + esc(m[1]) + "</mark>");
          else if (m[2] !== undefined) raw('<span class="wikilink" data-target="' + esc(m[2]) + '">' + esc((m[3] || m[2]).trim()) + "</span>");
          else { text(m[4]); raw('<span class="tag">#' + esc(m[5]) + "</span>"); }
          last = re.lastIndex;
        }
        text(s.slice(last));
      });
      block.children = out;
    });
  });

  var ICONS = { note:"✎", abstract:"☰", summary:"☰", tldr:"☰", info:"ℹ", todo:"☐", tip:"🔥", hint:"🔥", important:"🔥",
    success:"✔", check:"✔", done:"✔", question:"?", help:"?", faq:"?", warning:"⚠", caution:"⚠", attention:"⚠",
    failure:"✖", fail:"✖", missing:"✖", danger:"⚡", error:"⚡", bug:"🐞", example:"☷", quote:"❝", cite:"❝" };

  function callouts(root) {
    root.querySelectorAll("blockquote").forEach(function (bq) {
      var p = bq.firstElementChild;
      if (!p || p.tagName !== "P") return;
      var m = /^\[!([A-Za-z-]+)\]([+-]?)[ \t]*([^\n]*)\n?/.exec(p.innerHTML);
      if (!m) return;
      var type = m[1].toLowerCase();
      var title = m[3] || (type.charAt(0).toUpperCase() + type.slice(1));
      p.innerHTML = p.innerHTML.slice(m[0].length);
      if (!p.innerHTML.trim()) p.remove();
      var box = document.createElement(m[2] ? "details" : "div");
      if (m[2] === "+") box.open = true;
      box.className = "callout"; box.dataset.type = type;
      var head = document.createElement(m[2] ? "summary" : "div");
      head.className = "callout-title"; head.dataset.icon = ICONS[type] || "✎"; head.innerHTML = title;
      var body = document.createElement("div"); body.className = "callout-body";
      while (bq.firstChild) body.appendChild(bq.firstChild);
      box.appendChild(head); box.appendChild(body);
      bq.replaceWith(box);
    });
  }

  window.applyTheme = function (vars) {
    var st = document.documentElement.style;
    Object.keys(vars).forEach(function (k) { st.setProperty("--" + k, vars[k]); });
    if (document.querySelector(".mermaid-diagram")) queueDiagrams(false);     // redraw diagrams in the new colours (cached ones at once)
  };

  // GitHub-style anchors on headings, so [text](#heading) links and [[Note#Heading]] can jump to them.
  function slugify(text) { return String(text).trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-"); }
  function prepareHeadings(doc) {
    var seen = {};
    doc.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach(function (h) {
      var base = slugify(h.textContent || ""), n = seen[base] = (seen[base] === undefined ? 0 : seen[base] + 1);
      h.id = n ? base + "-" + n : base;
    });
  }
  window.scrollToAnchor = function (fragment) {
    var doc = document.getElementById("doc");
    var want = slugify(fragment);
    var el = null;
    doc.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach(function (h) {
      if (!el && (h.id === want || slugify(h.textContent || "") === want)) el = h;
    });
    if (el) { el.scrollIntoView({ block: "start" }); return true; }
    return false;
  };

  // Mermaid diagrams: a ```mermaid block is drawn as an SVG, in the theme's colours. The library is large, so the page
  // loads it only when a document has a diagram. Its security level is "strict": no scripts or click handlers.
  var mermaidLoading = null, diagramGen = 0, diagramSeq = 0;
  function loadMermaid() {
    if (window.mermaid) return Promise.resolve(window.mermaid);
    if (!mermaidLoading) mermaidLoading = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "mermaid.min.js";
      s.onload = function () { resolve(window.mermaid); };
      s.onerror = function () { mermaidLoading = null; reject(new Error("the diagram library could not be loaded")); };
      document.head.appendChild(s);
    });
    return mermaidLoading;
  }
  function lightness(hex) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return 0;
    var n = parseInt(m[1], 16);
    return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  }
  function mermaidTheme() {
    var cs = getComputedStyle(document.documentElement);
    function v(name) { return cs.getPropertyValue(name).trim(); }
    var bg = v("--bg"), fg = v("--fg"), surface = v("--surface"), accent = v("--accent"), alt = v("--bg-alt"), muted = v("--fg-muted");
    var t = {
      darkMode: lightness(bg) < 0.5, background: bg, fontFamily: v("--font-body") || "sans-serif",
      primaryColor: surface, primaryTextColor: fg, primaryBorderColor: accent, secondaryColor: alt, secondaryTextColor: fg,
      tertiaryColor: bg, tertiaryTextColor: fg, lineColor: muted, textColor: fg, mainBkg: surface, nodeBorder: accent,
      clusterBkg: alt, clusterBorder: muted, titleColor: fg, edgeLabelBackground: bg, noteBkgColor: alt, noteTextColor: fg,
      noteBorderColor: muted, actorBkg: surface, actorBorder: accent, actorTextColor: fg, actorLineColor: muted,
      signalColor: fg, signalTextColor: fg, labelBoxBkgColor: surface, labelBoxBorderColor: accent, labelTextColor: fg,
      loopTextColor: fg, activationBkgColor: alt, sequenceNumberColor: bg,
      pieTitleTextColor: fg, pieSectionTextColor: bg, pieLegendTextColor: fg, pieStrokeColor: bg, pieOuterStrokeColor: bg, pieOpacity: "0.95"
    };
    // Charts, pies, timelines and mind maps colour their parts from a scale: use the theme's accent colours.
    [accent, v("--red"), v("--orange"), v("--yellow"), v("--green"), v("--cyan"), v("--purple"), v("--h1"), v("--h2"), v("--h3"), v("--h4"), v("--h5")].forEach(function (c, i) {
      t["pie" + (i + 1)] = c; t["cScale" + i] = c; t["cScaleLabel" + i] = bg;
    });
    return t;
  }
  function diagramError(box, message) {
    var src = box.getAttribute("data-src");
    box.className = "mermaid-diagram failed";
    box.textContent = "";
    var head = document.createElement("div"); head.className = "diagram-error"; head.textContent = "Diagram error: " + message;
    var pre = document.createElement("pre"), code = document.createElement("code"); code.textContent = src; pre.appendChild(code);
    box.appendChild(head); box.appendChild(pre);
  }
  // Drawing a diagram takes tens of milliseconds, so drawn diagrams are remembered (by theme and source) and a diagram
  // is only drawn when it is near the screen. A tab switch or a re-render then costs nothing for diagrams seen before.
  var diagramCache = {}, diagramOrder = [], diagramObserver = null, diagramEpoch = 0, mermaidKey = null;
  function cacheDiagram(key, svg) {
    if (!(key in diagramCache)) { diagramOrder.push(key); if (diagramOrder.length > 60) delete diagramCache[diagramOrder.shift()]; }
    diagramCache[key] = svg;
  }
  function showDiagram(box, themeKey, svg) {
    box.className = "mermaid-diagram"; box.innerHTML = svg; box.setAttribute("data-key", themeKey);
  }
  /** Draw these boxes, one after another; resolves when all are done. */
  function drawBoxes(boxes, themeKey, epoch) {
    return loadMermaid().then(function (m) {
      if (mermaidKey !== themeKey) { m.initialize({ startOnLoad: false, securityLevel: "strict", theme: "base", themeVariables: JSON.parse(themeKey), fontFamily: JSON.parse(themeKey).fontFamily }); mermaidKey = themeKey; }
      return boxes.reduce(function (chain, box) {
        return chain.then(function () {
          if (epoch !== diagramEpoch || !document.body.contains(box)) return null;
          var src = box.getAttribute("data-src");
          var id = "arkmd-diagram-" + (++diagramSeq);
          return m.render(id, src).then(function (r) {
            cacheDiagram(themeKey + "\u0000" + src, r.svg);
            showDiagram(box, themeKey, r.svg);
          }).catch(function (e) {
            var stray = document.getElementById("d" + id); if (stray) stray.remove();   // mermaid leaves its error drawing in the page
            diagramError(box, String((e && e.message) || e).split("\n")[0]);
            box.setAttribute("data-key", themeKey);
          });
        });
      }, Promise.resolve());
    }).catch(function (e) {
      boxes.forEach(function (box) { diagramError(box, String((e && e.message) || e)); });
    });
  }
  /** Bring every diagram up to date with the current theme: from the cache at once, the rest when they come near the screen. */
  function queueDiagrams(all) {
    var doc = document.getElementById("doc");
    var boxes = Array.prototype.slice.call(doc.querySelectorAll(".mermaid-diagram"));
    if (diagramObserver) { diagramObserver.disconnect(); diagramObserver = null; }
    if (!boxes.length) return Promise.resolve();
    var epoch = ++diagramEpoch;
    var themeKey = JSON.stringify(mermaidTheme());
    var pending = boxes.filter(function (box) {
      if (box.getAttribute("data-key") === themeKey) return false;
      var cached = diagramCache[themeKey + "\u0000" + box.getAttribute("data-src")];
      if (cached) { showDiagram(box, themeKey, cached); return false; }
      return true;
    });
    if (!pending.length) return Promise.resolve();
    if (all || !("IntersectionObserver" in window)) return drawBoxes(pending, themeKey, epoch);
    diagramObserver = new IntersectionObserver(function (entries) {
      var seen = entries.filter(function (e) { return e.isIntersecting; }).map(function (e) { return e.target; });
      seen.forEach(function (box) { diagramObserver.unobserve(box); });
      if (seen.length) drawBoxes(seen, themeKey, epoch);
    }, { rootMargin: "800px 0px" });
    pending.forEach(function (box) { diagramObserver.observe(box); });
    return Promise.resolve();
  }
  /** Draw every diagram now (before printing or exporting, which need all of them). */
  window.renderAllDiagrams = function () { return queueDiagrams(true); };
  function prepareDiagrams(doc) {
    doc.querySelectorAll('pre[data-lang="mermaid"]').forEach(function (pre) {
      var box = document.createElement("div");
      box.className = "mermaid-diagram pending";
      box.setAttribute("data-src", pre.textContent);
      box.setAttribute("role", "img");
      box.setAttribute("aria-label", "Diagram");
      box.textContent = "Diagram";
      pre.parentNode.replaceChild(box, pre);
    });
    queueDiagrams(false);
  }

  // Images next to the document (desktop): the host reads the file and returns an address the page can show.
  function loadLocalImages(doc) {
    doc.querySelectorAll("img").forEach(function (img) {
      var src = img.getAttribute("src") || "";
      if (!src || /^([a-z][a-z0-9+.-]*:|\/)/i.test(src)) return;
      img.removeAttribute("src");
      var host = window.parent !== window && window.parent.arkLoadImage;
      function missing() {
        var s = document.createElement("span");
        s.className = "img-missing";
        s.textContent = "Image not found: " + (img.getAttribute("alt") || src);
        if (img.parentNode) img.parentNode.replaceChild(s, img);
      }
      if (!host) return missing();
      Promise.resolve(host(src)).then(function (url) { img.src = url; }).catch(missing);
    });
  }

  // Pictures from the web are hidden unless allowed: loading one tells its server your address and when you read the
  // file. Policy "ask" (default) hides them with a bar to load them, "always" loads them, "never" keeps them hidden.
  window.setImagePolicy = function (policy) { imagePolicy = policy === "always" || policy === "never" ? policy : "ask"; };
  function guardRemoteImages(doc) {
    var hidden = [];
    doc.querySelectorAll("img").forEach(function (img) {
      var src = img.getAttribute("data-remote") || "";
      if (!src) return;
      var ph = document.createElement("span");
      ph.className = "img-hidden";
      ph.textContent = "Remote image hidden" + (img.getAttribute("alt") ? ": " + img.getAttribute("alt") : "");
      ph.title = src;
      if (img.parentNode) img.parentNode.replaceChild(ph, img);
      hidden.push({ ph: ph, img: img, src: src });
    });
    if (!hidden.length || imagePolicy === "never") return;
    var bar = document.createElement("div");
    bar.className = "img-bar";
    var text = document.createElement("span");
    text.textContent = hidden.length + (hidden.length === 1 ? " remote image is" : " remote images are") + " hidden. Loading them tells the sites that host them that you opened this file.";
    var button = document.createElement("button");
    button.textContent = "Load images";
    button.onclick = function () {
      hidden.forEach(function (h) { allowedRemote[h.src] = true; h.img.removeAttribute("data-remote"); h.img.setAttribute("src", h.src); if (h.ph.parentNode) h.ph.parentNode.replaceChild(h.img, h.ph); });
      bar.remove();
    };
    bar.append(text, button);
    doc.insertBefore(bar, doc.firstChild);
  }

  window.render = function (src, scrollFraction) {
    var doc = document.getElementById("doc");
    var front = "";
    var fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
    var lineOffset = 0;
    if (fm) { front = '<div class="frontmatter">' + esc(fm[1]) + "</div>"; lineOffset = fm[0].split("\n").length - 1; src = src.slice(fm[0].length); }
    if (!src.trim() && !front) { doc.innerHTML = '<p class="empty">Empty file</p>'; return; }
    doc.innerHTML = front + md.render(src, { lineOffset: lineOffset });
    callouts(doc);
    doc.querySelectorAll("li.task-list-item input:checked").forEach(function (i) { i.parentNode.classList.add("task-done"); });
    // Accessibility: task checkboxes are named by their item text; wide tables/code blocks are keyboard-scrollable.
    doc.querySelectorAll("li.task-list-item > input").forEach(function (i) {
      i.setAttribute("aria-label", (i.parentNode.textContent || "").trim().slice(0, 120) || "Task");
    });
    doc.querySelectorAll("pre, table").forEach(function (el) {
      el.setAttribute("tabindex", "0");
      el.setAttribute("role", "region");
      el.setAttribute("aria-label", el.tagName === "PRE" ? "Code" + (el.dataset.lang ? " (" + el.dataset.lang + ")" : "") : "Table");
    });
    prepareHeadings(doc);
    loadLocalImages(doc);
    guardRemoteImages(doc);
    prepareDiagrams(doc);
    if (scrollFraction) {
      requestAnimationFrame(function () {
        window.scrollTo(0, scrollFraction * (document.body.scrollHeight - window.innerHeight));
      });
    }
  };

  // Reading font: dir under assets/fonts/ (null = system). kind: static | mono (no italic files) | variable.
  window.setFont = function (dir, kind) {
    var css = "";
    function face(file, weight, style) {
      css += "@font-face{font-family:ArkBody;src:url('fonts/" + dir + "/" + file + ".ttf');font-weight:" + weight + ";font-style:" + style + ";}";
    }
    if (dir && kind === "variable") { face("regular", "400 700", "normal"); face("italic", "400 700", "italic"); }
    else if (dir) {
      face("regular", 400, "normal"); face("bold", 700, "normal");
      if (kind !== "mono") { face("italic", 400, "italic"); face("bolditalic", 700, "italic"); }
    }
    document.getElementById("fontface").textContent = css;
    document.documentElement.style.setProperty("--font-body", dir ? "ArkBody, system-ui, sans-serif" : "system-ui, Roboto, sans-serif");
  };

  window.scrollFraction = function () {
    var h = document.body.scrollHeight - window.innerHeight;
    return h > 0 ? window.scrollY / h : 0;
  };

  // Find in the page: wrap matches (within single text nodes) in <mark class="find-hit">.
  window.findClear = function () {
    document.querySelectorAll("mark.find-hit").forEach(function (m) {
      var p = m.parentNode;
      p.replaceChild(document.createTextNode(m.textContent), m);
      p.normalize();
    });
  };
  window.findAll = function (source, flags) {
    window.findClear();
    var re = new RegExp(source, flags), count = 0, nodes = [];
    var walker = document.createTreeWalker(document.getElementById("doc"), NodeFilter.SHOW_TEXT, null);
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      if (count >= 10000 || /^(SCRIPT|STYLE|TEXTAREA)$/.test(node.parentNode.nodeName) || node.parentNode.closest("svg")) return;
      var text = node.nodeValue, m, last = 0, frag = null;
      re.lastIndex = 0;
      while ((m = re.exec(text)) && count < 10000) {
        if (m[0] === "") { re.lastIndex++; continue; }
        frag = frag || document.createDocumentFragment();
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        var mark = document.createElement("mark");
        mark.className = "find-hit";
        mark.textContent = m[0];
        frag.appendChild(mark);
        last = m.index + m[0].length;
        count++;
      }
      if (frag) {
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag, node);
      }
    });
    return count;
  };
  window.findStep = function (i) {
    var marks = document.querySelectorAll("mark.find-hit");
    marks.forEach(function (m) { m.classList.remove("current"); });
    var m = marks[i];
    if (!m) return;
    m.classList.add("current");
    for (var d = m.closest("details"); d; d = d.parentElement && d.parentElement.closest("details")) d.open = true;
    m.scrollIntoView({ block: "center" });
  };

  // A standalone copy of the rendered page (theme colours inline, no scripts), for Export as HTML.
  window.exportHtml = function (title) {
    return window.renderAllDiagrams().then(function () { return exportCopy(title); });
  };
  function exportCopy(title) {
    var copy = document.documentElement.cloneNode(true);
    copy.querySelectorAll("script").forEach(function (n) { n.remove(); });
    var fonts = copy.querySelector("#fontface"); if (fonts) fonts.remove();
    copy.querySelectorAll("style").forEach(function (n) { n.textContent = n.textContent.replace(/@font-face\s*\{[^}]*\}/g, ""); });
    copy.querySelectorAll("mark.find-hit").forEach(function (m) { m.replaceWith(document.createTextNode(m.textContent)); });
    var t = copy.querySelector("title"); if (t) t.textContent = title || "Document";
    // Images next to the document were shown from temporary addresses; save them inside the page instead.
    var live = Array.prototype.slice.call(document.querySelectorAll("#doc img"));
    var saved = Array.prototype.slice.call(copy.querySelectorAll("#doc img"));
    var host = window.parent !== window && window.parent.arkImageData;
    return Promise.all(saved.map(function (img, i) {
      var src = live[i] && live[i].getAttribute("src") || "";
      if (src.indexOf("blob:") !== 0 || !host) return null;
      return Promise.resolve(host(src)).then(function (data) { img.setAttribute("src", data); }).catch(function () { img.removeAttribute("src"); });
    })).then(function () { return "<!doctype html>\n" + copy.outerHTML; });
  }

  // The headings of the rendered document, for the host's Outline flyout.
  function headingEls() { return Array.prototype.slice.call(document.querySelectorAll("#doc h1, #doc h2, #doc h3, #doc h4, #doc h5, #doc h6")); }
  window.headings = function () {
    return headingEls().map(function (h) { return { level: Number(h.tagName.charAt(1)), text: (h.textContent || "").replace(/\s+/g, " ").trim() }; });
  };
  window.scrollToHeading = function (i) {
    var h = headingEls()[i];
    if (!h) return;
    h.scrollIntoView({ block: "start" });
    h.setAttribute("tabindex", "-1");
    h.focus({ preventScroll: true });
  };
  window.currentHeading = function () {
    var at = -1;
    headingEls().forEach(function (h, i) { if (h.getBoundingClientRect().top <= 24) at = i; });
    return at;
  };

  // Ticking a task box in the reader changes the file's text through the host (it saves like any edit).
  document.addEventListener("change", function (e) {
    var box = e.target;
    var li = box && box.closest && box.closest("li.task-list-item");
    if (!li || !li.hasAttribute("data-line")) return;
    var ok = window.parent !== window && window.parent.arkToggleTask && window.parent.arkToggleTask(Number(li.getAttribute("data-line")), box.checked);
    if (!ok) { box.checked = !box.checked; return; }
    li.classList.toggle("task-done", box.checked);
  });

  // Embedded in the desktop app (iframe): hand links to the host so they open in the system browser.
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[href]");
    if (a) {
      var href = a.getAttribute("href");
      if (href.charAt(0) === "#") {
        e.preventDefault();
        var frag = href.slice(1);
        try { frag = decodeURIComponent(frag); } catch (x) { /* keep as is */ }
        window.scrollToAnchor(frag);
        return;
      }
      if (window.parent !== window && window.parent.arkOpenLink) { e.preventDefault(); window.parent.arkOpenLink(href); }
      return;
    }
    var wiki = e.target.closest && e.target.closest(".wikilink");
    if (wiki && window.parent !== window && window.parent.arkOpenWikilink) window.parent.arkOpenWikilink(wiki.getAttribute("data-target") || wiki.textContent);
  });

  if (window.Host) Host.ready();
})();
