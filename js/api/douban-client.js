// 豆瓣 API 客户端

import { fetchJson } from './client.js';

const DOUBAN_API_BASE = 'https://movie.douban.com/j/search_subjects';

/**
 * 获取豆瓣热门内容
 * @param {string} type - 'movie' | 'tv'
 * @param {string} tag - 标签，如 '热门'
 * @param {number} pageLimit - 每页数量
 * @param {number} pageStart - 起始位置
 */
export async function fetchHot(type = 'movie', tag = '热门', pageLimit = 18, pageStart = 0) {
    const url = `${DOUBAN_API_BASE}?type=${type}&tag=${encodeURIComponent(tag)}&page_limit=${pageLimit}&page_start=${pageStart}`;
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });
        if (!response.ok) throw new Error(`豆瓣请求失败: ${response.status}`);
        const data = await response.json();
        return data.subjects || [];
    } catch (error) {
        console.error('豆瓣 API 请求失败:', error);
        return [];
    }
}

/**
 * 获取豆瓣标签列表
 * @param {string} type - 'movie' | 'tv'
 */
export async function fetchTags(type = 'movie') {
    const url = `https://movie.douban.com/j/search_tags?type=${type}&source=`;
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });
        if (!response.ok) throw new Error(`豆瓣标签请求失败: ${response.status}`);
        const data = await response.json();
        return data.tags || [];
    } catch (error) {
        console.error('豆瓣标签请求失败:', error);
        return [];
    }
}
