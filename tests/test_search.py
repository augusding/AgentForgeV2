import asyncio, aiohttp, re
from urllib.parse import quote

async def test():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }
    print("=== Test Sogou ===")
    url = "https://www.sogou.com/web?query=" + quote("上证指数")
    async with aiohttp.ClientSession() as s:
        async with s.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=10), allow_redirects=True) as r:
            html = await r.text()
            print(f"Status: {r.status}, Length: {len(html)}")
            links = re.findall(r'<h3[^>]*>.*?<a[^>]+href=["\x27]([^"\x27]+)["\x27][^>]*>(.*?)</a>.*?</h3>', html, re.DOTALL)
            print(f"Found {len(links)} results")
            for u, t in links[:3]:
                clean = re.sub(r'<[^>]+>', '', t).strip()
                print(f"  {clean[:50]}: {u[:60]}")
            if not links:
                print(f"HTML snippet: {html[1000:2000]}")

asyncio.run(test())