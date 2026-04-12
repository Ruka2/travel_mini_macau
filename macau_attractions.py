#!/usr/bin/env python3
"""
澳门景点数据
包含澳门热门景点、餐厅、酒店等位置信息
用于Agent推荐时进行地图高亮显示
"""

# 澳门主要景点数据
MACAU_ATTRACTIONS = [
    {
        "name": "大三巴牌坊",
        "name_en": "Ruins of St. Paul's",
        "lat": 22.1973,
        "lng": 113.5409,
        "category": "景点",
        "description": "澳门最著名的地标，圣保禄大教堂遗址",
        "area": "澳门半岛"
    },
    {
        "name": "威尼斯人",
        "name_en": "The Venetian Macao",
        "lat": 22.1483,
        "lng": 113.5602,
        "category": "景点",
        "description": "综合度假村，以威尼斯水乡为主题",
        "area": "氹仔"
    },
    {
        "name": "巴黎人",
        "name_en": "The Parisian Macao",
        "lat": 22.1495,
        "lng": 113.5615,
        "category": "景点",
        "description": "法式主题度假村，拥有巴黎铁塔 replica",
        "area": "氹仔"
    },
    {
        "name": "伦敦人",
        "name_en": "The Londoner Macao",
        "lat": 22.1510,
        "lng": 113.5625,
        "category": "景点",
        "description": "英式主题度假村，大本钟地标",
        "area": "氹仔"
    },
    {
        "name": "新葡京酒店",
        "name_en": "Grand Lisboa",
        "lat": 22.1896,
        "lng": 113.5447,
        "category": "景点",
        "description": "澳门地标性建筑，莲花造型",
        "area": "澳门半岛"
    },
    {
        "name": "渔人码头",
        "name_en": "Fisherman's Wharf",
        "lat": 22.1920,
        "lng": 113.5550,
        "category": "景点",
        "description": "主题公园式购物中心，罗马建筑群",
        "area": "澳门半岛"
    },
    {
        "name": "澳门塔",
        "name_en": "Macau Tower",
        "lat": 22.1808,
        "lng": 113.5365,
        "category": "景点",
        "description": "观光塔，可体验蹦极和空中漫步",
        "area": "澳门半岛"
    },
    {
        "name": "官也街",
        "name_en": "Rua do Cunha",
        "lat": 22.1530,
        "lng": 113.5560,
        "category": "美食",
        "description": "著名美食街，手信和地道小吃",
        "area": "氹仔"
    },
    {
        "name": "议事亭前地",
        "name_en": "Senado Square",
        "lat": 22.1941,
        "lng": 113.5445,
        "category": "景点",
        "description": "历史城区核心，葡式建筑群",
        "area": "澳门半岛"
    },
    {
        "name": "妈阁庙",
        "name_en": "A-Ma Temple",
        "lat": 22.1860,
        "lng": 113.5310,
        "category": "景点",
        "description": "澳门最古老的中式庙宇",
        "area": "澳门半岛"
    },
    {
        "name": "龙环葡韵",
        "name_en": "Casa Garden",
        "lat": 22.1540,
        "lng": 113.5580,
        "category": "景点",
        "description": "薄荷绿色葡式住宅博物馆",
        "area": "氹仔"
    },
    {
        "name": "黑沙海滩",
        "name_en": "Hac Sa Beach",
        "lat": 22.1160,
        "lng": 113.5750,
        "category": "景点",
        "description": "天然黑沙海滩，烧烤胜地",
        "area": "路环"
    },
    {
        "name": "安德鲁饼店总店",
        "name_en": "Lord Stow's Bakery",
        "lat": 22.1150,
        "lng": 113.5520,
        "category": "美食",
        "description": "葡式蛋挞鼻祖，路环总店",
        "area": "路环"
    },
    {
        "name": "永利皇宫",
        "name_en": "Wynn Palace",
        "lat": 22.1460,
        "lng": 113.5630,
        "category": "景点",
        "description": "豪华度假村，观光缆车免费乘坐",
        "area": "氹仔"
    },
    {
        "name": "银河度假城",
        "name_en": "Galaxy Macau",
        "lat": 22.1500,
        "lng": 113.5550,
        "category": "景点",
        "description": "综合度假城，天浪淘园水上乐园",
        "area": "氹仔"
    },
    {
        "name": "新马路",
        "name_en": "Avenida de Almeida Ribeiro",
        "lat": 22.1930,
        "lng": 113.5430,
        "category": "购物",
        "description": "澳门最繁华的商业街",
        "area": "澳门半岛"
    },
    {
        "name": "福隆新街",
        "name_en": "Rua da Felicidade",
        "lat": 22.1920,
        "lng": 113.5410,
        "category": "美食",
        "description": "老字号美食街，红窗门建筑群",
        "area": "澳门半岛"
    },
    {
        "name": "路环市区",
        "name_en": "Coloane Village",
        "lat": 22.1150,
        "lng": 113.5510,
        "category": "景点",
        "description": "宁静渔村风情，彩色小房子",
        "area": "路环"
    },
    {
        "name": "竹湾海滩",
        "name_en": "Cheoc Van Beach",
        "lat": 22.1200,
        "lng": 113.5650,
        "category": "景点",
        "description": "幽静海滩，适合游泳烧烤",
        "area": "路环"
    },
    {
        "name": "十月初五马路",
        "name_en": "Cinco de Outubro",
        "lat": 22.1155,
        "lng": 113.5515,
        "category": "景点",
        "description": "路环海边漫步道，韩剧取景地",
        "area": "路环"
    }
]


