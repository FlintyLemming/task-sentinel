import logging

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .models import Task

logger = logging.getLogger(__name__)


async def send_telegram_alert(task: Task, reason: str) -> bool:
    if not settings.TELEGRAM_BOT_TOKEN or not settings.TELEGRAM_CHAT_ID:
        logger.warning("Telegram not configured, skipping alert for %s", task.id)
        return False

    emoji = {"offline": "⚫", "failing": "🔴"}.get(reason, "⚠️")
    text = (
        f"{emoji} *Task Sentinel Alert*\n\n"
        f"*Task*: {task.name} (`{task.id}`)\n"
        f"*Status*: {task.status}\n"
        f"*Reason*: {reason}\n"
        f"*Last ping*: {task.last_ping_at.isoformat() if task.last_ping_at else 'Never'}\n"
    )
    if task.last_ping_message:
        text += f"*Last message*: {task.last_ping_message}\n"

    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": settings.TELEGRAM_CHAT_ID,
        "text": text,
        "parse_mode": "Markdown",
    }

    proxy = settings.TELEGRAM_PROXY or None
    async with httpx.AsyncClient(timeout=10, proxy=proxy) as client:
        try:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                logger.info("Telegram alert sent for task %s", task.id)
                return True
            else:
                logger.error("Telegram API error: %s", resp.text)
                return False
        except Exception as e:
            logger.error("Failed to send Telegram alert: %s", e)
            return False
