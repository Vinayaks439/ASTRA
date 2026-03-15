"""Competitor Data Puller Agent — scans the web for competitor prices.

Uses SearchAPI (searchapi.io) Google Shopping to find competitor products and prices for each
SKU in the database, then writes hourly comp snapshots and updates the
competitors collection.
"""
from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx

from shared.a2a.models import AgentCard, Message, Skill, Task
from shared.a2a.server import A2AServer, make_completed_task
from shared.config import (
    AGENT_URLS,
    SERP_API_KEY,
)
from shared.mcp.client import (
    query_skus,
    write_comp_snapshot,
    write_competitor,
)

logger = logging.getLogger(__name__)

AGENT_CARD = AgentCard(
    name="competitor-puller-agent",
    description="Scans the web for competitor prices using SerpAPI Google Shopping",
    url=AGENT_URLS["competitor-puller"],
    skills=[
        Skill(
            id="pull-competitor-data",
            name="Pull Competitor Data",
            description="Search the web for competitor prices for all SKUs and update snapshots",
            inputModes=["application/json"],
            outputModes=["application/json"],
        )
    ],
)

_SERP_URL = "https://www.searchapi.io/api/v1/search"


def _parse_price(price_str: str) -> float | None:
    """Extract a float from a price string like '$19.99' or '19.99 USD'."""
    if not price_str:
        return None
    cleaned = re.sub(r"[^\d.]", "", str(price_str))
    try:
        val = float(cleaned)
        return val if val > 0 else None
    except ValueError:
        return None


def _domain(url: str) -> str:
    """Return the hostname from a URL, falling back to 'web'."""
    try:
        return urlparse(url).hostname or "web"
    except Exception:
        return "web"


async def _find_competitor_prices(part_name: str, category: str) -> list[dict]:
    """Use SearchAPI Google Shopping to find live competitor prices."""
    query = f"{part_name} {category}".strip()
    params = {
        "engine": "google_shopping",
        "q": query,
        "api_key": SERP_API_KEY,
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(_SERP_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    results = []
    for item in data.get("shopping_results", []):
        price = _parse_price(item.get("price", ""))
        if price is None:
            continue
        link = item.get("link", "")
        results.append({
            "compName": item.get("source", "Unknown"),
            "platform": _domain(link),
            "competitorPrice": price,
            "storeURL": link,
            "productName": item.get("title", part_name),
        })

    return results


async def handle_task(task_id: str, message: Message) -> Task:
    """A2A task handler — pull competitor prices and update hourly comp snapshot collection."""
    data: dict = {}
    for part in message.parts:
        if part.data:
            data = part.data if isinstance(part.data, dict) else {}

    sku_ids: list[str] = data.get("sku_ids", [])
    skus = await query_skus()
    if sku_ids:
        skus = [s for s in skus if s["id"] in sku_ids]

    now = datetime.now(timezone.utc)
    hour_slot = now.strftime("%Y-%m-%dT%H")

    results = []
    seen_competitors: dict[str, dict] = {}  # key: "compName|platform"

    for sku in skus:
        sku_id = sku["id"]
        part_name = sku.get("partName") or sku.get("partNo") or sku_id
        category = sku.get("category", "")
        own_price = float(sku.get("sellingPrice", 0))

        logger.info("[competitor-puller] sku=%s searching: %s / %s", sku_id, part_name, category)

        try:
            competitors = await _find_competitor_prices(part_name, category)
        except Exception as exc:
            logger.warning("[competitor-puller] sku=%s search error: %s", sku_id, exc)
            results.append({"skuId": sku_id, "status": "error", "error": str(exc)})
            continue

        written = 0
        for comp in competitors:
            comp_price = comp.get("competitorPrice")
            if not isinstance(comp_price, (int, float)) or comp_price <= 0:
                continue

            comp_name = comp.get("compName") or "Unknown"
            platform = comp.get("platform") or "web"
            store_url = comp.get("storeURL") or ""
            product_name = comp.get("productName") or part_name

            comp_key = f"{comp_name}|{platform}"
            if comp_key not in seen_competitors:
                seen_competitors[comp_key] = {
                    "id": f"comp-{uuid.uuid5(uuid.NAMESPACE_URL, comp_key)}",
                    "compName": comp_name,
                    "platform": platform,
                    "storeURL": store_url,
                }

            competitor_id = seen_competitors[comp_key]["id"]
            price_gap_pct = round((own_price - comp_price) / own_price * 100, 2) if own_price > 0 else 0.0

            # ── hourly-comp-snapshots ─────────────────────────────────────────
            await write_comp_snapshot({
                "id": f"cs-hourly-{sku_id}-{competitor_id}-{hour_slot}",
                "skuId": sku_id,
                "partNo": sku.get("partNo", ""),
                "competitorId": competitor_id,
                "compName": comp_name,
                "platform": platform,
                "storeURL": store_url,
                "hourSlot": hour_slot,
                "competitorPrice": comp_price,
                "priceGapPct": price_gap_pct,
                "productName": product_name,
                "scrapedAt": now.isoformat(),
            }, "hourly")

            written += 1

        results.append({"skuId": sku_id, "status": "ok", "competitorsFound": written})

    # Upsert all discovered competitors
    for comp_doc in seen_competitors.values():
        try:
            await write_competitor(comp_doc)
        except Exception as exc:
            logger.warning("[competitor-puller] failed to write competitor %s: %s", comp_doc["id"], exc)

    logger.info(
        "[competitor-puller] done: %d SKUs processed, %d unique competitors",
        len(results), len(seen_competitors),
    )
    return make_completed_task(task_id, "competitor-data", results)


def create_server() -> A2AServer:
    return A2AServer(AGENT_CARD, handle_task)
