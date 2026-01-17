import { mergeProps, useSSRContext } from 'vue';
import { ssrRenderAttrs } from 'vue/server-renderer';
import { _ as _export_sfc } from './server.mjs';
import '../_/nitro.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import '../routes/renderer.mjs';
import 'vue-bundle-renderer/runtime';
import 'unhead/server';
import 'devalue';
import 'unhead/utils';
import 'unhead/plugins';
import 'vue-router';

const _sfc_main = {};
function _sfc_ssrRender(_ctx, _push, _parent, _attrs) {
  _push(`<div${ssrRenderAttrs(mergeProps({ class: "container mx-auto px-4 py-8 max-w-2xl text-white" }, _attrs))}><h1 class="text-4xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">\u5173\u4E8E LibreTV</h1><div class="space-y-6 text-gray-300 leading-relaxed"><p>LibreTV \u662F\u4E00\u4E2A\u514D\u8D39\u7684\u5728\u7EBF\u89C6\u9891\u641C\u7D22\u5E73\u53F0\uFF0C\u81F4\u529B\u4E8E\u4E3A\u7528\u6237\u63D0\u4F9B\u65E0\u5E7F\u544A\u3001\u5B89\u5168\u3001\u4FBF\u6377\u7684\u89C2\u5F71\u4F53\u9A8C\u3002</p><div class="bg-[#1a1a1a] p-6 rounded-lg border border-[#333]"><h2 class="text-xl font-bold text-white mb-4">\u514D\u8D23\u58F0\u660E</h2><p class="mb-2">\u672C\u7AD9\u4EC5\u4E3A\u89C6\u9891\u641C\u7D22\u5DE5\u5177\uFF0C\u4E0D\u5B58\u50A8\u3001\u4E0A\u4F20\u6216\u5206\u53D1\u4EFB\u4F55\u89C6\u9891\u5185\u5BB9\u3002</p><p>\u6240\u6709\u89C6\u9891\u5747\u6765\u81EA\u7B2C\u4E09\u65B9API\u63A5\u53E3\u3002\u5982\u6709\u4FB5\u6743\uFF0C\u8BF7\u8054\u7CFB\u76F8\u5173\u5185\u5BB9\u63D0\u4F9B\u65B9\u3002</p></div><div class="bg-[#1a1a1a] p-6 rounded-lg border border-[#333]"><h2 class="text-xl font-bold text-white mb-4">\u8054\u7CFB\u6211\u4EEC</h2><p>\u5982\u6709\u4EFB\u4F55\u95EE\u9898\u6216\u5EFA\u8BAE\uFF0C\u6B22\u8FCE\u63D0\u4EA4 Issue \u6216\u8054\u7CFB\u5F00\u53D1\u8005\u3002</p><div class="mt-4 flex space-x-4"><a href="https://github.com/nanfenghuiyi/LibreTV" target="_blank" class="text-blue-400 hover:text-blue-300">GitHub</a></div></div></div></div>`);
}
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("pages/about.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const about = /* @__PURE__ */ _export_sfc(_sfc_main, [["ssrRender", _sfc_ssrRender]]);

export { about as default };
//# sourceMappingURL=about-B4dgqY5X.mjs.map
