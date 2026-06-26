import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_auth_check_success(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/check",
        json={"password": "test-admin-pass"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert isinstance(data["token"], str)


@pytest.mark.asyncio
async def test_auth_check_wrong_password(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/check",
        json={"password": "wrong-password"},
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid password"
