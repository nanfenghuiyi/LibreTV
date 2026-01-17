import { defineComponent, ref, computed, watch, mergeProps, unref, toRef, isRef, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderList, ssrRenderComponent, ssrRenderAttr, ssrInterpolate } from 'vue/server-renderer';
import { d as useRoute, u as useRouter, _ as _export_sfc, n as navigateTo, a as useNuxtApp } from './server.mjs';
import { sha256 } from 'js-sha256';
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

const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "VideoCard",
  __ssrInlineRender: true,
  props: {
    video: {}
  },
  setup(__props) {
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "bg-[#1a1a1a] rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all hover:scale-105 cursor-pointer flex flex-col h-full" }, _attrs))}><div class="relative aspect-[3/4] overflow-hidden group"><img${ssrRenderAttr("src", __props.video.vod_pic)} alt="cover" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy"><div class="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div><div class="absolute bottom-2 left-2 right-2"><span class="text-xs bg-pink-600 text-white px-2 py-1 rounded">${ssrInterpolate(__props.video.type_name || "\u89C6\u9891")}</span>`);
      if (__props.video.vod_remarks) {
        _push(`<span class="text-xs bg-blue-600 text-white px-2 py-1 rounded ml-1">${ssrInterpolate(__props.video.vod_remarks)}</span>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div></div><div class="p-3 flex flex-col flex-1"><h3 class="text-white font-medium truncate mb-1"${ssrRenderAttr("title", __props.video.vod_name)}>${ssrInterpolate(__props.video.vod_name)}</h3><div class="flex justify-between items-center text-xs text-gray-400 mt-auto"><span>${ssrInterpolate(__props.video.vod_year || "\u672A\u77E5")}</span><span class="border border-gray-600 px-1 rounded">${ssrInterpolate(__props.video.source_name)}</span></div></div></div>`);
    };
  }
});
const _sfc_setup$2 = _sfc_main$2.setup;
_sfc_main$2.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/VideoCard.vue");
  return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "DetailModal",
  __ssrInlineRender: true,
  props: {
    show: { type: Boolean },
    video: {}
  },
  emits: ["close", "play"],
  setup(__props, { emit: __emit }) {
    const isUrl = (str) => str.startsWith("http");
    return (_ctx, _push, _parent, _attrs) => {
      var _a;
      if (__props.show) {
        _push(`<div${ssrRenderAttrs(mergeProps({ class: "fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4" }, _attrs))} data-v-557f9d47><div class="bg-[#111] p-6 rounded-lg w-full max-w-4xl border border-[#333] max-h-[90vh] flex flex-col relative animate-fade-in" data-v-557f9d47><button class="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl" data-v-557f9d47>\xD7</button><div class="flex flex-col md:flex-row gap-6 overflow-y-auto" data-v-557f9d47><div class="w-full md:w-1/3 flex-shrink-0" data-v-557f9d47><div class="aspect-[3/4] rounded overflow-hidden relative group" data-v-557f9d47><img${ssrRenderAttr("src", __props.video.vod_pic)} class="w-full h-full object-cover" data-v-557f9d47><div class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" data-v-557f9d47><button class="bg-red-600 hover:bg-red-700 text-white rounded-full p-4 transition-transform hover:scale-110" data-v-557f9d47><svg class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24" data-v-557f9d47><path d="M8 5v14l11-7z" data-v-557f9d47></path></svg></button></div></div></div><div class="flex-1 text-gray-300" data-v-557f9d47><h2 class="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 mb-4" data-v-557f9d47>${ssrInterpolate(__props.video.vod_name)}</h2><div class="space-y-2 text-sm mb-6" data-v-557f9d47><p data-v-557f9d47><span class="text-gray-500" data-v-557f9d47>\u7C7B\u578B:</span> ${ssrInterpolate(__props.video.type_name)}</p><p data-v-557f9d47><span class="text-gray-500" data-v-557f9d47>\u5730\u533A:</span> ${ssrInterpolate(__props.video.vod_area)}</p><p data-v-557f9d47><span class="text-gray-500" data-v-557f9d47>\u5E74\u4EFD:</span> ${ssrInterpolate(__props.video.vod_year)}</p><p data-v-557f9d47><span class="text-gray-500" data-v-557f9d47>\u4E3B\u6F14:</span> ${ssrInterpolate(__props.video.vod_actor)}</p><p data-v-557f9d47><span class="text-gray-500" data-v-557f9d47>\u7B80\u4ECB:</span> <span data-v-557f9d47>${(_a = __props.video.vod_content) != null ? _a : ""}</span></p></div>`);
        if (__props.video.episodes && __props.video.episodes.length > 0) {
          _push(`<div data-v-557f9d47><h3 class="text-white font-bold mb-2" data-v-557f9d47>\u9009\u96C6\u64AD\u653E</h3><div class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2" data-v-557f9d47><!--[-->`);
          ssrRenderList(__props.video.episodes, (ep, index) => {
            _push(`<button class="bg-[#222] hover:bg-pink-600 text-gray-300 hover:text-white py-2 px-1 rounded text-xs truncate transition-colors" data-v-557f9d47>${ssrInterpolate(isUrl(ep) ? `\u7B2C${index + 1}\u96C6` : ep.split("$")[0])}</button>`);
          });
          _push(`<!--]--></div></div>`);
        } else {
          _push(`<div class="text-red-500 mt-4" data-v-557f9d47> \u6682\u65E0\u64AD\u653E\u6E90 </div>`);
        }
        _push(`</div></div></div></div>`);
      } else {
        _push(`<!---->`);
      }
    };
  }
});
const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/DetailModal.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const __nuxt_component_1 = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-557f9d47"]]);
const API_SITES = {
  testSource: {
    api: "https://www.example.com/api.php/provide/vod",
    name: "\u7A7A\u5185\u5BB9\u6D4B\u8BD5\u6E90",
    adult: true
  }
};
const API_CONFIG = {
  search: {
    path: "?ac=videolist&wd="
  },
  detail: {
    path: "?ac=videolist&ids="
  }
};
const useStateKeyPrefix = "$s";
function useState(...args) {
  const autoKey = typeof args[args.length - 1] === "string" ? args.pop() : void 0;
  if (typeof args[0] !== "string") {
    args.unshift(autoKey);
  }
  const [_key, init] = args;
  if (!_key || typeof _key !== "string") {
    throw new TypeError("[nuxt] [useState] key must be a string: " + _key);
  }
  if (init !== void 0 && typeof init !== "function") {
    throw new Error("[nuxt] [useState] init must be a function: " + init);
  }
  const key = useStateKeyPrefix + _key;
  const nuxtApp = useNuxtApp();
  const state = toRef(nuxtApp.payload.state, key);
  if (state.value === void 0 && init) {
    const initialValue = init();
    if (isRef(initialValue)) {
      nuxtApp.payload.state[key] = initialValue;
      return initialValue;
    }
    state.value = initialValue;
  }
  return state;
}
const useAuth = () => {
  const passwordHash = useState("passwordHash", () => "");
  const isAuthenticated = useState("isAuthenticated", () => false);
  const setPassword = (password) => {
    passwordHash.value = sha256(password);
    isAuthenticated.value = true;
  };
  const getAuthParams = () => {
    if (!passwordHash.value) return {};
    return {
      auth: passwordHash.value,
      t: Date.now().toString()
    };
  };
  return {
    passwordHash,
    isAuthenticated,
    setPassword,
    getAuthParams
  };
};
const useVideoApi = () => {
  const { getAuthParams } = useAuth();
  const fetchApi = async (url, options = {}) => {
    const authParams = getAuthParams();
    const separator = url.includes("?") ? "&" : "?";
    const params = new URLSearchParams(authParams).toString();
    const targetUrl = url + (params ? separator + params : "");
    const proxyUrl = `/api/proxy/${encodeURIComponent(targetUrl)}`;
    return $fetch(proxyUrl, {
      ...options,
      headers: {
        ...options.headers,
        "Accept": "application/json"
      }
    });
  };
  const search = async (query, sourceKey) => {
    const source = API_SITES[sourceKey];
    if (!source) throw new Error("Invalid source");
    const url = `${source.api}${API_CONFIG.search.path}${encodeURIComponent(query)}`;
    try {
      const data = await fetchApi(url);
      if (!data || !data.list) return [];
      return data.list.map((item) => ({
        ...item,
        source_name: source.name,
        source_code: sourceKey
      }));
    } catch (e) {
      console.error(`Search error for ${sourceKey}:`, e);
      return [];
    }
  };
  const handleAggregatedSearch = async (query) => {
    const sources = Object.keys(API_SITES).filter((k) => k !== "testSource");
    const promises = sources.map((s) => search(query, s));
    const results = await Promise.allSettled(promises);
    const flatResults = [];
    results.forEach((res) => {
      if (res.status === "fulfilled" && res.value) {
        flatResults.push(...res.value);
      }
    });
    const seen = /* @__PURE__ */ new Set();
    return flatResults.filter((item) => {
      const key = `${item.source_code}_${item.vod_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const getDetail = async (id, sourceKey) => {
    const source = API_SITES[sourceKey];
    if (!source) throw new Error("Invalid source");
    const url = `${source.api}${API_CONFIG.detail.path}${id}`;
    try {
      const data = await fetchApi(url);
      if (!data || !data.list || !data.list[0]) throw new Error("No detail found");
      const detail = data.list[0];
      let episodes = [];
      if (detail.vod_play_url) {
        const playSources = detail.vod_play_url.split("$$$");
        const mainSource = playSources[0] || "";
        const episodeList = mainSource.split("#");
        episodes = episodeList.map((ep) => {
          const parts = ep.split("$");
          return parts.length > 1 ? parts[1] : parts[0];
        }).filter((u) => u.startsWith("http"));
      }
      return {
        ...detail,
        episodes,
        source_name: source.name,
        source_code: sourceKey
      };
    } catch (e) {
      console.error(`Detail error name ${sourceKey}:`, e);
      throw e;
    }
  };
  return {
    search,
    handleAggregatedSearch,
    getDetail
  };
};
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "index",
  __ssrInlineRender: true,
  setup(__props) {
    const route = useRoute();
    useRouter();
    const { handleAggregatedSearch, getDetail } = useVideoApi();
    const results = ref([]);
    const loading = ref(false);
    const showDetail = ref(false);
    const currentDetail = ref({});
    const hasResults = computed(() => results.value.length > 0);
    const performSearch = async (query) => {
      if (!query) return;
      loading.value = true;
      try {
        const data = await handleAggregatedSearch(query);
        results.value = data || [];
      } catch (e) {
        console.error(e);
      } finally {
        loading.value = false;
      }
    };
    watch(() => route.query.s, (newVal) => {
      if (newVal) {
        performSearch(newVal);
      } else {
        results.value = [];
      }
    }, { immediate: true });
    const openDetail = async (item) => {
      loading.value = true;
      try {
        const detail = await getDetail(item.vod_id, item.source_code);
        currentDetail.value = detail;
        showDetail.value = true;
      } catch (e) {
        alert("\u83B7\u53D6\u8BE6\u60C5\u5931\u8D25");
      } finally {
        loading.value = false;
      }
    };
    const handlePlay = (url) => {
      navigateTo({
        path: "/play",
        query: { url, title: currentDetail.value.vod_name }
      });
    };
    return (_ctx, _push, _parent, _attrs) => {
      const _component_VideoCard = _sfc_main$2;
      const _component_DetailModal = __nuxt_component_1;
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "h-full" }, _attrs))}>`);
      if (unref(loading)) {
        _push(`<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"><div class="w-10 h-10 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (!unref(hasResults) && !unref(loading)) {
        _push(`<div class="my-8"><div class="text-center text-gray-500 py-20"><h2 class="text-2xl font-bold mb-4">\u6B22\u8FCE\u6765\u5230 LibreTV</h2><p>\u8F93\u5165\u5173\u952E\u8BCD\u641C\u7D22\u4F60\u559C\u6B22\u7684\u89C6\u9891</p></div></div>`);
      } else {
        _push(`<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"><!--[-->`);
        ssrRenderList(unref(results), (item, index) => {
          _push(ssrRenderComponent(_component_VideoCard, {
            key: item.vod_id + "_" + item.source_code + index,
            video: item,
            onClick: ($event) => openDetail(item)
          }, null, _parent));
        });
        _push(`<!--]--></div>`);
      }
      if (unref(showDetail)) {
        _push(ssrRenderComponent(_component_DetailModal, {
          show: unref(showDetail),
          video: unref(currentDetail),
          onClose: ($event) => showDetail.value = false,
          onPlay: handlePlay
        }, null, _parent));
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("pages/index.vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};

export { _sfc_main as default };
//# sourceMappingURL=index-DqxDc6z4.mjs.map
