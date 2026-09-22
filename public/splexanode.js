/* Splexanode widget loader. Public widget identifiers only — no credentials. */
(function () {
  var current = document.currentScript;
  var base = current ? new URL(current.src, window.location.href).origin : window.location.origin;

  function overlay(widgetId, options) {
    var host = document.createElement("div");
    host.setAttribute("data-splexanode-overlay", widgetId);
    host.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:rgba(6,9,16,.55);display:grid;place-items:center";
    var frame = document.createElement("iframe");
    frame.title = "Splexanode upload";
    frame.allow = "camera";
    frame.style.cssText = "width:min(520px,94vw);height:min(640px,92vh);border:0;background:transparent";
    frame.src = base + "/widget/" + encodeURIComponent(widgetId) + "?origin=" + encodeURIComponent(window.location.origin);
    host.appendChild(frame);
    host.addEventListener("click", function (event) { if (event.target === host) close(); });
    document.body.appendChild(host);

    function close() {
      window.removeEventListener("message", onMessage);
      if (host.parentNode) host.parentNode.removeChild(host);
    }

    function onMessage(event) {
      if (event.source !== frame.contentWindow) return;
      var payload = event.data;
      if (!payload || payload.source !== "splexanode" || typeof payload.type !== "string") return;
      var detail = payload.detail || {};
      document.dispatchEvent(new CustomEvent("splexanode:" + payload.type, { detail: detail }));
      if (options && typeof options.on === "function") options.on(payload.type, detail);
      if (payload.type === "transfer-complete") setTimeout(close, 1200);
    }

    window.addEventListener("message", onMessage);
    return { close: close };
  }

  window.Splexanode = {
    open: function (widgetId, options) { return overlay(widgetId, options || {}); },
  };

  function bind() {
    var triggers = document.querySelectorAll("[data-splexanode-widget]");
    for (var index = 0; index < triggers.length; index += 1) {
      var node = triggers[index];
      if (node === current || node.tagName === "SCRIPT" || node.getAttribute("data-splexanode-bound")) continue;
      node.setAttribute("data-splexanode-bound", "1");
      node.addEventListener("click", function (event) {
        event.preventDefault();
        window.Splexanode.open(this.getAttribute("data-splexanode-widget"));
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