def get_attractions_by_category(category: str) -> list:
    """根据类别获取景点"""
    return [a for a in MACAU_ATTRACTIONS if a["category"] == category]


def get_attractions_by_area(area: str) -> list:
    """根据区域获取景点"""
    return [a for a in MACAU_ATTRACTIONS if a["area"] == area]


def search_attractions(keyword: str) -> list:
    """根据关键词搜索景点"""
    keyword = keyword.lower()
    results = []
    for a in MACAU_ATTRACTIONS:
        if (keyword in a["name"].lower() or 
            keyword in a["name_en"].lower() or
            keyword in a["description"].lower() or
            keyword in a["category"].lower()):
            results.append(a)
    return results


def get_attraction_by_name(name: str) -> dict:
    """根据名称获取景点信息"""
    for a in MACAU_ATTRACTIONS:
        if a["name"] == name or a["name_en"] == name:
            return a
    return None


def format_attractions_for_highlight(attractions: list) -> list:
    """
    将景点格式化为地图高亮所需的格式
    返回: [{name, lat, lng, description, category}, ...]
    """
    return [{
        "name": a["name"],
        "lat": a["lat"],
        "lng": a["lng"],
        "description": f"{a['category']} · {a['area']}",
        "category": a["category"],
        "area": a["area"]
    } for a in attractions]


# 常用地点别名映射
LOCATION_ALIASES = {
    "大三巴": "大三巴牌坊",
    "牌坊": "大三巴牌坊",
    "葡京": "新葡京酒店",
    "威尼斯": "威尼斯人",
    "巴黎": "巴黎人",
    "伦敦": "伦敦人",
    "永利": "永利皇宫",
    "银河": "银河度假城",
    "官也": "官也街",
    "塔": "澳门塔",
    "观光塔": "澳门塔",
    "议事亭": "议事亭前地",
    "喷水池": "议事亭前地",
    "妈阁": "妈阁庙",
    "妈祖": "妈阁庙",
    "龙环": "龙环葡韵",
    "黑沙": "黑沙海滩",
    "安德鲁": "安德鲁饼店总店",
    "蛋挞": "安德鲁饼店总店",
    "路环村": "路环市区",
}


def resolve_location_name(name: str) -> str:
    """解析地点别名，返回标准名称"""
    return LOCATION_ALIASES.get(name, name)
